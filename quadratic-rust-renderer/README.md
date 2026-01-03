# Quadratic Rust Renderer

A GPU-accelerated renderer for the Quadratic spreadsheet application, designed to run in a Web Worker for browser rendering.

## Overview

This project replaces the TypeScript/Pixi.js-based renderer with a Rust implementation supporting both WebGPU (preferred) and WebGL2 (fallback) backends. The benefits include:

- **Performance**: Native code compiled to WASM with GPU acceleration
- **Memory Safety**: Rust's ownership model prevents common graphics bugs
- **Dual Backend**: WebGPU for modern browsers with WebGL2 fallback
- **Shared Viewport**: Uses SharedArrayBuffer for zero-copy viewport synchronization with the main thread

## Architecture

The renderer is organized into platform-agnostic modules with a browser-specific worker entry point:

```
src/
├── lib.rs                  # WASM entry point and exports
├── renderers/              # Graphics backends
│   ├── primitives/         # Shared rendering primitives
│   │   ├── color.rs        # Color types and conversions
│   │   ├── font.rs         # Font texture ID management
│   │   ├── line.rs         # Line primitives
│   │   ├── rect.rs         # Rectangle primitives
│   │   ├── sprite.rs       # Sprite rendering
│   │   └── texture.rs      # Texture management
│   ├── webgl/              # WebGL2 backend
│   │   ├── context/        # WebGL context, draw calls, textures
│   │   ├── shaders/        # GLSL shaders (basic, msdf, sprite)
│   │   ├── font_manager.rs # WebGL font texture management
│   │   └── text.rs         # WebGL text rendering
│   └── webgpu/             # WebGPU backend
│       ├── context/        # WebGPU context, draw calls, viewport
│       ├── shaders/        # WGSL shaders (basic, instanced, msdf, sprite)
│       ├── font_manager.rs # WebGPU font texture management
│       └── render_target.rs
├── sheets/                 # Sheet data management
│   ├── sheet.rs            # Individual sheet state
│   ├── sheets.rs           # Multi-sheet container
│   ├── fills/              # Cell background fills (hash-based)
│   │   └── cells_fills_hash.rs
│   └── text/               # Text/label rendering
│       ├── bitmap_font.rs  # Bitmap font data structures
│       ├── cell_label.rs   # Individual cell label
│       ├── cells_text_hash.rs  # Spatial hash for text
│       ├── emoji_sprites.rs    # Emoji spritesheet handling
│       ├── label_mesh.rs   # Text mesh generation
│       └── a1_notation.rs  # A1-style cell reference parsing
├── tables/                 # Data table rendering
│   ├── table_cache.rs      # Table geometry caching
│   ├── table_render_data.rs # Table render data structures
│   └── table_rendering.rs  # Table header/outline rendering
├── ui/                     # Global UI elements
│   ├── ui.rs               # UI container
│   ├── cursor.rs           # Cursor and selection rendering
│   ├── grid_lines.rs       # Grid line rendering
│   └── headings/           # Row/column headings
│       ├── column_headings.rs
│       ├── row_headings.rs
│       └── grid_headings.rs
├── viewport/               # Camera/viewport management
│   ├── viewport.rs         # Viewport state and transforms
│   └── viewport_buffer.rs  # SharedArrayBuffer integration
├── utils/                  # Utilities
│   ├── color.rs            # Color conversions
│   ├── console_logger.rs   # WASM console logging
│   └── math.rs             # Math helpers
└── worker/                 # Web Worker entry point (browser only)
    ├── renderer.rs         # WorkerRenderer - main JS API
    ├── state.rs            # RendererState - core state management
    ├── backend.rs          # RenderBackend enum (WebGL/WebGPU)
    ├── message_handler.rs  # Core message handling
    ├── batch_receiver.rs   # Layout batch processing
    └── render/             # Per-element rendering helpers
        ├── background.rs
        ├── cursor.rs
        ├── fills.rs
        ├── headings.rs
        ├── tables.rs
        └── text.rs
```

## Building

### Prerequisites

- Rust nightly (see `rust-toolchain.toml`)
- wasm-pack: `cargo install wasm-pack`
- cargo-watch (optional, for development): `cargo install cargo-watch`

### Development

```bash
# Watch mode with auto-rebuild (WASM)
npm run start

# Or with local dev server
npm run dev

# Manual build for development
npm run build:dev
```

### Production

```bash
# Build WASM package
npm run build

# Build native (for cloud rendering)
npm run build:native
```

### Testing

```bash
# Native tests
npm run test

# WASM tests (requires Chrome)
npm run test:wasm

# Linting
npm run lint
npm run lint:wasm
```

## Usage

The renderer runs in a Web Worker and communicates with the main thread via SharedArrayBuffer for viewport state.

```javascript
import init, { WorkerRenderer } from './pkg/quadratic_rust_renderer';

async function main() {
  await init();

  // Transfer an OffscreenCanvas to the worker
  const canvas = document.getElementById('canvas').transferControlToOffscreen();

  // Create renderer - auto-selects WebGPU or WebGL
  let renderer;
  if (WorkerRenderer.is_webgpu_available()) {
    renderer = await WorkerRenderer.new_webgpu(canvas);
  } else {
    renderer = new WorkerRenderer(canvas); // WebGL fallback
  }

  console.log(`Using ${renderer.backend_name()} backend`);

  // Set up shared viewport buffer from main thread
  renderer.set_viewport_buffer(sharedViewportBuffer);

  // Start rendering
  renderer.start();

  // Render loop
  function frame(timestamp) {
    const elapsed = timestamp - lastTime;
    renderer.frame(elapsed);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
```

## Key Differences from Pixi.js

| Pixi.js | Rust Renderer |
|---------|---------------|
| Container hierarchy | Flat render order with explicit passes |
| Sprites/Graphics | Vertex buffers with custom shaders |
| BitmapText | MSDF text rendering with bitmap fonts |
| WebGL 1/2 | WebGPU (preferred) + WebGL2 (fallback) |
| requestAnimationFrame | wasm-bindgen-futures async loop |
| Main thread rendering | Web Worker with OffscreenCanvas |
| Direct viewport control | SharedArrayBuffer viewport sync |

## Communication with Core

The renderer communicates with `quadratic-core` via bincode-encoded messages:

- **RendererToCore**: Requests for hash data (fills, labels)
- **CoreToRenderer**: Sheet data, cell data, table data, offsets

Data is organized in spatial hashes for efficient viewport-based loading and unloading.

## Current Status

✅ **Implemented**:

- [x] WASM initialization and Web Worker integration
- [x] WebGPU context setup with WebGL2 fallback
- [x] SharedArrayBuffer viewport synchronization
- [x] Grid lines rendering
- [x] Cell background fills (with spatial hashing)
- [x] MSDF text rendering with bitmap fonts
- [x] Emoji sprite rendering (lazy-loaded pages)
- [x] Viewport pan/zoom (via shared buffer)
- [x] Cursor and selection rendering
- [x] Row/column headings
- [x] Data tables (headers, outlines, column names)
- [x] Multi-sheet support
- [x] Text overflow clipping

🚧 **In Progress / Planned**:

- [ ] Images
- [ ] Validations
- [ ] Code cell decorations
- [ ] Performance optimizations
