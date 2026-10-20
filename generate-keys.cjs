import nacl from 'tweetnacl';

// Générer une paire de clés Ed25519
const keyPair = nacl.sign.keyPair();

// Convertir en base64
const privateKeyBase64 = Buffer.from(keyPair.secretKey).toString('base64');
const publicKeyBase64 = Buffer.from(keyPair.publicKey).toString('base64');

console.log('========================================');
console.log('  CLÉS ED25519 POUR CARISOFT');
console.log('========================================');
console.log('');
console.log('🔑 CLÉ PRIVÉE (à mettre dans Vercel) :');
console.log('Variable : LICENSE_PRIVATE_KEY');
console.log('Valeur   :', privateKeyBase64);
console.log('');
console.log('🔓 CLÉ PUBLIQUE (à mettre dans license.rs) :');
console.log('Fichier  : src-tauri/src/license.rs');
console.log('Ligne    : const PUBLIC_KEY_BASE64 = "...";');
console.log('Valeur   :', publicKeyBase64);
console.log('');
console.log('========================================');
console.log('⚠️  IMPORTANT :');
console.log('- Gardez la clé PRIVÉE secrète (Vercel uniquement)');
console.log('- La clé PUBLIQUE peut être dans le code client');
console.log('- Sauvegardez ces deux clés dans un fichier sécurisé');
console.log('========================================');