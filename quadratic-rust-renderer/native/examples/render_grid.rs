//! Render a Quadratic grid file to PNG
//!
//! This example loads a .grid file and renders a specified range to PNG.
//!
//! Usage:
//!   cargo run -p quadratic-renderer-native --example render_grid -- \
//!     --file path/to/file.grid \
//!     --range "A1:J20" \
//!     --output output.png \
//!     --width 800 \
//!     --height 600 \
//!     --fonts path/to/fonts

use clap::Parser;
use quadratic_core::grid::file::import;
use quadratic_core_shared::{Pos, Rect};
use quadratic_renderer_core::font_loader::load_fonts_from_directory;
use quadratic_renderer_native::{CellFill, NativeRenderer, RenderRequest, SelectionRange};
use std::fs;
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(name = "render_grid")]
#[command(about = "Render a Quadratic grid file to PNG")]
struct Args {
    /// Input grid file (.grid)
    #[arg(short, long)]
    file: PathBuf,

    /// Cell range to render in A1 notation (e.g., "A1:J20")
    #[arg(short, long, default_value = "A1:J20")]
    range: String,

    /// Output PNG file
    #[arg(short, long, default_value = "output.png")]
    output: PathBuf,

    /// Output width in pixels
    #[arg(long, default_value = "800")]
    width: u32,

    /// Output height in pixels
    #[arg(long, default_value = "600")]
    height: u32,

    /// Sheet index (0-based)
    #[arg(short, long, default_value = "0")]
    sheet: usize,

    /// Show grid lines
    #[arg(long, default_value = "true")]
    grid_lines: bool,

    /// Fonts directory containing .fnt files
    #[arg(long)]
    fonts: Option<PathBuf>,
}

fn main() -> anyhow::Result<()> {
    // Initialize logging
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let args = Args::parse();

    // Load the grid file
    println!("Loading grid file: {:?}", args.file);
    let file_bytes = fs::read(&args.file)?;
    let grid = import(file_bytes)?;

    // Get the sheet
    let sheets = grid.sheets();
    if args.sheet >= sheets.len() {
        anyhow::bail!(
            "Sheet index {} out of range. Grid has {} sheets.",
            args.sheet,
            sheets.len()
        );
    }
    let sheet = &sheets[args.sheet];
    println!("Using sheet: {}", sheet.name());

    // Parse the range using quadratic-core-shared's A1 parser
    let rect = Rect::test_a1(&args.range);
    let selection = SelectionRange::new(rect.min.x, rect.min.y, rect.max.x, rect.max.y);

    println!(
        "Rendering range: {} (columns {}-{}, rows {}-{})",
        args.range, selection.start_col, selection.end_col, selection.start_row, selection.end_row
    );

    // Create render request
    let mut request = RenderRequest::new(selection, args.width, args.height);
    request.show_grid_lines = args.grid_lines;

    // Get sheet offsets for column/row sizes
    request.offsets = sheet.offsets().clone();

    // Get fills from the sheet
    let render_rect = quadratic_core::Rect::new_span(
        Pos {
            x: selection.start_col,
            y: selection.start_row,
        },
        Pos {
            x: selection.end_col,
            y: selection.end_row,
        },
    );

    let fills = sheet.get_render_fills_in_rect(render_rect);
    request.fills = fills
        .into_iter()
        .flat_map(|fill| {
            // Convert JsRenderFill (which is a rect) to individual cell fills
            let color = parse_color(&fill.color);
            let mut cells = Vec::new();
            for dx in 0..fill.w {
                for dy in 0..fill.h {
                    cells.push(CellFill::new(fill.x + dx as i64, fill.y + dy as i64, color));
                }
            }
            cells
        })
        .collect();

    println!("Found {} cell fills", request.fills.len());

    // Create renderer and render
    println!(
        "Creating renderer ({} x {} pixels)...",
        args.width, args.height
    );
    let mut renderer = NativeRenderer::new(args.width, args.height)?;

    // Load fonts if directory specified
    if let Some(font_dir) = &args.fonts {
        println!("Loading fonts from {:?}", font_dir);

        // Standard OpenSans font variants
        let font_files = [
            "OpenSans.fnt",
            "OpenSans-Bold.fnt",
            "OpenSans-Italic.fnt",
            "OpenSans-BoldItalic.fnt",
        ];

        let (fonts, texture_infos) = load_fonts_from_directory(font_dir, &font_files)?;

        println!("Loaded {} fonts: {:?}", fonts.count(), fonts.font_names());

        // Load font textures
        for texture_info in &texture_infos {
            let texture_path = font_dir.join(&texture_info.filename);
            println!(
                "Loading font texture: {:?} (UID: {})",
                texture_path, texture_info.texture_uid
            );

            let texture_bytes = fs::read(&texture_path)?;
            renderer.upload_font_texture(texture_info.texture_uid, &texture_bytes)?;
        }

        // Set fonts on renderer
        renderer.set_fonts(fonts);
    }

    println!("Rendering...");
    let png_bytes = renderer.render_to_png(&request)?;

    // Save to file
    fs::write(&args.output, &png_bytes)?;
    println!("Saved to {:?} ({} bytes)", args.output, png_bytes.len());

    Ok(())
}

