//! Screenshot - Render a Quadratic grid file to PNG
//!
//! This tool loads a .grid file and renders a specified range to PNG.
//! The image is sized to exactly fit the cell area while maintaining aspect ratio.
//!
//! Usage:
//!   cargo run -p quadratic-renderer-native --example screenshot -- \
//!     --file path/to/file.grid \
//!     --range "A1:J20" \
//!     --output output.png \
//!     --width 800 \
//!     --fonts path/to/fonts
//!
//! Or via npm:
//!   npm run screenshot -- --file path/to/file.grid --range "A1:J20"
//!
//! Note: Specify either --width OR --height. The other dimension will be
//! calculated to match the cell area's aspect ratio.

use clap::Parser;
use quadratic_core::grid::file::import;
use quadratic_core_shared::{Pos, Rect};
use quadratic_renderer_core::font_loader::load_fonts_from_directory;
use quadratic_renderer_core::{from_rgba, parse_color};
use quadratic_renderer_native::{
    BorderLineStyle, CellFill, CellText, NativeRenderer, RenderRequest, SelectionRange,
    SheetBorders, TableOutline, TableOutlines,
};
use std::fs;
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(name = "screenshot")]
#[command(about = "Render a Quadratic grid file to PNG screenshot")]
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

    /// Output width in pixels (if not set, calculated from height)
    #[arg(long)]
    width: Option<u32>,

    /// Output height in pixels (if not set, calculated from width)
    #[arg(long)]
    height: Option<u32>,

    /// Sheet index (0-based)
    #[arg(short, long, default_value = "0")]
    sheet: usize,

    /// Show grid lines
    #[arg(long, default_value = "true")]
    grid_lines: bool,

    /// Fonts directory containing .fnt files
    #[arg(long, default_value = "quadratic-client/public/fonts/opensans")]
    fonts: PathBuf,

    /// Device pixel ratio for higher resolution rendering (default 2 for crisp text)
    #[arg(long, default_value = "2")]
    dpr: u32,
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

    // Get sheet offsets for column/row sizes
    let offsets = sheet.offsets().clone();

    // Calculate the selection's world bounds to determine aspect ratio
    let (_world_x, _world_y, world_w, world_h) = selection.world_bounds(&offsets);
    let aspect_ratio = world_w / world_h;

    println!(
        "Cell area: {:.1}x{:.1} pixels (aspect ratio: {:.3})",
        world_w, world_h, aspect_ratio
    );

    // Calculate output dimensions based on aspect ratio
    let (base_width, base_height) = match (args.width, args.height) {
        (Some(w), Some(_h)) => {
            println!("Warning: Both width and height specified. Using width and calculating height from aspect ratio.");
            (w, (w as f32 / aspect_ratio).round() as u32)
        }
        (Some(w), None) => (w, (w as f32 / aspect_ratio).round() as u32),
        (None, Some(h)) => ((h as f32 * aspect_ratio).round() as u32, h),
        (None, None) => {
            // Default to 800px width
            let w = 800u32;
            (w, (w as f32 / aspect_ratio).round() as u32)
        }
    };

    // Apply DPR for higher resolution rendering
    let render_width = base_width * args.dpr;
    let render_height = base_height * args.dpr;

    // Create render request
    let mut request = RenderRequest::new(selection, render_width, render_height);
    request.show_grid_lines = args.grid_lines;
    request.offsets = offsets;

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

    // Get text cells from the sheet
    let a1_context = grid.expensive_make_a1_context();
    let js_render_cells = sheet.get_render_cells(render_rect, &a1_context);

    // Table header text colors (matching TS renderer)
    const TABLE_NAME_TEXT_COLOR: [f32; 4] = [1.0, 1.0, 1.0, 1.0]; // White on colored bg
    const COLUMN_HEADER_TEXT_COLOR: [f32; 4] = [0.008, 0.031, 0.090, 1.0]; // Dark on white bg

    request.text = js_render_cells
        .into_iter()
        .filter(|cell| !cell.value.is_empty())
        .map(|cell| {
            let mut text = CellText::new(cell.x, cell.y, &cell.value);

            // Apply text color based on cell type
            if cell.table_name == Some(true) {
                // Table name row: white text on colored background
                text = text.with_color(TABLE_NAME_TEXT_COLOR);
            } else if cell.column_header == Some(true) {
                // Column header row: dark text on white background
                text = text.with_color(COLUMN_HEADER_TEXT_COLOR);
            } else if let Some(ref color_str) = cell.text_color {
                text = text.with_color(parse_color(color_str));
            }

            // Apply font size
            if let Some(size) = cell.font_size {
                text = text.with_font_size(size as f32);
            }

            // Apply bold/italic
            if cell.bold == Some(true) {
                text = text.bold();
            }
            if cell.italic == Some(true) {
                text = text.italic();
            }

            text
        })
        .collect();

    println!("Found {} text cells", request.text.len());

    // Get borders from the sheet
    let js_borders = sheet.borders_in_sheet();
    let mut borders = SheetBorders::new();

    // Convert horizontal borders
    if let Some(h_borders) = js_borders.horizontal {
        for border in h_borders {
            let color = from_rgba(&border.color);
            let line_style = cell_border_line_to_style(&border.line);
            borders.add_horizontal(border.x, border.y, border.width, color, line_style);
        }
    }

    // Convert vertical borders
    if let Some(v_borders) = js_borders.vertical {
        for border in v_borders {
            let color = from_rgba(&border.color);
            let line_style = cell_border_line_to_style(&border.line);
            borders.add_vertical(border.x, border.y, border.height, color, line_style);
        }
    }

    request.borders = borders;
    println!(
        "Found {} horizontal and {} vertical borders",
        request.borders.horizontal.len(),
        request.borders.vertical.len()
    );

    // Get table outlines (code cells / data tables)
    // Only include tables that intersect with the selection, clipped to selection bounds
    let mut table_outlines = TableOutlines::new();
    for code_cell in sheet.get_all_render_code_cells() {
        let table_x = code_cell.x as i64;
        let table_y = code_cell.y as i64;
        let table_right = table_x + code_cell.w as i64;
        let table_bottom = table_y + code_cell.h as i64;

        // Check if table intersects with selection
        if table_right <= selection.start_col
            || table_x > selection.end_col
            || table_bottom <= selection.start_row
            || table_y > selection.end_row
        {
            continue; // Table doesn't intersect with selection
        }

        // Clip table bounds to selection
        let clipped_x = table_x.max(selection.start_col);
        let clipped_y = table_y.max(selection.start_row);
        let clipped_right = table_right.min(selection.end_col + 1);
        let clipped_bottom = table_bottom.min(selection.end_row + 1);
        let clipped_w = (clipped_right - clipped_x) as u32;
        let clipped_h = (clipped_bottom - clipped_y) as u32;

        // Check if table extends beyond selection bounds
        let is_clipped_bottom = table_bottom > selection.end_row + 1;
        let is_clipped_right = table_right > selection.end_col + 1;

        // Only show name/columns if the top of the table is visible
        let show_name = code_cell.show_name && table_y >= selection.start_row;
        let show_columns = code_cell.show_columns
            && (table_y + if show_name { 1 } else { 0 }) >= selection.start_row;

        let mut table = TableOutline::new(clipped_x, clipped_y, clipped_w, clipped_h)
            .with_show_columns(show_columns)
            .with_active(false) // No active table in static render
            .with_clipped_bottom(is_clipped_bottom)
            .with_clipped_right(is_clipped_right);

        if show_name {
            table = table.with_name(&code_cell.name);
        }

        table_outlines.add(table);
    }
    request.table_outlines = table_outlines;
    println!(
        "Found {} table outlines",
        request.table_outlines.tables.len()
    );

    // Create renderer and render
    println!(
        "Creating renderer ({} x {} pixels, {}x DPR = {} x {})...",
        base_width, base_height, args.dpr, render_width, render_height
    );
    let mut renderer = NativeRenderer::new(render_width, render_height)?;

    // Load fonts
    let font_dir = &args.fonts;
    if font_dir.exists() {
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
    } else {
        println!(
            "Warning: Fonts directory {:?} not found, text will not render",
            font_dir
        );
    }

    println!("Rendering...");
    let png_bytes = renderer.render_to_png(&request)?;

    // Save to file
    fs::write(&args.output, &png_bytes)?;
    println!("Saved to {:?} ({} bytes)", args.output, png_bytes.len());

    Ok(())
}

/// Convert CellBorderLine to BorderLineStyle
fn cell_border_line_to_style(
    line: &quadratic_core::grid::sheet::borders::CellBorderLine,
) -> BorderLineStyle {
    use quadratic_core::grid::sheet::borders::CellBorderLine;
    match line {
        CellBorderLine::Line1 => BorderLineStyle::Line1,
        CellBorderLine::Line2 => BorderLineStyle::Line2,
        CellBorderLine::Line3 => BorderLineStyle::Line3,
        CellBorderLine::Dotted => BorderLineStyle::Dotted,
        CellBorderLine::Dashed => BorderLineStyle::Dashed,
        CellBorderLine::Double => BorderLineStyle::Double,
        CellBorderLine::Clear => BorderLineStyle::Line1, // Shouldn't happen
    }
}
