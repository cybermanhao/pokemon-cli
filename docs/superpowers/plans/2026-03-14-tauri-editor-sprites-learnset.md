# Tauri Editor — Sprite Studio & Learnset Editor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Sprite Studio (multi-engine ASCII generation with visual comparison, batch fetch, config persistence) and the Learnset Editor (read-only Gen 9 level-up / egg / TM tables).

**Architecture:** Tauri Rust backend handles PNG download and ASCII generation (native engine + binary/Node sidecars). The React frontend displays side-by-side engine outputs with a unified config panel. Learnset data is queried via `@pkmn/data` `gen.learnsets.get()` entirely in the browser.

**Tech Stack:** Tauri 2.x, Rust (`image` crate, `reqwest`), Node.js sidecar (Jimp, CJS), `chafa` binary, `jp2a` binary, React 18, `@pkmn/dex`, `@pkmn/data`

**Prerequisite:** Plan A (foundation) must be complete — `mod_io.rs`, tab shell, and shared state in App.jsx are assumed to exist.

**Spec:** `docs/superpowers/specs/2026-03-14-tauri-editor-design.md` (Sections 4, 5, 8, 9)

---

## Chunk 1: Rust — Sprite Fetch + Native ASCII Engine

### File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/editor/src-tauri/Cargo.toml` | Add reqwest, tokio |
| Create | `packages/editor/src-tauri/src/commands/sprite_fetch.rs` | Download PNG → temp file |
| Create | `packages/editor/src-tauri/src/commands/ascii_native.rs` | Brightness + Braille ASCII engine |
| Modify | `packages/editor/src-tauri/src/commands/mod.rs` | Add new modules |
| Modify | `packages/editor/src-tauri/src/main.rs` | Register new commands |
| Modify | `packages/editor/src-tauri/capabilities/default.json` | Add http + shell permissions |

---

### Task 1: Add Cargo dependencies for network and async

**Files:**
- Modify: `packages/editor/src-tauri/Cargo.toml`

- [ ] **Step 1: Add reqwest and tokio to Cargo.toml**

Add to `[dependencies]`:

```toml
reqwest = { version = "0.12", default-features = false, features = ["rustls-tls", "stream"] }
tokio = { version = "1", features = ["full"] }
```

`reqwest 0.12` uses `rustls` (no OpenSSL dependency, simpler Windows build). Tauri 2 already uses tokio internally.

- [ ] **Step 2: Cargo check**

```bash
cd packages/editor/src-tauri && cargo check
```

Expected: no errors (warnings about unused imports are OK)

- [ ] **Step 3: Commit**

```bash
git add packages/editor/src-tauri/Cargo.toml
git commit -m "chore(editor): add reqwest + tokio to Cargo deps"
```

---

### Task 2: sprite_fetch.rs — download PNG to temp file

**Files:**
- Create: `packages/editor/src-tauri/src/commands/sprite_fetch.rs`

**Context:** The Tauri IPC command downloads a sprite PNG and saves it to a temp file, returning the path. All ASCII engines (Rust and sidecars) receive this path rather than raw bytes, avoiding IPC byte-array inflation.

PokéAPI GitHub sprites CDN is used directly (no API rate limit):
- front: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png`
- back: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/{id}.png`
- frontShiny: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/{id}.png`
- backShiny: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/shiny/{id}.png`

- [ ] **Step 1: Write unit tests first**

Create `packages/editor/src-tauri/src/commands/sprite_fetch.rs`:

```rust
use std::path::PathBuf;

/// Resolve the PokeAPI GitHub CDN URL for a sprite variant.
pub fn sprite_url(id: u32, variant: &str) -> String {
    let base = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
    match variant {
        "front"      => format!("{base}/{id}.png"),
        "back"       => format!("{base}/back/{id}.png"),
        "frontShiny" => format!("{base}/shiny/{id}.png"),
        "backShiny"  => format!("{base}/back/shiny/{id}.png"),
        _            => format!("{base}/{id}.png"),
    }
}

/// Returns the local cache path for a downloaded PNG.
/// `~/.pokemon-cli/sprites/png/{id}_{variant}.png`
pub fn png_cache_path(id: u32, variant: &str) -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".into());
    PathBuf::from(home)
        .join(".pokemon-cli").join("sprites").join("png")
        .join(format!("{id}_{variant}.png"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sprite_url_front() {
        assert_eq!(sprite_url(25, "front"), "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png");
    }

    #[test]
    fn sprite_url_back_shiny() {
        assert_eq!(sprite_url(25, "backShiny"), "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/shiny/25.png");
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
    let bytes = reqwest::get(&url).await
        .map_err(|e| format!("HTTP error: {e}"))?
        .error_for_status()
        .map_err(|e| format!("HTTP status error: {e}"))?
        .bytes().await
        .map_err(|e| format!("Failed to read bytes: {e}"))?;

    std::fs::write(&path, &bytes)
        .map_err(|e| format!("Failed to write PNG: {e}"))?;

    Ok(path.to_string_lossy().into_owned())
}
```

- [ ] **Step 2: Run tests**

```bash
cd packages/editor/src-tauri && cargo test commands::sprite_fetch
```

Expected: 4 tests pass (no network needed — tests only check URL construction and path structure)

- [ ] **Step 3: Commit**

```bash
git add packages/editor/src-tauri/src/commands/sprite_fetch.rs
git commit -m "feat(editor): sprite_fetch Rust command — download PNG to cache"
```

---

### Task 3: ascii_native.rs — brightness + Braille ASCII engine

**Files:**
- Create: `packages/editor/src-tauri/src/commands/ascii_native.rs`

**Context:** Two rendering modes:
1. **Brightness mapping** — resize image to `width × height`, map each pixel's brightness to a character in the charset.
2. **Braille** — resize image to `width*2 × height*4` pixels, group into 2×4 blocks, map each dot to a Braille bit flag.

Aspect ratio correction: `auto_height = round(width * (img_h / img_w) * 0.5)`.
ANSI true-color output: `\x1b[38;2;R;G;Bm<char>\x1b[0m` per pixel.
Alpha threshold: pixels with `alpha < 64` render as space regardless of brightness.

- [ ] **Step 1: Write tests first**

Create `packages/editor/src-tauri/src/commands/ascii_native.rs`:

