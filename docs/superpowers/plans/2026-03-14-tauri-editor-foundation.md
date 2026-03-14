# Tauri Editor — Foundation & Data Editors Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Tauri 2.x editor scaffold with mod.js read/write and structured editors for Species, Moves, and Items.

**Architecture:** Tauri 2.x backend (Rust) exposes IPC commands for reading/writing `packages/battle/src/mod.js`. The React frontend uses `@tauri-apps/api/core` invoke calls to load and save data. Species and Moves use structured form UIs; Items uses a Monaco raw JS editor to preserve effect callbacks.

**Tech Stack:** Tauri 2.x, React 18 (JSX), Vite 5, @pkmn/dex, @monaco-editor/react, serde_json (Rust), image crate (Rust)

**Spec:** `docs/superpowers/specs/2026-03-14-tauri-editor-design.md`

---

## Chunk 1: Rust Backend — mod_io

### File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/editor/src-tauri/src/main.rs` | Register IPC commands |
| Modify | `packages/editor/src-tauri/Cargo.toml` | Add dependencies |
| Create | `packages/editor/src-tauri/src/commands/mod.rs` | Module declarations |
| Create | `packages/editor/src-tauri/src/commands/mod_io.rs` | Parse and write mod.js |
| Modify | `packages/editor/src-tauri/capabilities/default.json` | Add fs permissions |

---

### Task 1: Add Cargo dependencies

**Files:**
- Modify: `packages/editor/src-tauri/Cargo.toml`

- [ ] **Step 1: Add required crates**

Replace the `[dependencies]` block with:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
tauri-plugin-fs = "2"
tauri-plugin-http = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
image = { version = "0.25", default-features = false, features = ["png"] }
tempfile = "3"
```

- [ ] **Step 2: Run cargo check in the tauri src directory**

```bash
cd packages/editor/src-tauri && cargo check
```

Expected: compiles (warnings OK, errors not OK)

- [ ] **Step 3: Commit**

```bash
git add packages/editor/src-tauri/Cargo.toml
git commit -m "chore(editor): add Cargo dependencies"
```

---

### Task 2: mod_io — paired-brace parser

**Files:**
- Create: `packages/editor/src-tauri/src/commands/mod.rs`
- Create: `packages/editor/src-tauri/src/commands/mod_io.rs`

**Context:** `mod.js` has three top-level keys inside `MOD_DATA = { Species: {...}, Moves: {...}, Items: {...} }`. The parser must handle arbitrarily nested braces. `Items` is extracted as a raw JS string (may contain function values). `Species` and `Moves` are parsed as JSON.

- [ ] **Step 1: Create the commands module file**

Create `packages/editor/src-tauri/src/commands/mod.rs`:

```rust
pub mod mod_io;
```

- [ ] **Step 2: Write unit tests for the brace scanner first**

Create `packages/editor/src-tauri/src/commands/mod_io.rs` with tests only:

```rust
/// Extract the value string for a top-level key inside a JS object literal.
/// `src` is the full content between the outer `{` and `}` of MOD_DATA.
/// Returns the raw string (with surrounding braces) for the given key.
pub fn extract_block(src: &str, key: &str) -> Option<String> {
    todo!()
}

/// Splice a new value string for `key` back into `src`.
pub fn splice_block(src: &str, key: &str, new_value: &str) -> Option<String> {
    todo!()
}

