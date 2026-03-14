# Tauri Pokemon Editor — Design Spec

**Date:** 2026-03-14
**Status:** Draft
**Location:** `packages/editor/`

---

## 1. Overview

A Tauri 2.x desktop application for editing the game's mod data, managing sprites, and browsing learnsets. The editor reads and writes `packages/battle/src/mod.js` (the `MOD_DATA` object) as its single source of truth.

**Scope:**
- Pokédex Editor — create and modify custom species and official-species overrides
- Sprite Studio — multi-engine ASCII generation with visual comparison and config persistence
- Learnset Editor — read-only learnset browser with level-up / egg / TM tables
- Items Editor — Monaco raw JS editor for Items block (supports function-valued effect callbacks)
- Map Planner — roadmap placeholder, no implementation in this phase

**Non-goals:** The editor does not ship a battle simulator or game runtime. It is purely a data-authoring tool.

---

## 2. Architecture

```
packages/editor/
├── src/                          Rust (Tauri backend)
│   ├── main.rs
│   └── commands/
│       ├── mod_io.rs             Read / write mod.js
│       ├── sprite_fetch.rs       Download PNG from PokéAPI
│       ├── ascii_native.rs       Built-in Rust ASCII engine
│       └── sidecar.rs            Invoke chafa / jp2a / node sidecars
├── frontend/                     React + Vite (TypeScript)
│   └── src/
│       ├── App.tsx               Tab router (Dex / Sprites / Learnset / Map)
│       ├── pages/
│       │   ├── DexEditor.tsx
│       │   ├── SpriteStudio.tsx
│       │   ├── LearnsetEditor.tsx
│       │   └── MapPlanner.tsx
│       └── lib/
│           ├── dex.ts            @pkmn/dex wrapper (browser-side)
│           └── modParser.ts      MOD_DATA serializer / deserializer
├── sidecars/                     Bundled binaries (platform-specific)
│   ├── chafa-x86_64-windows.exe
│   ├── jp2a-x86_64-windows.exe
│   └── node-sprite.cjs           Thin Node.js wrapper (Jimp, existing logic)
└── tauri.conf.json
```

### Data flow

```
mod.js  ──(Rust read)──►  MOD_DATA JSON  ──(IPC)──►  React state
                                                           │
                                                     user edits
                                                           │
mod.js  ◄─(Rust write)──  MOD_DATA JSON  ◄─(IPC)──  React state
```

`@pkmn/dex` runs entirely in the Vite frontend (same npm package as CLI). Official Gen 9 data is read-only in the browser; only `MOD_DATA` is writable.

---

## 3. Pokédex Editor

### Layout

Two-panel layout:
- **Left:** species list (all `MOD_DATA.Species` entries + search/filter)
- **Right:** form editor for the selected species

### Species list

- Displays: sprite thumbnail (if cached), name, num, type badges
- "New Species" button — blank form, `num` auto-assigned ≥ 10000
- "Fork from Official" button — opens a picker of all Gen 9 species, creates an entry with `inherit: true` pre-filled
- Each entry shows a "Modified" indicator if it overrides any field of an official species

### Form fields

| Field | Control |
|-------|---------|
| `num` | Number input (read-only for inherited entries) |
| `name` | Text input |
| `types[0]`, `types[1]` | Type selector (18 types + None) |
| `baseStats` (hp/atk/def/spa/spd/spe) | Numeric inputs + live BST total |
| `abilities['0']`, `['1']`, `['H']` | Autocomplete from dex ability list |
| `height`, `weight` | Number inputs (dm / hg) |
| `color` | Color picker mapped to Pokemon color names |
| `genderRatio` | Slider (male %) or "Genderless" toggle |
| `evYield` | 6 stat inputs |
| `prevo`, `evos[]` | Text inputs with autocomplete |
| `gen` | Number input |

### Save / discard

- Changes are held in React state (dirty tracking per field)
- "Save" writes the full `MOD_DATA.Species` back to `mod.js` via Tauri command
- "Discard" resets to last saved state
- Validation: `num` must be unique; `name` must be non-empty

---

## 4. Sprite Studio

### Purpose

Download PNG sprites from PokéAPI, run them through multiple ASCII generation engines with configurable parameters, display results side by side, and save the chosen config + output to the sprite cache (`~/.pokemon-cli/sprites/`).

