# Quadratic Rust Renderer

A proof-of-concept port of the Pixi.js renderer from `quadratic-client/src/app/gridGL` into Rust for use via WebAssembly.

## Overview

This project aims to replace the TypeScript/Pixi.js-based renderer with a Rust implementation using `wgpu` for GPU-accelerated rendering. The benefits include:

- **Performance**: Native code compiled to WASM can be significantly faster
- **Memory Safety**: Rust's ownership model prevents common graphics bugs
- **WebGPU Native**: Modern graphics API with better performance than WebGL
- **Code Sharing**: Potential to share rendering logic with native desktop apps

## Architecture

The renderer is structured to mirror the existing Pixi.js implementation:

```
src/
├── lib.rs              # WASM entry point and exports
├── app.rs              # Main renderer application (PixiApp equivalent)
├── viewport/           # Viewport/camera controls
│   ├── mod.rs
│   ├── viewport.rs     # Viewport container
│   ├── drag.rs         # Drag interactions
│   └── wheel.rs        # Zoom/scroll handling
├── content/            # Renderable content
│   ├── mod.rs
│   ├── content.rs      # Main content container
│   ├── grid_lines.rs   # Grid line rendering
│   ├── headings.rs     # Row/column headings
│   └── cursor.rs       # Cursor rendering
├── cells/              # Cell rendering
│   ├── mod.rs
│   ├── cells_sheet.rs  # Sheet cell management
│   ├── cells_labels.rs # Text label rendering
│   └── borders.rs      # Cell border rendering
├── gpu/                # GPU abstractions
│   ├── mod.rs
│   ├── context.rs      # WGPU context management
│   ├── pipeline.rs     # Render pipelines
│   └── buffers.rs      # Vertex/index buffers
└── utils/              # Utilities
    ├── mod.rs
    └── color.rs        # Color conversions
```

## Building

### Prerequisites

- Rust 1.89.0+ (see rust-toolchain.toml)
- wasm-pack: `cargo install wasm-pack`
- cargo-watch (optional, for development): `cargo install cargo-watch`

### Development

```bash
# Watch mode with auto-rebuild
npm run start

# Or manually build for development
npm run build:dev
```

### Production

```bash
npm run build
```

## Usage

After building, import the WASM module in your JavaScript/TypeScript:

```typescript
import init, { RustRenderer } from './pkg/quadratic_rust_renderer';

async function main() {
  await init();

  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const renderer = await RustRenderer.new(canvas);

  // Start render loop
  renderer.start();
}
```

## Integration with Quadratic Client

This POC is designed to eventually replace the Pixi.js renderer in `quadratic-client`. The integration path:

1. **Phase 1**: Build standalone renderer with basic grid/cell rendering
2. **Phase 2**: Add cell content, labels, and formatting support
3. **Phase 3**: Implement viewport interactions (pan, zoom, selection)
4. **Phase 4**: Add advanced features (tables, images, validations)
5. **Phase 5**: Integrate with the existing quadratic-client application

## Key Differences from Pixi.js

| Pixi.js | Rust Renderer |
|---------|---------------|
| Container hierarchy | Render order managed explicitly |
| Sprites/Graphics | Custom vertex buffers |
| BitmapText | fontdue for glyph rasterization |
| WebGL 1/2 | WebGPU (with WebGL fallback) |
| requestAnimationFrame | wasm-bindgen-futures async loop |

## Testing

```bash
npm run test
```

## Current Status

🚧 **Work in Progress** - This is a proof of concept.

- [ ] Basic WASM initialization
- [ ] WGPU context setup
- [ ] Grid lines rendering
- [ ] Cell background rendering
- [ ] Text rendering
- [ ] Viewport pan/zoom
- [ ] Cursor rendering
- [ ] Selection rendering
- [ ] Row/column headings
- [ ] Tables
- [ ] Images
- [ ] Validations