/// Extract the entire MOD_DATA object body from a mod.js file string.
/// Returns the content between (and including) the outermost `{` and `}`.
pub fn extract_mod_data_body(file: &str) -> Option<String> {
    todo!()
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
}
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd packages/editor/src-tauri && cargo test commands::mod_io
```

Expected: compile error on `todo!()` — that's fine, just confirm the test structure compiles after removing `todo!()` and replacing with `unimplemented!()` temporarily if needed. Actually `todo!()` panics at runtime, so tests will panic. Confirm test names appear.

- [ ] **Step 4: Implement `extract_mod_data_body`**

```rust
pub fn extract_mod_data_body(file: &str) -> Option<String> {
    // Find "MOD_DATA = {" then scan for matching closing brace
    let marker = "MOD_DATA = ";
    let start = file.find(marker)? + marker.len();
    let rest = &file[start..];
    let brace_start = rest.find('{')? ;
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
        if escape { escape = false; continue; }
        if ch == '\\' && in_str.is_some() { escape = true; continue; }
        if let Some(q) = in_str {
            if ch == q { in_str = None; }
            continue;
        }
        match ch {
            '\'' | '"' | '`' => { in_str = Some(ch); }
            '{' => { depth += 1; }
            '}' => {
                depth -= 1;
                if depth == 0 { end = i; break; }
            }
            _ => {}
        }
    }
    if depth != 0 { return None; }
    Some(src[..=end].to_string())
}
```

- [ ] **Step 5: Implement `extract_block` and `splice_block` (depth-aware)**

**Why depth-aware?** A naive `str::find("Moves:")` would match the key anywhere — inside nested values, string literals, or comments. We must only match keys that appear at brace depth 1 (direct children of the outer object). Also, the file uses `Key: {` (space before brace), so we must skip whitespace after the colon.

```rust
/// Scan `src` character-by-character and return the byte position of `key`
/// only when it appears as a top-level key (brace depth == 1).
/// `src` must start with the opening `{` of the MOD_DATA body.
fn find_top_level_key(src: &str, key: &str) -> Option<usize> {
    let mut depth = 0i32;
    let mut in_str: Option<char> = None;
    let mut escape = false;
    let bytes = src.as_bytes();
    let n = bytes.len();
    let mut i = 0;
    while i < n {
        let ch = src[i..].chars().next().unwrap();
        let ch_len = ch.len_utf8();
        if escape { escape = false; i += ch_len; continue; }
        if ch == '\\' && in_str.is_some() { escape = true; i += ch_len; continue; }
        if let Some(q) = in_str {
            if ch == q { in_str = None; }
            i += ch_len; continue;
        }
        match ch {
            '\'' | '"' | '`' => { in_str = Some(ch); }
            '{' => { depth += 1; }
            '}' => { depth -= 1; }
            _ => {
                // At depth 1 we are inside the top-level object — check for our key
                if depth == 1 {
                    // Try bare identifier: `Key:`
                    let bare = format!("{}:", key);
                    // Try single-quoted: `'Key':`
                    let sq = format!("'{}': ", key);
                    let sq2 = format!("'{}':", key);
                    // Try double-quoted: `"Key":`
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
    // Advance past the key+colon to find the opening brace
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
```

- [ ] **Step 7: Run tests — all should pass**

```bash
cd packages/editor/src-tauri && cargo test commands::mod_io
```

Expected: 4 tests pass

- [ ] **Step 8: Add the Tauri IPC commands**

Append to `mod_io.rs`:

```rust
use serde_json::Value;
use std::fs;

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

    // All three blocks default to empty objects — handles a fresh mod.js with no keys yet
    let species_raw = extract_block(&body, "Species")
        .unwrap_or_else(|| "{}".to_string());
    let moves_raw = extract_block(&body, "Moves")
        .unwrap_or_else(|| "{}".to_string());
    let items_raw = extract_block(&body, "Items")
        .unwrap_or_else(|| "{}".to_string());

    // Convert JS object literal to JSON: single-quote keys → double-quote
    // Simple approach: only handle the subset produced by the editor (no functions in Species/Moves)
    let species: Value = js_obj_to_json(&species_raw)
        .map_err(|e| format!("Failed to parse Species: {e}"))?;
    let moves: Value = js_obj_to_json(&moves_raw)
        .map_err(|e| format!("Failed to parse Moves: {e}"))?;

    Ok(ModData { species, moves, items_raw })
}

#[tauri::command]
pub fn write_mod_data(mod_path: String, species: Value, moves: Value, items_raw: String) -> Result<(), String> {
    let file = fs::read_to_string(&mod_path)
        .map_err(|e| format!("Failed to read: {e}"))?;

    // Serialize Species and Moves to pretty JSON (valid JS object literal)
    let new_species = serde_json::to_string_pretty(&species)
        .map_err(|e| e.to_string())?;
    let new_moves = serde_json::to_string_pretty(&moves)
        .map_err(|e| e.to_string())?;

    // Build a complete new MOD_DATA body from scratch.
    // This avoids the fragility of splicing-into-existing-body, and correctly handles
    // a fresh mod.js that has no Species/Moves/Items keys yet.
    let new_body = format!(
        "{{\n  Species: {},\n  Moves: {},\n  Items: {}\n}}",
        new_species, new_moves, items_raw
    );

    // Locate and replace the MOD_DATA body in the original file
    let body = extract_mod_data_body(&file)
        .ok_or("Could not find MOD_DATA in file")?;
    let body_start = file.find(&body).ok_or("Body not found in file")?;

    let mut new_file = String::with_capacity(file.len());
    new_file.push_str(&file[..body_start]);
    new_file.push_str(&new_body);
    new_file.push_str(&file[body_start + body.len()..]);

    fs::write(&mod_path, new_file)
        .map_err(|e| format!("Failed to write: {e}"))?;
    Ok(())
}

/// Convert a JS object literal to valid JSON.
/// Handles the subset produced by @pkmn/mods mod data:
/// - Bare identifier keys (`hp: 35` → `"hp": 35`)
/// - Single-quoted string values (`'Fire'` → `"Fire"`)
/// - No functions, computed keys, or template literals.
fn js_obj_to_json(src: &str) -> Result<Value, String> {
    let mut out = String::with_capacity(src.len() + src.len() / 4);
    let mut chars = src.chars().peekable();
    // Tracks whether we are inside a string (and which quote char started it)
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
                out.push('"'); // close with double-quote
            } else {
                // Escape any unescaped double-quotes inside a single-quoted string
                if ch == '"' { out.push('\\'); }
                out.push(ch);
            }
            continue;
        }

        match ch {
            '\'' => {
                // Opening single-quote: start a double-quoted string
                in_str = Some('\'');
                out.push('"');
            }
            '"' => {
                // Already-double-quoted string (should be rare in mod.js but handle it)
                in_str = Some('"');
                out.push('"');
            }
            // Bare identifier key: appears after `{` or `,` followed by optional whitespace
            // We detect it by looking for `<identifier><whitespace*>:` outside a string
            c if c.is_ascii_alphabetic() || c == '_' || c == '$' => {
                // Collect the full identifier
                let mut ident = String::new();
                ident.push(c);
                while let Some(&next) = chars.peek() {
                    if next.is_ascii_alphanumeric() || next == '_' || next == '$' {
                        ident.push(chars.next().unwrap());
                    } else {
                        break;
                    }
                }
                // Peek past whitespace to see if the next non-space char is ':'
                let mut lookahead: Vec<char> = Vec::new();
                while let Some(&sp) = chars.peek() {
                    if sp == ' ' || sp == '\t' || sp == '\n' || sp == '\r' {
                        lookahead.push(chars.next().unwrap());
                    } else {
                        break;
                    }
                }
                if chars.peek() == Some(&':') {
                    // This is a bare identifier key — quote it
                    out.push('"');
                    out.push_str(&ident);
                    out.push('"');
                    out.extend(lookahead.iter());
                } else {
                    // Not a key (e.g., `true`, `false`, `null`, numbers as values)
                    out.push_str(&ident);
                    out.extend(lookahead.iter());
                }
            }
            other => out.push(other),
        }
    }

    serde_json::from_str(&out).map_err(|e| format!("{e}\nConverted source:\n{out}"))
}
```

- [ ] **Step 9: Write tests for `js_obj_to_json` covering real mod.js format**

Add to the `#[cfg(test)]` block:

```rust
#[test]
fn js_obj_to_json_bare_keys() {
    // Real @pkmn/mods format: bare identifier keys, single-quoted string values
    let js = "{ 'Pikachu': { inherit: true, baseStats: { hp: 35, atk: 55 } } }";
    let v = js_obj_to_json(js).unwrap();
    assert_eq!(v["Pikachu"]["baseStats"]["hp"], 35);
    assert_eq!(v["Pikachu"]["inherit"], true);
}

#[test]
fn js_obj_to_json_mixed_keys() {
    // Keys like num, name are bare; string values are single-quoted
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
    // The real fresh mod.js has no Species/Moves/Items keys — must not crash
    let empty_file = "export const MOD_DATA = {\n  // 在这里添加自定义数据\n};\n";
    let body = extract_mod_data_body(empty_file).unwrap();
    // All three should return None (no keys present)
    assert!(extract_block(&body, "Species").is_none());
    assert!(extract_block(&body, "Moves").is_none());
    assert!(extract_block(&body, "Items").is_none());
    // But unwrap_or("{}") produces parseable JSON
    let v = js_obj_to_json(
        &extract_block(&body, "Species").unwrap_or_else(|| "{}".to_string())
    ).unwrap();
    assert!(v.as_object().unwrap().is_empty());
}
```

- [ ] **Step 10: Run all tests**

```bash
cd packages/editor/src-tauri && cargo test
```

Expected: all tests pass

- [ ] **Step 11: Register commands in `main.rs`**

Replace `packages/editor/src-tauri/src/main.rs`:

```rust
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
```

- [ ] **Step 12: Add fs permissions to capabilities**

Replace `packages/editor/src-tauri/capabilities/default.json`:

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
    "fs:allow-write-text-file"
  ]
}
```

- [ ] **Step 13: Cargo check**

```bash
cd packages/editor/src-tauri && cargo check
```

Expected: no errors

- [ ] **Step 14: Commit**

```bash
git add packages/editor/src-tauri/
git commit -m "feat(editor): add mod_io Rust commands with brace-scan parser"
```

---

## Chunk 2: Frontend Scaffold + IPC Layer

### File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/editor/package.json` | Add frontend dependencies |
| Modify | `packages/editor/vite.config.js` | Resolve @pokemon/battle alias |
| Modify | `packages/editor/src/main.jsx` | App entry |
| Modify | `packages/editor/src/App.jsx` | Tab router shell |
| Create | `packages/editor/src/lib/ipc.js` | Typed invoke wrappers |
| Create | `packages/editor/src/lib/dex.js` | @pkmn/dex wrapper |
| Create | `packages/editor/src/lib/types.js` | Shared data shapes (JSDoc) |

