use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit, Nonce};
use chrono::{DateTime, Utc};
use ed25519_dalek::{VerifyingKey, Signature};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use tauri::api::path::app_data_dir;

const SALT: &[u8] = b"CARISOFT_LICENSE_SALT_2026_SECURE";
const PUBLIC_KEY_B64: &str = "8fq3bGylqk50LrLbpV4URKQeuP4HyrNNoRuUc1G1ZvU=";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LicenseState {
    pub token: String,
    pub last_seen_ts: i64,
    pub status: String,
    pub days_remaining: i64,
    pub tenant_id: String,
    pub expires_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TokenPayload {
    pub key: String,
    pub tenantId: String,
    pub machineId: String,
    pub activatedAt: String,
    pub expiresAt: String,
    pub serverTime: String,
}

pub fn get_machine_hardware_id() -> Result<String, String> {
    let raw_id = machine_uid::get().map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    hasher.update(raw_id.as_bytes());
    Ok(hex::encode(hasher.finalize()))
}

fn derive_encryption_key(hwid: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(hwid.as_bytes());
    hasher.update(SALT);
    let result = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    key
}

fn encrypt_data(data: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| e.to_string())?;
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher.encrypt(nonce, data).map_err(|e| e.to_string())?;
    let mut combined = nonce_bytes.to_vec();
    combined.extend(ciphertext);
    Ok(combined)
}

fn decrypt_data(encrypted: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, String> {
    if encrypted.len() < 12 {
        return Err("Données chiffrées trop courtes".into());
    }
    let (nonce_bytes, ciphertext) = encrypted.split_at(12);
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher.decrypt(nonce, ciphertext).map_err(|e| e.to_string())
}

fn save_state(app_handle: &tauri::AppHandle, state: &LicenseState) -> Result<(), String> {
    let hwid = get_machine_hardware_id()?;
    let enc_key = derive_encryption_key(&hwid);
    let json_bytes = serde_json::to_vec(state).map_err(|e| e.to_string())?;
    let encrypted = encrypt_data(&json_bytes, &enc_key)?;

    if let Some(app_dir) = app_data_dir(app_handle.config()) {
        let _ = fs::create_dir_all(&app_dir);
        let file_path = app_dir.join("license.dat");
        let _ = fs::write(file_path, &encrypted);
    }

    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        use winreg::RegValue;
        if let Ok(hkcu) = RegKey::predef(HKEY_CURRENT_USER).create_subkey("Software\\Carisoft\\License") {
            let reg_val = RegValue {
                vtype: REG_BINARY,
                bytes: encrypted,
            };
            let _ = hkcu.0.set_raw_value("Data", &reg_val);
        }
    }

    Ok(())
}

fn load_state(app_handle: &tauri::AppHandle) -> Result<Option<LicenseState>, String> {
    let hwid = get_machine_hardware_id()?;
    let enc_key = derive_encryption_key(&hwid);

    let app_dir = app_data_dir(app_handle.config());
    let file_path = app_dir.map(|d| d.join("license.dat"));

    #[cfg(target_os = "windows")]
    let reg_data = {
        use winreg::enums::*;
        use winreg::RegKey;
        RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey("Software\\Carisoft\\License")
            .and_then(|key| key.get_raw_value("Data").map(|rv| rv.bytes))
            .ok()
    };
    #[cfg(not(target_os = "windows"))]
    let reg_data: Option<Vec<u8>> = None;

    let mut raw_bytes: Option<Vec<u8>> = None;
    if let Some(fp) = file_path {
        if fp.exists() {
            if let Ok(bytes) = fs::read(fp) {
                raw_bytes = Some(bytes);
            }
        }
    }
    if raw_bytes.is_none() {
        raw_bytes = reg_data;
    }

    let Some(encrypted_bytes) = raw_bytes else {
        return Ok(None);
    };

    let decrypted = decrypt_data(&encrypted_bytes, &enc_key).map_err(|_| "tampered".to_string())?;
    let state: LicenseState = serde_json::from_slice(&decrypted).map_err(|_| "tampered".to_string())?;
    Ok(Some(state))
}

