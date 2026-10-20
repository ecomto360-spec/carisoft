use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::PathBuf;
use chrono::{Utc, Duration};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use ed25519_dalek::{VerifyingKey, Signature, Verifier};
use sha2::{Digest, Sha256};

const API_BASE: &str = "https://carisoft.vercel.app";
// ✅ CLÉ PUBLIQUE CORRECTE (correspond à la clé privée dans Vercel)
const PUBLIC_KEY_BASE64: &str = "8fq3bGylqk50LrLbpV4URKQeuP4HyrNNoRuUc1G1ZvU="; 

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LicenseData {
    pub key: String,
    pub tenant_id: String,
    pub token: String,
    pub machine_id: String,
    pub activated_at: i64,
    pub expires_at: i64,
    pub last_seen_at: i64,
    pub last_online_check_at: i64,
}

#[derive(Serialize, Debug)]
pub struct LicenseStatus {
    pub valid: bool,
    pub status: String, // "active", "expired", "revoked", "invalid", "tampered", "online_required", "none"
    pub days_remaining: i64,
    pub expires_at: Option<i64>,
    pub message: String,
}

#[derive(Serialize, Debug)]
pub struct Diagnostics {
    pub environnement: String,
    pub machine_id_prefix: String,
    pub app_data_path: String,
    pub fichier_licence_present: bool,
    pub resultat_test_api: String,
}

fn get_machine_id() -> Result<String, String> {
    match machine_uid::get() {
        Ok(raw_id) => {
            let mut hasher = Sha256::new();
            hasher.update(raw_id.as_bytes());
            Ok(hex::encode(hasher.finalize()))
        }
        Err(e) => Err(format!("Erreur machine-uid: {}", e)),
    }
}

fn get_license_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let path = app_handle.path_resolver().app_data_dir()
        .ok_or_else(|| "Impossible de déterminer le dossier de données".to_string())?;
    fs::create_dir_all(&path).map_err(|e| format!("Erreur création dossier: {}", e))?;
    Ok(path.join("license.dat"))
}

fn verify_token_signature(token: &str, local_machine_id: &str, tenant_id: &str) -> Result<serde_json::Value, String> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 2 {
        return Err("Format de jeton invalide".to_string());
    }

    let payload_bytes = STANDARD.decode(parts[0]).map_err(|_| "Décodage payload échoué")?;
    let sig_bytes = STANDARD.decode(parts[1]).map_err(|_| "Décodage signature échoué")?;
    
    let signature = Signature::from_slice(&sig_bytes).map_err(|_| "Signature invalide")?;
    let pk_bytes = STANDARD.decode(PUBLIC_KEY_BASE64).map_err(|_| "Clé publique invalide")?;
    let pk_array: [u8; 32] = pk_bytes.try_into().map_err(|_| "Taille clé publique incorrecte")?;
    let verifying_key = VerifyingKey::from_bytes(&pk_array).map_err(|_| "Clé publique corrompue")?;

    verifying_key.verify(&payload_bytes, &signature).map_err(|_| "Échec de la vérification cryptographique")?;

    let payload: serde_json::Value = serde_json::from_slice(&payload_bytes).map_err(|_| "Payload JSON invalide")?;
    
    if payload["machineId"].as_str().unwrap_or("") != local_machine_id {
        return Err("Licence liée à un autre ordinateur".to_string());
    }
    if payload["tenantId"].as_str().unwrap_or("") != tenant_id {
        return Err("Tenant ID invalide".to_string());
    }

    Ok(payload)
}