---

### Task 3: Install frontend dependencies

- [ ] **Step 1: Add dependencies to packages/editor/package.json**

This is a pnpm workspace — do NOT run `npm install` inside the package. Instead, add the packages to the `dependencies` field manually, then run pnpm from the root.

Edit `packages/editor/package.json`, add to `"dependencies"`:
```json
"@pkmn/dex": "^0.8.0",
"@pkmn/data": "^0.8.0",
"@monaco-editor/react": "^4.6.0"
```

Then from the monorepo root:
```bash
pnpm install
```

- [ ] **Step 2: Verify packages resolved**

```bash
ls packages/editor/node_modules/@pkmn
```

Expected: `dex` and `data` directories (or via workspace root `node_modules/@pkmn`)

- [ ] **Step 3: Commit**

```bash
git add packages/editor/package.json pnpm-lock.yaml
git commit -m "chore(editor): add @pkmn/dex, @pkmn/data, @monaco-editor/react"
```

---

### Task 4: IPC wrapper and types

**Files:**
- Create: `packages/editor/src/lib/ipc.js`
- Create: `packages/editor/src/lib/types.js`

- [ ] **Step 1: Create types.js**

```js
// packages/editor/src/lib/types.js

/**
 * @typedef {Object} BaseStats
 * @property {number} hp
 * @property {number} atk
 * @property {number} def
 * @property {number} spa
 * @property {number} spd
 * @property {number} spe
 */

/**
 * @typedef {Object} SpeciesEntry
 * @property {number} num
 * @property {string} name
 * @property {string[]} types
 * @property {BaseStats} baseStats
 * @property {{ '0': string, '1'?: string, H?: string }} abilities
 * @property {number} [height]
 * @property {number} [weight]
 * @property {string} [color]
 * @property {string} [prevo]
 * @property {string[]} [evos]
 * @property {boolean} [inherit]
 */

/**
 * @typedef {Object} MoveEntry
 * @property {number} num
 * @property {string} name
 * @property {string} type
 * @property {'Physical'|'Special'|'Status'} category
 * @property {number} [basePower]
 * @property {number} [accuracy]
 * @property {number} [pp]
 * @property {number} [priority]
 * @property {string} [target]
 */

/**
 * @typedef {Object} ModData
 * @property {Record<string, SpeciesEntry>} species
 * @property {Record<string, MoveEntry>} moves
 * @property {string} items_raw
 */
```

- [ ] **Step 2: Create ipc.js**

```js
// packages/editor/src/lib/ipc.js
import { invoke } from '@tauri-apps/api/core';

/** @returns {Promise<import('./types.js').ModData>} */
export function readModData(modPath) {
  return invoke('read_mod_data', { modPath });
}

/**
 * @param {string} modPath
 * @param {Record<string, import('./types.js').SpeciesEntry>} species
 * @param {Record<string, import('./types.js').MoveEntry>} moves
 * @param {string} itemsRaw
 */
export function writeModData(modPath, species, moves, itemsRaw) {
  return invoke('write_mod_data', { modPath, species, moves, itemsRaw });
}
```

- [ ] **Step 3: Create dex.js**

