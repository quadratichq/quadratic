# Quadratic Rust Renderer

A GPU-accelerated renderer for generating screenshots and thumbnails from Quadratic grid files.

## Overview

This project provides server-side rendering for Quadratic spreadsheets:

- **Screenshot Generation**: Generate PNG/JPEG images from grid files
- **Thumbnail Creation**: Create thumbnails for file previews
- **Cloud Rendering**: Server-side rendering in cloud workers

### Key Benefits

- **Performance**: GPU-accelerated rendering via wgpu
- **Memory Safety**: Rust's ownership model prevents common graphics bugs
- **Cross-Platform**: Supports Vulkan, Metal, and DX12 backends
- **Headless**: No display required for server-side use

## Project Structure

```
quadratic-rust-renderer/
├── core/                   # Shared platform-agnostic library
│   ├── src/
│   │   ├── lib.rs
│   │   ├── font_loader.rs      # Font loading
│   │   ├── types/              # Shared types
│   │   │   ├── buffer_types.rs # TextBuffer, FillBuffer, LineBuffer
│   │   │   ├── render_types.rs # RenderCell, RenderFill
│   │   │   ├── render_batch.rs # RenderBatch, HashRenderData
│   │   │   └── borders.rs      # Border rendering
│   │   ├── tables/             # Table rendering
│   │   │   └── table_outline.rs
│   │   ├── sheets/             # Sheet data management
│   │   │   └── text/           # Text layout and rendering
│   │   └── wgpu_backend/       # GPU renderer
│   │       ├── renderer.rs     # WgpuRenderer
│   │       ├── pipelines.rs    # Render pipelines
│   │       ├── shaders.rs      # WGSL shaders
│   │       └── texture_manager.rs
│   └── Cargo.toml
│
└── native/                 # Native renderer
    ├── src/
    │   ├── lib.rs
    │   ├── renderer.rs         # NativeRenderer using wgpu
    │   ├── request.rs          # RenderRequest
    │   └── image_export.rs     # PNG/JPEG export
    ├── screenshot/
    │   └── screenshot.rs       # CLI screenshot tool
    └── Cargo.toml
```

## Building

### Prerequisites

- Rust stable (see `rust-toolchain.toml`)
- One of the following for rendering:
  - **GPU**: Vulkan, Metal, or DX12 support (recommended)
  - **CPU Fallback**: Software rendering via llvmpipe (Mesa), SwiftShader, or lavapipe
  
For headless servers without GPU, install a software Vulkan driver:
```bash
# Ubuntu/Debian
apt-get install mesa-vulkan-drivers

# macOS (SwiftShader via Homebrew)
brew install swiftshader
```

### Build

```bash
# Build native screenshot tool
cargo build -p quadratic-renderer-native --example screenshot --release

# Run screenshot tool
cargo run -p quadratic-renderer-native --example screenshot -- \
  --file path/to/file.grid \
  --range A1:Z100 \
  --output screenshot.png
```

## Screenshot Tool

Generate PNG screenshots from grid files:

```bash
cargo run -p quadratic-renderer-native --example screenshot -- \
  --file path/to/file.grid \
  --range A1:Z50 \
  --width 1200 \
  --output screenshot.png \
  --dpr 2
```

### Thumbnail Mode

Generate a thumbnail with automatic settings (1280x720 PNG, auto-calculated range):

```bash
cargo run -p quadratic-renderer-native --example screenshot -- \
  --file path/to/file.grid \
  --thumbnail
```

Thumbnail mode automatically:
- Calculates the range from top-left (0,0) to cover cells visible in 1280x720 pixels
- Outputs a 1280x720 PNG image (16:9 aspect ratio)
- Enables grid lines
- Saves to `thumbnail.png` by default

### Options

- `--file`: Path to .grid file (required)
- `--thumbnail`: Generate a thumbnail with automatic settings
- `--range`: A1 notation range to render (default: A1:J20)
- `--width` or `--height`: Output dimension (other calculated from aspect ratio)
- `--output`: Output path (default: thumbnail.png in thumbnail mode, output.png otherwise)
- `--format`: Output format: png, jpeg, or webp (default: png)
- `--quality`: JPEG quality 0-100 (default: 90)
- `--dpr`: Device pixel ratio for crisp text (default: 2)
- `--fonts`: Font directory (default: quadratic-client/public/fonts/opensans)
- `--grid-lines`: Show grid lines (default: true)
- `--sheet`: Sheet index, 0-based (default: 0)

## Architecture

### Core Library

The `core/` crate contains platform-agnostic rendering code:

- **Types**: `RenderCell`, `RenderFill`, `RenderBatch`, buffer types
- **Text Layout**: MSDF font rendering with text overflow clipping
- **Table Outlines**: Table border and header rendering
- **wgpu Backend**: GPU rendering pipelines and shaders

### Native Renderer

The `native/` crate provides headless rendering:

- Uses wgpu with native backends (Vulkan, Metal, DX12)
- Loads grid files via `quadratic-core`
- Generates PNG/JPEG output
- API for programmatic rendering

## Usage Example

```rust
use quadratic_renderer_native::{NativeRenderer, RenderRequest, SelectionRange};

// Create renderer
let mut renderer = NativeRenderer::new(800, 600)?;

// Define what to render
let request = RenderRequest::new(
    SelectionRange::new(1, 1, 10, 20),
    800,
    600,
);

// Render to PNG
let png_bytes = renderer.render_to_png(&request)?;
```

## Rendering Features

- Grid lines
- Cell background fills
- MSDF text rendering with font variants (bold, italic)
- Cell borders (multiple styles)
- Data table outlines with headers
- Text overflow clipping
- High-DPI support via device pixel ratio
