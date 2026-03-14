use image::{ImageBuffer, Rgba};
use serde::{Deserialize, Serialize};

/// ASCII rendering configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AsciiConfig {
    pub width: u32,
    pub charset: String, // "simple", "blocks", "braille", "shades"
    pub colored: bool,
    pub invert: bool,
    pub contrast: f32,
}

/// Character sets for different modes
const CHARSET_SIMPLE: &str = " .:-=+*#%@";
const CHARSET_BLOCKS: &str = " ░▒▓█";
const CHARSET_SHADES: &str = " .:-~=+*#%@";

/// Braille dot bit positions (2x4 grid)
const BRAILLE_BITS: [[u8; 2]; 4] = [
    [0x01, 0x08], // dots 1,4
    [0x02, 0x10], // dots 2,5
    [0x04, 0x20], // dots 3,6
    [0x40, 0x80], // dots 4,8 (actually 7,8 but we use 4,8 for visual ordering)
];

/// Get charset string by name
fn get_charset(name: &str) -> &'static str {
    match name {
        "blocks" => CHARSET_BLOCKS,
        "shades" => CHARSET_SHADES,
        _ => CHARSET_SIMPLE,
    }
}

/// Calculate brightness from RGBA pixel (alpha threshold: <64 = transparent)
fn pixel_brightness(pixel: &Rgba<u8>) -> Option<f32> {
    if pixel[3] < 64 {
        return None; // Transparent
    }
    let r = pixel[0] as f32;
    let g = pixel[1] as f32;
    let b = pixel[2] as f32;
    // Standard luminance weights
    Some(0.299 * r + 0.587 * g + 0.114 * b)
}

/// Map brightness to character
fn brightness_to_char(brightness: f32, charset: &str, invert: bool, contrast: f32) -> char {
    let adjusted = (brightness / 255.0 * contrast).clamp(0.0, 1.0);
    let idx = if invert {
        (adjusted * (charset.len() - 1) as f32) as usize
    } else {
        ((1.0 - adjusted) * (charset.len() - 1) as f32) as usize
    };
    charset.chars().nth(idx).unwrap_or(' ')
}

/// Render ASCII using brightness mapping
fn render_brightness(img: &ImageBuffer<Rgba<u8>, Vec<u8>>, width: u32, charset: &str, invert: bool, contrast: f32) -> Vec<String> {
    let (src_w, src_h) = img.dimensions();
    // Aspect ratio correction: terminal cells are 2:1 (wide)
    let height = ((width as f32 * (src_h as f32 / src_w as f32) * 0.5) as u32).max(1);

    // Resize manually (simple nearest neighbor)
    let mut lines = Vec::with_capacity(height as usize);

    for y in 0..height {
        let src_y = (y * src_h / height) as u32;
        let mut line = String::new();
        for x in 0..width {
            let src_x = (x * src_w / width) as u32;
            let pixel = img.get_pixel(src_x, src_y);
            if let Some(brightness) = pixel_brightness(pixel) {
                let ch = brightness_to_char(brightness, charset, invert, contrast);
                if charset == CHARSET_SIMPLE {
                    line.push(ch);
                } else {
                    // For blocks/shades, optionally add color
                    line.push(ch);
                }
            } else {
                line.push(' ');
            }
        }
        lines.push(line);
    }

    lines
}

/// Render ASCII using Braille characters
fn render_braille(img: &ImageBuffer<Rgba<u8>, Vec<u8>>, width: u32, invert: bool, contrast: f32) -> Vec<String> {
    let (src_w, src_h) = img.dimensions();
    // Braille cells are 2x4 pixels
    let cell_w = 2;
    let cell_h = 4;
    let cols = width;
    let rows = ((width as f32 * (src_h as f32 / src_w as f32) * 0.5) / 2.0) as u32;

    let mut lines = Vec::with_capacity(rows as usize);

    for row in 0..rows {
        let mut line = String::new();
        for col in 0..cols {
            let src_x = (col * src_w / width) as u32;
            let src_y = (row * src_h / rows) as u32;

            let mut dots = 0u8;
            for dy in 0..cell_h {
                for dx in 0..cell_w {
                    let px = src_x + dx * src_w / (width * cell_w);
                    let py = src_y + dy * src_h / (rows * cell_h);
                    if px < src_w && py < src_h {
                        let pixel = img.get_pixel(px, py);
                        if let Some(brightness) = pixel_brightness(pixel) {
                            let adjusted = (brightness / 255.0 * contrast).clamp(0.0, 1.0);
                            let on = if invert { adjusted < 0.5 } else { adjusted >= 0.5 };
                            if on {
                                dots |= BRAILLE_BITS[dy as usize][dx as usize];
                            }
                        }
                    }
                }
            }

            // Braille characters start at U+2800
            let ch = char::from_u32(0x2800 + dots as u32).unwrap_or(' ');
            line.push(ch);
        }
        lines.push(line);
    }

    lines
}

/// Main ASCII rendering function
#[tauri::command]
pub fn render_ascii(png_path: String, config: AsciiConfig) -> Result<Vec<String>, String> {
    let img = image::open(&png_path)
        .map_err(|e| format!("Failed to open PNG: {e}"))?
        .to_rgba8();

    let charset = get_charset(&config.charset);

    if config.charset == "braille" {
        Ok(render_braille(&img, config.width, config.invert, config.contrast))
    } else {
        Ok(render_brightness(&img, config.width, charset, config.invert, config.contrast))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn charset_selection() {
        assert_eq!(get_charset("simple"), CHARSET_SIMPLE);
        assert_eq!(get_charset("blocks"), CHARSET_BLOCKS);
        assert_eq!(get_charset("unknown"), CHARSET_SIMPLE);
    }

    #[test]
    fn brightness_to_char_invert() {
        let charset = CHARSET_SIMPLE;
        // Low brightness should give high char (last) when not inverted
        let ch = brightness_to_char(0.0, charset, false, 1.0);
        assert_eq!(ch, '@'); // Last char
        // Low brightness should give low char (first) when inverted
        let ch = brightness_to_char(0.0, charset, true, 1.0);
        assert_eq!(ch, ' '); // First char
    }
}
