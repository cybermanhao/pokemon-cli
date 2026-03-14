use std::path::PathBuf;

/// Resolve the PokeAPI GitHub CDN URL for a sprite variant.
pub fn sprite_url(id: u32, variant: &str) -> String {
    let base = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
    match variant {
        "front" => format!("{base}/{id}.png"),
        "back" => format!("{base}/back/{id}.png"),
        "frontShiny" => format!("{base}/shiny/{id}.png"),
        "backShiny" => format!("{base}/back/shiny/{id}.png"),
        _ => format!("{base}/{id}.png"),
    }
}

/// Returns the local cache path for a downloaded PNG.
/// `~/.pokemon-cli/sprites/png/{id}_{variant}.png`
pub fn png_cache_path(id: u32, variant: &str) -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".into());
    PathBuf::from(home)
        .join(".pokemon-cli")
        .join("sprites")
        .join("png")
        .join(format!("{id}_{variant}.png"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sprite_url_front() {
        assert_eq!(
            sprite_url(25, "front"),
            "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png"
        );
    }

    #[test]
    fn sprite_url_back_shiny() {
        assert_eq!(
            sprite_url(25, "backShiny"),
            "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/shiny/25.png"
        );
    }

    #[test]
    fn sprite_url_unknown_variant_defaults_to_front() {
        let url = sprite_url(1, "bogus");
        assert!(url.ends_with("/1.png"));
    }

    #[test]
    fn png_cache_path_structure() {
        let p = png_cache_path(25, "front");
        let s = p.to_string_lossy();
        assert!(s.contains(".pokemon-cli"));
        assert!(s.ends_with("25_front.png"));
    }
}

/// Download sprite PNG for `id`+`variant` to the local PNG cache.
/// Returns the absolute path to the saved file.
/// If already cached, returns the cached path without re-downloading.
#[tauri::command]
pub async fn fetch_sprite_png(id: u32, variant: String) -> Result<String, String> {
    let path = png_cache_path(id, &variant);

    if path.exists() {
        return Ok(path.to_string_lossy().into_owned());
    }

    // Ensure cache dir
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create cache dir: {e}"))?;
    }

    let url = sprite_url(id, &variant);
    let bytes = reqwest::get(&url)
        .await
        .map_err(|e| format!("HTTP error: {e}"))?
        .error_for_status()
        .map_err(|e| format!("HTTP status error: {e}"))?
        .bytes()
        .await
        .map_err(|e| format!("Failed to read bytes: {e}"))?;

    std::fs::write(&path, &bytes).map_err(|e| format!("Failed to write PNG: {e}"))?;

    Ok(path.to_string_lossy().into_owned())
}
