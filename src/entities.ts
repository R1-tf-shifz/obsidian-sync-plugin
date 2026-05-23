
export class User {
	password: string
	login: string
	constructor(login: string, password: string) {
		this.login = login;
		this.password = password;
	}
}

export class Result {
	status: Number
	body: string
	constructor(status: Number, body: string) {
		this.status = status;
		this.body = body;
	}
}

