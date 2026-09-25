# Système de Licence Offline (Tauri + Ed25519)

Ce document décrit l'implémentation complète et sécurisée d'un système de vérification de licence 100% hors-ligne pour CARISOFT.next, basé sur la cryptographie asymétrique (Ed25519) et lié au matériel (MachineID).

## TÂCHE 1 : BACKEND (Node.js) - Générateur de Licence

Créez un fichier `license-generator.js` sur votre machine ou serveur sécurisé. Ce script n'est **jamais** distribué avec l'application.

```javascript
const crypto = require('crypto');

// 1. Générer une nouvelle paire de clés (À NE FAIRE QU'UNE SEULE FOIS)
function generateKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  
  // Exporter la clé publique en format RAW (32 octets) pour l'intégrer dans le code Rust
  const pubKeyRaw = publicKey.export({ type: 'raw', format: 'der' });
  console.log("=== CLÉ PUBLIQUE (À COPIER DANS RUST) ===");
  console.log(`[${pubKeyRaw.join(', ')}]`);

  return { publicKey, privateKey };
}

// 2. Générer une licence pour un client
function generateLicense(machineId, daysValid, privateKey) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + daysValid);
  const expiresAtStr = expiresAt.toISOString().split('T')[0];

  const payload = {
    machineId: machineId,
    expiresAt: expiresAtStr,
    plan: "PRO"
  };

  const payloadStr = JSON.stringify(payload);
  
  // Encodage Base64URL (sans padding)
  const payloadB64 = Buffer.from(payloadStr).toString('base64url');

  // Signer le payload avec la clé privée
  const signature = crypto.sign(null, Buffer.from(payloadStr), privateKey);
  const signatureB64 = signature.toString('base64url');

  // Format de la licence : payload.signature
  const licenseKey = `${payloadB64}.${signatureB64}`;
  
  return licenseKey;
}

// --- EXEMPLE D'UTILISATION ---
// 1. Génération des clés
const keys = generateKeys();

// 2. Le client vous envoie son MachineID généré par Tauri
const clientMachineId = "12345678-ABCD-EFGH-IJKL-987654321000"; // Exemple

// 3. Vous générez une licence valide pour 365 jours
const license = generateLicense(clientMachineId, 365, keys.privateKey);
console.log("\n=== CLÉ DE LICENCE (À ENVOYER AU CLIENT) ===");
console.log(license);
```

## TÂCHE 2 : SYSTÈME (Rust / Tauri v2) - Machine ID & Validation

Dans votre projet Tauri (`src-tauri/Cargo.toml`), ajoutez ces dépendances :
```toml
[dependencies]
tauri = { version = "2.0.0", features = [] }
tauri-plugin-store = "2.0.0"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
winreg = "0.52" # Pour lire l'ID matériel Windows
ed25519-dalek = "2.1" # Cryptographie
base64 = "0.22"
chrono = "0.4"
```

Modifiez votre `src-tauri/src/main.rs` :

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::command;
use winreg::enums::*;
use winreg::RegKey;
use ed25519_dalek::{Verifier, Signature, VerifyingKey};
use serde::{Deserialize, Serialize};
use chrono::NaiveDate;
use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};

// Structure du payload JSON
#[derive(Deserialize, Serialize)]
#[allow(non_snake_case)]
struct LicensePayload {
    machineId: String,
    expiresAt: String,
    plan: String,
}

// Commande 1 : Obtenir l'ID unique de la machine (UUID Windows)
#[command]
fn get_machine_id() -> Result<String, String> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let crypto_key = hklm.open_subkey("SOFTWARE\\Microsoft\\Cryptography")
        .map_err(|e| format!("Erreur registre: {}", e))?;
    let machine_guid: String = crypto_key.get_value("MachineGuid")
        .map_err(|e| format!("Erreur lecture GUID: {}", e))?;
    Ok(machine_guid.to_uppercase())
}

// Commande 2 : Vérifier la licence
#[command]
fn verify_license(license_key: String) -> Result<LicensePayload, String> {
    let parts: Vec<&str> = license_key.split('.').collect();
    if parts.len() != 2 {
        return Err("Format de licence invalide.".into());
    }

    let payload_b64 = parts[0];
    let signature_b64 = parts[1];

    let payload_bytes = URL_SAFE_NO_PAD.decode(payload_b64).map_err(|_| "Payload corrompu.")?;
    let signature_bytes = URL_SAFE_NO_PAD.decode(signature_b64).map_err(|_| "Signature corrompue.")?;

    if signature_bytes.len() != 64 {
        return Err("Signature cryptographique invalide.".into());
    }

    // REMPLACEZ CE TABLEAU PAR LA CLÉ PUBLIQUE GÉNÉRÉE PAR VOTRE SCRIPT NODE.JS (32 octets)
    let public_key_bytes: [u8; 32] = [
        12, 34, 56, 78, /* ... collez les 32 nombres ici ... */ 90
    ];

    // Vérification cryptographique Ed25519
    let verifying_key = VerifyingKey::from_bytes(&public_key_bytes)
        .map_err(|_| "Clé publique système corrompue.")?;
    
    let signature = Signature::from_bytes(signature_bytes.as_slice().try_into().unwrap());

    verifying_key.verify(&payload_bytes, &signature)
        .map_err(|_| "ALERTE: Signature invalide. Clé contrefaite.")?;

    // Si on arrive ici, la cryptographie est valide. On vérifie les règles métier.
    let payload_str = String::from_utf8(payload_bytes).map_err(|_| "Encodage invalide.")?;
    let payload: LicensePayload = serde_json::from_str(&payload_str).map_err(|_| "Données de licence illisibles.")?;

    // 1. Vérifier le Machine ID
    let current_machine_id = get_machine_id()?;
    if payload.machineId.to_uppercase() != current_machine_id {
        return Err("Cette licence appartient à un autre ordinateur.".into());
    }

    // 2. Vérifier l'expiration
    let expiration_date = NaiveDate::parse_from_str(&payload.expiresAt, "%Y-%m-%d")
        .map_err(|_| "Format de date d'expiration invalide.")?;
    let today = chrono::Local::now().date_naive();

    if today > expiration_date {
        return Err(format!("Licence expirée depuis le {}.", payload.expiresAt));
    }

    Ok(payload) // Retourne les données pour les sauvegarder côté React
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![get_machine_id, verify_license])
        .run(tauri::generate_context!())
        .expect("Erreur lors de l'initialisation de CARISOFT");
}
```
