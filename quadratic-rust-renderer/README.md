# Quadratic Rust Renderer

A GPU-accelerated renderer for the Quadratic spreadsheet application, supporting both browser (WASM) and server-side (native) rendering.

## Overview

This project provides a unified rendering solution with multiple targets:

- **Browser Rendering**: WASM-compiled renderer running in Web Workers with WebGPU (preferred) or WebGL2 (fallback)
- **Server-Side Rendering**: Native Rust binary for generating screenshots and thumbnails in cloud environments
- **Shared Core**: Platform-agnostic rendering logic shared between all targets

### Key Benefits

- **Performance**: Native code compiled to WASM with GPU acceleration
- **Memory Safety**: Rust's ownership model prevents common graphics bugs
- **Dual Backend**: WebGPU for modern browsers with WebGL2 fallback
- **Shared Viewport**: Uses SharedArrayBuffer for zero-copy viewport synchronization
- **Server-Side Support**: Generate PNGs from grid files without a browser

## Project Structure

```
quadratic-rust-renderer/
├── core/                   # Shared platform-agnostic library
│   ├── src/
│   │   ├── lib.rs
│   │   ├── console_logger.rs   # WASM console logging
│   │   ├── font_loader.rs      # Font loading (WASM + native)
│   │   ├── types/              # Shared types
│   │   │   ├── buffer_types.rs # TextBuffer, FillBuffer, LineBuffer
│   │   │   ├── render_batch.rs # RenderBatch, HashRenderData
│   │   │   ├── constants.rs    # HASH_WIDTH, HASH_HEIGHT, etc.
│   │   │   └── hash_coords.rs  # Hash coordinate utilities
│   │   ├── tables/             # Table rendering
│   │   │   └── table_outline.rs
│   │   └── wgpu_backend/       # Shared wgpu renderer
│   │       ├── renderer.rs     # WgpuRenderer
│   │       ├── pipelines.rs    # Render pipelines
│   │       ├── shaders.rs      # WGSL shaders
│   │       └── texture_manager.rs
│   └── Cargo.toml
│
├── renderer/               # WASM renderer worker (browser)
│   ├── src/
│   │   ├── lib.rs              # WASM entry point
│   │   ├── renderers/          # Graphics backends
│   │   │   ├── primitives/     # Color, font, line, rect, sprite
│   │   │   ├── webgl/          # WebGL2 backend
│   │   │   └── webgpu/         # WebGPU backend
│   │   ├── sheets/             # Sheet data management
│   │   │   ├── fills/          # Cell background fills
│   │   │   └── text/           # Text/label rendering
│   │   ├── tables/             # Data table rendering
│   │   ├── ui/                 # Cursor, grid lines, headings
│   │   ├── viewport/           # Camera/viewport management
│   │   └── worker/             # Web Worker entry point
│   │       ├── renderer.rs     # WorkerRenderer - main JS API
│   │       ├── state.rs        # RendererState
│   │       ├── message_handler.rs
│   │       └── render/         # Per-element rendering
│   └── Cargo.toml
│
├── layout/                 # WASM layout worker (browser)
│   ├── src/
│   │   ├── lib.rs              # WASM entry point
│   │   ├── sheets/             # Sheet layout data
│   │   │   ├── fills/          # Fill layout
│   │   │   └── text/           # Text layout, label mesh generation
│   │   ├── tables/             # Table layout
│   │   ├── ui/                 # UI layout (cursor, headings)
│   │   ├── viewport/           # Viewport calculations
│   │   └── worker/             # Layout worker entry point
│   │       ├── layout_worker.rs
│   │       ├── state.rs
│   │       └── message_handler.rs
│   └── Cargo.toml
│
└── native/                 # Native renderer (server-side)
    ├── src/
    │   ├── lib.rs
    │   ├── renderer.rs         # NativeRenderer using wgpu
    │   ├── request.rs          # RenderRequest
    │   └── image_export.rs     # PNG export
    ├── screenshot/
    │   └── screenshot.rs       # CLI screenshot tool
    └── Cargo.toml
```

## Building

### Prerequisites

- Rust nightly (see `rust-toolchain.toml`)
- wasm-pack: `cargo install wasm-pack`
- cargo-watch (optional): `cargo install cargo-watch`

### WASM Builds (from repo root)

```bash
# Build renderer WASM
npm run build:wasm:rust-renderer

# Build layout worker WASM
npm run build:wasm:rust-layout

# Watch mode
npm run watch:wasm:rust-renderer
npm run watch:wasm:rust-layout
```

### Native Build

```bash
# Build native screenshot tool
cargo build -p quadratic-renderer-native --example screenshot

# Run screenshot tool
npm run screenshot -- --file path/to/grid.grid --selection A1:Z100 --output screenshot.png
```

## Screenshot Tool

Generate PNG screenshots from grid files:

```bash
npm run screenshot -- \
  --file path/to/file.grid \
  --selection A1:Z50 \
  --width 1200 \
  --output screenshot.png \
  --dpr 2
```

Options:
- `--file`: Path to .grid file (required)
- `--selection`: A1 notation range to render (required)
- `--width` or `--height`: Output dimension (other calculated from aspect ratio)
- `--output`: Output PNG path (default: output.png)
- `--dpr`: Device pixel ratio for crisp text (default: 2)
- `--fonts`: Font directory (default: quadratic-client/public/fonts/opensans)
- `--grid-lines`: Show grid lines (default: true)

## Architecture

### Two-Worker Model (Browser)

The browser renderer uses a two-worker architecture for optimal performance:

1. **Layout Worker** (`layout/`): Computes text layout, generates meshes, produces `RenderBatch`
2. **Render Worker** (`renderer/`): Receives batches, uploads to GPU, renders frames

Communication uses `SharedArrayBuffer` for viewport state and `MessagePort` for batch transfer.

### Core Library

The `core/` crate contains platform-agnostic code shared between all targets:

- **Types**: `RenderBatch`, `TextBuffer`, `FillBuffer`, `LineBuffer`
- **Constants**: Hash dimensions, padding values
- **Font Loading**: Unified font loader for WASM and native
- **Table Outlines**: Table border rendering logic
- **wgpu Backend**: Shared GPU rendering code for WebGPU and native

### Native Renderer

The `native/` crate provides headless rendering for server-side use:

- Uses wgpu with native backends (Vulkan, Metal, DX12)
- Loads grid files via `quadratic-core`
- Generates PNG output
- Used for thumbnails, exports, and cloud rendering

## Communication with Core

The renderer communicates with `quadratic-core` via bincode-encoded messages:

- **RendererToCore**: Requests for hash data (fills, labels)
- **CoreToRenderer**: Sheet data, cell data, table data, offsets

Data is organized in spatial hashes (100x100 cells) for efficient viewport-based loading.

## Current Status

✅ **Implemented**:
- WASM initialization and Web Worker integration
- WebGPU context with WebGL2 fallback
- SharedArrayBuffer viewport synchronization
- Grid lines, cell fills, MSDF text rendering
- Emoji sprites (lazy-loaded)
- Cursor and selection rendering
- Row/column headings
- Data tables (headers, outlines)
- Multi-sheet support
- Text overflow clipping
- Native headless rendering
- PNG screenshot generation

🚧 **In Progress / Planned**:
- Images
- Validations
- Code cell decorations
- Performance optimizations
