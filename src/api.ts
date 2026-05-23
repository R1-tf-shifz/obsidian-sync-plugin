import { requestUrl } from "obsidian";
import { URL } from "url";
import { User, Result } from "entities";

export class Api {

	private static _base_host: string; //= HelloWorldSandboxPlugin.host();

	constructor(host: string) {
		Api._base_host = host;
	}

	CreateURL(url: string) {
		try {
			return new URL(url, Api._base_host).toString();
		} catch {
			let res = Api._base_host;
			res += url.startsWith("/") ? url : "/" + url;
			console.log(`failed to use URL | url ${res}`);
			return res;
		}
	}

	async getHealth() {
		let url = this.CreateURL("/health");

		let response = await requestUrl({
			url: url,
			throw: false
		});
		return new Result(response.status, response.text);
	}

	async postRegister(user: User) {
		let url = this.CreateURL("/register");
		let body = JSON.stringify(user);

		let response = await requestUrl({
			url: url,
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: body,
			throw: false
		});
		if (response.status === 409) {
			return new Result(response.status, "User with that name already exists");
		}
		return new Result(response.status, response.text);
	}

	async postLogin(user: User) {
		let url = this.CreateURL("/login");
		let body = JSON.stringify(user);

		let response = await requestUrl({
			url: url,
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: body,
			throw: false
		});
		return new Result(response.status, response.text);
	}

	async getMe(jwt: string) {
		let url = this.CreateURL("/api/me");
		let header = this.createHeader(jwt);

		let response = await requestUrl({
			url: url,
			method: "GET",
			headers: {
				"Authorization": header
			},
			throw: false
		});
		return new Result(response.status, response.text)
	}

	async postVault(jwt: string, name: string) {
		let url = this.CreateURL("/api/vault");
		console.log(`url ${url} | name: ${name} | jwt: ${jwt}`)

		let header = this.createHeader(jwt);
		let body = JSON.stringify(name);

		let response = await requestUrl({
			headers: {
				"Authorization": header,
				"Content-Type": "application/json"
			},
			body: body,
			method: "POST",
			throw: false,
			url: url
		});
		return new Result(response.status, response.text)
	}

	async getVaults(jwt: string) {
		let url = this.CreateURL("/api/vaults");
		let header = this.createHeader(jwt);

		let response = await requestUrl({
			headers: {
				"Authorization": header
			},
			method: "GET",
			throw: false,
			url: url
		});
		return new Result(response.status, response.text)
	}

	async putFile(jwt: string, payload: Note, vault_id: string, path: string) {
		let url = this.CreateURL(`/api/vaults/${vault_id}/put_file/${path}`);
		let header = this.createHeader(jwt);
		let body = JSON.stringify(payload);

		let response = await requestUrl({
			headers: {
				"Authorization": header,
				"Content-Type": "application/json"
			},
			body: body,
			method: "PUT",
			throw: false,
			url: url
		});
		return new Result(response.status, response.text)
	}

	async postUpdate(jwt: string, files: object, vault_id: string) {
		let url = this.CreateURL(`/api/vaults/${vault_id}/update`);
		let header = this.createHeader(jwt);
		let body = JSON.stringify(files);

		let response = await requestUrl({
			headers: {
				"Authorization": header,
				"Content-Type": "application/json",
			},
			body: body,
			method: "POST",
			throw: false,
			url: url
		});
		return new Result(response.status, response.text)
	}

	async getDelete(jwt: string, vault_id: string, path: string) {
		let url = this.CreateURL(`/api/vaults/${vault_id}/delete/${path}`);
		let header = this.createHeader(jwt);

		let response = await requestUrl({
			headers: {
				"Authorization": header
			},
			method: "GET",
			throw: false,
			url: url
		});
		return new Result(response.status, response.text)
	}

	async getFile(jwt: string, vault_id: string, path: string) {
		let url = this.CreateURL(`/api/vaults/${vault_id}/get_file/${path}`);
		let header = this.createHeader(jwt);

		let response = await requestUrl({
			headers: {
				"Authorization": header
			},
			method: "GET",
			throw: false,
			url: url
		});
		return new Result(response.status, response.text)
	}

	async getRestoreFile(jwt: string, vault_id: string, path: string) {
		let url = this.CreateURL(`/api/vaults/${vault_id}/restore_file/${path}`);
		let header = this.createHeader(jwt);

		let response = await requestUrl({
			headers: {
				"Authorization": header
			},
			method: "GET",
			throw: false,
			url: url
		});
		return new Result(response.status, response.text)
	}

	createHeader(jwt: string) {
		return `Bearer ${jwt}`
	}

	get Host() {
		return Api._base_host
	}

	set Host(value) {
		Api._base_host = value;
	}
}

export class Note {
	payload: string
	timestamp: string
	hash: string

	constructor(payload: string, timestamp: string, hash: string) {
		this.payload = payload;
		this.timestamp = timestamp;
		this.hash = hash;
	}
}