```js
// packages/editor/src/lib/dex.js
import { Dex } from '@pkmn/dex';
import { Generations } from '@pkmn/data';

const gens = new Generations(Dex);
const gen9 = gens.get(9);

/** @returns {string[]} All official Gen 9 species names */
export function getAllSpeciesNames() {
  const names = [];
  for (const s of gen9.species) {
    if (s.exists) names.push(s.name);
  }
  return names.sort();
}

/** @returns {string[]} All ability names in dex */
export function getAllAbilityNames() {
  const names = [];
  for (const a of Dex.abilities.all()) {
    if (a.exists) names.push(a.name);
  }
  return names.sort();
}

/** @param {string} name @returns {import('./types.js').SpeciesEntry|null} */
export function getOfficialSpecies(name) {
  const s = gen9.species.get(name);
  if (!s || !s.exists) return null;
  return {
    num: s.num,
    name: s.name,
    types: s.types,
    baseStats: s.baseStats,
    abilities: s.abilities,
    height: s.heightm,
    weight: s.weightkg,
    color: s.color,
    prevo: s.prevo || undefined,
    evos: s.evos?.length ? s.evos : undefined,
    inherit: true,
  };
}

export const TYPES = [
  'Normal','Fire','Water','Electric','Grass','Ice',
  'Fighting','Poison','Ground','Flying','Psychic','Bug',
  'Rock','Ghost','Dragon','Dark','Steel','Fairy'
];
```

- [ ] **Step 4: Commit**

```bash
git add packages/editor/src/lib/
git commit -m "feat(editor): add IPC wrapper and dex.js frontend layer"
```

---

### Task 5: App shell with tab router

**Files:**
- Modify: `packages/editor/src/App.jsx`

- [ ] **Step 1: Rewrite App.jsx — lift mod state up**

Shared state lives in App to prevent editors from overwriting each other's changes.
All editors read from and write back to this single shared state via props.

```jsx
// packages/editor/src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { readModData, writeModData } from './lib/ipc.js';
import { useModPath } from './hooks/useModPath.js';
import DexEditor from './pages/DexEditor/index.jsx';
import MovesEditor from './pages/MovesEditor/index.jsx';
import ItemsEditor from './pages/ItemsEditor/index.jsx';
import SpriteStudio from './pages/SpriteStudio/index.jsx';
import LearnsetEditor from './pages/LearnsetEditor/index.jsx';

const TAB_IDS = ['dex', 'moves', 'items', 'sprites', 'learnset'];
const TAB_LABELS = { dex: '图鉴', moves: '技能', items: '道具', sprites: '精灵工坊', learnset: '学习表' };

export default function App() {
  const modPath = useModPath();
  const [active, setActive] = useState('dex');

  // Shared mod data — single source of truth for all editors
  const [species, setSpecies] = useState({});
  const [moves, setMoves] = useState({});
  const [itemsRaw, setItemsRaw] = useState('{}');
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('加载中…');

  useEffect(() => {
    readModData(modPath)
      .then(data => {
        setSpecies(data.species ?? {});
        setMoves(data.moves ?? {});
        setItemsRaw(data.items_raw ?? '{}');
        setStatus('已加载');
      })
      .catch(e => setStatus(`加载失败: ${e}`));
  }, [modPath]);

  const handleSave = useCallback(async () => {
    try {
      await writeModData(modPath, species, moves, itemsRaw);
      setDirty(false);
      setStatus('已保存 ✓');
    } catch (e) {
      setStatus(`保存失败: ${e}`);
    }
  }, [modPath, species, moves, itemsRaw]);

  const sharedProps = {
    species, setSpecies: (fn) => { setSpecies(fn); setDirty(true); },
    moves,   setMoves:   (fn) => { setMoves(fn);   setDirty(true); },
    itemsRaw, setItemsRaw: (v) => { setItemsRaw(v); setDirty(true); },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
      <nav style={{ display: 'flex', borderBottom: '1px solid #333', background: '#1a1a2e', alignItems: 'center' }}>
        {TAB_IDS.map(id => (
          <button key={id} onClick={() => setActive(id)}
            style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer',
              background: active === id ? '#16213e' : 'transparent',
              color: active === id ? '#e94560' : '#aaa',
              borderBottom: active === id ? '2px solid #e94560' : '2px solid transparent',
              fontSize: 14,
            }}>
            {TAB_LABELS[id]}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px' }}>
          <button onClick={handleSave} disabled={!dirty}
            style={{ padding: '5px 14px', background: dirty ? '#e94560' : '#333', color: '#fff', border: 'none', cursor: dirty ? 'pointer' : 'default', borderRadius: 4, fontSize: 13 }}>
            保存 mod.js
          </button>
          <span style={{ color: '#888', fontSize: 12 }}>{status}</span>
        </div>
      </nav>
      <div style={{ flex: 1, overflow: 'auto', background: '#0f3460', color: '#eee' }}>
        {active === 'dex'      && <DexEditor      {...sharedProps} />}
        {active === 'moves'    && <MovesEditor    {...sharedProps} />}
        {active === 'items'    && <ItemsEditor    {...sharedProps} />}
        {active === 'sprites'  && <SpriteStudio />}
        {active === 'learnset' && <LearnsetEditor />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create stub page components (so App compiles)**

Create these five files — each is a minimal placeholder:

`packages/editor/src/pages/DexEditor/index.jsx`:
```jsx
export default function DexEditor() { return <div style={{padding:20}}>图鉴编辑器 — 加载中</div>; }
```

`packages/editor/src/pages/MovesEditor/index.jsx`:
```jsx
export default function MovesEditor() { return <div style={{padding:20}}>技能编辑器 — 加载中</div>; }
```

`packages/editor/src/pages/ItemsEditor/index.jsx`:
```jsx
export default function ItemsEditor() { return <div style={{padding:20}}>道具编辑器 — 加载中</div>; }
```

`packages/editor/src/pages/SpriteStudio/index.jsx`:
```jsx
export default function SpriteStudio() { return <div style={{padding:20}}>精灵工坊 — 加载中</div>; }
```

`packages/editor/src/pages/LearnsetEditor/index.jsx`:
```jsx
export default function LearnsetEditor() { return <div style={{padding:20}}>学习表 — 加载中</div>; }
```

- [ ] **Step 3: Start the dev server (frontend only)**

```bash
cd packages/editor && npm run dev
```

Open browser at `http://localhost:1420` (or whatever port Vite reports). Confirm 5 tabs render, clicking switches between placeholders.

- [ ] **Step 4: Commit**

