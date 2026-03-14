use tokio::process::Command as AsyncCommand;

/// Render ASCII using a sidecar engine (jimp, chafa, jp2a)
#[tauri::command]
pub async fn render_ascii_sidecar(
    engine: String,
    png_path: String,
    width: u32,
    charset: String,
    _colored: bool,
    _invert: bool,
    _contrast: f32,
) -> Result<String, String> {
    // Get the sidecar path at compile time using env!
    let sidecar_path = env!("CARGO_MANIFEST_DIR");
    let node_sidecar = format!("{}/sidecars/node-sprite.cjs", sidecar_path);

    match engine.as_str() {
        "jimp" => {
            let output = AsyncCommand::new("node")
                .arg(&node_sidecar)
                .arg("--engine=jimp")
                .arg(format!("--width={}", width))
                .arg(format!("--charset={}", charset))
                .arg(&png_path)
                .output()
                .await
                .map_err(|e| format!("Failed to run jimp sidecar: {}", e))?;
            if !output.status.success() {
                return Err(String::from_utf8_lossy(&output.stderr).to_string());
            }

            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        }
        "chafa" => {
            let output = AsyncCommand::new("chafa")
                .args(["-w", &width.to_string()])
                .arg(&png_path)
                .output()
                .await
                .map_err(|e| format!("Failed to run chafa: {e}"))?;

            if !output.status.success() {
                return Err(String::from_utf8_lossy(&output.stderr).to_string());
            }

            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        }
        "jp2a" => {
            let output = AsyncCommand::new("jp2a")
                .args(["--width", &width.to_string()])
                .arg(&png_path)
                .output()
                .await
                .map_err(|e| format!("Failed to run jp2a: {e}"))?;

            if !output.status.success() {
                return Err(String::from_utf8_lossy(&output.stderr).to_string());
            }

            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        }
        _ => Err(format!("Unknown engine: {}", engine)),
    }
}
