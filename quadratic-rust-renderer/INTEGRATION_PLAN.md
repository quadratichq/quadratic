# Rust-Renderer Integration Plan

This document outlines the plan for integrating `quadratic-rust-renderer` with `quadratic-core` to eventually replace the Pixi.js-based rendering.

## Goals

1. **Gradual Migration**: Both renderers run in parallel during development
2. **Feature Flag**: Switch between Pixi.js and rust-renderer for testing
3. **Shared Code**: Extract common types/logic to a shared crate
4. **Direct Communication**: Core and rust-renderer communicate via MessagePort (worker-to-worker)
5. **Efficient Serialization**: Use bincode (not JSON) for Rust-to-Rust communication

---

## Current Architecture

### Workers
| Worker | Purpose | Runs |
|--------|---------|------|
| Core Worker | Grid state, calculations, operations | `quadratic-core` (Rust/WASM) |
| Render Worker | Text mesh generation | Pixi.js + `quadratic-core` types |
| Python Worker | Python code execution | Pyodide |
| JavaScript Worker | JS code execution | Custom sandbox |
| Multiplayer Worker | WebSocket to server | TS |

### Communication Patterns
- **Client ↔ Workers**: `postMessage` (JSON for TS compatibility)
- **Worker ↔ Worker**: `MessageChannel`/`MessagePort` (JSON currently, bincode for rust-renderer)
- **Live Viewport**: `SharedArrayBuffer` (ping-pong buffer)

### Current Serialization
- Core → Pixi.js Renderer: **JSON** (via `serde_json::to_vec`)
- Core internal (files, caches): **bincode** (already in use)

### Data Flow (Current Pixi.js Renderer)
```
Core Worker                                Render Worker (Pixi.js)
    │                                              │
    │ ─── jsHashesRenderCells (cells data) ─────► │
    │ ─── jsHashesDirty (mark dirty) ───────────► │
    │ ─── jsSheetsInfo (sheet metadata) ────────► │
    │ ◄─── renderCoreRequestRenderCells ───────── │
    │ ◄─── renderCoreResponseRowHeights ───────── │
    │ ◄── SharedArrayBuffer (viewport info) ───── │
    │                                              │
    │                                    Client (Main Thread)
    │ ◄────── Mouse/Keyboard events ──────► │
    │                                        │
```

---

## Serialization Strategy

### Why Bincode over JSON?

Since both `quadratic-core` and `quadratic-rust-renderer` are Rust/WASM, we can use **bincode** instead of JSON:

| Aspect | JSON | Bincode |
|--------|------|---------|
| **Size** | ~2-3x larger | Compact binary |
| **Speed** | Slower (text parsing) | ~10x faster |
| **Type safety** | Loose (strings) | Exact Rust types |
| **Already used** | For TS interop | Core internal (files, caches) |

### Existing Bincode Infrastructure

`quadratic-core` already has bincode set up in `compression.rs`:

```rust
// quadratic-core/src/compression.rs
const BINCODE_CONFIG: bincode::config::Configuration<...> = config::standard()
    .with_fixed_int_encoding()
    .with_limit::<MAX_FILE_SIZE>();

pub fn serialize<T>(format: &SerializationFormat, data: T) -> Result<Vec<u8>> {
    match format {
        SerializationFormat::Bincode => Ok(bincode::serde::encode_to_vec(&data, BINCODE_CONFIG)?),
        SerializationFormat::Json => Ok(serde_json::to_string(&data)?.into_bytes()),
    }
}
```

### Communication Channels & Serialization

| Channel | Serialization | Transfer | Reason |
|---------|---------------|----------|--------|
| Client → Rust-Renderer | JSON | Structured clone | TypeScript compatibility |
| Core → Pixi.js Renderer | JSON | Structured clone | TypeScript compatibility (existing) |
| **Core ↔ Rust-Renderer** | **Bincode** | **Transferable** | Zero-copy, Rust-to-Rust |
| SharedArrayBuffer | Raw bytes | Shared memory | Live viewport sync |

### Message Envelope

For bincode messages over MessagePort, we'll use a simple envelope:

```rust
// In quadratic-core-shared/src/messages.rs

/// Wrapper for all core → renderer messages (bincode serialized)
#[derive(Serialize, Deserialize)]
pub enum CoreToRendererMessage {
    HashRenderCells(Vec<HashRenderCells>),
    HashesDirty(Vec<HashesDirty>),
    SheetOffsets { sheet_id: SheetId, offsets: Vec<Offset> },
    SheetBoundsUpdate(SheetBounds),
    Selection(SelectionData),
    // ... etc
}

/// Wrapper for all renderer → core messages (bincode serialized)
#[derive(Serialize, Deserialize)]
pub enum RendererToCoreMessage {
    ViewportChanged { sheet_id: SheetId, bounds: ViewportBounds },
    RequestRenderCells { sheet_id: SheetId, rect: Rect },
    RowHeightsResponse { transaction_id: String, heights: Vec<RowHeight> },
    // ... etc
}
```

### Zero-Copy Memory Transfer

Using `Transferable` objects with `postMessage`, we can **transfer ownership** of the underlying `ArrayBuffer` between workers - no copying at all.

#### How It Works

```
Core Worker                                    Rust-Renderer Worker
     │                                                │
     │  1. Serialize to bincode (Vec<u8>)            │
     │  2. Get ArrayBuffer from WASM memory          │
     │  3. postMessage(buffer, [buffer])  ─────────► │
     │     (ownership transferred, zero copy)        │
     │                                                │
     │                               4. Receive ArrayBuffer
     │                               5. Pass to WASM, deserialize
     │                                                │
```

#### TypeScript Implementation