```bash
git add packages/editor/src/
git commit -m "feat(editor): add tab shell with page stubs"
```

---

## Chunk 3: Dex Editor

### File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/editor/src/pages/DexEditor/index.jsx` | State management, load/save |
| Create | `packages/editor/src/pages/DexEditor/SpeciesList.jsx` | Left panel, list + search |
| Create | `packages/editor/src/pages/DexEditor/SpeciesForm.jsx` | Right panel, edit form |
| Create | `packages/editor/src/hooks/useModPath.js` | Resolve mod.js path via env/dialog |

---

### Task 6: mod.js path resolution

**Files:**
- Create: `packages/editor/src/hooks/useModPath.js`

**Context:** The editor needs to know where `packages/battle/src/mod.js` lives. Simplest approach: hardcode relative to `__dirname` using Tauri's `appLocalDataDir`, or just resolve from the editor's own location. For dev, we can use an env variable injected at build time.

- [ ] **Step 1: Add Vite env variable**

In `packages/editor/vite.config.js`, add a `define` block to inject the mod path.

**Note:** `package.json` has `"type": "module"` so `vite.config.js` runs as ESM — use `import.meta.url` instead of `__dirname`.

```js
// packages/editor/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  define: {
    __MOD_PATH__: JSON.stringify(
      resolve(__dirname, '../battle/src/mod.js').replace(/\\/g, '/')
    ),
  },
  server: { port: 1420, strictPort: true },
});
```

- [ ] **Step 2: Create useModPath hook**

```js
// packages/editor/src/hooks/useModPath.js

/** Returns the absolute path to mod.js, injected at build time. */
export function useModPath() {
  return __MOD_PATH__;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/editor/vite.config.js packages/editor/src/hooks/
git commit -m "feat(editor): inject mod.js path via Vite define"
```

---

### Task 7: DexEditor — receives shared state via props

**Files:**
- Modify: `packages/editor/src/pages/DexEditor/index.jsx`

State is managed in App.jsx (shared). DexEditor receives `species` and `setSpecies` as props.

- [ ] **Step 1: Implement DexEditor (props-based, no local load/save)**

```jsx
// packages/editor/src/pages/DexEditor/index.jsx
import React, { useState, useCallback } from 'react';
import SpeciesList from './SpeciesList.jsx';
import SpeciesForm from './SpeciesForm.jsx';

export default function DexEditor({ species, setSpecies }) {
  const [selected, setSelected] = useState(null);

  const handleUpdate = useCallback((name, entry) => {
    setSpecies(prev => ({ ...prev, [name]: entry }));
  }, [setSpecies]);

  const handleDelete = useCallback((name) => {
    setSpecies(prev => { const n = { ...prev }; delete n[name]; return n; });
    if (selected === name) setSelected(null);
  }, [selected, setSpecies]);

  const handleNew = useCallback(() => {
    const nums = Object.values(species).map(s => s.num).filter(n => n >= 10000);
    const nextNum = nums.length ? Math.max(...nums) + 1 : 10000;
    const name = `Custom${nextNum}`;
    const entry = {
      num: nextNum, name, types: ['Normal'],
      baseStats: { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 },
      abilities: { '0': 'Adaptability' },
    };
    setSpecies(prev => ({ ...prev, [name]: entry }));
    setSelected(name);
  }, [species, setSpecies]);

  const handleFork = useCallback((name, entry) => {
    setSpecies(prev => ({ ...prev, [name]: entry }));
    setSelected(name);
  }, [setSpecies]);

  const selectedEntry = selected ? species[selected] : null;

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <SpeciesList
        species={species}
        selected={selected}
        onSelect={setSelected}
        onNew={handleNew}
        onDelete={handleDelete}
        onFork={handleFork}
      />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {selectedEntry
          ? <SpeciesForm key={selected} name={selected} entry={selectedEntry} onUpdate={handleUpdate} />
          : <div style={{ padding: 40, color: '#666' }}>← 选择或新建一个精灵</div>
        }
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/editor/src/pages/DexEditor/index.jsx
git commit -m "feat(editor): DexEditor state management and load/save"
```

---

### Task 8: SpeciesList component

**Files:**
- Modify: `packages/editor/src/pages/DexEditor/SpeciesList.jsx`

- [ ] **Step 1: Implement SpeciesList**

