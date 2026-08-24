import { mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { webcrypto } from "node:crypto";

const [privatePath, publicPath] = process.argv.slice(2);
if (!privatePath || !publicPath) throw new Error("Usage: node generate-portfolio-keypair.mjs <private-path> <public-path>");
const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const privateJwk = await webcrypto.subtle.exportKey("jwk", pair.privateKey);
const publicJwk = await webcrypto.subtle.exportKey("jwk", pair.publicKey);
mkdirSync(new URL(".", `file://${privatePath}`).pathname, { recursive: true });
writeFileSync(privatePath, JSON.stringify(privateJwk));
writeFileSync(publicPath, JSON.stringify(publicJwk));
chmodSync(privatePath, 0o600);
console.log(`Generated key pair. Private key stored securely at ${privatePath}; public key stored at ${publicPath}.`);