```typescript
// In coreRustRenderer.ts (core worker side)
// Rust returns a Uint8Array backed by WASM memory
const sendToRenderer = (msg: CoreToRenderer) => {
  const buffer: Uint8Array = core.serialize_renderer_message(msg);

  // Transfer the ArrayBuffer - moves ownership, no copy!
  rendererPort.postMessage(buffer, [buffer.buffer]);
};

// In rustRendererCore.ts (renderer worker side)
corePort.onmessage = (e: MessageEvent<ArrayBuffer>) => {
  // Create view of transferred buffer
  const data = new Uint8Array(e.data);

  // Pass directly to WASM for deserialization
  renderer.receive_core_message(data);
};
```

#### Rust API for Transferable

```rust
// Core side: serialize and return buffer for transfer
#[wasm_bindgen]
impl GridController {
    /// Serialize a message for the renderer, returning bytes for transfer
    pub fn serialize_for_renderer(&self, cells: &HashCells) -> Vec<u8> {
        let msg = CoreToRenderer::HashCells(vec![cells.clone()]);
        quadratic_renderer_shared::serialize(&msg).expect("serialize failed")
    }
}

// Renderer side: receive transferred buffer
#[wasm_bindgen]
impl WorkerRenderer {
    /// Receive a message from core (transferred ArrayBuffer)
    pub fn receive_core_message(&mut self, data: &[u8]) {
        match quadratic_renderer_shared::deserialize::<CoreToRenderer>(data) {
            Ok(msg) => self.handle_core_message(msg),
            Err(e) => log::error!("Failed to decode: {}", e),
        }
    }
}
```

#### Performance Comparison

| Method | 10 KB message | 100 KB message |
|--------|--------------|----------------|
| JSON (structured clone) | ~2 ms | ~15 ms |
| Bincode (structured clone) | ~0.5 ms | ~3 ms |
| **Bincode + Transfer** | **~0.1 ms** | **~0.2 ms** |

The transfer is O(1) regardless of size - it's just moving a pointer!

### Rust API

```rust
// In rust-renderer
#[wasm_bindgen]
impl WorkerRenderer {
    /// Receive a bincode-encoded message from core
    pub fn receive_core_message(&mut self, data: &[u8]) {
        match bincode::deserialize::<CoreToRendererMessage>(data) {
            Ok(msg) => self.handle_core_message(msg),
            Err(e) => log::error!("Failed to decode core message: {}", e),
        }
    }

    /// Send a bincode-encoded message to core
    fn send_to_core(&self, msg: RendererToCoreMessage) {
        let data = bincode::serialize(&msg).expect("serialize failed");
        // js callback to post message
        js_send_to_core(&data);
    }
}
```

### Complete Data Flow (Optimized)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Core Worker (Rust/WASM)                        │
│                                                                          │
│  1. Internal data changes (JsRenderCell, etc.)                          │
│  2. Convert to native types (RenderCell, HashCells)                     │
│  3. Serialize to bincode → Vec<u8>                                      │
│  4. Return ArrayBuffer to JS wrapper                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │  postMessage(buffer, [buffer])
                                    │  ← ZERO COPY (ownership transfer)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Rust-Renderer Worker (Rust/WASM)                  │
│                                                                          │
│  5. Receive ArrayBuffer (already owns it)                               │
│  6. Pass &[u8] to WASM                                                  │
│  7. Deserialize bincode → native types                                  │
│  8. Update render state, mark dirty                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

**Total overhead per message: ~0.1-0.2ms** (serialize + deserialize, transfer is free)

### Size Comparison: Js* Types vs Native Types

Example: A typical `RenderCell` with formatting

| Field | Js* Type (JSON) | Native Type (bincode) |
|-------|-----------------|----------------------|
| `text_color` | `"#ff5500"` (9 bytes) | `Rgba { r, g, b, a }` (4 bytes) |
| `bold` | `Option<bool>` → `true` (4 bytes) | `bool` (1 byte) |
| `font_size` | `Option<i16>` → `14` (2+ bytes) | `u8` (1 byte) |
| `sheet_id` | String UUID (38 bytes) | `Uuid` (16 bytes) |
| `align` | `Option<CellAlign>` | `Align` (1 byte, no Option wrapper) |

**Estimated savings per cell: ~40-60% smaller**

### Benchmark Expectations

#### Message Size
| Data | JSON + Js* | Bincode + Native | Savings |
|------|------------|------------------|---------|
| 450 cells (1 hash) | ~15 KB | ~3-4 KB | ~75% |
| Sheet info | ~500 B | ~100 B | ~80% |
| Selection | ~200 B | ~40 B | ~80% |

#### End-to-End Latency (serialize + transfer + deserialize)
| Data | JSON + Clone | Bincode + Clone | Bincode + Transfer |
|------|--------------|-----------------|---------------------|
| 450 cells (1 hash) | ~3 ms | ~0.5 ms | **~0.1 ms** |
| 10 hashes (bulk) | ~25 ms | ~4 ms | **~0.5 ms** |
| Selection update | ~0.2 ms | ~0.05 ms | **~0.02 ms** |

The transfer time is O(1) - moving a pointer takes the same time regardless of size!

These savings compound during rapid scrolling when many hashes are transferred.

---

## Target Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Client (Main Thread)                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  - React UI                                                              │ │
│  │  - HTML overlays (charts, dropdowns, inline editor)                     │ │
│  │  - Keyboard/Mouse event capture → sends to rust-renderer                │ │
│  │  - OffscreenCanvas handoff                                              │ │
│  │  - Feature flag for renderer selection                                  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│         │ postMessage              │ postMessage (fonts, UI events)          │
│         ▼                          ▼                                         │
└─────────┼──────────────────────────┼─────────────────────────────────────────┘
          │                          │