```rust
use image::{DynamicImage, GenericImageView, Rgba};
use serde::Deserialize;

#[derive(Deserialize, Clone)]
pub struct AsciiConfig {
    pub width: u32,
    pub height: Option<u32>,    // None = auto from aspect ratio
    pub charset: String,         // "dense" | "simple" | "blocks" | "braille" | custom string
    pub colored: bool,
    pub invert: bool,
    pub contrast: f32,           // -100.0 to +100.0 (applied before mapping)
}

impl AsciiConfig {
    pub fn charset_chars(&self) -> &str {
        match self.charset.as_str() {
            "dense"  => " .:-=+*#%@",
            "simple" => " .+*#@",
            "blocks" => " \u{2591}\u{2592}\u{2593}\u{2588}",
            "braille" => "",  // handled separately
            other    => other,
        }
    }

    pub fn effective_height(&self, img_w: u32, img_h: u32) -> u32 {
        self.height.unwrap_or_else(|| {
            // Aspect ratio correction: terminal cells are ~2:1 height:width
            ((self.width as f32) * (img_h as f32 / img_w as f32) * 0.5).round() as u32
        }).max(1)
    }
}

fn apply_contrast(brightness: f32, contrast: f32) -> f32 {
    let factor = (259.0 * (contrast + 255.0)) / (255.0 * (259.0 - contrast));
    let v = factor * (brightness - 128.0) + 128.0;
    v.clamp(0.0, 255.0)
}

fn ansi_true_color(r: u8, g: u8, b: u8, ch: &str) -> String {
    format!("\x1b[38;2;{r};{g};{b}m{ch}\x1b[0m")
}

fn pixel_to_char(r: u8, g: u8, b: u8, a: u8, config: &AsciiConfig) -> String {
    if a < 64 { return " ".to_string(); }
    let chars = config.charset_chars();
    let brightness = 0.299 * r as f32 + 0.587 * g as f32 + 0.114 * b as f32;
    let brightness = apply_contrast(brightness, config.contrast);
    let brightness = if config.invert { 255.0 - brightness } else { brightness };
    let idx = ((brightness / 255.0) * (chars.chars().count() - 1) as f32).round() as usize;
    let ch = chars.chars().nth(idx).unwrap_or(' ').to_string();
    if config.colored {
        ansi_true_color(r, g, b, &ch)
    } else {
        ch
    }
}

/// Braille rendering: each Braille char covers a 2×4 pixel block.
/// Dot bit layout:
///   col=0,row=0 → 0x01    col=1,row=0 → 0x08
///   col=0,row=1 → 0x02    col=1,row=1 → 0x10
///   col=0,row=2 → 0x04    col=1,row=2 → 0x20
///   col=0,row=3 → 0x40    col=1,row=3 → 0x80
const BRAILLE_BITS: [[u8; 2]; 4] = [
    [0x01, 0x08],
    [0x02, 0x10],
    [0x04, 0x20],
    [0x40, 0x80],
];
const BRAILLE_BASE: u32 = 0x2800;
const BRAILLE_THRESHOLD: f32 = 128.0;

fn render_braille(img: &DynamicImage, config: &AsciiConfig) -> Vec<String> {
    let h = config.effective_height(img.width(), img.height());
    let w = config.width;
    // Scale image to (w*2) × (h*4) so each char cell maps to a 2×4 pixel block
    let scaled = img.resize_exact(w * 2, h * 4, image::imageops::FilterType::Lanczos3);
    let mut lines = Vec::new();
    for char_row in 0..h {
        let mut line = String::new();
        for char_col in 0..w {
            let mut bitmask: u8 = 0;
            let mut sum_r: u32 = 0; let mut sum_g: u32 = 0; let mut sum_b: u32 = 0;
            let mut visible: u32 = 0;
            for dot_row in 0..4u32 {
                for dot_col in 0..2u32 {
                    let px = char_col * 2 + dot_col;
                    let py = char_row * 4 + dot_row;
                    let Rgba([r, g, b, a]) = scaled.get_pixel(px, py);
                    if a < 64 { continue; }
                    let brightness = 0.299 * r as f32 + 0.587 * g as f32 + 0.114 * b as f32;
                    let brightness = apply_contrast(brightness, config.contrast);
                    let brightness = if config.invert { 255.0 - brightness } else { brightness };
                    if brightness > BRAILLE_THRESHOLD {
                        bitmask |= BRAILLE_BITS[dot_row as usize][dot_col as usize];
                    }
                    sum_r += r as u32; sum_g += g as u32; sum_b += b as u32;
                    visible += 1;
                }
            }
            let braille_char = char::from_u32(BRAILLE_BASE + bitmask as u32).unwrap_or('⠀');
            let ch = braille_char.to_string();
            if config.colored && visible > 0 {
                let r = (sum_r / visible) as u8;
                let g = (sum_g / visible) as u8;
                let b = (sum_b / visible) as u8;
                line.push_str(&ansi_true_color(r, g, b, &ch));
            } else {
                line.push_str(&ch);
            }
        }
        lines.push(line);
    }
    lines
}

pub fn render_ascii_from_image(img: &DynamicImage, config: &AsciiConfig) -> Vec<String> {
    if config.charset == "braille" {
        return render_braille(img, config);
    }
    let h = config.effective_height(img.width(), img.height());
    let scaled = img.resize_exact(config.width, h, image::imageops::FilterType::Lanczos3);
    let mut lines = Vec::new();
    for y in 0..h {
        let mut line = String::new();
        for x in 0..config.width {
            let Rgba([r, g, b, a]) = scaled.get_pixel(x, y);
            line.push_str(&pixel_to_char(r, g, b, a, config));
        }
        lines.push(line);
    }
    lines
}

#[tauri::command]
pub fn render_ascii(png_path: String, config: AsciiConfig) -> Result<Vec<String>, String> {
    let img = image::open(&png_path)
        .map_err(|e| format!("Failed to open PNG at {png_path}: {e}"))?;
    Ok(render_ascii_from_image(&img, &config))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn default_config() -> AsciiConfig {
        AsciiConfig {
            width: 8,
            height: None,
            charset: "dense".into(),
            colored: false,
            invert: false,
            contrast: 0.0,
        }
    }

    #[test]
    fn charset_chars_dense() {
        let c = default_config();
        assert_eq!(c.charset_chars(), " .:-=+*#%@");
    }

    #[test]
    fn charset_chars_braille_is_empty() {
        let mut c = default_config();
        c.charset = "braille".into();
        assert_eq!(c.charset_chars(), "");
    }

    #[test]
    fn effective_height_auto_square_image() {
        // 100×100 image, width=32 → height should be ~16 (0.5 aspect correction)
        let c = default_config();
        let h = c.effective_height(100, 100);
        assert_eq!(h, 4); // width=8, 8 * (100/100) * 0.5 = 4
    }

    #[test]
    fn effective_height_explicit_override() {
        let mut c = default_config();
        c.height = Some(12);
        assert_eq!(c.effective_height(100, 100), 12);
    }

    #[test]
    fn pixel_to_char_transparent_is_space() {
        let c = default_config();
        assert_eq!(pixel_to_char(255, 0, 0, 0, &c), " ");
    }

    #[test]
    fn pixel_to_char_white_is_last_char() {
        let c = default_config();
        let result = pixel_to_char(255, 255, 255, 255, &c);
        assert_eq!(result, "@");
    }

    #[test]
    fn pixel_to_char_black_is_first_char() {
        let c = default_config();
        let result = pixel_to_char(0, 0, 0, 255, &c);
        assert_eq!(result, " ");
    }

    #[test]
    fn invert_swaps_dark_and_light() {
        let mut c = default_config();
        c.invert = true;
        let bright = pixel_to_char(255, 255, 255, 255, &c);
        let dark = pixel_to_char(0, 0, 0, 255, &c);
        assert_eq!(bright, " ");
        assert_eq!(dark, "@");
    }

    #[test]
    fn braille_base_char() {
        // U+2800 is the empty braille character
        let base = char::from_u32(0x2800).unwrap();
        assert_eq!(base, '⠀');
    }

    #[test]
    fn braille_full_dot() {
        // 0xFF = all 8 dots set → U+28FF (⣿)
        let full = char::from_u32(0x2800 + 0xFF).unwrap();
        assert_eq!(full, '⣿');
    }

    #[test]
    fn render_ascii_synthetic_image() {
        // Create a small synthetic white 4×4 PNG in memory
        let img = DynamicImage::new_rgba8(4, 4);
        // All pixels are transparent (0,0,0,0) — should produce spaces
        let c = AsciiConfig { width: 4, height: Some(2), charset: "dense".into(), colored: false, invert: false, contrast: 0.0 };
        let lines = render_ascii_from_image(&img, &c);
        assert_eq!(lines.len(), 2);
        assert!(lines[0].chars().all(|ch| ch == ' '));
    }
}
```

- [ ] **Step 2: Run all tests**

```bash
cd packages/editor/src-tauri && cargo test commands::ascii_native
```

Expected: 11 tests pass