### Sprite variants

| Variant ID (editor) | PokéAPI field | CLI cache key |
|---------------------|---------------|---------------|
| `front` | `sprites.front_default` | `front` / `front_mono` |
| `back` | `sprites.back_default` | `back` / `back_mono` |
| `frontShiny` | `sprites.front_shiny` | `frontShiny` / `frontShiny_mono` |
| `backShiny` | `sprites.back_shiny` | `backShiny` / `backShiny_mono` |

The editor uses the CLI cache key convention throughout; PokéAPI field names are only used when fetching from the API.

- Batch mode: fetch all variants for a range of Pokémon IDs

### ASCII Engines

Four engines, selectable per-run or run all simultaneously for comparison:

| ID | Engine | Runtime | Notes |
|----|--------|---------|-------|
| `jimp` | Node.js sidecar (Jimp) | Node.js | Current CLI implementation; backward-compatible cache. **Fix required:** existing `jimpToAscii` call is missing `await`; sidecar must also override `height` using aspect-ratio formula instead of hardcoded `16`. |
| `rust` | Built-in Rust | Tauri backend | Zero external deps; same brightness algorithm |
| `chafa` | `chafa` binary | sidecar | Unicode / Braille / Block chars; true-color ANSI |
| `jp2a` | `jp2a` binary | sidecar | Classic dense ASCII; fast |

All engines share a **unified config schema**:

```typescript
interface AsciiConfig {
  width: number;          // output chars wide (default 32)
  height: number;         // output chars tall (auto = width * 0.5 * aspectRatio)
  autoHeight: boolean;    // derive height with aspect-ratio correction
  charset: CharsetId;     // see below
  customChars?: string;   // when charset = 'custom'
  colored: boolean;       // ANSI color output
  invert: boolean;        // invert brightness mapping
  contrast: number;       // -100 to +100
  brightness: number;     // -100 to +100
}

type CharsetId =
  | 'dense'      // ' .:-=+*#%@'
  | 'simple'     // ' .+*#@'
  | 'blocks'     // '▁▂▃▄▅▆▇█'
  | 'braille'    // U+2800–U+28FF, 2×4 dot matrix per char
  | 'custom';
```

**Aspect-ratio correction** (fixes "fat Pokémon" bug in current code):
- Terminal cells are ~2:1 height:width
- Corrected height = `Math.round(width * (imgH / imgW) * 0.5)`
- All engines apply this when `autoHeight = true`

**Braille rendering** (built-in Rust + chafa):
- Each Braille character maps a 2×4 pixel block → 8 dot flags
- Effective resolution at 32-char width: 64×64 dots vs 32×16 for classic ASCII
- Unicode range: U+2800 (empty) + bitmask per dot position

### Studio UI

```
┌─ Sprite Studio ─────────────────────────────────────────────┐
│  Species: [Pikachu ▼]  Variant: [front ▼]  [Fetch PNG]       │
│                                                               │
│  ┌─ Config ──────────┐  ┌─ jimp ─┐ ┌─ rust ─┐ ┌─ chafa ─┐  │
│  │ Width:    [32]     │  │        │ │        │ │         │  │
│  │ AutoH:    [✓]      │  │ ASCII  │ │ ASCII  │ │  ASCII  │  │
│  │ Charset:  [braille]│  │ output │ │ output │ │  output │  │
│  │ Colored:  [✓]      │  │        │ │        │ │         │  │
│  │ Contrast: [0]      │  └────────┘ └────────┘ └─────────┘  │
│  │ Invert:   [ ]      │            [Use this config ▲]        │
│  └────────────────────┘                                       │
│  [Batch Fetch: 1–151]                    [Save to Cache]      │
└───────────────────────────────────────────────────────────────┘
```

- "Use this config" saves the engine + config as the default for that species/variant in a `sprite-config.json` alongside the cache
- "Save to Cache" writes the ASCII lines to `~/.pokemon-cli/sprites/<id>_<variant>.json` (same format as CLI)
- Batch mode: downloads + converts all variants for IDs 1–N, skipping cached entries

---

## 5. Learnset Editor

Read-only browser for Gen 9 learnsets, using the same `gen.learnsets.get()` async API as the CLI.

Three tabs per species:

