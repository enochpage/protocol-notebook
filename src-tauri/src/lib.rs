mod vault;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(vault::Vault(std::sync::Mutex::new(
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../data/vault"),
        )))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            vault::load_workspace,
            vault::save_workspace,
            vault::save_asset,
            vault::read_asset
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