fn verify_token_signature(token: &str, hwid: &str) -> Result<TokenPayload, String> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 2 {
        return Err("Format de jeton invalide".into());
    }

    let payload_bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, parts[0])
        .map_err(|_| "Erreur décodage payload base64".to_string())?;
    let sig_bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, parts[1])
        .map_err(|_| "Erreur décodage signature base64".to_string())?;

    let pub_key_bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, PUBLIC_KEY_B64)
        .map_err(|_| "Erreur décodage clé publique".to_string())?;

    if pub_key_bytes.len() != 32 {
        return Err("Taille clé publique Ed25519 invalide".into());
    }

    let mut key_arr = [0u8; 32];
    key_arr.copy_from_slice(&pub_key_bytes);
    let verifying_key = VerifyingKey::from_bytes(&key_arr).map_err(|_| "Clé publique Ed25519 invalide".to_string())?;

    if sig_bytes.len() != 64 {
        return Err("Taille signature invalide".into());
    }
    let mut sig_arr = [0u8; 64];
    sig_arr.copy_from_slice(&sig_bytes);
    let signature = Signature::from_bytes(&sig_arr);

    verifying_key.verify_strict(&payload_bytes, &signature).map_err(|_| "Signature Ed25519 invalide (tampered)".to_string())?;

    let payload: TokenPayload = serde_json::from_slice(&payload_bytes).map_err(|_| "Payload JSON invalide".to_string())?;

    if payload.machineId != hwid {
        return Err("MachineId du jeton incompatible avec cet ordinateur".into());
    }

    Ok(payload)
}

#[tauri::command]
pub async fn license_activate(
    app_handle: tauri::AppHandle,
    key: String,
    tenant_id: String,
) -> Result<LicenseState, String> {
    let hwid = get_machine_hardware_id()?;

    let client = reqwest::Client::new();
    let res = client
        .post("https://carisoft.vercel.app/api/activate-license")
        .json(&serde_json::json!({
            "key": key,
            "machineId": hwid,
            "tenantId": tenant_id
        }))
        .send()
        .await
        .map_err(|e| format!("Erreur réseau lors de l'activation: {}", e))?;

    let res_json: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Erreur lecture réponse serveur: {}", e))?;

    if res_json["success"].as_bool() != Some(true) {
        let err_msg = res_json["error"].as_str().unwrap_or("Échec de l'activation de la licence.");
        return Err(err_msg.into());
    }

    let token = res_json["token"].as_str().ok_or("Jeton manquant dans la réponse")?.to_string();
    let payload = verify_token_signature(&token, &hwid)?;

    let server_dt = DateTime::parse_from_rfc3339(&payload.serverTime).map_err(|e| e.to_string())?;
    let server_ts = server_dt.timestamp();
    let local_now = Utc::now().timestamp();

    let exp_dt = DateTime::parse_from_rfc3339(&payload.expiresAt).map_err(|e| e.to_string())?;
    let exp_ts = exp_dt.timestamp();

    if std::cmp::max(local_now, server_ts) > exp_ts {
        return Err("Cette licence a expiré.".into());
    }

    let days_remaining = std::cmp::max(0, (exp_ts - std::cmp::max(local_now, server_ts) + 86399) / 86400);

    let state = LicenseState {
        token,
        last_seen_ts: server_ts,
        status: "active".into(),
        days_remaining,
        tenant_id: payload.tenantId,
        expires_at: payload.expiresAt,
    };

    save_state(&app_handle, &state)?;
    Ok(state)
}

