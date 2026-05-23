import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex } from "@noble/hashes/utils.js";
import { FileManager } from "fileManager";

export class CryptoManager {
	constructor() { }

	hash(payload: string) {
		payload = FileManager.trimPayload(payload);
		let hash = sha256(Uint8Array.from(payload));
		let hex = bytesToHex(hash);
		return hex;
	}
}