- [ ] **Step 3: Wire up new commands in mod.rs and main.rs**

`packages/editor/src-tauri/src/commands/mod.rs`:
```rust
pub mod mod_io;
pub mod sprite_fetch;
pub mod ascii_native;
```

`packages/editor/src-tauri/src/main.rs` — add to `invoke_handler`:
```rust
commands::sprite_fetch::fetch_sprite_png,
commands::ascii_native::render_ascii,
```

- [ ] **Step 4: Add http permission to capabilities**

`packages/editor/src-tauri/capabilities/default.json` — add:
```json
"http:default"
```

Full file:
```json
{
  "$schema": "https://schema.tauri.app/config/2/capability",
  "identifier": "default",
  "description": "Default capabilities for Pokemon Editor",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "http:default"
  ]
}
```

- [ ] **Step 5: Cargo check**

```bash
cd packages/editor/src-tauri && cargo check
```

- [ ] **Step 6: Commit**

```bash
git add packages/editor/src-tauri/
git commit -m "feat(editor): native Rust ASCII engine with brightness and Braille"
```

---

## Chunk 2: Node.js Sidecar (Jimp) + sidecar.rs + chafa/jp2a

### File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/editor/sidecars/node-sprite.cjs` | Fixed Jimp ASCII wrapper (CJS, CLI interface) |
| Create | `packages/editor/src-tauri/src/commands/sidecar.rs` | Invoke node/chafa/jp2a sidecars |
| Modify | `packages/editor/src-tauri/tauri.conf.json` | Register sidecar binaries |
| Modify | `packages/editor/src-tauri/src/commands/mod.rs` | Add sidecar module |
| Modify | `packages/editor/src-tauri/src/main.rs` | Register sidecar command |

---

### Task 4: Node.js Jimp sidecar

**Files:**
- Create: `packages/editor/sidecars/node-sprite.cjs`

**Context:** The existing `ascii-sprite.js` has two bugs:
1. `jimpToAscii` is `async` but called without `await` (line 71)
2. Height is hardcoded to `16` — no aspect ratio correction

The sidecar is a standalone CJS script (no ESM, to avoid bundling issues) that accepts CLI args and writes JSON to stdout.

**Interface:**
```
node node-sprite.cjs <png_path> <width> <charset> <colored> <invert> <contrast>
```
Output: JSON array of strings (one string per rendered line) written to stdout.
Exit 0 on success, exit 1 + stderr message on failure.

- [ ] **Step 1: Create the sidecar**

**Important — jimp version:** jimp v4+ is ESM-only and does not support `require()`. Pin jimp to the last CJS release (0.22.x) for this sidecar. Add to `packages/editor/package.json`:
```json
"jimp": "0.22.12"
```
Then run `pnpm install` from the monorepo root before proceeding.

```bash
mkdir -p packages/editor/sidecars
```

Create `packages/editor/sidecars/node-sprite.cjs`:

