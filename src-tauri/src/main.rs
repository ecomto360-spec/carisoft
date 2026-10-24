#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use sha2::{Digest, Sha256};

mod license;

/// Commande Tauri retournant l'identifiant matériel unique de la machine,
/// hashé en SHA-256 pour assurer anonymat et empreinte infalsifiable.
#[tauri::command]
fn get_machine_id() -> Result<String, String> {
    match machine_uid::get() {
        Ok(raw_id) => {
            let mut hasher = Sha256::new();
            hasher.update(raw_id.as_bytes());
            let result = hasher.finalize();
            Ok(hex::encode(result))
        }
        Err(err) => Err(format!(
            "Erreur lors de la récupération de l'identifiant machine: {}",
            err
        )),
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_machine_id,
            license::license_activate,
            license::license_status,
            license::license_diagnostics,
            license::license_admin
        ])
        .run(tauri::generate_context!())
        .expect("Erreur lors de l'exécution de l'application CARISOFT Tauri");
}
