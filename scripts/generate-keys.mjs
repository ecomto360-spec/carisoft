import nacl from 'tweetnacl';

const keyPair = nacl.sign.keyPair();
const publicKeyBase64 = Buffer.from(keyPair.publicKey).toString('base64');
const privateKeyBase64 = Buffer.from(keyPair.secretKey).toString('base64');

console.log("=== PAIRE DE CLÉS ED25519 (CARISOFT.next) ===");
console.log("PUBLIC_KEY_BASE64=" + publicKeyBase64);
console.log("PRIVATE_KEY_BASE64=" + privateKeyBase64);