#[tauri::command]
pub async fn license_activate(app_handle: tauri::AppHandle, key: String, tenant_id: String) -> Result<LicenseStatus, String> {
    let local_machine_id = get_machine_id()?;
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(15)).build().map_err(|e| e.to_string())?;

    let response = client.post(format!("{}/api/activate-license", API_BASE))
        .json(&json!({ "key": key, "tenantId": tenant_id, "machineId": local_machine_id }))
        .send().await.map_err(|e| format!("Erreur réseau: {}", e))?;

    if !response.status().is_success() {
        let err_text = response.text().await.unwrap_or_else(|_| "Erreur serveur".to_string());
        return Err(format!("Activation refusée: {}", err_text));
    }

    let res_json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let token = res_json["token"].as_str().ok_or("Jeton manquant dans la réponse")?.to_string();
    let server_time_str = res_json["serverTime"].as_str().ok_or("serverTime manquant")?;
    
    let server_time = chrono::DateTime::parse_from_rfc3339(server_time_str)
        .map_err(|_| "Format date serveur invalide")?.with_timezone(&Utc);
    let now = Utc::now();

    if (now - server_time).abs() > Duration::minutes(10) {
        return Ok(LicenseStatus {
            valid: false, status: "tampered".into(), days_remaining: 0, expires_at: None,
            message: "Horloge système incorrecte (écart > 10 min avec le serveur).".to_string(),
        });
    }

    let payload = verify_token_signature(&token, &local_machine_id, &tenant_id)?;
    
    let activated_at_str = payload["activatedAt"].as_str().unwrap_or("");
    let expires_at_str = payload["expiresAt"].as_str().unwrap_or("");

    let activated_at = chrono::DateTime::parse_from_rfc3339(activated_at_str)
        .map(|dt| dt.with_timezone(&Utc).timestamp())
        .unwrap_or(now.timestamp());

    let expires_at = chrono::DateTime::parse_from_rfc3339(expires_at_str)
        .map(|dt| dt.with_timezone(&Utc).timestamp())
        .unwrap_or(0);

    let license_data = LicenseData {
        key, tenant_id, token, machine_id: local_machine_id,
        activated_at, expires_at, last_seen_at: now.timestamp(), last_online_check_at: now.timestamp(),
    };

    let path = get_license_path(&app_handle)?;
    let temp_path = path.with_extension("tmp");
    fs::write(&temp_path, serde_json::to_string(&license_data).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    fs::rename(&temp_path, &path).map_err(|e| e.to_string())?;

    let days_remaining = ((expires_at - now.timestamp()) / 86400).max(0);
    Ok(LicenseStatus {
        valid: true, status: "active".into(), days_remaining, expires_at: Some(expires_at),
        message: "Licence activée avec succès.".to_string(),
    })
}