```js
// packages/editor/sidecars/node-sprite.cjs
// Jimp-based ASCII renderer — sidecar for Tauri editor
// Usage: node node-sprite.cjs <png_path> <width> <charset> <colored> <invert> <contrast>
// Output: JSON array of strings on stdout

'use strict';

const [, , pngPath, widthStr, charset, coloredStr, invertStr, contrastStr] = process.argv;

if (!pngPath) {
  process.stderr.write('Usage: node-sprite.cjs <png_path> <width> <charset> <colored> <invert> <contrast>\n');
  process.exit(1);
}

const width = parseInt(widthStr, 10) || 32;
const colored = coloredStr === 'true';
const invert = invertStr === 'true';
const contrast = parseFloat(contrastStr) || 0;

const CHARSETS = {
  dense:  ' .:-=+*#%@',
  simple: ' .+*#@',
  blocks: ' \u2591\u2592\u2593\u2588',
};

function getChars(cs) {
  return CHARSETS[cs] ?? cs;
}

function applyContrast(brightness, contrast) {
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  return Math.max(0, Math.min(255, factor * (brightness - 128) + 128));
}

function rgbToAnsi256(r, g, b) {
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round((r - 8) / 247 * 24) + 232;
  }
  return 16 + 36 * Math.round(r / 255 * 5) + 6 * Math.round(g / 255 * 5) + Math.round(b / 255 * 5);
}

function ansi256Color(code, text) { return `\x1b[38;5;${code}m${text}\x1b[0m`; }

// Braille rendering — 2×4 pixel blocks per character
const BRAILLE_BITS = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
];

async function renderBraille(img, width, colored, invert, contrast) {
  const { Jimp } = require('jimp');
  const origW = img.bitmap.width;
  const origH = img.bitmap.height;
  // Aspect-corrected height in char-rows
  const charHeight = Math.max(1, Math.round(width * (origH / origW) * 0.5));
  // Scale to (width*2) × (charHeight*4) pixels
  const scaled = img.clone().resize({ w: width * 2, h: charHeight * 4 });
  const lines = [];
  for (let row = 0; row < charHeight; row++) {
    let line = '';
    for (let col = 0; col < width; col++) {
      let bitmask = 0;
      let sumR = 0, sumG = 0, sumB = 0, visible = 0;
      for (let dr = 0; dr < 4; dr++) {
        for (let dc = 0; dc < 2; dc++) {
          const px = col * 2 + dc;
          const py = row * 4 + dr;
          const pixel = scaled.getPixelColor(px, py);
          const r = (pixel >>> 24) & 0xff;
          const g = (pixel >>> 16) & 0xff;
          const b = (pixel >>> 8) & 0xff;
          const a = pixel & 0xff;
          if (a < 64) continue;
          let br = 0.299 * r + 0.587 * g + 0.114 * b;
          br = applyContrast(br, contrast);
          if (invert) br = 255 - br;
          if (br > 128) bitmask |= BRAILLE_BITS[dr][dc];
          sumR += r; sumG += g; sumB += b; visible++;
        }
      }
      const brailleChar = String.fromCodePoint(0x2800 + bitmask);
      if (colored && visible > 0) {
        const ar = Math.round(sumR / visible);
        const ag = Math.round(sumG / visible);
        const ab = Math.round(sumB / visible);
        line += ansi256Color(rgbToAnsi256(ar, ag, ab), brailleChar);
      } else {
        line += brailleChar;
      }
    }
    lines.push(line);
  }
  return lines;
}

async function renderBrightness(img, width, chars, colored, invert, contrast) {
  const origW = img.bitmap.width;
  const origH = img.bitmap.height;
  // Aspect ratio correction: terminal cells ~2:1 height:width
  const height = Math.max(1, Math.round(width * (origH / origW) * 0.5));
  const scaled = img.clone().resize({ w: width, h: height });
  const lines = [];
  for (let y = 0; y < height; y++) {
    let line = '';
    for (let x = 0; x < width; x++) {
      const pixel = scaled.getPixelColor(x, y);
      const r = (pixel >>> 24) & 0xff;
      const g = (pixel >>> 16) & 0xff;
      const b = (pixel >>> 8) & 0xff;
      const a = pixel & 0xff;
      if (a < 64) { line += ' '; continue; }
      let br = 0.299 * r + 0.587 * g + 0.114 * b;
      br = applyContrast(br, contrast);
      if (invert) br = 255 - br;
      const idx = Math.round((br / 255) * (chars.length - 1));
      const ch = chars[idx] ?? ' ';
      line += colored ? ansi256Color(rgbToAnsi256(r, g, b), ch) : ch;
    }
    lines.push(line);
  }
  return lines;
}

async function main() {
  const { Jimp } = require('jimp');
  const img = await Jimp.read(pngPath);
  let lines;
  if (charset === 'braille') {
    lines = await renderBraille(img, width, colored, invert, contrast);
  } else {
    const chars = getChars(charset);
    lines = await renderBrightness(img, width, chars, colored, invert, contrast);
  }
  process.stdout.write(JSON.stringify(lines) + '\n');
}

main().catch(err => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
```

- [ ] **Step 2: Test the sidecar manually**

First ensure Jimp is available to the sidecar (it lives in the editor package):
```bash
cd packages/editor && node sidecars/node-sprite.cjs
```
Expected: prints usage error and exits 1 (Jimp not loaded yet — that's OK, testing the args guard).

To test properly, download a test PNG:
```bash
curl -o /tmp/test_pikachu.png "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png"
cd packages/editor && node sidecars/node-sprite.cjs /tmp/test_pikachu.png 32 dense false false 0
```
Expected: JSON array of 16 strings printed to stdout.

- [ ] **Step 3: Commit the sidecar**

```bash
git add packages/editor/sidecars/node-sprite.cjs
git commit -m "feat(editor): Jimp ASCII sidecar with aspect ratio fix and Braille support"
```

---

### Task 5: sidecar.rs — Tauri command to invoke sidecars

**Files:**
- Create: `packages/editor/src-tauri/src/commands/sidecar.rs`

**Context:** Tauri 2.x's `tauri-plugin-shell` allows spawning sidecar processes. For the node sidecar, we call the system `node` binary with the script path. For `chafa` and `jp2a`, they must be pre-installed on the system (or bundled — see Task 6). The command outputs JSON that we parse.

- [ ] **Step 1: Write sidecar.rs**

```rust
use serde_json::Value;
use tokio::process::Command; // async Command to avoid blocking the IPC thread

/// Invoke an ASCII rendering engine via sidecar or system binary.
/// `engine` is one of: "jimp", "chafa", "jp2a"
#[tauri::command]
pub async fn render_ascii_sidecar(
    engine: String,
    png_path: String,
    width: u32,
    charset: String,
    colored: bool,
    invert: bool,
    contrast: f32,
) -> Result<Vec<String>, String> {
    match engine.as_str() {
        "jimp"  => render_jimp(&png_path, width, &charset, colored, invert, contrast).await,
        "chafa" => render_chafa(&png_path, width, &charset, colored).await,
        "jp2a"  => render_jp2a(&png_path, width, colored).await,
        other   => Err(format!("Unknown engine: {other}")),
    }
}

fn node_sidecar_path() -> std::path::PathBuf {
    // env!() is a compile-time macro — bakes the path into the binary at build time.
    // This works for both `cargo test` and `tauri dev`.
    // For a production release build, bundle `node-sprite.cjs` as a Tauri resource
    // and use `app.path().resource_dir()` instead.
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    std::path::PathBuf::from(manifest_dir)
        .parent().unwrap_or(std::path::Path::new("."))
        .join("sidecars").join("node-sprite.cjs")
}

async fn render_jimp(
    png_path: &str, width: u32, charset: &str, colored: bool, invert: bool, contrast: f32,
) -> Result<Vec<String>, String> {
    let script = node_sidecar_path();
    let output = Command::new("node")
        .arg(&script)
        .args([
            png_path,
            &width.to_string(),
            charset,
            &colored.to_string(),
            &invert.to_string(),
            &contrast.to_string(),
        ])
        .output().await
        .map_err(|e| format!("Failed to spawn node: {e}"))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("jimp sidecar error: {err}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let v: Value = serde_json::from_str(stdout.trim())
        .map_err(|e| format!("Failed to parse jimp output: {e}"))?;

    v.as_array()
        .ok_or_else(|| "jimp output is not an array".to_string())?
        .iter()
        .map(|s| s.as_str().map(|s| s.to_string()).ok_or_else(|| "non-string in output".to_string()))
        .collect()
}

fn chafa_symbol_arg(charset: &str) -> &'static str {
    match charset {
        "braille" => "braille",
        "blocks"  => "block",
        _         => "ascii",
    }
}

async fn render_chafa(
    png_path: &str, width: u32, charset: &str, colored: bool,
) -> Result<Vec<String>, String> {
    // chafa outputs ANSI terminal escape sequences directly (not JSON)
    // We capture stdout lines as-is
    let colors_arg = if colored { "full" } else { "none" };
    let symbols = chafa_symbol_arg(charset);
    // chafa size: width×height — use same aspect correction as Rust engine
    // height is omitted and chafa auto-detects, but we set explicit height:
    let height = (width as f32 * 0.5).round() as u32;
    let size_arg = format!("{width}x{height}");

    let output = Command::new("chafa")
        .args([
            "--size", &size_arg,
            "--symbols", symbols,
            "--colors", colors_arg,
            "--format", "symbols",
            png_path,
        ])
        .output().await
        .map_err(|e| format!("Failed to spawn chafa (is it installed?): {e}"))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("chafa error: {err}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.lines().map(|l| l.to_string()).collect())
}

async fn render_jp2a(png_path: &str, width: u32, colored: bool) -> Result<Vec<String>, String> {
    let mut args = vec![
        format!("--width={width}"),
        "--background=dark".to_string(),
    ];
    if colored { args.push("--color".to_string()); }
    args.push(png_path.to_string());

    let output = Command::new("jp2a")
        .args(&args)
        .output().await
        .map_err(|e| format!("Failed to spawn jp2a (is it installed?): {e}"))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("jp2a error: {err}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.lines().map(|l| l.to_string()).collect())
}
```

- [ ] **Step 2: Register in mod.rs and main.rs**

`commands/mod.rs`:
```rust
pub mod mod_io;
pub mod sprite_fetch;
pub mod ascii_native;
pub mod sidecar;
```

`main.rs` — add `commands::sidecar::render_ascii_sidecar` to `invoke_handler![]`.

- [ ] **Step 3: Cargo check**

```bash
cd packages/editor/src-tauri && cargo check
```

- [ ] **Step 4: Commit**

```bash
git add packages/editor/src-tauri/src/commands/sidecar.rs packages/editor/src-tauri/src/commands/mod.rs packages/editor/src-tauri/src/main.rs
git commit -m "feat(editor): sidecar.rs — jimp/chafa/jp2a engine invocation"
```

---

## Chunk 3: Sprite Studio Frontend

### File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/editor/src/lib/spriteConfig.js` | AsciiConfig defaults + sprite-config.json read/write |
| Modify | `packages/editor/src/pages/SpriteStudio/index.jsx` | Main orchestrator |
| Create | `packages/editor/src/pages/SpriteStudio/ConfigPanel.jsx` | Unified config controls |
| Create | `packages/editor/src/pages/SpriteStudio/EnginePanel.jsx` | Per-engine output display |

---

### Task 6: spriteConfig.js — config management

**Files:**
- Create: `packages/editor/src/lib/spriteConfig.js`

- [ ] **Step 1: Create config defaults and helpers**

```js
// packages/editor/src/lib/spriteConfig.js

export const DEFAULT_CONFIG = {
  width: 32,
  height: null,        // null = auto (aspect ratio corrected)
  charset: 'dense',
  colored: true,
  invert: false,
  contrast: 0,
};

export const CHARSETS = [
  { id: 'dense',   label: '密集 ( .:-=+*#%@)' },
  { id: 'simple',  label: '简洁 ( .+*#@)' },
  { id: 'blocks',  label: '方块 (▁▂▃▄▅▆▇█)' },
  { id: 'braille', label: '盲文 (⠿⣿ 2×4点阵)' },
];

export const ENGINES = [
  { id: 'rust',  label: 'Rust 内置', ipcType: 'native' },
  { id: 'jimp',  label: 'Jimp (Node)', ipcType: 'sidecar' },
  { id: 'chafa', label: 'chafa', ipcType: 'sidecar' },
  { id: 'jp2a',  label: 'jp2a', ipcType: 'sidecar' },
];

export const VARIANTS = [
  { id: 'front',      label: '正面' },
  { id: 'back',       label: '背面' },
  { id: 'frontShiny', label: '色违正面' },
  { id: 'backShiny',  label: '色违背面' },
];
```

- [ ] **Step 2: Commit**

```bash
git add packages/editor/src/lib/spriteConfig.js
git commit -m "feat(editor): sprite config constants and engine list"
```

---

### Task 7: ipc.js additions for sprite commands

**Files:**
- Modify: `packages/editor/src/lib/ipc.js`

- [ ] **Step 1: Add sprite IPC calls**

Append to `packages/editor/src/lib/ipc.js`:

```js
/** @returns {Promise<string>} absolute path to downloaded PNG */
export function fetchSpritePng(id, variant) {
  return invoke('fetch_sprite_png', { id, variant });
}

/**
 * Render ASCII using the built-in Rust engine.
 * @param {string} pngPath
 * @param {{ width:number, height:number|null, charset:string, colored:boolean, invert:boolean, contrast:number }} config
 * @returns {Promise<string[]>}
 */
export function renderAsciiNative(pngPath, config) {
  return invoke('render_ascii', { pngPath, config });
}

/**
 * Render ASCII using a sidecar engine (jimp/chafa/jp2a).
 * @param {'jimp'|'chafa'|'jp2a'} engine
 * @param {string} pngPath
 * @param {{ width:number, charset:string, colored:boolean, invert:boolean, contrast:number }} config
 * @returns {Promise<string[]>}
 */
export function renderAsciiSidecar(engine, pngPath, config) {
  return invoke('render_ascii_sidecar', {
    engine, pngPath,
    width: config.width,
    charset: config.charset,
    colored: config.colored,
    invert: config.invert,
    contrast: config.contrast,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/editor/src/lib/ipc.js
git commit -m "feat(editor): add sprite IPC wrappers to ipc.js"
```

---

### Task 8: ConfigPanel component

**Files:**
- Create: `packages/editor/src/pages/SpriteStudio/ConfigPanel.jsx`

- [ ] **Step 1: Implement ConfigPanel**

```jsx
// packages/editor/src/pages/SpriteStudio/ConfigPanel.jsx
import React from 'react';
import { CHARSETS, VARIANTS } from '../../lib/spriteConfig.js';

const inputStyle = {
  background: '#0d0d1a', color: '#eee',
  border: '1px solid #444', padding: '3px 6px',
  borderRadius: 3, fontSize: 13,
};

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <label style={{ width: 80, fontSize: 12, color: '#aaa', flexShrink: 0 }}>{label}</label>
      {children}
    </div>
  );
}

export default function ConfigPanel({ config, onChange, pokemonId, onIdChange, variant, onVariantChange }) {
  function patch(key, val) { onChange({ ...config, [key]: val }); }

  return (
    <div style={{ width: 220, padding: 12, borderRight: '1px solid #333', overflowY: 'auto' }}>
      <div style={{ color: '#e94560', fontWeight: 'bold', marginBottom: 12, fontSize: 14 }}>配置</div>

      <Row label="精灵ID">
        <input type="number" value={pokemonId} min={1} max={1025}
          style={{ ...inputStyle, width: 70 }} onChange={e => onIdChange(Number(e.target.value))} />
      </Row>

      <Row label="Variant">
        <select value={variant} style={inputStyle} onChange={e => onVariantChange(e.target.value)}>
          {VARIANTS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </Row>

      <Row label="宽度">
        <input type="number" value={config.width} min={8} max={120}
          style={{ ...inputStyle, width: 60 }} onChange={e => patch('width', Number(e.target.value))} />
        <span style={{ fontSize: 11, color: '#666' }}>chars</span>
      </Row>

      <Row label="字符集">
        <select value={config.charset} style={{ ...inputStyle, width: 130 }}
          onChange={e => patch('charset', e.target.value)}>
          {CHARSETS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </Row>

      <Row label="彩色">
        <input type="checkbox" checked={config.colored} onChange={e => patch('colored', e.target.checked)} />
      </Row>

      <Row label="反色">
        <input type="checkbox" checked={config.invert} onChange={e => patch('invert', e.target.checked)} />
      </Row>

      <Row label="对比度">
        <input type="range" min={-100} max={100} value={config.contrast}
          style={{ width: 100 }} onChange={e => patch('contrast', Number(e.target.value))} />
        <span style={{ fontSize: 11, color: '#888', width: 30 }}>{config.contrast}</span>
      </Row>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/editor/src/pages/SpriteStudio/ConfigPanel.jsx
git commit -m "feat(editor): SpriteStudio ConfigPanel"
```

---

### Task 9: EnginePanel component

**Files:**
- Create: `packages/editor/src/pages/SpriteStudio/EnginePanel.jsx`

- [ ] **Step 1: Implement EnginePanel**

```jsx
// packages/editor/src/pages/SpriteStudio/EnginePanel.jsx
import React from 'react';

export default function EnginePanel({ engine, lines, loading, error, selected, onSelect }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, border: '1px solid',
      borderColor: selected ? '#e94560' : '#333',
      borderRadius: 4, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{
        padding: '4px 8px', background: selected ? '#2a0d13' : '#16213e',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, color: selected ? '#e94560' : '#aaa', fontWeight: 'bold' }}>
          {engine.label}
        </span>
        <button
          onClick={onSelect}
          style={{
            padding: '2px 8px', fontSize: 11, border: 'none', borderRadius: 3, cursor: 'pointer',
            background: selected ? '#e94560' : '#444', color: '#fff',
          }}>
          {selected ? '✓ 已选' : '选用'}
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 8, background: '#000' }}>
        {loading && <div style={{ color: '#888', fontSize: 12 }}>渲染中…</div>}
        {error && <div style={{ color: '#e94560', fontSize: 12 }}>⚠ {error}</div>}
        {!loading && !error && lines && (
          <pre style={{
            margin: 0, fontSize: 11, lineHeight: 1.2, fontFamily: 'monospace',
            whiteSpace: 'pre', color: '#eee',
          }}>
            {/* Lines may contain ANSI escape codes — render as raw text in terminal-like context */}
            {lines.map((l, i) => <div key={i} dangerouslySetInnerHTML={{ __html: ansiToHtml(l) }} />)}
          </pre>
        )}
        {!loading && !error && !lines && (
          <div style={{ color: '#555', fontSize: 12 }}>点击"获取精灵"开始渲染</div>
        )}
      </div>
    </div>
  );
}

// Minimal ANSI SGR → HTML converter (handles true-color and 256-color foreground)
function ansiToHtml(str) {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\x1b\[0m/g, '</span>')
    .replace(/\x1b\[38;2;(\d+);(\d+);(\d+)m/g, '<span style="color:rgb($1,$2,$3)">')
    .replace(/\x1b\[38;5;(\d+)m/g, (_, code) => `<span style="color:${ansi256ToHex(Number(code))}">`);
}

function ansi256ToHex(code) {
  if (code < 16) {
    const base = ['#000','#800','#080','#880','#008','#808','#088','#c8c','#888','#f00','#0f0','#ff0','#00f','#f0f','#0ff','#fff'];
    return base[code] ?? '#fff';
  }
  if (code < 232) {
    const c = code - 16;
    const b = c % 6; const g = Math.floor(c / 6) % 6; const r = Math.floor(c / 36);
    const t = v => v ? Math.round(v * 40 + 55) : 0;
    return `rgb(${t(r)},${t(g)},${t(b)})`;
  }
  const gray = Math.round((code - 232) * 10.2 + 8);
  return `rgb(${gray},${gray},${gray})`;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/editor/src/pages/SpriteStudio/EnginePanel.jsx
git commit -m "feat(editor): EnginePanel with ANSI color rendering"
```

---

### Task 10: SpriteStudio main orchestrator

**Files:**
- Modify: `packages/editor/src/pages/SpriteStudio/index.jsx`

- [ ] **Step 1: Implement SpriteStudio**

```jsx
// packages/editor/src/pages/SpriteStudio/index.jsx
import React, { useState, useCallback } from 'react';
import { fetchSpritePng, renderAsciiNative, renderAsciiSidecar } from '../../lib/ipc.js';
import { DEFAULT_CONFIG, ENGINES } from '../../lib/spriteConfig.js';
import ConfigPanel from './ConfigPanel.jsx';
import EnginePanel from './EnginePanel.jsx';

const initialEngineState = () =>
  Object.fromEntries(ENGINES.map(e => [e.id, { lines: null, loading: false, error: null }]));

export default function SpriteStudio() {
  const [pokemonId, setPokemonId] = useState(25); // Pikachu default
  const [variant, setVariant] = useState('front');
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [pngPath, setPngPath] = useState(null);
  const [engineState, setEngineState] = useState(initialEngineState);
  const [selectedEngine, setSelectedEngine] = useState('rust');
  const [fetchStatus, setFetchStatus] = useState('');

  function setEngine(id, patch) {
    setEngineState(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  const handleFetch = useCallback(async () => {
    setFetchStatus('下载精灵PNG…');
    try {
      const path = await fetchSpritePng(pokemonId, variant);
      setPngPath(path);
      setFetchStatus(`已缓存: ${path.split(/[/\\]/).pop()}`);
    } catch (e) {
      setFetchStatus(`下载失败: ${e}`);
    }
  }, [pokemonId, variant]);

  const handleRenderAll = useCallback(async () => {
    if (!pngPath) { setFetchStatus('请先获取精灵'); return; }
    // Run all engines in parallel
    await Promise.all(ENGINES.map(async engine => {
      setEngine(engine.id, { loading: true, error: null });
      try {
        let lines;
        if (engine.ipcType === 'native') {
          lines = await renderAsciiNative(pngPath, config);
        } else {
          lines = await renderAsciiSidecar(engine.id, pngPath, config);
        }
        setEngine(engine.id, { lines, loading: false });
      } catch (e) {
        setEngine(engine.id, { loading: false, error: String(e) });
      }
    }));
  }, [pngPath, config]);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <ConfigPanel
        config={config} onChange={setConfig}
        pokemonId={pokemonId} onIdChange={setPokemonId}
        variant={variant} onVariantChange={setVariant}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '8px 12px', background: '#16213e', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <button onClick={handleFetch}
            style={{ padding: '5px 12px', background: '#1a6b3c', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: 4, fontSize: 13 }}>
            获取精灵 PNG
          </button>
          <button onClick={handleRenderAll} disabled={!pngPath}
            style={{ padding: '5px 12px', background: pngPath ? '#1a3b6b' : '#333', color: '#fff', border: 'none', cursor: pngPath ? 'pointer' : 'default', borderRadius: 4, fontSize: 13 }}>
            全部引擎渲染
          </button>
          <span style={{ color: '#888', fontSize: 12 }}>{fetchStatus}</span>
          <span style={{ marginLeft: 'auto', color: '#666', fontSize: 11 }}>
            已选引擎: <span style={{ color: '#e94560' }}>{selectedEngine}</span>
          </span>
        </div>

        {/* Engine comparison grid */}
        <div style={{ flex: 1, display: 'flex', gap: 8, padding: 8, overflow: 'hidden' }}>
          {ENGINES.map(engine => (
            <EnginePanel
              key={engine.id}
              engine={engine}
              lines={engineState[engine.id].lines}
              loading={engineState[engine.id].loading}
              error={engineState[engine.id].error}
              selected={selectedEngine === engine.id}
              onSelect={() => setSelectedEngine(engine.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run Tauri dev and test the full flow**

```bash
cd packages/editor && pnpm tauri dev
```

1. Click "精灵工坊" tab
2. Set ID to 25 (Pikachu), click "获取精灵 PNG" — status should show cache path
3. Click "全部引擎渲染" — Rust and jimp panels should fill with ASCII
4. chafa/jp2a panels will show errors if not installed — that's expected

- [ ] **Step 3: Commit**

```bash
git add packages/editor/src/pages/SpriteStudio/
git commit -m "feat(editor): Sprite Studio UI — multi-engine comparison view"
```

---

## Chunk 4: Batch Mode

### File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/editor/src/pages/SpriteStudio/BatchPanel.jsx` | Batch fetch/render UI |
| Modify | `packages/editor/src/pages/SpriteStudio/index.jsx` | Add batch tab |

---

### Task 11: BatchPanel

**Files:**
- Create: `packages/editor/src/pages/SpriteStudio/BatchPanel.jsx`

- [ ] **Step 1: Implement BatchPanel**

```jsx
// packages/editor/src/pages/SpriteStudio/BatchPanel.jsx
import React, { useState, useRef } from 'react';
import { fetchSpritePng, renderAsciiNative } from '../../lib/ipc.js';
import { DEFAULT_CONFIG, VARIANTS } from '../../lib/spriteConfig.js';

export default function BatchPanel() {
  const [startId, setStartId] = useState(1);
  const [endId, setEndId] = useState(151);
  const [selectedVariants, setSelectedVariants] = useState(['front']);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [log, setLog] = useState([]);
  const abortRef = useRef(false);

  function toggleVariant(id) {
    setSelectedVariants(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  }

  function appendLog(msg) {
    setLog(prev => [...prev.slice(-200), msg]); // keep last 200 lines
  }

  async function handleStart() {
    setRunning(true);
    abortRef.current = false;
    setLog([]);
    const total = (endId - startId + 1) * selectedVariants.length;
    let done = 0;

    for (let id = startId; id <= endId; id++) {
      if (abortRef.current) { appendLog('已中止'); break; }
      for (const variant of selectedVariants) {
        if (abortRef.current) break;
        try {
          const pngPath = await fetchSpritePng(id, variant);
          await renderAsciiNative(pngPath, config);
          done++;
          setProgress(`${done}/${total} — #${id} ${variant}`);
          appendLog(`✓ #${id} ${variant}`);
        } catch (e) {
          appendLog(`✗ #${id} ${variant}: ${e}`);
          done++;
        }
      }
    }
    setRunning(false);
    setProgress(`完成 ${done}/${total}`);
  }

  return (
    <div style={{ padding: 20, maxWidth: 500 }}>
      <div style={{ color: '#e94560', fontWeight: 'bold', marginBottom: 16, fontSize: 14 }}>批量获取 & 生成</div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: '#aaa' }}>ID范围:</span>
        <input type="number" value={startId} min={1} onChange={e => setStartId(Number(e.target.value))}
          style={{ width: 70, background: '#0d0d1a', color: '#eee', border: '1px solid #444', padding: '3px 6px', borderRadius: 3 }} />
        <span style={{ color: '#aaa' }}>—</span>
        <input type="number" value={endId} min={startId} onChange={e => setEndId(Number(e.target.value))}
          style={{ width: 70, background: '#0d0d1a', color: '#eee', border: '1px solid #444', padding: '3px 6px', borderRadius: 3 }} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>Variants:</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {VARIANTS.map(v => (
            <label key={v.id} style={{ fontSize: 12, color: selectedVariants.includes(v.id) ? '#7fb3f5' : '#888', cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedVariants.includes(v.id)} onChange={() => toggleVariant(v.id)} />
              {' '}{v.label}
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={handleStart} disabled={running || selectedVariants.length === 0}
          style={{ padding: '6px 16px', background: running ? '#333' : '#1a6b3c', color: '#fff', border: 'none', cursor: running ? 'default' : 'pointer', borderRadius: 4 }}>
          {running ? '运行中…' : '开始'}
        </button>
        {running && (
          <button onClick={() => { abortRef.current = true; }}
            style={{ padding: '6px 16px', background: '#8b0000', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: 4 }}>
            中止
          </button>
        )}
        <span style={{ fontSize: 12, color: '#888', alignSelf: 'center' }}>{progress}</span>
      </div>

      <div style={{ height: 200, overflowY: 'auto', background: '#000', padding: 8, borderRadius: 4, fontSize: 11, fontFamily: 'monospace' }}>
        {log.map((l, i) => (
          <div key={i} style={{ color: l.startsWith('✓') ? '#6a9' : l.startsWith('✗') ? '#e94560' : '#888' }}>{l}</div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add batch tab to SpriteStudio**

In `packages/editor/src/pages/SpriteStudio/index.jsx`, add a mode toggle for "单个" vs "批量":

```jsx
// Add to top of SpriteStudio:
import BatchPanel from './BatchPanel.jsx';

// Add state:
const [mode, setMode] = useState('single'); // 'single' | 'batch'

// Add to toolbar:
<button onClick={() => setMode(m => m === 'single' ? 'batch' : 'single')}
  style={{ padding: '5px 12px', background: '#555', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: 4, fontSize: 13 }}>
  {mode === 'single' ? '批量模式' : '单个模式'}
</button>

// Replace the engine grid div with:
{mode === 'single' ? (
  <div style={{ flex: 1, display: 'flex', gap: 8, padding: 8, overflow: 'hidden' }}>
    {ENGINES.map(engine => (
      <EnginePanel key={engine.id} engine={engine} ... />
    ))}
  </div>
) : (
  <BatchPanel />
)}
```

- [ ] **Step 3: Test batch mode**

```bash
cd packages/editor && pnpm tauri dev
```

- Switch to "精灵工坊" → click "批量模式"
- Set range 1–5, select "正面", click 开始
- Verify log shows 5 ✓ entries and progress updates

- [ ] **Step 4: Commit**

```bash
git add packages/editor/src/pages/SpriteStudio/
git commit -m "feat(editor): batch sprite fetch and render mode"
```

---

## Chunk 5: Learnset Editor

### File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/editor/src/pages/LearnsetEditor/index.jsx` | Species picker + tab switcher |
| Create | `packages/editor/src/pages/LearnsetEditor/LevelUpTable.jsx` | Level-up moves table |
| Create | `packages/editor/src/pages/LearnsetEditor/EggMoveTable.jsx` | Egg moves table |
| Create | `packages/editor/src/pages/LearnsetEditor/TmTable.jsx` | TM/HM moves table |
| Create | `packages/editor/src/lib/learnset.js` | Learnset query helpers |

---

### Task 12: learnset.js helper

**Files:**
- Create: `packages/editor/src/lib/learnset.js`

**Context:** `@pkmn/data` `gen.learnsets.get(speciesName)` returns a `LearnsetEntry` with a `learnset` property mapping move IDs to source arrays like `["9L24", "9M", "9E"]`. Prefix codes: `9L<n>` = level-up at level n, `9M` = TM, `9E` = egg move, `9T` = tutor.

- [ ] **Step 1: Create learnset.js**

```js
// packages/editor/src/lib/learnset.js
import { Dex } from '@pkmn/dex';
import { Generations } from '@pkmn/data';

const gens = new Generations(Dex);
const gen9 = gens.get(9);

/**
 * @typedef {Object} MoveRow
 * @property {string} moveId
 * @property {string} moveName
 * @property {string} type
 * @property {string} category
 * @property {number|null} basePower
 * @property {number|null} accuracy
 * @property {number|null} pp
 */

/** Parse source string array for a single move, categorized by type */
function parseSources(sources) {
  const result = { levels: [], isTM: false, isEgg: false, isTutor: false };
  for (const src of sources) {
    if (src.startsWith('9L')) result.levels.push(Number(src.slice(2)));
    else if (src === '9M') result.isTM = true;
    else if (src === '9E') result.isEgg = true;
    else if (src === '9T') result.isTutor = true;
  }
  return result;
}

function makeMoveRow(moveId, learnset) {
  const move = gen9.moves.get(moveId);
  if (!move || !move.exists) return null;
  return {
    moveId,
    moveName: move.name,
    type: move.type,
    category: move.category,
    basePower: move.basePower || null,
    accuracy: move.accuracy === true ? null : (move.accuracy || null),
    pp: move.pp || null,
    ...parseSources(learnset[moveId] ?? []),
  };
}

/**
 * @param {string} speciesName
 * @returns {Promise<{ levelUp: MoveRow[], eggMoves: MoveRow[], tmMoves: MoveRow[] }>}
 */
export async function getLearnset(speciesName) {
  const entry = await gen9.learnsets.get(speciesName);
  if (!entry || !entry.learnset) {
    return { levelUp: [], eggMoves: [], tmMoves: [] };
  }

  const allMoves = Object.keys(entry.learnset).map(id => makeMoveRow(id, entry.learnset)).filter(Boolean);

  const levelUp = allMoves
    .filter(m => m.levels.length > 0)
    .map(m => ({ ...m, level: Math.min(...m.levels) }))
    .sort((a, b) => a.level - b.level);

  const eggMoves = allMoves.filter(m => m.isEgg).sort((a, b) => a.moveName.localeCompare(b.moveName));
  const tmMoves  = allMoves.filter(m => m.isTM).sort((a, b) => a.moveName.localeCompare(b.moveName));

  return { levelUp, eggMoves, tmMoves };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/editor/src/lib/learnset.js
git commit -m "feat(editor): learnset query helper for Gen 9"
```

---

### Task 13: Learnset table components

**Files:**
- Create: `packages/editor/src/pages/LearnsetEditor/LevelUpTable.jsx`
- Create: `packages/editor/src/pages/LearnsetEditor/EggMoveTable.jsx`
- Create: `packages/editor/src/pages/LearnsetEditor/TmTable.jsx`

- [ ] **Step 1: Create shared MoveTable component**

Create `packages/editor/src/pages/LearnsetEditor/MoveTable.jsx`:

```jsx
// packages/editor/src/pages/LearnsetEditor/MoveTable.jsx
import React from 'react';

export const TYPE_COLORS = {
  Normal:'#A8A878',Fire:'#F08030',Water:'#6890F0',Electric:'#F8D030',
  Grass:'#78C850',Ice:'#98D8D8',Fighting:'#C03028',Poison:'#A040A0',
  Ground:'#E0C068',Flying:'#A890F0',Psychic:'#F85888',Bug:'#A8B820',
  Rock:'#B8A038',Ghost:'#705898',Dragon:'#7038F8',Dark:'#705848',
  Steel:'#B8B8D0',Fairy:'#EE99AC'
};

const thStyle = { padding: '4px 8px', fontSize: 11, color: '#888', textAlign: 'left', borderBottom: '1px solid #333' };
const tdStyle = { padding: '4px 8px', fontSize: 12 };

export default function MoveTable({ columns, rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>{columns.map(c => <th key={c.key} style={thStyle}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.moveId} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.03)' }}>
              {columns.map(c => (
                <td key={c.key} style={{ ...tdStyle, color: c.color?.(row) ?? '#eee' }}>
                  {c.render ? c.render(row) : row[c.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} style={{ ...tdStyle, color: '#555', textAlign: 'center' }}>无数据</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create LevelUpTable**

```jsx
// packages/editor/src/pages/LearnsetEditor/LevelUpTable.jsx
import React from 'react';
import MoveTable, { TYPE_COLORS } from './MoveTable.jsx';

const COLS = [
  { key: 'level',    label: '等级', render: r => `Lv.${r.level}` },
  { key: 'moveName', label: '技能名' },
  { key: 'type',     label: '属性', color: r => TYPE_COLORS[r.type] ?? '#eee' },
  { key: 'category', label: '分类' },
  { key: 'basePower',label: '威力' },
  { key: 'accuracy', label: '命中' },
  { key: 'pp',       label: 'PP' },
];

export default function LevelUpTable({ moves }) {
  return <MoveTable columns={COLS} rows={moves} />;
}
```

- [ ] **Step 3: Create EggMoveTable**

```jsx
// packages/editor/src/pages/LearnsetEditor/EggMoveTable.jsx
import React from 'react';
import MoveTable, { TYPE_COLORS } from './MoveTable.jsx';

const COLS = [
  { key: 'moveName', label: '技能名' },
  { key: 'type',     label: '属性', color: r => TYPE_COLORS[r.type] ?? '#eee' },
  { key: 'category', label: '分类' },
  { key: 'basePower',label: '威力' },
  { key: 'accuracy', label: '命中' },
  { key: 'pp',       label: 'PP' },
];

export default function EggMoveTable({ moves }) {
  return <MoveTable columns={COLS} rows={moves} />;
}
```

- [ ] **Step 4: Create TmTable**

```jsx
// packages/editor/src/pages/LearnsetEditor/TmTable.jsx
import React from 'react';
import MoveTable, { TYPE_COLORS } from './MoveTable.jsx';

const COLS = [
  { key: 'moveName', label: '技能名' },
  { key: 'type',     label: '属性', color: r => TYPE_COLORS[r.type] ?? '#eee' },
  { key: 'category', label: '分类' },
  { key: 'basePower',label: '威力' },
  { key: 'accuracy', label: '命中' },
  { key: 'pp',       label: 'PP' },
];

export default function TmTable({ moves }) {
  return <MoveTable columns={COLS} rows={moves} />;
}
```

- [ ] **Step 5: Commit tables**

```bash
git add packages/editor/src/pages/LearnsetEditor/
git commit -m "feat(editor): learnset table components (level-up, egg, TM)"
```

---

### Task 14: LearnsetEditor orchestrator

**Files:**
- Modify: `packages/editor/src/pages/LearnsetEditor/index.jsx`

- [ ] **Step 1: Implement LearnsetEditor**

```jsx
// packages/editor/src/pages/LearnsetEditor/index.jsx
import React, { useState, useEffect } from 'react';
import { getLearnset } from '../../lib/learnset.js';
import { getAllSpeciesNames } from '../../lib/dex.js';
import LevelUpTable from './LevelUpTable.jsx';
import EggMoveTable from './EggMoveTable.jsx';
import TmTable from './TmTable.jsx';

const ALL_SPECIES = getAllSpeciesNames();
const TABS = [
  { id: 'levelUp', label: '升级技能' },
  { id: 'egg',     label: '蛋技能' },
  { id: 'tm',      label: 'TM' },
];

export default function LearnsetEditor() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('Pikachu');
  const [activeTab, setActiveTab] = useState('levelUp');
  const [learnset, setLearnset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const filtered = ALL_SPECIES.filter(n => n.toLowerCase().includes(search.toLowerCase())).slice(0, 50);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setError('');
    getLearnset(selected)
      .then(data => { setLearnset(data); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [selected]);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Species list */}
      <div style={{ width: 180, borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 8, background: '#16213e' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索精灵…"
            style={{ width: '100%', padding: 4, background: '#0d0d1a', color: '#eee', border: '1px solid #444', boxSizing: 'border-box', fontSize: 13 }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.map(name => (
            <div key={name} onClick={() => setSelected(name)}
              style={{
                padding: '5px 12px', cursor: 'pointer', fontSize: 13,
                background: selected === name ? '#16213e' : 'transparent',
                borderLeft: selected === name ? '3px solid #e94560' : '3px solid transparent',
                color: selected === name ? '#eee' : '#aaa',
              }}>
              {name}
            </div>
          ))}
        </div>
      </div>

      {/* Learnset content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #333', background: '#16213e' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13,
                background: activeTab === tab.id ? '#0f3460' : 'transparent',
                color: activeTab === tab.id ? '#e94560' : '#888',
                borderBottom: activeTab === tab.id ? '2px solid #e94560' : '2px solid transparent',
              }}>
              {tab.label}
              {learnset && (
                <span style={{ marginLeft: 4, fontSize: 11, color: '#666' }}>
                  ({({ levelUp: learnset.levelUp, egg: learnset.eggMoves, tm: learnset.tmMoves }[tab.id])?.length ?? 0})
                </span>
              )}
            </button>
          ))}
          <div style={{ padding: '8px 16px', color: '#e94560', fontWeight: 'bold', fontSize: 14, marginLeft: 8 }}>
            {selected}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {loading && <div style={{ padding: 20, color: '#888' }}>加载中…</div>}
          {error && <div style={{ padding: 20, color: '#e94560' }}>⚠ {error}</div>}
          {!loading && !error && learnset && (
            <>
              {activeTab === 'levelUp' && <LevelUpTable moves={learnset.levelUp} />}
              {activeTab === 'egg'     && <EggMoveTable moves={learnset.eggMoves} />}
              {activeTab === 'tm'      && <TmTable      moves={learnset.tmMoves} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run Tauri dev and test**

```bash
cd packages/editor && pnpm tauri dev
```

- Click "学习表" tab
- Search for "Pikachu", click it
- Switch between "升级技能" / "蛋技能" / "TM" — tables should populate
- Try "Charizard" — has all three categories

- [ ] **Step 3: Final commit**

```bash
git add packages/editor/src/pages/LearnsetEditor/ packages/editor/src/lib/learnset.js
git commit -m "feat(editor): Learnset Editor — level-up / egg / TM tables for Gen 9"
```

---

## Chunk 6: Final Integration Test

### Task 15: End-to-end smoke test

- [ ] **Step 1: Test Sprite Studio — native engine**

```bash
cd packages/editor && pnpm tauri dev
```

1. "精灵工坊" → ID=1 (Bulbasaur), Variant=front, 宽度=32, 字符集=braille, 彩色=on
2. 获取精灵 PNG → check status shows cache path
3. 全部引擎渲染 → Rust panel fills with Braille output
4. Jimp panel fills (may take 1-2s for node startup)
5. chafa/jp2a show error if not installed — expected

- [ ] **Step 2: Test batch mode**

- Switch to 批量模式, range 1-3, variant=front, Start
- Check `~/.pokemon-cli/sprites/png/` contains 1_front.png, 2_front.png, 3_front.png

```bash
ls ~/.pokemon-cli/sprites/png/ | head -10
```

- [ ] **Step 3: Test Learnset Editor**

- "学习表" → search "Garchomp" → level-up tab shows moves like "Dragon Claw" at Lv.1, etc.
- TM tab shows a list of compatible TMs
- Egg tab for "Charizard" shows egg moves

- [ ] **Step 4: Verify CLI still works after Plan B additions**

```bash
pnpm cli:dev
```

Start a battle — confirm nothing is broken (Plan B only adds to editor package, shouldn't affect CLI).

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat(editor): Plan B complete — Sprite Studio and Learnset Editor"
```