/// Parse a color string (hex or named) to RGBA
fn parse_color(color: &str) -> [f32; 4] {
    // Handle hex colors
    if color.starts_with('#') {
        let hex = color.trim_start_matches('#');
        if hex.len() == 6 {
            if let (Ok(r), Ok(g), Ok(b)) = (
                u8::from_str_radix(&hex[0..2], 16),
                u8::from_str_radix(&hex[2..4], 16),
                u8::from_str_radix(&hex[4..6], 16),
            ) {
                return [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0, 1.0];
            }
        } else if hex.len() == 8 {
            if let (Ok(r), Ok(g), Ok(b), Ok(a)) = (
                u8::from_str_radix(&hex[0..2], 16),
                u8::from_str_radix(&hex[2..4], 16),
                u8::from_str_radix(&hex[4..6], 16),
                u8::from_str_radix(&hex[6..8], 16),
            ) {
                return [
                    r as f32 / 255.0,
                    g as f32 / 255.0,
                    b as f32 / 255.0,
                    a as f32 / 255.0,
                ];
            }
        }
    }

    // Handle rgba() format
    if color.starts_with("rgba(") {
        let inner = color.trim_start_matches("rgba(").trim_end_matches(')');
        let parts: Vec<&str> = inner.split(',').collect();
        if parts.len() == 4 {
            if let (Ok(r), Ok(g), Ok(b), Ok(a)) = (
                parts[0].trim().parse::<f32>(),
                parts[1].trim().parse::<f32>(),
                parts[2].trim().parse::<f32>(),
                parts[3].trim().parse::<f32>(),
            ) {
                return [r / 255.0, g / 255.0, b / 255.0, a];
            }
        }
    }

    // Handle rgb() format
    if color.starts_with("rgb(") {
        let inner = color.trim_start_matches("rgb(").trim_end_matches(')');
        let parts: Vec<&str> = inner.split(',').collect();
        if parts.len() == 3 {
            if let (Ok(r), Ok(g), Ok(b)) = (
                parts[0].trim().parse::<f32>(),
                parts[1].trim().parse::<f32>(),
                parts[2].trim().parse::<f32>(),
            ) {
                return [r / 255.0, g / 255.0, b / 255.0, 1.0];
            }
        }
    }

    // Handle named colors
    match color.to_lowercase().as_str() {
        "red" => [1.0, 0.0, 0.0, 1.0],
        "green" => [0.0, 1.0, 0.0, 1.0],
        "blue" => [0.0, 0.0, 1.0, 1.0],
        "yellow" => [1.0, 1.0, 0.0, 1.0],
        "cyan" => [0.0, 1.0, 1.0, 1.0],
        "magenta" => [1.0, 0.0, 1.0, 1.0],
        "white" => [1.0, 1.0, 1.0, 1.0],
        "black" => [0.0, 0.0, 0.0, 1.0],
        "gray" | "grey" => [0.5, 0.5, 0.5, 1.0],
        "orange" => [1.0, 0.647, 0.0, 1.0],
        "pink" => [1.0, 0.753, 0.796, 1.0],
        "purple" => [0.5, 0.0, 0.5, 1.0],
        _ => [0.8, 0.8, 0.8, 1.0], // Default light gray
    }
}