```jsx
// packages/editor/src/pages/DexEditor/SpeciesList.jsx
import React, { useState } from 'react';
import { getAllSpeciesNames, getOfficialSpecies } from '../../lib/dex.js';

const ALL_OFFICIAL = getAllSpeciesNames(); // loaded once

export default function SpeciesList({ species, selected, onSelect, onNew, onDelete }) {
  const [search, setSearch] = useState('');
  const [showForkDialog, setShowForkDialog] = useState(false);
  const [forkSearch, setForkSearch] = useState('');

  const entries = Object.keys(species).filter(k =>
    k.toLowerCase().includes(search.toLowerCase())
  );

  const forkResults = ALL_OFFICIAL.filter(n =>
    n.toLowerCase().includes(forkSearch.toLowerCase()) && !species[n]
  ).slice(0, 20);

  function handleFork(officialName) {
    const entry = getOfficialSpecies(officialName);
    if (!entry) return;
    onSelect && onSelect(officialName);
    // Notify parent to add this entry
    // We need to update species — pass up via a callback
    // Using a custom event to keep the component boundary simple
    window.dispatchEvent(new CustomEvent('editor:fork', { detail: { name: officialName, entry } }));
    setShowForkDialog(false);
  }

  return (
    <div style={{ width: 220, borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 8, background: '#16213e' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜索..." style={{ width: '100%', padding: 4, background: '#0d0d1a', color: '#eee', border: '1px solid #444', boxSizing: 'border-box' }} />
      </div>
      <div style={{ padding: 8, display: 'flex', gap: 4 }}>
        <button onClick={onNew} style={{ flex: 1, padding: 4, fontSize: 12, background: '#1a6b3c', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: 3 }}>
          + 新建
        </button>
        <button onClick={() => setShowForkDialog(true)} style={{ flex: 1, padding: 4, fontSize: 12, background: '#1a3b6b', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: 3 }}>
          Fork 官方
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {entries.map(name => (
          <div key={name} onClick={() => onSelect(name)}
            style={{
              padding: '6px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
              background: selected === name ? '#16213e' : 'transparent',
              borderLeft: selected === name ? '3px solid #e94560' : '3px solid transparent',
              color: species[name]?.inherit ? '#7fb3f5' : '#eee',
            }}>
            <span style={{ fontSize: 13 }}>{name}</span>
            <button onClick={e => { e.stopPropagation(); onDelete(name); }}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12 }}>✕</button>
          </div>
        ))}
        {entries.length === 0 && <div style={{ padding: 16, color: '#555', fontSize: 12 }}>无精灵（点新建添加）</div>}
      </div>

      {showForkDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#16213e', padding: 20, borderRadius: 8, width: 320 }}>
            <h3 style={{ margin: '0 0 12px', color: '#eee' }}>Fork 官方精灵</h3>
            <input value={forkSearch} onChange={e => setForkSearch(e.target.value)} autoFocus
              placeholder="搜索官方精灵..." style={{ width: '100%', padding: 6, background: '#0d0d1a', color: '#eee', border: '1px solid #444', marginBottom: 8, boxSizing: 'border-box' }} />
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {forkResults.map(name => (
                <div key={name} onClick={() => handleFork(name)}
                  style={{ padding: '6px 10px', cursor: 'pointer', color: '#7fb3f5', fontSize: 13 }}
                  onMouseEnter={e => e.target.style.background = '#1a3b6b'}
                  onMouseLeave={e => e.target.style.background = 'transparent'}>
                  {name}
                </div>
              ))}
              {forkResults.length === 0 && <div style={{ color: '#555', padding: 8 }}>无结果</div>}
            </div>
            <button onClick={() => setShowForkDialog(false)} style={{ marginTop: 12, padding: '6px 16px', background: '#333', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: 4 }}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update SpeciesList to use `onFork` prop**

In `SpeciesList.jsx`, the `handleFork` function currently calls `onSelect` then dispatches a window event. Replace both with a direct prop call — no global events needed:

```js
// Replace the entire handleFork function body in SpeciesList.jsx:
function handleFork(officialName) {
  const entry = getOfficialSpecies(officialName);
  if (!entry) return;
  onFork(officialName, entry); // single callback, DexEditor handles both setSpecies + setSelected
  setShowForkDialog(false);
}
```

Also add `onFork` to the component's props destructuring:
```js
export default function SpeciesList({ species, selected, onSelect, onNew, onDelete, onFork }) {
```

- [ ] **Step 3: Commit**

```bash
git add packages/editor/src/pages/DexEditor/
git commit -m "feat(editor): SpeciesList with Fork dialog"
```

---

### Task 9: SpeciesForm component

**Files:**
- Create: `packages/editor/src/pages/DexEditor/SpeciesForm.jsx`

- [ ] **Step 1: Implement SpeciesForm**

```jsx
// packages/editor/src/pages/DexEditor/SpeciesForm.jsx
import React, { useState } from 'react';
import { TYPES, getAllAbilityNames } from '../../lib/dex.js';

const ABILITIES = getAllAbilityNames();
const COLORS = ['Red','Blue','Yellow','Green','Black','Brown','Purple','Gray','White','Pink'];

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <label style={{ width: 100, fontSize: 12, color: '#aaa', textAlign: 'right', flexShrink: 0 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = { background: '#0d0d1a', color: '#eee', border: '1px solid #444', padding: '3px 6px', borderRadius: 3, fontSize: 13 };

export default function SpeciesForm({ name, entry, onUpdate }) {
  const [local, setLocal] = useState({ ...entry });

  function patch(key, value) {
    const next = { ...local, [key]: value };
    setLocal(next);
    onUpdate(name, next);
  }

  function patchStat(stat, value) {
    const next = { ...local, baseStats: { ...local.baseStats, [stat]: Number(value) || 0 } };
    setLocal(next);
    onUpdate(name, next);
  }

  function patchAbility(slot, value) {
    const next = { ...local, abilities: { ...local.abilities, [slot]: value } };
    setLocal(next);
    onUpdate(name, next);
  }

  const bst = Object.values(local.baseStats ?? {}).reduce((s, v) => s + (v || 0), 0);

  return (
    <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
      <h2 style={{ margin: '0 0 20px', color: '#e94560' }}>{name}</h2>

      <Field label="编号 (num)">
        <input type="number" value={local.num ?? ''} style={inputStyle}
          onChange={e => patch('num', Number(e.target.value))} />
      </Field>

      <Field label="inherit">
        <input type="checkbox" checked={!!local.inherit}
          onChange={e => patch('inherit', e.target.checked)} />
        <span style={{ fontSize: 12, color: '#888' }}>（继承官方基础数据）</span>
      </Field>

      <Field label="属性1">
        <select value={local.types?.[0] ?? 'Normal'} style={inputStyle}
          onChange={e => patch('types', [e.target.value, local.types?.[1]])}>
          {TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </Field>

      <Field label="属性2">
        <select value={local.types?.[1] ?? ''} style={inputStyle}
          onChange={e => patch('types', [local.types?.[0] ?? 'Normal', e.target.value || undefined].filter(Boolean))}>
          <option value="">无</option>
          {TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </Field>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>种族值 (BST: {bst})</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {['hp','atk','def','spa','spd','spe'].map(stat => (
            <div key={stat} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, color: '#888', width: 28 }}>{stat.toUpperCase()}</span>
              <input type="number" min={1} max={255} value={local.baseStats?.[stat] ?? 0} style={{ ...inputStyle, width: 54 }}
                onChange={e => patchStat(stat, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      {['0','1','H'].map(slot => (
        <Field key={slot} label={slot === 'H' ? '隐藏特性' : `特性${slot}`}>
          <input list={`ability-list-${slot}`} value={local.abilities?.[slot] ?? ''} style={{ ...inputStyle, width: 200 }}
            onChange={e => patchAbility(slot, e.target.value)} />
          <datalist id={`ability-list-${slot}`}>
            {ABILITIES.map(a => <option key={a} value={a} />)}
          </datalist>
        </Field>
      ))}

      <Field label="颜色">
        <select value={local.color ?? ''} style={inputStyle} onChange={e => patch('color', e.target.value)}>
          <option value="">无</option>
          {COLORS.map(c => <option key={c}>{c}</option>)}
        </select>
      </Field>

      <Field label="身高 (dm)">
        <input type="number" value={local.height ?? ''} style={inputStyle} onChange={e => patch('height', Number(e.target.value))} />
      </Field>

      <Field label="体重 (hg)">
        <input type="number" value={local.weight ?? ''} style={inputStyle} onChange={e => patch('weight', Number(e.target.value))} />
      </Field>

      <Field label="进化前">
        <input value={local.prevo ?? ''} style={inputStyle} onChange={e => patch('prevo', e.target.value || undefined)} />
      </Field>

      <Field label="进化后">
        <input value={local.evos?.join(', ') ?? ''} style={inputStyle} placeholder="逗号分隔"
          onChange={e => patch('evos', e.target.value ? e.target.value.split(',').map(s => s.trim()) : undefined)} />
      </Field>
    </div>
  );
}
```

- [ ] **Step 2: Start Tauri dev to test end to end**

```bash
cd packages/editor && npx tauri dev
```

- Open the editor, click "图鉴" tab
- Confirm the mod.js loads and species appear in the list
- Edit a stat and click "保存到 mod.js"
- Open `packages/battle/src/mod.js` and verify the change is written

- [ ] **Step 3: Commit**

```bash
git add packages/editor/src/pages/DexEditor/
git commit -m "feat(editor): complete DexEditor with SpeciesForm"
```

---

## Chunk 4: Items Editor (Monaco) + Moves Editor

### File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/editor/src/pages/ItemsEditor/index.jsx` | Monaco raw JS editor |
| Create | `packages/editor/src/pages/MovesEditor/index.jsx` | Moves list orchestrator |
| Create | `packages/editor/src/pages/MovesEditor/MoveList.jsx` | Left panel |
| Create | `packages/editor/src/pages/MovesEditor/MoveForm.jsx` | Right panel form |

---

### Task 10: Items Editor with Monaco

**Context:** Items can contain function values like `onModifySpA: () => 1.2`, which cannot be JSON-serialized. The editor presents the raw JS block in a Monaco code editor. The backend reads it as a string and writes it back verbatim.

- [ ] **Step 1: Implement ItemsEditor (props-based)**

Receives `itemsRaw` and `setItemsRaw` from App shared state. No local load/save.

```jsx
// packages/editor/src/pages/ItemsEditor/index.jsx
import React from 'react';
import Editor from '@monaco-editor/react';

export default function ItemsEditor({ itemsRaw, setItemsRaw }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 16px', background: '#16213e' }}>
        <span style={{ color: '#aaa', fontSize: 13 }}>道具编辑器 — 直接编辑 JS（支持 effect 函数）— 在顶栏点"保存 mod.js"</span>
      </div>
      <div style={{ flex: 1 }}>
        <Editor
          height="100%"
          defaultLanguage="javascript"
          value={itemsRaw}
          theme="vs-dark"
          onChange={v => setItemsRaw(v ?? '{}')}
          options={{ minimap: { enabled: false }, fontSize: 13, tabSize: 2 }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify Monaco loads in Tauri dev**

```bash
cd packages/editor && npx tauri dev
```

Click "道具" tab. Monaco editor should appear with the current Items block content.

- [ ] **Step 3: Commit**

```bash
git add packages/editor/src/pages/ItemsEditor/
git commit -m "feat(editor): Items editor with Monaco raw JS"
```

---

### Task 11: Moves Editor

**Files:**
- Modify: `packages/editor/src/pages/MovesEditor/index.jsx`
- Create: `packages/editor/src/pages/MovesEditor/MoveList.jsx`
- Create: `packages/editor/src/pages/MovesEditor/MoveForm.jsx`

- [ ] **Step 1: Implement MovesEditor (props-based)**

Receives `moves` and `setMoves` from App shared state.

```jsx
// packages/editor/src/pages/MovesEditor/index.jsx
import React, { useState, useCallback } from 'react';
import MoveList from './MoveList.jsx';
import MoveForm from './MoveForm.jsx';

export default function MovesEditor({ moves, setMoves }) {
  const [selected, setSelected] = useState(null);

  const handleUpdate = useCallback((name, entry) => {
    setMoves(prev => ({ ...prev, [name]: entry }));
  }, [setMoves]);

  const handleDelete = useCallback((name) => {
    setMoves(prev => { const n = { ...prev }; delete n[name]; return n; });
    if (selected === name) setSelected(null);
  }, [selected, setMoves]);

  const handleNew = useCallback(() => {
    const nums = Object.values(moves).map(m => m.num).filter(n => n >= 10000);
    const nextNum = nums.length ? Math.max(...nums) + 1 : 10000;
    const name = `CustomMove${nextNum}`;
    const entry = { num: nextNum, name, type: 'Normal', category: 'Physical', basePower: 60, accuracy: 100, pp: 10, priority: 0, target: 'normal' };
    setMoves(prev => ({ ...prev, [name]: entry }));
    setSelected(name);
  }, [moves, setMoves]);

  const selectedEntry = selected ? moves[selected] : null;

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <MoveList moves={moves} selected={selected} onSelect={setSelected} onNew={handleNew} onDelete={handleDelete} />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {selectedEntry
          ? <MoveForm key={selected} name={selected} entry={selectedEntry} onUpdate={handleUpdate} />
          : <div style={{ padding: 40, color: '#666' }}>← 选择或新建一个技能</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement MoveList**

```jsx
// packages/editor/src/pages/MovesEditor/MoveList.jsx
import React, { useState } from 'react';

const TYPE_COLORS = { Fire:'#F08030',Water:'#6890F0',Grass:'#78C850',Electric:'#F8D030',Normal:'#A8A878',Psychic:'#F85888',Dragon:'#7038F8',Dark:'#705848',Steel:'#B8B8D0',Fighting:'#C03028',Ice:'#98D8D8',Ghost:'#705898',Poison:'#A040A0',Ground:'#E0C068',Flying:'#A890F0',Bug:'#A8B820',Rock:'#B8A038',Fairy:'#EE99AC' };

export default function MoveList({ moves, selected, onSelect, onNew, onDelete }) {
  const [search, setSearch] = useState('');
  const entries = Object.keys(moves).filter(k => k.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ width: 220, borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 8, background: '#16213e' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索技能..."
          style={{ width: '100%', padding: 4, background: '#0d0d1a', color: '#eee', border: '1px solid #444', boxSizing: 'border-box' }} />
      </div>
      <div style={{ padding: 8 }}>
        <button onClick={onNew} style={{ width: '100%', padding: 4, fontSize: 12, background: '#1a6b3c', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: 3 }}>+ 新建技能</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {entries.map(name => (
          <div key={name} onClick={() => onSelect(name)}
            style={{ padding: '6px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: selected === name ? '#16213e' : 'transparent', borderLeft: selected === name ? '3px solid #e94560' : '3px solid transparent' }}>
            <div>
              <div style={{ fontSize: 13, color: '#eee' }}>{name}</div>
              <div style={{ fontSize: 11, color: TYPE_COLORS[moves[name]?.type] ?? '#888' }}>{moves[name]?.type} · {moves[name]?.category}</div>
            </div>
            <button onClick={e => { e.stopPropagation(); onDelete(name); }} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12 }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement MoveForm**

```jsx
// packages/editor/src/pages/MovesEditor/MoveForm.jsx
import React, { useState } from 'react';
import { TYPES } from '../../lib/dex.js';

const CATEGORIES = ['Physical', 'Special', 'Status'];
const TARGETS = ['normal','self','allySide','foeSide','all','adjacentAlly','adjacentFoe','any','allAdjacent','allAdjacentFoes','entireField'];
const inputStyle = { background: '#0d0d1a', color: '#eee', border: '1px solid #444', padding: '3px 6px', borderRadius: 3, fontSize: 13 };

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <label style={{ width: 110, fontSize: 12, color: '#aaa', textAlign: 'right', flexShrink: 0 }}>{label}</label>
      {children}
    </div>
  );
}

export default function MoveForm({ name, entry, onUpdate }) {
  const [local, setLocal] = useState({ ...entry });

  function patch(key, value) {
    const next = { ...local, [key]: value };
    setLocal(next);
    onUpdate(name, next);
  }

  return (
    <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
      <h2 style={{ margin: '0 0 20px', color: '#e94560' }}>{name}</h2>
      <Field label="编号 (num)"><input type="number" value={local.num ?? ''} style={inputStyle} onChange={e => patch('num', Number(e.target.value))} /></Field>
      <Field label="属性 (type)">
        <select value={local.type ?? 'Normal'} style={inputStyle} onChange={e => patch('type', e.target.value)}>
          {TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="分类 (category)">
        <select value={local.category ?? 'Physical'} style={inputStyle} onChange={e => patch('category', e.target.value)}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="威力 (basePower)"><input type="number" value={local.basePower ?? 0} style={inputStyle} onChange={e => patch('basePower', Number(e.target.value))} /></Field>
      <Field label="命中 (accuracy)"><input type="number" value={local.accuracy ?? 100} style={inputStyle} onChange={e => patch('accuracy', Number(e.target.value))} /></Field>
      <Field label="PP"><input type="number" value={local.pp ?? 10} style={inputStyle} onChange={e => patch('pp', Number(e.target.value))} /></Field>
      <Field label="优先级 (priority)"><input type="number" value={local.priority ?? 0} min={-7} max={5} style={inputStyle} onChange={e => patch('priority', Number(e.target.value))} /></Field>
      <Field label="目标 (target)">
        <select value={local.target ?? 'normal'} style={inputStyle} onChange={e => patch('target', e.target.value)}>
          {TARGETS.map(t => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="描述 (desc)"><input value={local.desc ?? ''} style={{ ...inputStyle, width: 300 }} onChange={e => patch('desc', e.target.value)} /></Field>
      <Field label="简短描述"><input value={local.shortDesc ?? ''} style={{ ...inputStyle, width: 300 }} onChange={e => patch('shortDesc', e.target.value)} /></Field>
    </div>
  );
}
```

- [ ] **Step 4: Run Tauri dev and test Moves editor end to end**

```bash
cd packages/editor && npx tauri dev
```

- Click "技能" tab — move list renders
- Create a new move, fill in fields, click Save
- Verify mod.js is updated

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src/pages/MovesEditor/
git commit -m "feat(editor): complete Moves editor"
```

---

## Chunk 5: Final wiring + smoke test

### Task 12: Verify full read/write round-trip

- [ ] **Step 1: Add a test Species with nested baseStats via DexEditor**

In Tauri dev: add a new species with all stats filled, click Save.

- [ ] **Step 2: Verify mod.js is valid JS**

```bash
node -e "const m = require('./packages/battle/src/mod.js'); console.log('OK', Object.keys(m.MOD_DATA.Species))"
```

Wait — mod.js uses ES module syntax (`export const`). Check it with:

```bash
node --input-type=module < packages/battle/src/mod.js && echo "Valid ESM"
```

Expected: no syntax errors, prints "Valid ESM"

- [ ] **Step 3: Verify CLI still works after edit**

```bash
pnpm cli:dev
```

Start a battle — confirm the modified species data appears correctly in the game.

- [ ] **Step 4: Final commit**

```bash
git add packages/editor/
git commit -m "feat(editor): foundation complete — Dex, Moves, Items editors"
```

---

*Plan B (Sprite Studio + Learnset) to be written separately after P1-P2 are complete.*
