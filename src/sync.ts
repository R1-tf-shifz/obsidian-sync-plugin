import { Api, Note } from "api";
import { User, Result } from "entities";
import HelloWorldSandboxPlugin from "main";
import { File, FileManager } from "fileManager";
import { MyPluginSettings } from "settings";
import { removeSlashes } from "slashes";


export class Sync {
	plugin: HelloWorldSandboxPlugin
	api: Api
	settings: MyPluginSettings
	fileManager: FileManager
	#jwt: string

	constructor(plugin: HelloWorldSandboxPlugin, api: Api) {
		this.api = api;
		this.plugin = plugin;
		this.settings = plugin.settings;
		this.fileManager = new FileManager(plugin);
	}

	async parseDeletedWhileOfflineFiles() {
		let files = this.plugin.settings.deletedWhileOffline;

		if (this.plugin.offline || files.length === 0) {
			return;
		}

		let requestsToDelete = [];

		for (let i = 0; i < files.length; i++) {
			let file = files[i];

			if (file === undefined) {
				continue;
			}

			requestsToDelete.push(this.deleteFile(file));
		}

		await Promise.all(requestsToDelete);
		this.plugin.settings.deletedWhileOffline = [];
		await this.plugin.saveSettings();
	}

	async deleteFile(path: string) {
		let vaultID = this.getVaultID();

		if (vaultID === undefined) {
			return;
		}

		let response = await this.api.getDelete(this.#jwt, vaultID, path);

		if (response.status !== 200) {
			throw new WebError(response.status, "Failed to delete file on server");
		}
	}

	async restoreFile(path: string) {
		if (this.plugin.offline) {
			throw new Error("offline state. Skip command. Wait for connection and try again");
		}

		let vaultID = this.getVaultID();

		if (vaultID === undefined) {
			return;
		}

		let response = await this.api.getRestoreFile(this.#jwt, vaultID, path);

		if (response.status !== 200) {
			throw new WebError(response.status, "Failed to receive file");
		}

		await this.fileManager.writeToFile(response.body, path);
		this.plugin.removeCommand(`restore ${path}`);
		this.plugin.settings.deletedFiles.remove(path);
		await this.plugin.saveSettings();
	}

	async fullSync() {
		if (this.plugin.offline) {
			throw new Error("Current state is offline. Faile to connect server, so, your actions will be cached (deleting files)");
		}

		if (this.#jwt === undefined) {
			await this.authorization();
		}

		let filesMeta = await this.fileManager.getFiles();

		if (filesMeta.length === 0) {
			console.log("0 files fetched!");
			return;
		}

		let parsedFiles = this.parseFilesForUpdate(filesMeta);
		let vaultID = this.getVaultID();

		if (vaultID === undefined) {
			console.log("Failed to get vault id. Maybe this vault doesnt have id");
			vaultID = await this.createVaultOnServer();
		}

		let response = await this.api.postUpdate(this.#jwt, parsedFiles, vaultID ?? "");

		if (response.status !== 200) {
			throw new WebError(response.status, `Failed to sync things | ${response.body}`);
		}

		let json = JSON.parse(response.body);
		console.log(response.body);
		let sendToServer = json["req"];
		let getFromServer = json["res"];
		let deleted = json["deleted"];

		await Promise.allSettled([
			this.sendFilesToServer(sendToServer),
			this.getFilesFromServer(getFromServer),
			this.parseDeletedFiles(deleted),
			this.parseDeletedWhileOfflineFiles()
		]);
	}

	async sendFilesToServer(files: any) {
		let requests: Promise<Result | undefined>[] = []
		let vault_id = this.getVaultID();
		let failedToSend: string[] = []

		if (vault_id === undefined) {
			throw new Error("Failed to get vault id");
		}

		for (let i = 0; i < files.length; i++) {
			let req = this.fileManager.readPayload(files[i])
				.then((payload) => {

					if (payload === null) {
						failedToSend.push(files[i]);
						return;
					}

					let file = this.fileManager.getTFile(files[i]);

					if (file === null) {
						failedToSend.push(files[i]);
						return;
					}

					let hash = this.fileManager.crypto.hash(payload);
					payload = removeSlashes(payload);

					let timestamp = new Date(file.stat.mtime).toISOString();
					let note = new Note(payload, timestamp, hash);

					return this.api.putFile(this.#jwt, note, vault_id, files[i]);
				});

			requests.push(req);
		}

		let allReqs = await Promise.allSettled(requests);

		allReqs.forEach(result => {
			if (result === undefined) {
				return;
			}

			if (result.status === "rejected") {
				return;
			}

			let resOfReq = result.value;

			if (resOfReq !== undefined && resOfReq.status !== 200) {
				throw new WebError(resOfReq.status, resOfReq.body);
			}
		});

		console.log(`failed to push: ${JSON.stringify(failedToSend)}`)
		return failedToSend;
	}

	async getFilesFromServer(files: any) {
		let requests: Promise<void>[] = [];
		let vaultID = this.getVaultID();

		if (vaultID === undefined) {
			throw new Error("Failed to get vault id");
		}

		for (let i = 0; i < files.length; i++) {

			let req = this.api.getFile(
				this.#jwt,
				vaultID,
				files[i]
			)
				.then((response) => {
					if (response.status !== 200) {
						console.log(`failed to get file: ${files[i]} | ${response.body} | ${response.status}`);
						return;
					}

					return this.fileManager.writeToFile(response.body, files[i]);
				});

			requests.push(req);
		}

		await Promise.allSettled(requests);
	}

	async parseDeletedFiles(files: any) {
		let myDeleted = this.plugin.settings.deletedFiles;
		let reallyDeleted = [];
		let deleteThis = [];

		for (let i = 0; i < myDeleted.length; i++) {

			if (files.contains(myDeleted[i])) {
				files.remove(myDeleted[i])
				reallyDeleted.push(myDeleted[i])
			}
		}

		for (let i = 0; i < files.length; i++) {
			reallyDeleted.push(files[i])
			deleteThis.push(this.fileManager.deleteFile(files[i]))
		}

		console.log(`reallyDeleted: ${reallyDeleted} (need to be equal to the myDeleted)`)
		console.log(`myDeleted: ${myDeleted}`);

		this.settings.deletedFiles = reallyDeleted;
		await this.plugin.saveSettings();

		await Promise.allSettled(deleteThis);
	}


	async createVaultOnServer() {
		let vaultName = this.fileManager.vault.getName();
		let vaultIDRaw = await this.api.postVault(this.#jwt, vaultName);

		if (vaultIDRaw.status !== 200) {
			throw new WebError(vaultIDRaw.status, `${vaultIDRaw.body}`)
		}

		let json = JSON.parse(vaultIDRaw.body);
		let vaultID = json["id"];

		if (vaultID === undefined) {
			return null;
		}

		this.settings.vaults_id[vaultName] = vaultID;
		await this.plugin.saveSettings();
		return vaultID;
	}

	async firstEnter() {
		if (this.plugin.settings.haveAccount) {
			return;
		}

		try {
			await this.registration();
		} catch {
			//will work if user have account
			await this.authorization();
			this.settings.haveAccount = true;
		}

		if (this.#jwt === null || this.#jwt === "") {
			await this.authorization();
			this.settings.haveAccount = true;
		}

		let response = await this.api.getVaults(this.#jwt);
		let vaultName = this.fileManager.vault.getName();

		if (response.status === 200) {

			let json = JSON.parse(response.body);
			let vaultID: string = "";

			for (let i = 0; i < json.length; i++) {
				let dirName = json[i]["name"] ?? "";

				if (dirName === vaultName) {
					vaultID = json[i]["id"];
					this.settings.vaults_id[vaultName] = vaultID;
					await this.plugin.saveSettings();
					await this.fullSync();
					return;
				}
			}
		}

		let vaultID = await this.createVaultOnServer();

		if (vaultID === null) {
			throw new Error("Failed to create vault and sync things");
		}

		await this.fullSync();
	}

	async authorization() {
		let user = this.createUser();

		if (user instanceof Error) {
			throw user;
		}

		let response = await this.api.postLogin(user);

		if (response.status === 401) {
			throw new WebError(response.status, "Login or password are incorrect");
		}

		let json = JSON.parse(response.body);
		this.#jwt = json["jwt"];
		return;
	}

	async registration() {
		let user = this.createUser();

		if (user instanceof Error) {
			throw user;
		}

		let response = await this.api.postRegister(user);

		if (response.status === 409) {
			throw new WebError(response.status, response.body);
		} else if (response.status === 201) {
			return;
		}

		throw new WebError(response.status, response.body);
	}

	getVaultID() {
		let vaultName = this.fileManager.vault.getName();
		let id = this.settings.vaults_id[vaultName];
		return id;
	}

	parseFileForUpdate(file: File) {
		let timestamp = new Date(file.tfile.stat.mtime).toISOString();
		let obj = {
			[`${file.path}`]: [file.hash, timestamp]
		}
		return obj;
	}

	parseFilesForUpdate(files: File[]) {
		let parsedFiles: object = {};
		files.forEach(file => {
			let parsedFile = this.parseFileForUpdate(file);
			parsedFiles = Object.assign(parsedFiles, parsedFile);
		});
		return parsedFiles;
	}

	createUser() {
		let password = this.getPassword();

		if (password === null) {
			return new Error("Set password in settings!");
		}

		let user = new User(
			this.settings.login,
			password
		);
		return user;
	}

	getPassword() {
		return this.plugin.app.secretStorage.getSecret(this.settings.password);
	}
}

export class WebError extends Error {
	status: Number
	constructor(status: Number, message: string) {
		super(message);
		this.status = status;
	}
}