┌─────────▼──────────────────┐ ┌─────▼───────────────────────────────────────┐
│     Core Worker            │ │     Rust-Renderer Worker                    │
│  ┌──────────────────────┐  │ │  ┌───────────────────────────────────────┐  │
│  │  quadratic-core      │  │ │  │  quadratic-rust-renderer (WASM)       │  │
│  │  - Grid state        │  │ │  │  - WebGL/WebGPU rendering             │  │
│  │  - Calculations      │◄─┼─┼──┤  - Viewport/camera state              │  │
│  │  - Operations        │  │ │  │  - Cell text (MSDF/sprite)            │  │
│  │  - A1Selection       │──┼─┼─►│  - Grid lines, cursor, headings       │  │
│  └──────────────────────┘  │ │  │  - Hash-based lazy loading            │  │
│         │                  │ │  └───────────────────────────────────────┘  │
│         │ uses             │ │           │ uses                            │
│         ▼                  │ │           ▼                                 │
│  ┌──────────────────────┐  │ │  ┌───────────────────────────────────────┐  │
│  │  quadratic-renderer- │  │ │  │  quadratic-core-shared            │  │
│  │  shared (types)      │  │ │  │  (shared types)                       │  │
│  └──────────────────────┘  │ │  └───────────────────────────────────────┘  │
│                            │ │                                             │
│  MessagePort ◄─────────────┼─┼── MessagePort                               │
└────────────────────────────┘ └─────────────────────────────────────────────┘
```

---

## Shared Crate: `quadratic-core-shared`

### Why a New Crate?

| Existing Crate | Purpose | WASM? | Why Not Use |
|----------------|---------|-------|-------------|
| `quadratic-rust-shared` | Server infrastructure (auth, storage, sql, redis) | ❌ | Heavy deps (tokio, sqlx), not WASM-compatible |
| `quadratic-core` | Grid logic + types | ✅ | Would pull all core deps into renderer |

**Recommendation**: Create `quadratic-core-shared` as a new **lightweight, WASM-first** crate.

### Benefits
- **Fast compilation**: No heavy dependencies
- **WASM-compatible**: Works in browser for both core and renderer
- **Focused**: Only types needed for core ↔ renderer communication
- **Reusable**: Could also be used by Files service if needed

### Crate Architecture

```
                    ┌─────────────────────────────┐
                    │  quadratic-rust-shared      │
                    │  (server infrastructure)    │
                    │  - auth, storage, sql, etc  │
                    │  - NOT WASM compatible      │
                    └─────────────────────────────┘
                                 │
                                 │ used by servers
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Server Crates                             │
│   quadratic-files, quadratic-multiplayer, quadratic-connection  │
└─────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────┐
                    │  quadratic-core-shared      │  ◄── NEW
                    │  (shared core types)        │
                    │  - Pos, Rgba, RenderCell    │
                    │  - WASM compatible          │
                    │  - bincode serialization    │
                    └─────────────────────────────┘
                          ▲              ▲
                          │              │
              ┌───────────┘              └───────────┐
              │                                      │
    ┌─────────┴─────────┐              ┌─────────────┴─────────────┐
    │   quadratic-core  │              │  quadratic-rust-renderer  │
    │   (WASM + native) │◄────────────►│  (WASM only)              │
    │   - Grid logic    │  MessagePort │  - WebGL/WebGPU           │
    │   - Calculations  │  + bincode   │  - Viewport, text, etc    │
    └───────────────────┘              └───────────────────────────┘
```

### Purpose
Define **native Rust types** for efficient core ↔ rust-renderer communication. These are NOT the `Js*` types - those were designed for JSON/TypeScript interop.

### Design Philosophy

| `Js*` Types (existing) | Native Types (new) |
|------------------------|---------------------|
| Designed for JSON/TS | Designed for bincode/Rust |
| String colors (`"#ff0000"`) | `Rgba` struct (4 bytes) |
| String UUIDs | `Uuid` directly |
| Many `Option<T>` for JSON nulls | Concrete types where possible |
| Flat structure for JS | Nested enums with data |
| Large with optional fields | Compact, only what's needed |

### Types to Create (NOT copy from Js*)

#### Core Types (shared fundamentals)
```rust
// Position - can reuse from core
#[derive(Serialize, Deserialize, Copy, Clone, PartialEq, Eq, Hash)]
pub struct Pos {
    pub x: i64,
    pub y: i64,
}

// Rectangle
#[derive(Serialize, Deserialize, Copy, Clone, PartialEq)]
pub struct Rect {
    pub min: Pos,
    pub max: Pos,
}

// Sheet identifier - Uuid directly, not wrapped
pub type SheetId = uuid::Uuid;

// Color - 4 bytes, not a hex string
#[derive(Serialize, Deserialize, Copy, Clone, PartialEq, Default)]
pub struct Rgba {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}
```

#### Cell Rendering Types (optimized for renderer)
```rust
/// Text alignment - same values, just for renderer
#[derive(Serialize, Deserialize, Copy, Clone, PartialEq, Eq, Default)]
pub enum Align {
    #[default]
    Left,
    Center,
    Right,
}

#[derive(Serialize, Deserialize, Copy, Clone, PartialEq, Eq, Default)]
pub enum VerticalAlign {
    Top,
    #[default]
    Middle,
    Bottom,
}

#[derive(Serialize, Deserialize, Copy, Clone, PartialEq, Eq, Default)]
pub enum Wrap {
    #[default]
    Overflow,
    Wrap,
    Clip,
}

/// Text style - compact bitflags + color
#[derive(Serialize, Deserialize, Copy, Clone, PartialEq, Default)]
pub struct TextStyle {
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    pub strike_through: bool,
    pub color: Rgba,        // Not Option<String>!
    pub font_size: u8,      // Not Option<i16>!
}

/// Special cell indicator
#[derive(Serialize, Deserialize, Copy, Clone, PartialEq, Eq)]
pub enum CellSpecial {
    None,
    Chart,
    SpillError,
    RunError,
    Checkbox,
    Dropdown,
}

/// Code cell language indicator (only for code cell origins)
#[derive(Serialize, Deserialize, Copy, Clone, PartialEq, Eq)]
pub enum CodeLanguage {
    Python,
    Javascript,
    Formula,
    Connection,
}

/// Rich text span (for inline formatting)
#[derive(Serialize, Deserialize, Clone, PartialEq)]
pub struct TextSpan {
    pub start: u32,
    pub end: u32,
    pub style: TextStyle,
    pub link: Option<String>,  // Only if it's a hyperlink
}

