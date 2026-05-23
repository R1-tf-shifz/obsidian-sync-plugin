import { CryptoManager } from "cryptoManager";
import HelloWorldSandboxPlugin from "main";
import { TFile, TFolder, Vault } from "obsidian";
import { FileHash } from "settings";
import { removeSlashes } from "slashes";

export class FileManager {
	app: HelloWorldSandboxPlugin;
	vault: Vault;
	crypto: CryptoManager;

	constructor(app: HelloWorldSandboxPlugin) {
		this.app = app;
		this.vault = app.app.vault;
		this.crypto = new CryptoManager();
	}

	getTFile(path: string) {
		let file = this.vault.getAbstractFileByPath(path);

		if (file == null) {
			return null;
		}

		if (file instanceof TFolder) {
			return null;
		}

		return file as TFile
	}

	async getFiles() {
		let filesRaw: TFile[] = this.vault.getFiles();
		let preparedFiles: File[] = [];

		for (let i = 0; i < filesRaw.length; i++) {
			let file = filesRaw[i];

			if (file === undefined || file === null) {
				continue;
			}

			let hash = await this.getHash(file);
			let preparedFile = new File(
				file.path,
				hash,
				file
			);
			preparedFiles.push(preparedFile);

		}

		return preparedFiles;
	}

	async getHash(file: TFile) {
		let fileHash = this.app.settings.filesHashes[file.path];

		if (fileHash !== undefined && !fileHash.isHashChanged) {
			return fileHash.hash;
		}

		console.log(`hash changed: ${file.basename}`);

		let payload = await this.vault.process(file, (data) => {
			return data;
		});

		let hash = this.crypto.hash(payload);
		this.app.settings.filesHashes[file.path] = new FileHash(hash, false);
		await this.app.saveSettings();
		return hash;
	}

	async writeToFile(payload: string, path: string) {
		let file = this.vault.getAbstractFileByPath(path);

		if (file instanceof TFolder) {
			throw new Error("File is a folder!");
		}

		if (file === null) {
			await this.createFileAndWritePayload(payload, path);
			return;
		}

		let text = removeSlashes(payload);
		text = FileManager.trimPayload(text);
		await this.vault.process(file as TFile, (data) => {
			data = text;
			return text;
		});
	}

	async createFileAndWritePayload(payload: string, path: string) {
		let text = removeSlashes(payload);
		text = FileManager.trimPayload(text);

		let file = await this.vault.create(path, text)
			.catch(async () => {
				await this.createFoldersForFile(path);
				await this.createFileAndWritePayload(text, path);
			})

		return file;
	}

	static trimPayload(payload: string) {
		if (!payload.startsWith('"') && !payload.endsWith('"')) {
			return payload;
		}
		return payload.substring(1, payload.length - 1);
	}

	async createFoldersForFile(path: string) {
		let pathSplit = path.split("/");

		if (pathSplit.length <= 1) {
			return;
		}

		let curPath = pathSplit[0] ?? "";

		for (let i = 0; i < pathSplit.length - 1; i++) {

			if (i !== 0) {
				curPath += "/" + pathSplit[i];
			}

			try {
				console.log(`path ${curPath}`);
				await this.vault.createFolder(curPath);
			} catch {
				continue;
			}
		}
	}

	async readPayload(path: string) {
		let file = this.vault.getAbstractFileByPath(path);

		if (file == null || file instanceof TFolder) {
			return null;
		}

		let payload = await this.vault.process(file as TFile, (data) => data);
		return payload;
	}

	async deleteFile(path: string) {
		let file = this.vault.getAbstractFileByPath(path);

		if (file === null || file instanceof TFolder) {
			return false;
		}

		await this.vault.delete(file as TFile);
		return true;
	}
}

export class File {
	path: string
	hash: string
	tfile: TFile

	constructor(path: string, hash: string, tfile: TFile) {
		this.path = path;
		this.hash = hash;
		this.tfile = tfile;
	}
}
