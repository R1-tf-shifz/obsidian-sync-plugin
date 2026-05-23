import { Notice, Plugin, TFile } from 'obsidian';
import { DEFAULT_SETTINGS, MyPluginSettings, MySettingsTab } from "./settings";
import { Api } from 'api';
import { Sync, WebError } from 'sync';

// Remember to rename these classes and interfaces!

export default class HelloWorldSandboxPlugin extends Plugin {
	settings: MyPluginSettings;
	api: Api;
	sync: Sync;
	offline: boolean;

	async onload() {
		this.offline = false;
		await this.loadSettings();
		this.api = new Api(this.settings.host);
		this.sync = new Sync(this, this.api);

		await this.sync.authorization()
			.then(() => {
				new Notice("Succesfull startup authorization!");
			})
			.catch((e) => {

				if (e.message === "net::ERR_CONNECTION_REFUSED") {
					this.offline = true;
					console.log('offline mode!');
				}

				new Notice(`Failed to authorize: ${e}`);
			});

		// This creates an icon in the left ribbon.
		this.addRibbonIcon('refresh-cw', 'Sync', () => {
			this.sync.fullSync()
				.then(() => new Notice("Synced!"))
				.catch((e) => {

					if (!(e instanceof WebError)) {
						new Notice(`${e.message}`);
						return;
					}

					let webErr = e as WebError;

					if (webErr.status === 401) {
						this.sync.authorization().catch((e) => {
							new Notice(`Failed to login in account. Try On First Enter Command | ${e}`);
						});

						this.sync.fullSync().catch((e) => {
							new Notice(`Failed to sync | ${e}`);
						});

					} else if (webErr.status === 409) {
						new Notice("Unique violation | Vault, login or etc");
					} else {
						new Notice(`Something failed: ${e} | Web: ${webErr.message} | status ${webErr.status}`);
					}
				});
		});

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'on-first-enter',
			name: 'On First Enter',
			callback: () => {
				this.sync.firstEnter()
					.then(() => new Notice("Synced!"))
					.catch((e) => {

						if (e instanceof WebError) {
							new Notice(`WebError | status: ${e.status} | message ${e.message}`)
						}

						new Notice(`Failed to sync | Error: ${e}`);

					})
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new MySettingsTab(this.app, this));

		this.registerEvent(this.app.vault.on("delete", (file: TFile) => {
			this.onFileDelete(file.path);
		}))

		this.registerEvent(this.app.vault.on("modify", (file: TFile) => {
			let fileHash = this.settings.filesHashes[file.path];

			if (fileHash !== undefined && !fileHash.isHashChanged) {
				fileHash.isHashChanged = true;
			}
		}))

		this.registerInterval(window.setInterval(() => {
			this.saveSettings().then(() => console.log("settings saved"));
		}, +this.settings.settingsSaveDelay));

		this.app.workspace.onLayoutReady(() => {
			this.sync.fullSync()
				.then(() => new Notice("Succesfull startup sync!"))
				.catch((e) => {
					let webErr = e as WebError;
					new Notice(`Failed to sync on startup ${e.message} | code: ${webErr.status}`);
				});
		})

		this.createRestoreCommands();
	}

	createRestoreCommands() {
		for (let i = 0; i < this.settings.deletedFiles.length; i++) {
			let path = this.settings.deletedFiles[i];

			if (path === undefined) {
				continue;
			}

			this.addCommand({
				id: `restore ${path}`,
				name: `restore: ${path}`,
				callback: () => {
					this.sync.restoreFile(path)
						.then(() => {
							new Notice("File Succesfull restored");
						})
						.catch((e) => {
							let webE = e as WebError;
							new Notice(`${webE.message} | ${webE.status}`);
						});
				}
			});
		}
	}

	onFileDelete(path: string) {
		// create command and add path to settings
		if (this.settings.deletedFiles.contains(path)) {
			console.log("Duplicate command skipped");
			return;
		}

		this.sync.deleteFile(path)
			.then(() => {

				this.addCommand({
					id: `restore ${path}`,
					name: `restore: ${path}`,
					callback: () => {
						this.sync.restoreFile(path)
							.then(() => {
								new Notice("File Succesfull restored");
							})
							.catch((e) => {
								let webE = e as WebError;
								new Notice(`${webE.message} | ${webE.status}`);
							});
					}
				});

				this.settings.deletedFiles.push(path);
				return this.saveSettings();
			})
			.then(() => new Notice("File deleted"))
			.catch((e) => {
				let webE = e as WebError;

				new Notice(`${webE.message} | ${webE.status}`);
			});
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<MyPluginSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	get Settings() {
		return this.settings;
	}
}