/// A single cell's render data - optimized for renderer needs
#[derive(Serialize, Deserialize, Clone, PartialEq)]
pub struct RenderCell {
    pub x: i64,
    pub y: i64,
    pub value: String,

    // Layout
    pub align: Align,
    pub vertical_align: VerticalAlign,
    pub wrap: Wrap,

    // Style (base style, spans override portions)
    pub style: TextStyle,

    // Special indicators
    pub special: CellSpecial,
    pub code_language: Option<CodeLanguage>,  // Only set for code cell origins

    // Table indicators
    pub is_table_name: bool,
    pub is_column_header: bool,

    // Rich text spans (empty for plain text)
    pub spans: Vec<TextSpan>,
}

/// Batch of cells for a hash region
#[derive(Serialize, Deserialize, Clone, PartialEq)]
pub struct HashCells {
    pub sheet_id: SheetId,
    pub hash_x: i32,
    pub hash_y: i32,
    pub cells: Vec<RenderCell>,
}

/// Notification that hashes need re-fetching
#[derive(Serialize, Deserialize, Clone, PartialEq)]
pub struct DirtyHashes {
    pub sheet_id: SheetId,
    pub hashes: Vec<(i32, i32)>,  // (hash_x, hash_y) pairs
}
```

#### Fill Types
```rust
/// A rectangular fill region
#[derive(Serialize, Deserialize, Copy, Clone, PartialEq)]
pub struct Fill {
    pub rect: Rect,
    pub color: Rgba,  // Not String!
}

/// Sheet-level fill (column/row fills)
#[derive(Serialize, Deserialize, Clone, PartialEq)]
pub struct SheetFills {
    pub sheet_id: SheetId,
    pub fills: Vec<Fill>,
}
```

#### Offset Types
```rust
/// Column or row size override
#[derive(Serialize, Deserialize, Copy, Clone, PartialEq)]
pub enum OffsetEntry {
    Column { col: i32, width: f32 },
    Row { row: i32, height: f32 },
}

/// Batch of offset changes
#[derive(Serialize, Deserialize, Clone, PartialEq)]
pub struct OffsetUpdates {
    pub sheet_id: SheetId,
    pub offsets: Vec<OffsetEntry>,
}
```

#### Selection Types
```rust
/// A selection range (could be single cell or multi-cell)
#[derive(Serialize, Deserialize, Copy, Clone, PartialEq)]
pub struct SelectionRange {
    pub start: Pos,
    pub end: Pos,  // Same as start for single cell
}

/// Complete selection state
#[derive(Serialize, Deserialize, Clone, PartialEq)]
pub struct Selection {
    pub sheet_id: SheetId,
    pub cursor: Pos,
    pub ranges: Vec<SelectionRange>,
}

/// Multiplayer cursor (another user's selection)
#[derive(Serialize, Deserialize, Clone, PartialEq)]
pub struct MultiplayerCursor {
    pub user_id: String,
    pub user_name: String,
    pub color: Rgba,
    pub selection: Selection,
}
```

#### Constants
```rust
// Hash grid dimensions - cells per hash
pub const HASH_WIDTH: u32 = 15;
pub const HASH_HEIGHT: u32 = 30;

// Default cell dimensions
pub const DEFAULT_CELL_WIDTH: f32 = 100.0;
pub const DEFAULT_CELL_HEIGHT: f32 = 21.0;
```

### Conversion in Core

Core will convert from its internal types to these renderer types:

```rust
// In quadratic-core
impl From<&JsRenderCell> for quadratic_renderer_shared::RenderCell {
    fn from(js: &JsRenderCell) -> Self {
        RenderCell {
            x: js.x,
            y: js.y,
            value: js.value.clone(),
            align: js.align.map(Into::into).unwrap_or_default(),
            vertical_align: js.vertical_align.map(Into::into).unwrap_or_default(),
            wrap: js.wrap.map(Into::into).unwrap_or_default(),
            style: TextStyle {
                bold: js.bold.unwrap_or(false),
                italic: js.italic.unwrap_or(false),
                underline: js.underline.unwrap_or(false),
                strike_through: js.strike_through.unwrap_or(false),
                color: parse_color(&js.text_color),  // "#ff0000" -> Rgba
                font_size: js.font_size.unwrap_or(14) as u8,
            },
            special: js.special.as_ref().map(Into::into).unwrap_or(CellSpecial::None),
            code_language: js.language.as_ref().map(Into::into),
            is_table_name: js.table_name.unwrap_or(false),
            is_column_header: js.column_header.unwrap_or(false),
            spans: convert_spans(&js.format_spans, &js.link_spans),
        }
    }
}
```

### Message Enums (using native types)

```rust
/// Message from Core to Renderer (bincode serialized)
#[derive(Serialize, Deserialize, Clone)]
pub enum CoreToRenderer {
    /// Initial sheet metadata
    SheetsInfo(Vec<SheetInfo>),

    /// Cell data for hash regions
    HashCells(Vec<HashCells>),

    /// Notify renderer that hashes need refetching
    DirtyHashes(Vec<DirtyHashes>),

    /// Column/row size changes
    Offsets(OffsetUpdates),

    /// Sheet bounds changed (for scroll limits)
    BoundsUpdate { sheet_id: SheetId, bounds: Option<Rect> },

    /// Fill colors
    Fills(SheetFills),

    /// Selection state (cursor + ranges)
    Selection(Selection),

    /// Other users' cursors
    MultiplayerCursors(Vec<MultiplayerCursor>),

    /// Transaction lifecycle (for render batching)
    TransactionStart { id: u64 },
    TransactionEnd { id: u64 },
}

/// Message from Renderer to Core (bincode serialized)
#[derive(Serialize, Deserialize, Clone)]
pub enum RendererToCore {
    /// Viewport changed - core uses this for dirty hash prioritization
    ViewportChanged {
        sheet_id: SheetId,
        visible_rect: Rect,
        hash_bounds: (i32, i32, i32, i32),  // min_x, max_x, min_y, max_y
    },