| Tab | Source | Display |
|-----|--------|---------|
| **Level-up** | `9L<n>` sources | Level → Move name → Type → Category → Power → Acc |
| **Egg Moves** | `9E` sources | Move name → Type → Category → Power → Acc |
| **TM / HM** | `9M` sources | TM number → Move name → Type → Category → Power → Acc |

Future (out of scope now): inline move editing that writes to `MOD_DATA.Moves`.

---

## 6. Data Persistence

### mod.js format

The editor reads and writes `packages/battle/src/mod.js`. The file exports:
```js
export const MOD_ID = 'pokemon-cli';
export const MOD_DATA = { Species: {}, Moves: {}, Items: {} };
```

The Rust `mod_io.rs` command uses a **three-section strategy**:

| Section | Editing mode | Reason |
|---------|-------------|--------|
| `Species` | Structured form (JSON round-trip) | All fields are JSON-serializable |
| `Moves` | Structured form (JSON round-trip) | All fields are JSON-serializable |
| `Items` | Raw JS code editor (Monaco) | Effect callbacks (`onModifySpA: () => …`) are not JSON-serializable; raw editing preserves them |

The Rust backend:
1. Reads the file as text
2. Locates each of the three blocks using a paired-brace scan (handles nested objects correctly)
3. Sends `Species` and `Moves` as parsed JSON; sends `Items` block as a raw JS string to a Monaco editor in the frontend
4. On save: receives updated JSON for Species/Moves + raw JS string for Items; splices all three sections back, preserving surrounding comments

### Sprite config

`~/.pokemon-cli/sprites/sprite-config.json` — maps `"<id>_<variant>"` → `AsciiConfig`. The CLI's `getPokemonAscii()` can optionally read this to use the user's preferred engine/config.

---

## 7. Map Planner (Future Spec)

Out of scope for this phase. A Map Planner tab will be added only when a dedicated spec is written. Planned features for that future spec:
- Tile-based map editor using `pret/pokered` tile data as reference
- Encounter table editor (wild Pokémon per area, level ranges)
- Town / route connection graph
- Export to game map format (TBD)

---

## 8. Technical Notes

### Tauri IPC commands

```rust
// mod_io.rs
#[tauri::command] fn read_mod_data() -> Result<Value, String>
#[tauri::command] fn write_mod_data(data: Value) -> Result<(), String>

// sprite_fetch.rs
// Downloads PNG and saves to temp path; returns the path (avoids IPC byte-array inflation)
#[tauri::command] async fn fetch_sprite_png(id: u32, variant: String) -> Result<String, String>

// ascii_native.rs
// Takes a file path, not raw bytes, to match sidecar interface
#[tauri::command] fn render_ascii(png_path: String, config: AsciiConfig) -> Result<Vec<String>, String>

// sidecar.rs
#[tauri::command] async fn render_ascii_sidecar(engine: String, png_path: String, config: AsciiConfig) -> Result<Vec<String>, String>
```

> All ASCII rendering commands take a `png_path` (temp file written by `fetch_sprite_png`) rather than raw bytes. Passing `Vec<u8>` over Tauri IPC serializes as a JSON integer array, causing 3–10× size inflation for typical sprite PNGs.

### @pkmn/dex in the browser

`@pkmn/dex` is a pure-JS package with no Node.js-only APIs; it runs fine in Vite. The editor frontend imports it directly for:
- Species autocomplete data
- Official species base values (read-only reference)
- Learnset queries via `gen.learnsets.get()`

### Build

- Frontend: `vite build` → `frontend/dist/`
- Tauri: `tauri build` bundles dist + Rust binary + sidecars
- Sidecars: pre-built platform binaries committed to `sidecars/` (Windows x64 to start); CI builds for other platforms later

---

## 9. Phased Delivery

| Phase | Scope |
|-------|-------|
| **P1** | Project scaffold (Tauri 2.x + Vite + React), tab shell, `mod_io.rs` read/write (paired-brace scan, all three sections), Dex Editor form |
| **P2** | Items Editor (Monaco raw JS), Moves Editor (structured form) |
| **P3** | Sprite Studio: fetch PNG → temp path, built-in Rust ASCII engine, `jimp` sidecar (with await + aspect-ratio fixes) |
| **P4** | Sprite Studio: `chafa` + `jp2a` sidecars, Braille engine, batch mode, side-by-side engine comparison UI |
| **P5** | Learnset Editor (level-up / egg / TM tables) |
