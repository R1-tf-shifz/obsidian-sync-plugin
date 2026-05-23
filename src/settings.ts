import { App, PluginSettingTab, Setting, SecretComponent, moment } from "obsidian";
import HelloWorldSandboxPlugin from "./main";

export interface MyPluginSettings {
	host: string;
	login: string;
	password: string;
	vaults_id: Record<string, string>,   //vault - id
	haveAccount: boolean,
	deletedFiles: string[],
	filesHashes: Record<string, FileHash>,
	settingsSaveDelay: string,
	deletedWhileOffline: string[],
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	host: 'http://127.0.0.1:8080',
	login: "",
	password: "",
	vaults_id: {},
	haveAccount: false,
	deletedFiles: [],
	filesHashes: {},
	settingsSaveDelay: "1",
	deletedWhileOffline: [],
}

export class FileHash {
	hash: string;
	isHashChanged = false;

	constructor(hash: string, isHashChanged: boolean) {
		this.hash = hash;
		this.isHashChanged = isHashChanged;
	}
}

export class MySettingsTab extends PluginSettingTab {
	plugin: HelloWorldSandboxPlugin;

	constructor(app: App, plugin: HelloWorldSandboxPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Host')
			.setDesc('Enter ip of your api')
			.addText(text => text
				.setPlaceholder('127.0.0.1:8080')
				.setValue(this.plugin.settings.host)
				.onChange(async (value) => {
					this.plugin.settings.host = value;
					this.plugin.api.Host = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName("Login")
			.setDesc("Enter your login")
			.addText(text => text
				.setPlaceholder("Anonym")
				.setValue(this.plugin.settings.login)
				.onChange(async (value) => {
					this.plugin.settings.login = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName("Password")
			.setDesc("Your password for sync. Select a secret from a secret storage")
			.addComponent(el => new
				SecretComponent(this.app, el)
				.setValue(this.plugin.settings.password)
				.onChange(value => {
					this.plugin.settings.password = value;
					this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName("Settings autosave time")
			.setDesc("Delay between setting saves in minutes. Settings will use after startup")
			.addText(text => text
				//.setPlaceholder("seconds")
				.setValue(moment.duration(this.plugin.settings.settingsSaveDelay, "ms").asMinutes().toString())
				.onChange(async (value) => {
					let duration = moment.duration(value, "m");
					this.plugin.settings.settingsSaveDelay = duration.asMilliseconds().toString();
					await this.plugin.saveSettings();
				}));
	}
}