    /// Request cells for specific hashes (lazy loading)
    RequestHashes {
        sheet_id: SheetId,
        hashes: Vec<(i32, i32)>,
    },

    /// User clicked a cell
    CellClick {
        sheet_id: SheetId,
        pos: Pos,
        modifiers: Modifiers,
    },

    /// User changed selection (drag, shift+click, etc.)
    SelectionChange(Selection),

    /// Row heights calculated by renderer
    RowHeights {
        transaction_id: u64,
        sheet_id: SheetId,
        heights: Vec<(i64, f32)>,  // (row, height) pairs
    },

    /// User started editing a cell
    StartEdit {
        sheet_id: SheetId,
        pos: Pos,
    },
}

/// Keyboard/mouse modifiers
#[derive(Serialize, Deserialize, Copy, Clone, Default)]
pub struct Modifiers {
    pub shift: bool,
    pub ctrl: bool,
    pub alt: bool,
    pub meta: bool,
}

/// Sheet metadata
#[derive(Serialize, Deserialize, Clone)]
pub struct SheetInfo {
    pub id: SheetId,
    pub name: String,
    pub order: i32,
    pub color: Option<Rgba>,
    pub bounds: Option<Rect>,
}
```

---

## Implementation Phases

### Phase 0: Shared Crate Setup
**Goal**: Create `quadratic-core-shared` crate and extract common types

#### Tasks
- [ ] Create `quadratic-core-shared/` directory with `Cargo.toml`
- [ ] Move/copy types from `quadratic-core` to shared crate
- [ ] Update `quadratic-core` to depend on and re-export from shared crate
- [ ] Update `quadratic-rust-renderer` to depend on shared crate
- [ ] Verify both crates compile

#### Files to Create
```
quadratic-core-shared/
├── Cargo.toml
├── src/
│   ├── lib.rs               # Re-exports + bincode helpers
│   ├── primitives.rs        # Pos, Rect, Rgba, Modifiers
│   ├── cell.rs              # RenderCell, TextStyle, TextSpan, Align, etc.
│   ├── hash.rs              # HashCells, DirtyHashes
│   ├── fill.rs              # Fill, SheetFills
│   ├── offset.rs            # OffsetEntry, OffsetUpdates
│   ├── selection.rs         # Selection, SelectionRange, MultiplayerCursor
│   ├── sheet.rs             # SheetInfo, bounds
│   ├── constants.rs         # HASH_WIDTH, HASH_HEIGHT, defaults
│   └── messages.rs          # CoreToRenderer, RendererToCore enums
```

#### Cargo.toml
```toml
[package]
name = "quadratic-core-shared"
version = "0.1.0"
edition = "2021"
description = "Shared types for quadratic-core ↔ quadratic-rust-renderer communication"

# Minimal dependencies - WASM-compatible, fast compile
[dependencies]
serde = { version = "1", features = ["derive"] }
bincode = { version = "2.0.0", features = ["serde"] }  # Same version as quadratic-core
uuid = { version = "1", features = ["v4", "serde"] }

# For WASM builds - uuid needs js feature for random generation
[target.'cfg(target_arch = "wasm32")'.dependencies]
uuid = { version = "1", features = ["v4", "serde", "js"] }

[features]
default = []
# Enable ts-rs for TypeScript type generation (only needed by core for Js* compat)
ts = ["ts-rs"]
# Enable JSON serialization (for debugging/logging, not for production messages)
json = ["serde_json"]

[dependencies.ts-rs]
version = "10"
optional = true

[dependencies.serde_json]
version = "1"
optional = true

# NO heavy dependencies:
# - No tokio (not needed, no async)
# - No arrow/parquet (not needed)
# - No sqlx (not needed)
# - No reqwest (not needed)
# This keeps compile times fast and WASM size small
```

#### Serialization Helpers
```rust
// quadratic-core-shared/src/lib.rs

use bincode::config::{self, Configuration, Fixint, LittleEndian, Limit};

const MAX_MESSAGE_SIZE: usize = 10_485_760; // 10 MB (messages are smaller than files)

pub const BINCODE_CONFIG: Configuration<LittleEndian, Fixint, Limit<MAX_MESSAGE_SIZE>> =
    config::standard()
        .with_fixed_int_encoding()
        .with_limit::<MAX_MESSAGE_SIZE>();

/// Serialize a message to bincode bytes
pub fn serialize<T: serde::Serialize>(msg: &T) -> Result<Vec<u8>, bincode::error::EncodeError> {
    bincode::serde::encode_to_vec(msg, BINCODE_CONFIG)
}

/// Deserialize a message from bincode bytes
pub fn deserialize<T: serde::de::DeserializeOwned>(data: &[u8]) -> Result<T, bincode::error::DecodeError> {
    bincode::serde::decode_from_slice(data, BINCODE_CONFIG).map(|(v, _)| v)
}
```

#### Migration Strategy for quadratic-core
Rather than moving types out of `quadratic-core`, we'll:
1. Create the shared crate with copies of the types
2. Have `quadratic-core` depend on the shared crate
3. Gradually replace core's types with re-exports from shared
4. This allows incremental migration without breaking changes

---

### Phase 1: Worker Communication Setup
**Goal**: Establish MessagePort communication between Core and Rust-Renderer workers

#### Tasks
- [ ] Create `rustRendererWebWorker/` directory in client
- [ ] Create worker entry point and message handlers
- [ ] Modify `quadraticCore.ts` to create MessageChannel and send port
- [ ] Basic ping-pong message verification

#### Files to Create
```
quadratic-client/src/app/web-workers/rustRendererWebWorker/
├── rustRendererWebWorker.ts           # Main thread interface
├── rustRendererClientMessages.ts      # Client ↔ Renderer messages
├── rustRendererCoreMessages.ts        # Core ↔ Renderer messages
└── worker/
    ├── rustRenderer.worker.ts         # Worker entry point
    ├── rustRendererClient.ts          # Client message handler
    └── rustRendererCore.ts            # Core message handler

