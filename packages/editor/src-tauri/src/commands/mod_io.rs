use serde_json::Value;
use std::fs;

/// Extract the entire MOD_DATA object body from a mod.js file string.
/// Returns the content between (and including) the outermost `{` and `}`.
pub fn extract_mod_data_body(file: &str) -> Option<String> {
    let marker = "MOD_DATA = ";
    let start = file.find(marker)? + marker.len();
    let rest = &file[start..];
    let brace_start = rest.find('{')?;
    let content_start = start + brace_start;
    extract_balanced(&file[content_start..])
}

/// Extract a balanced brace-delimited block starting at the first '{' in `src`.
fn extract_balanced(src: &str) -> Option<String> {
    let mut depth = 0i32;
    let mut in_str: Option<char> = None;
    let mut escape = false;
    let mut end = 0usize;
    for (i, ch) in src.char_indices() {
        if escape {
            escape = false;
            continue;
        }
        if ch == '\\' && in_str.is_some() {
            escape = true;
            continue;
        }
        if let Some(q) = in_str {
            if ch == q {
                in_str = None;
            }
            continue;
        }
        match ch {
            '\'' | '"' | '`' => {
                in_str = Some(ch);
            }
            '{' => {
                depth += 1;
            }
            '}' => {
                depth -= 1;
                if depth == 0 {
                    end = i;
                    break;
                }
            }
            _ => {}
        }
    }
    if depth != 0 {
        return None;
    }
    Some(src[..=end].to_string())
}

/// Scan `src` character-by-character and return the byte position of `key`
/// only when it appears as a top-level key (brace depth == 1).
/// `src` must start with the opening `{` of the MOD_DATA body.
fn find_top_level_key(src: &str, key: &str) -> Option<usize> {
    let mut depth = 0i32;
    let mut in_str: Option<char> = None;
    let mut escape = false;
    let n = src.len();
    let mut i = 0;
    while i < n {
        let ch = src[i..].chars().next().unwrap();
        let ch_len = ch.len_utf8();
        if escape {
            escape = false;
            i += ch_len;
            continue;
        }
        if ch == '\\' && in_str.is_some() {
            escape = true;
            i += ch_len;
            continue;
        }
        if let Some(q) = in_str {
            if ch == q {
                in_str = None;
            }
            i += ch_len;
            continue;
        }
        match ch {
            '\'' | '"' | '`' => {
                in_str = Some(ch);
            }
            '{' => {
                depth += 1;
            }
            '}' => {
                depth -= 1;
            }
            _ => {
                // At depth 1 we are inside the top-level object — check for our key
                if depth == 1 {
                    let bare = format!("{}:", key);
                    let sq = format!("'{}': ", key);
                    let sq2 = format!("'{}':", key);
                    let dq = format!("\"{}\":", key);
                    for pat in &[bare.as_str(), sq.as_str(), sq2.as_str(), dq.as_str()] {
                        if src[i..].starts_with(pat) {
                            return Some(i);
                        }
                    }
                }
            }
        }
        i += ch_len;
    }
    None
}

pub fn extract_block(src: &str, key: &str) -> Option<String> {
    let key_pos = find_top_level_key(src, key)?;
    let after_key = &src[key_pos..];
    let brace_offset = after_key.find('{')?;
    extract_balanced(&after_key[brace_offset..])
}

pub fn splice_block(src: &str, key: &str, new_value: &str) -> Option<String> {
    let key_pos = find_top_level_key(src, key)?;
    let after_key = &src[key_pos..];
    let brace_offset = after_key.find('{')?;
    let old_block = extract_balanced(&after_key[brace_offset..])?;
    let old_start = key_pos + brace_offset;
    let old_end = old_start + old_block.len();

    let mut result = String::with_capacity(src.len());
    result.push_str(&src[..old_start]);
    result.push_str(new_value);
    result.push_str(&src[old_end..]);
    Some(result)
}