#[tauri::command]
pub async fn license_status(app_handle: tauri::AppHandle, tenant_id: String) -> Result<LicenseStatus, String> {
    let path = match get_license_path(&app_handle) {
        Ok(p) => p,
        Err(_) => return Ok(LicenseStatus { valid: false, status: "none".into(), days_remaining: 0, expires_at: None, message: "Aucune licence trouvée.".to_string() }),
    };

    if !path.exists() {
        return Ok(LicenseStatus { valid: false, status: "none".into(), days_remaining: 0, expires_at: None, message: "Aucune licence trouvée.".to_string() });
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let data: LicenseData = serde_json::from_str(&content).map_err(|_| "Fichier de licence corrompu".to_string())?;
    let now = Utc::now();

    let local_machine_id = get_machine_id()?;
    if let Err(e) = verify_token_signature(&data.token, &local_machine_id, &tenant_id) {
        return Ok(LicenseStatus { valid: false, status: "tampered".into(), days_remaining: 0, expires_at: None, message: format!("Licence altérée: {}", e) });
    }

    if now.timestamp() < data.activated_at - 300 || now.timestamp() < data.last_seen_at - 300 {
        return Ok(LicenseStatus { valid: false, status: "tampered".into(), days_remaining: 0, expires_at: None, message: "Détection de recul de l'horloge système.".to_string() });
    }

    if now.timestamp() > data.expires_at {
        return Ok(LicenseStatus { valid: false, status: "expired".into(), days_remaining: 0, expires_at: Some(data.expires_at), message: "La licence a expiré.".to_string() });
    }

    let mut needs_update = false;
    let mut is_revoked = false;
    let mut check_failed = false;

    if now.timestamp() - data.last_online_check_at > 3600 {
        let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(5)).build().unwrap();
        let res = client.post(format!("{}/api/check-license", API_BASE))
            .json(&json!({ "key": data.key, "tenantId": tenant_id, "machineId": local_machine_id }))
            .send().await;
        
        needs_update = true;
        match res {
            Ok(resp) => {
                if resp.status().is_success() {
                    let json_resp: serde_json::Value = resp.json().await.unwrap_or(json!({}));
                    if json_resp["status"].as_str() == Some("revoked") {
                        is_revoked = true;
                    }
                } else {
                    check_failed = true;
                }
            }
            Err(_) => {
                check_failed = true;
            }
        }
    }

    if now.timestamp() - data.last_online_check_at > 1209600 && check_failed {
         return Ok(LicenseStatus { 
             valid: false, 
             status: "online_required".into(), 
             days_remaining: ((data.expires_at - now.timestamp()) / 86400).max(0), 
             expires_at: Some(data.expires_at), 
             message: "Vérification en ligne requise (plus de 14 jours sans connexion valide).".to_string() 
         });
    }

    if is_revoked {
        return Ok(LicenseStatus { valid: false, status: "revoked".into(), days_remaining: 0, expires_at: Some(data.expires_at), message: "Cette licence a été révoquée par l'administrateur.".to_string() });
    }

    let mut updated_data = data.clone();
    updated_data.last_seen_at = now.timestamp();
    if needs_update && !check_failed { 
        updated_data.last_online_check_at = now.timestamp(); 
    }
    
    let temp_path = path.with_extension("tmp");
    fs::write(&temp_path, serde_json::to_string(&updated_data).unwrap()).ok();
    fs::rename(&temp_path, &path).ok();

    let days_remaining = ((data.expires_at - now.timestamp()) / 86400).max(0);
    Ok(LicenseStatus {
        valid: true, status: "active".into(), days_remaining, expires_at: Some(data.expires_at),
        message: "Licence valide.".to_string(),
    })
}

#[tauri::command]
pub async fn license_diagnostics(app_handle: tauri::AppHandle) -> Result<Diagnostics, String> {
    let machine_id = get_machine_id().unwrap_or_else(|_| "inconnu".to_string());
    let prefix = if machine_id.len() >= 8 { machine_id[..8].to_string() } else { machine_id };
    let path = get_license_path(&app_handle).unwrap_or_else(|_| PathBuf::from("inconnu"));
    let file_exists = path.exists();

    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(5)).build().unwrap();
    let api_test = client.post(format!("{}/api/check-license", API_BASE))
        .json(&json!({ "key": "CARI-TEST-0000-0000-0000", "tenantId": "test", "machineId": "test" }))
        .send().await;

    let api_result = match api_test {
        Ok(resp) => format!("HTTP {}", resp.status()),
        Err(e) => format!("Échec: {}", e),
    };

    Ok(Diagnostics {
        environnement: "tauri".to_string(),
        machine_id_prefix: prefix,
        app_data_path: path.to_string_lossy().to_string(),
        fichier_licence_present: file_exists,
        resultat_test_api: api_result,
    })
}

#[tauri::command]
pub async fn license_admin(action: String, id_token: String, params: serde_json::Value) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let res = client.post(format!("{}/api/admin-licenses", API_BASE))
        .header("Authorization", format!("Bearer {}", id_token))
        .json(&json!({ "action": action, "params": params }))
        .send().await.map_err(|e| e.to_string())?;
    
    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;
    
    if status.is_success() {
        serde_json::from_str(&text).map_err(|e| e.to_string())
    } else {
        Err(format!("Erreur API Admin ({}): {}", status, text))
    }
}