#[tauri::command]
pub async fn license_status(app_handle: tauri::AppHandle) -> Result<LicenseState, String> {
    let hwid = get_machine_hardware_id()?;
    let now_wall = Utc::now().timestamp();

    let Some(mut state) = load_state(&app_handle)? else {
        return Ok(LicenseState {
            token: "".into(),
            last_seen_ts: now_wall,
            status: "none".into(),
            days_remaining: 0,
            tenant_id: "".into(),
            expires_at: "".into(),
        });
    };

    if state.token.is_empty() {
        state.status = "none".into();
        return Ok(state);
    }

    match verify_token_signature(&state.token, &hwid) {
        Ok(payload) => {
            let server_dt = DateTime::parse_from_rfc3339(&payload.serverTime).map_err(|e| e.to_string())?;
            let server_ts = server_dt.timestamp();

            if now_wall < server_ts - 86400 {
                state.status = "tampered".into();
                return Ok(state);
            }

            if let Ok(exp_dt) = DateTime::parse_from_rfc3339(&payload.expiresAt) {
                let exp_ts = exp_dt.timestamp();
                let effective_now = std::cmp::max(now_wall, server_ts);

                if effective_now > exp_ts {
                    state.status = "expired".into();
                } else {
                    state.days_remaining = std::cmp::max(0, (exp_ts - effective_now + 86399) / 86400);
                    state.tenant_id = payload.tenantId;
                    state.expires_at = payload.expiresAt;

                    let act_dt = DateTime::parse_from_rfc3339(&payload.activatedAt).unwrap_or(server_dt);
                    let total_duration_days = (exp_ts - act_dt.timestamp()) / 86400;
                    let max_offline_sec = if total_duration_days <= 30 { 3 * 86400 } else { 14 * 86400 };

                    if let Ok(client) = reqwest::Client::builder().timeout(std::time::Duration::from_secs(5)).build() {
                        if let Ok(res) = client.post("https://carisoft.vercel.app/api/check-license")
                            .json(&serde_json::json!({ "key": payload.key, "machineId": hwid }))
                            .send().await {
                            if let Ok(json) = res.json::<serde_json::Value>().await {
                                if json["success"].as_bool() == Some(true) {
                                    if let Some(st) = json["status"].as_str() {
                                        if st == "revoked" || st == "expired" || st == "invalid" || st == "unused" || st == "not_found" {
                                            state.status = if st == "not_found" { "revoked".into() } else { st.into() };
                                        } else {
                                            state.status = "active".into();
                                            if let Some(tok) = json["token"].as_str() {
                                                state.token = tok.to_string();
                                                if let Ok(new_payload) = verify_token_signature(tok, &hwid) {
                                                    if let Ok(new_sdt) = DateTime::parse_from_rfc3339(&new_payload.serverTime) {
                                                        state.last_seen_ts = new_sdt.timestamp();
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if now_wall - server_ts > max_offline_sec {
                        state.status = "locked_offline".into();
                    } else if state.status != "revoked" && state.status != "expired" && state.status != "invalid" {
                        state.status = "active".into();
                    }
                }
            }
        }
        Err(_) => {
            state.status = "invalid".into();
        }
    }

    let _ = save_state(&app_handle, &state);
    Ok(state)
}

#[tauri::command]
pub fn license_diagnostics(app_handle: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let hwid = get_machine_hardware_id().unwrap_or_default();
    let state = load_state(&app_handle).ok().flatten();
    Ok(serde_json::json!({
        "hardwareId": hwid,
        "hasState": state.is_some(),
        "status": state.as_ref().map(|s| s.status.clone()).unwrap_or_else(|| "none".into()),
        "daysRemaining": state.as_ref().map(|s| s.days_remaining).unwrap_or(0),
    }))
}

#[tauri::command]
pub async fn license_admin(app_handle: tauri::AppHandle, action: String) -> Result<serde_json::Value, String> {
    if action == "reset" {
        if let Some(app_dir) = app_data_dir(app_handle.config()) {
            let file_path = app_dir.join("license.dat");
            let _ = fs::remove_file(file_path);
        }
        #[cfg(target_os = "windows")]
        {
            use winreg::enums::*;
            use winreg::RegKey;
            if let Ok(hkcu) = RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags("Software\\Carisoft", KEY_WRITE) {
                let _ = hkcu.delete_subkey("License");
            }
        }
        return Ok(serde_json::json!({ "success": true }));
    }
    Err("Action admin inconnue".into())
}