/// Convert a JS object literal to valid JSON.
/// Handles the subset produced by @pkmn/mods mod data:
/// - Bare identifier keys (`hp: 35` → `"hp": 35`)
/// - Single-quoted string values (`'Fire'` → `"Fire"`)
/// - No functions, computed keys, or template literals.
fn js_obj_to_json(src: &str) -> Result<Value, String> {
    let mut out = String::with_capacity(src.len() + src.len() / 4);
    let mut chars = src.chars().peekable();
    let mut in_str: Option<char> = None;
    let mut escape = false;

    while let Some(ch) = chars.next() {
        if escape {
            escape = false;
            out.push(ch);
            continue;
        }
        if ch == '\\' && in_str.is_some() {
            escape = true;
            out.push(ch);
            continue;
        }

        if let Some(q) = in_str {
            if ch == q {
                in_str = None;
                out.push('"');
            } else {
                if ch == '"' {
                    out.push('\\');
                }
                out.push(ch);
            }
            continue;
        }

        match ch {
            '\'' => {
                in_str = Some('\'');
                out.push('"');
            }
            '"' => {
                in_str = Some('"');
                out.push('"');
            }
            c if c.is_ascii_alphabetic() || c == '_' || c == '$' => {
                let mut ident = String::new();
                ident.push(c);
                while let Some(&next) = chars.peek() {
                    if next.is_ascii_alphanumeric() || next == '_' || next == '$' {
                        ident.push(chars.next().unwrap());
                    } else {
                        break;
                    }
                }
                // Peek past whitespace to see if next non-space char is ':'
                let mut lookahead: Vec<char> = Vec::new();
                while let Some(&sp) = chars.peek() {
                    if sp == ' ' || sp == '\t' || sp == '\n' || sp == '\r' {
                        lookahead.push(chars.next().unwrap());
                    } else {
                        break;
                    }
                }
                if chars.peek() == Some(&':') {
                    out.push('"');
                    out.push_str(&ident);
                    out.push('"');
                    out.extend(lookahead.iter());
                } else {
                    out.push_str(&ident);
                    out.extend(lookahead.iter());
                }
            }
            other => out.push(other),
        }
    }

    serde_json::from_str(&out).map_err(|e| format!("{e}\nConverted source:\n{out}"))
}

#[derive(serde::Serialize)]
pub struct ModData {
    pub species: Value,
    pub moves: Value,
    pub items_raw: String,
}

#[tauri::command]
pub fn read_mod_data(mod_path: String) -> Result<ModData, String> {
    let file = fs::read_to_string(&mod_path)
        .map_err(|e| format!("Failed to read {mod_path}: {e}"))?;

    let body = extract_mod_data_body(&file)
        .ok_or("Could not find MOD_DATA in file")?;

    let species_raw = extract_block(&body, "Species")
        .unwrap_or_else(|| "{}".to_string());
    let moves_raw = extract_block(&body, "Moves")
        .unwrap_or_else(|| "{}".to_string());
    let items_raw = extract_block(&body, "Items")
        .unwrap_or_else(|| "{}".to_string());

    let species: Value = js_obj_to_json(&species_raw)
        .map_err(|e| format!("Failed to parse Species: {e}"))?;
    let moves: Value = js_obj_to_json(&moves_raw)
        .map_err(|e| format!("Failed to parse Moves: {e}"))?;

    Ok(ModData { species, moves, items_raw })
}