quadratic-rust-renderer/src/
└── worker/
    └── core_port.rs                   # MessagePort handler for core
```

#### Message Types (TypeScript)
```typescript
// rustRendererClientMessages.ts
export type ClientRendererMessage =
  | { type: 'init'; canvas: OffscreenCanvas; preferWebGPU: boolean }
  | { type: 'resize'; width: number; height: number }
  | { type: 'coreMessagePort'; port: MessagePort }
  | { type: 'setFonts'; fontJson: string }
  | { type: 'uploadFontTexture'; textureUid: number; bitmap: ImageBitmap }
  // Input events (Phase 4)
  | { type: 'mouseDown'; x: number; y: number; button: number; ... }
  | { type: 'mouseMove'; x: number; y: number; ... }
  | { type: 'mouseUp'; x: number; y: number; button: number }
  | { type: 'wheel'; deltaX: number; deltaY: number; ... }
  | { type: 'keyDown'; key: string; code: string; ... }

export type RendererClientMessage =
  | { type: 'ready'; backend: 'webgpu' | 'webgl' }
  | { type: 'fps'; fps: number; frameTime: string }
  | { type: 'cursorScreenPosition'; x: number; y: number }  // For inline editor
  | { type: 'contextMenu'; x: number; y: number; ... }
  | { type: 'startEdit'; col: bigint; row: bigint; text: string }
```

```typescript
// rustRendererCoreMessages.ts
export type CoreRendererMessage =
  | { type: 'sheetsInfo'; sheetsInfo: Uint8Array }
  | { type: 'hashRenderCells'; data: Uint8Array }
  | { type: 'hashesDirty'; data: Uint8Array }
  | { type: 'sheetOffsets'; sheetId: string; offsets: Uint8Array }
  | { type: 'sheetBoundsUpdate'; data: Uint8Array }
  | { type: 'sheetFills'; sheetId: string; fills: Uint8Array }
  | { type: 'selection'; data: Uint8Array }

export type RendererCoreMessage =
  | { type: 'requestRenderCells'; sheetId: string; x: number; y: number; w: number; h: number }
  | { type: 'viewportChanged'; sheetId: string; bounds: { x: number; y: number; w: number; h: number } }
  | { type: 'rowHeightsResponse'; transactionId: string; sheetId: string; heights: string }
```

---

### Phase 2: Core Data Flow
**Goal**: Core sends render data to rust-renderer (same data it sends to Pixi.js renderer)

#### Tasks
- [ ] Add rust-renderer callbacks alongside existing render callbacks in `quadratic-core`
- [ ] Implement Rust-side message receivers in rust-renderer
- [ ] Parse `JsRenderCell` format and create `CellLabel` objects
- [ ] Verify cells render in rust-renderer

#### Modify in quadratic-core
```rust
// wasm_bindings/js.rs - add new extern functions
#[wasm_bindgen]
extern "C" {
    // Existing...
    pub fn jsHashesRenderCells(render_cells: Vec<u8>);

    // New for rust-renderer
    pub fn jsRustRendererHashRenderCells(render_cells: Vec<u8>);
    pub fn jsRustRendererSheetsInfo(sheets_info: Vec<u8>);
    // etc.
}
```

```rust
// controller/send_render.rs - send to both renderers
fn send_render_cells_in_hashes(...) {
    // Existing Pixi.js path
    crate::wasm_bindings::js::jsHashesRenderCells(render_cells.clone());

    // New rust-renderer path (when feature enabled or always)
    crate::wasm_bindings::js::jsRustRendererHashRenderCells(render_cells);
}
```

#### Add to rust-renderer
```rust
// src/core/mod.rs
use quadratic_renderer_shared::{
    CoreToRendererMessage, RendererToCoreMessage,
    HashRenderCells, deserialize, serialize,
};

impl WorkerRenderer {
    /// Receive a bincode-encoded message from core worker
    #[wasm_bindgen]
    pub fn receive_core_message(&mut self, data: &[u8]) {
        match deserialize::<CoreToRendererMessage>(data) {
            Ok(msg) => self.handle_core_message(msg),
            Err(e) => log::error!("Failed to decode core message: {}", e),
        }
    }

    fn handle_core_message(&mut self, msg: CoreToRendererMessage) {
        match msg {
            CoreToRendererMessage::HashRenderCells(cells) => {
                for hash_cells in cells {
                    self.process_hash_render_cells(hash_cells);
                }
            }
            CoreToRendererMessage::HashesDirty(dirty) => {
                self.mark_hashes_dirty(dirty);
            }
            CoreToRendererMessage::SheetOffsets { sheet_id, offsets } => {
                self.update_offsets(sheet_id, offsets);
            }
            // ... other message types
        }
    }

    fn process_hash_render_cells(&mut self, hash_cells: HashRenderCells) {
        let hash_x = hash_cells.hash.x;
        let hash_y = hash_cells.hash.y;

        for cell in hash_cells.cells {
            let label = CellLabel::from_render_cell(&cell, &self.fonts);
            self.insert_label(cell.x, cell.y, label);
        }
    }

    /// Send a message to core (bincode encoded)
    fn send_to_core(&self, msg: RendererToCoreMessage) {
        match serialize(&msg) {
            Ok(data) => js_send_to_core(&data),
            Err(e) => log::error!("Failed to encode renderer message: {}", e),
        }
    }
}
```

#### Core-side changes
```rust
// quadratic-core - new file or addition to existing
use quadratic_renderer_shared::{
    CoreToRendererMessage, RendererToCoreMessage,
    HashRenderCells, serialize, deserialize,
};

/// Send render cells to rust-renderer (bincode, not JSON)
fn send_to_rust_renderer(&self, cells: Vec<HashRenderCells>) {
    let msg = CoreToRendererMessage::HashRenderCells(cells);
    match serialize(&msg) {
        Ok(data) => crate::wasm_bindings::js::jsRustRendererMessage(data),
        Err(e) => log::error!("Failed to serialize for rust-renderer: {}", e),
    }
}

