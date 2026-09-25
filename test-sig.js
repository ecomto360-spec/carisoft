const crypto = require('crypto');
const LICENSE_SECRET = 'CARISOFT_SUPERADMIN_RSA_SIGN_KEY_NABSTERZERO_2026';
const cleanCompany = 'SARLMAHAJI';
const timestamp = parseInt('MU481IPH', 36);
const planTag = 'TRIAL';
const payloadStr = `${cleanCompany}|${timestamp}|${planTag}|${LICENSE_SECRET}`;

const sigBuffer = crypto.createHash('sha256').update(payloadStr).digest();
const sigHex = sigBuffer.toString('hex').toUpperCase();
const expectedShortSig = sigHex.slice(0, 8);
console.log("Expected Sig:", expectedShortSig);
console.log("Payload:", payloadStr);