#[tauri::command]
pub fn write_mod_data(
    mod_path: String,
    species: Value,
    moves: Value,
    items_raw: String,
) -> Result<(), String> {
    let file = fs::read_to_string(&mod_path)
        .map_err(|e| format!("Failed to read: {e}"))?;

    let new_species = serde_json::to_string_pretty(&species).map_err(|e| e.to_string())?;
    let new_moves = serde_json::to_string_pretty(&moves).map_err(|e| e.to_string())?;

    // Build complete new MOD_DATA body — handles fresh mod.js with no existing keys
    let new_body = format!(
        "{{\n  Species: {},\n  Moves: {},\n  Items: {}\n}}",
        new_species, new_moves, items_raw
    );

    let body = extract_mod_data_body(&file)
        .ok_or("Could not find MOD_DATA in file")?;
    let body_start = file.find(&body).ok_or("Body not found in file")?;

    let mut new_file = String::with_capacity(file.len());
    new_file.push_str(&file[..body_start]);
    new_file.push_str(&new_body);
    new_file.push_str(&file[body_start + body.len()..]);

    fs::write(&mod_path, new_file).map_err(|e| format!("Failed to write: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"
export const MOD_ID = 'pokemon-cli';
export const MOD_DATA = {
  Species: {
    'Pikachu': { inherit: true, baseStats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 120 } }
  },
  Moves: {
    'CustomFlame': { num: 10001, name: 'Custom Flame', type: 'Fire' }
  },
  Items: {
    'CustomItem': { num: 10001, name: 'Custom Item', onModifySpA: function() { return 1.2; } }
  },
};
"#;

    #[test]
    fn extracts_species_block() {
        let body = extract_mod_data_body(SAMPLE).unwrap();
        let block = extract_block(&body, "Species").unwrap();
        assert!(block.contains("'Pikachu'"));
        assert!(block.starts_with('{'));
        assert!(block.ends_with('}'));
    }

    #[test]
    fn extracts_items_block_with_function() {
        let body = extract_mod_data_body(SAMPLE).unwrap();
        let block = extract_block(&body, "Items").unwrap();
        assert!(block.contains("onModifySpA"));
        assert!(block.contains("function()"));
    }

    #[test]
    fn extracts_missing_block_returns_none() {
        let body = extract_mod_data_body(SAMPLE).unwrap();
        assert!(extract_block(&body, "Abilities").is_none());
    }

    #[test]
    fn splice_round_trip() {
        let body = extract_mod_data_body(SAMPLE).unwrap();
        let new_moves = r#"{ 'Splash': { num: 150 } }"#;
        let spliced = splice_block(&body, "Moves", new_moves).unwrap();
        let re_extracted = extract_block(&spliced, "Moves").unwrap();
        assert!(re_extracted.contains("'Splash'"));
        assert!(!re_extracted.contains("CustomFlame"));
    }

    #[test]
    fn js_obj_to_json_bare_keys() {
        let js = "{ 'Pikachu': { inherit: true, baseStats: { hp: 35, atk: 55 } } }";
        let v = js_obj_to_json(js).unwrap();
        assert_eq!(v["Pikachu"]["baseStats"]["hp"], 35);
        assert_eq!(v["Pikachu"]["inherit"], true);
    }

    #[test]
    fn js_obj_to_json_mixed_keys() {
        let js = "{ 'CustomFlame': { num: 10001, name: 'Custom Flame', type: 'Fire', category: 'Special' } }";
        let v = js_obj_to_json(js).unwrap();
        assert_eq!(v["CustomFlame"]["num"], 10001);
        assert_eq!(v["CustomFlame"]["type"], "Fire");
    }

    #[test]
    fn js_obj_to_json_empty_object() {
        let v = js_obj_to_json("{}").unwrap();
        assert!(v.as_object().unwrap().is_empty());
    }

    #[test]
    fn read_mod_data_empty_body() {
        let empty_file = "export const MOD_DATA = {\n  // 在这里添加自定义数据\n};\n";
        let body = extract_mod_data_body(empty_file).unwrap();
        assert!(extract_block(&body, "Species").is_none());
        assert!(extract_block(&body, "Moves").is_none());
        assert!(extract_block(&body, "Items").is_none());
        let v = js_obj_to_json(
            &extract_block(&body, "Species").unwrap_or_else(|| "{}".to_string()),
        )
        .unwrap();
        assert!(v.as_object().unwrap().is_empty());
    }
}