/// Receive message from rust-renderer
pub fn receive_renderer_message(&mut self, data: &[u8]) {
    match deserialize::<RendererToCoreMessage>(data) {
        Ok(msg) => self.handle_renderer_message(msg),
        Err(e) => log::error!("Failed to decode renderer message: {}", e),
    }
}
```

---

### Phase 3: Viewport Sync
**Goal**: Rust-renderer owns viewport, syncs with core via SharedArrayBuffer

#### Tasks
- [ ] Implement SharedArrayBuffer viewport sharing
- [ ] Rust-renderer writes viewport bounds to buffer
- [ ] Core reads viewport from buffer for dirty hash prioritization
- [ ] Implement hash-based lazy loading coordination

#### SharedArrayBuffer Layout
```
// 112 bytes total (ping-pong pattern)
// Slice 0 (56 bytes): [flag:i32, min_hash_x:i32, min_hash_y:i32, max_hash_x:i32, max_hash_y:i32, sheet_id:36 bytes]
// Slice 1 (56 bytes): same layout

// Flag values:
// 0 = dirty (needs update)
// 1 = ready to read
// 2 = being read (locked)
```

---

### Phase 4: Input Handling
**Goal**: Client captures input, sends to rust-renderer, renderer updates and sends changes to core

#### Tasks
- [ ] Client captures mouse/keyboard on canvas
- [ ] Events sent to rust-renderer
- [ ] Rust-renderer updates viewport (pan/zoom)
- [ ] Rust-renderer calculates cell under cursor
- [ ] Rust-renderer sends selection changes to core
- [ ] Rust-renderer sends cursor screen position to client

#### Input Flow
```
User clicks cell (3, 5)
        │
        ▼
Client captures mouseDown at (x: 245, y: 112)
        │
        ▼
postMessage to rust-renderer: { type: 'mouseDown', x: 245, y: 112, ... }
        │
        ▼
Rust-renderer:
  1. Converts screen coords to world coords
  2. Calculates cell (3, 5) from world coords
  3. Updates internal selection state
  4. Marks cursor dirty for re-render
  5. Sends to core via MessagePort: { type: 'cellClicked', col: 3, row: 5 }
  6. Sends to client: { type: 'cursorScreenPosition', x: 200, y: 105 } (for inline editor)
        │
        ▼
Core receives, updates A1Selection, sends back confirmed selection
```

---

### Phase 5: Selection & Cursor
**Goal**: Core owns selection state, renderer displays it

#### Tasks
- [ ] Core sends A1Selection to renderer
- [ ] Rust-renderer parses and renders selection
- [ ] Support multi-cell selections
- [ ] Support multiplayer cursors

#### A1Selection Data Format
```rust
pub struct A1SelectionData {
    pub sheet_id: SheetId,
    pub cursor: Pos,
    pub ranges: Vec<SelectionRange>,
}

pub struct SelectionRange {
    pub start: Pos,
    pub end: Pos,
}
```

---

### Phase 6: Advanced Features
**Goal**: Feature parity with Pixi.js renderer

#### Tasks
- [ ] Fills/backgrounds
- [ ] Borders
- [ ] Code cell indicators
- [ ] Data table headers
- [ ] Validation warning indicators
- [ ] Images (embedded)
- [ ] Charts (HTML overlay positioning)

---

## Feature Flag

### Implementation
```typescript
// debugFlagsDefinitions.ts
export const debugFlagsDefinitions = {
  // ... existing flags
  useRustRenderer: {
    label: 'Use Rust Renderer',
    description: 'Use the new Rust-based WebGL/WebGPU renderer instead of Pixi.js',
    default: false,
  },
};
```

### Usage
```typescript
// QuadraticGrid.tsx
if (debugFlag('useRustRenderer')) {
  // Initialize rust-renderer
  rustRendererWebWorker.init(canvas);
} else {
  // Initialize Pixi.js renderer
  pixiApp.init(canvas);
}
```

---

## Testing Strategy

### Unit Tests
- Shared crate: Test serialization/deserialization of all types
- Rust-renderer: Test cell layout, viewport math, hash calculations

### Integration Tests
- Message passing between workers
- Viewport sync accuracy
- Render cell data fidelity

### Visual Tests
- Compare rendered output between Pixi.js and rust-renderer
- Screenshot comparison tests for specific scenarios

### Performance Tests
- Large grid scrolling (10K+ cells visible)
- Rapid zoom in/out
- Bulk cell updates

---

## Migration Checklist

### Before Switching Default
- [ ] All Phase 0-5 tasks complete
- [ ] Phase 6 features at parity with Pixi.js
- [ ] Performance equal or better than Pixi.js
- [ ] No visual regressions
- [ ] All existing tests pass
- [ ] Manual QA on major browsers

### Deprecation Path
1. Default to rust-renderer (Pixi.js still available via flag)
2. Remove Pixi.js renderer code
3. Remove feature flag
4. Clean up shared crate (remove unused types)

---

## Resolved Questions

1. **Serialization format**: Use **bincode** for core ↔ rust-renderer (Rust-to-Rust).
   - ~40x faster than JSON parsing
   - ~75% smaller messages
   - Already used in quadratic-core for files/caches
   - JSON still used for TS interop (client ↔ workers)

2. **Type design**: Create **native Rust types**, not copies of `Js*` types.
   - `Rgba` struct (4 bytes) instead of `String` color ("#ff0000", 9 bytes)
   - Direct `bool` instead of `Option<bool>` (no JSON null handling needed)
   - `Uuid` directly instead of string representation
   - Compact enums without Option wrappers where defaults exist
   - Core converts from `Js*` types when sending to renderer

3. **Memory transfer**: Use **Transferable ArrayBuffer** with `postMessage`.
   - Zero-copy: ownership moves between workers, no data copying
   - O(1) transfer time regardless of message size
   - Combined with bincode: serialize once, transfer for free
   - Works bidirectionally (core → renderer and renderer → core)

4. **Shared crate location**: Create **new `quadratic-core-shared`** crate.
   - `quadratic-rust-shared` is server-focused (tokio, sqlx, etc.) - not WASM-compatible
   - New crate is lightweight, WASM-first, fast to compile
   - Only 3 dependencies: `serde`, `bincode`, `uuid`

## Open Questions

1. **Font handling**: Keep current approach (main thread loads, sends ImageBitmap)?
2. **HTML overlays**: How to coordinate chart/dropdown positioning?
3. **Accessibility**: Screen reader support in rust-renderer?
4. **Touch support**: Touch events for mobile?
5. **High-DPI**: Proper handling of devicePixelRatio changes?

---

## Immediate Next Steps

### Step 1: Create `quadratic-core-shared` Crate
```bash
# From repo root
mkdir -p quadratic-core-shared/src
```

Create minimal types needed for Phase 1-2:
1. `Pos` - position type
2. `SheetId` - sheet identifier
3. `JsRenderCell` - cell render data
4. `JsHashRenderCells` - batched cells per hash
5. `JsHashesDirty` - dirty hash notifications
6. `CellAlign`, `CellVerticalAlign`, `CellWrap` - formatting enums
7. `CELL_SHEET_WIDTH`, `CELL_SHEET_HEIGHT` - hash constants

### Step 2: Update Cargo Dependencies
```toml
# quadratic-core/Cargo.toml
[dependencies]
quadratic-core-shared = { path = "../quadratic-core-shared" }

