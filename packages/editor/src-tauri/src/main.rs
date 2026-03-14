#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::mod_io::read_mod_data,
            commands::mod_io::write_mod_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