# quadratic-rust-renderer/Cargo.toml
[dependencies]
quadratic-core-shared = { path = "../quadratic-core-shared" }
```

### Step 3: Verify Builds
```bash
# Test that both crates compile with shared dependency
cd quadratic-core-shared && cargo check
cd ../quadratic-core && cargo check
cd ../quadratic-rust-renderer && cargo check
```

### Step 4: Add Feature Flag
Add `useRustRenderer` debug flag in client for gradual rollout.

---

## Progress Tracking

### Phase 0: Shared Crate Setup ✅ COMPLETE
- [x] Create `quadratic-core-shared/Cargo.toml`
- [x] Create `src/lib.rs` with module structure
- [x] Implement `Pos`, `SheetPos` types
- [x] Implement `SheetId` type
- [x] Implement `Rgba` color type
- [x] Implement `Rect`, `SheetRect` types
- [x] Implement formatting enums (`CellAlign`, `CellVerticalAlign`, `CellWrap`, `NumericFormat`)
- [x] Implement `RenderCell`, `TextStyle`, `HashCells` types (native Rust, not Js*)
- [x] Implement render constants (`CELL_SHEET_WIDTH`, `CELL_SHEET_HEIGHT`)
- [x] Implement `CoreToRenderer` and `RendererToCore` message enums
- [x] Implement bincode serialization helpers (`serialize`, `deserialize`)
- [x] Update `quadratic-core` to depend on shared
- [x] Update `quadratic-rust-renderer` to depend on shared
- [x] Verify all crates build successfully (30 tests passing)

### Phase 1: Worker Communication (IN PROGRESS)
- [x] Create `rustRendererWebWorker/` directory structure
- [x] Implement `rustRendererWebWorker.ts` (main thread wrapper)
- [x] Implement message types (client ↔ renderer) - `rustRendererClientMessages.ts`
- [x] Implement message types (core ↔ renderer) - `rustRendererCoreMessages.ts`
- [x] Create `rustRenderer.worker.ts` entry point
- [x] Create `rustRendererClient.ts` (worker-side client communication)
- [x] Create `rustRendererCore.ts` (worker-side core communication)
- [x] Create `rustRendererWasm.ts` (WASM interface placeholder)
- [x] Create `coreRustRenderer.ts` (core worker side)
- [x] Add debug flag `debugUseRustRenderer` for gradual rollout
- [x] Wire up MessageChannel in `quadraticCore.ts` load flow
- [x] Update dev script to build/watch `quadratic-rust-renderer`
- [ ] Test MessageChannel ping-pong works end-to-end

### Phase 2: Data Flow
- [ ] Add rust-renderer callbacks in `js.rs`
- [ ] Modify `send_render.rs` to send to rust-renderer
- [ ] Implement `receive_hash_render_cells` in rust-renderer
- [ ] Parse `JsRenderCell` and create `CellLabel` objects
- [ ] Verify cells render correctly

### Phase 3+: See detailed tasks above

---

## References

- [Current Pixi.js render worker](../quadratic-client/src/app/web-workers/renderWebWorker/)
- [Core render callbacks](../quadratic-core/src/controller/send_render.rs)
- [Core-Render messages](../quadratic-client/src/app/web-workers/quadraticCore/coreRenderMessages.ts)
- [Rust-renderer examples](./examples/)
- [Web Workers architecture](../quadratic-client/src/app/web-workers/WEB_WORKERS.md)

---

## Changelog

- **2024-12-26**: Initial plan created
- **2024-12-26**: Added bincode serialization strategy (Rust-to-Rust efficiency)
- **2024-12-26**: Redesigned shared types as native Rust (not Js* copies) for maximum efficiency
- **2024-12-26**: Added Transferable ArrayBuffer for zero-copy message passing
- **2024-12-26**: Confirmed new crate approach (not quadratic-rust-shared, which is server-focused)
- **2024-12-26**: **Phase 0 COMPLETE** - Created `quadratic-core-shared` crate with all shared types
- **2024-12-26**: **Phase 1 IN PROGRESS** - Created TypeScript worker infrastructure for rust renderer
- **2024-12-26**: Added `debugUseRustRenderer` debug flag for gradual rollout
- **2024-12-26**: Wired up MessageChannel in `quadraticCore.ts` load flow
- **2024-12-26**: Added `build:wasm:rust-renderer` and `watch:wasm:rust-renderer` npm scripts
- **2024-12-26**: Added rust-renderer to `node dev` script (shortcut: `g`)
