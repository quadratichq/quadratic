//! Screenshot - Render a Quadratic grid file to an image
//!
//! This tool loads a .grid file and renders a specified range to PNG, JPEG, or WebP.
//! The image is sized to exactly fit the cell area while maintaining aspect ratio.
//!
//! Usage:
//!   cargo run -p quadratic-renderer-native --example screenshot -- \
//!     --file path/to/file.grid \
//!     --range "A1:J20" \
//!     --output output.png \
//!     --width 800 \
//!     --format png \
//!     --fonts path/to/fonts
//!
//! Or via npm:
//!   npm run screenshot -- --file path/to/file.grid --range "A1:J20" --format webp --quality 90
//!
//! Note: Specify either --width OR --height. The other dimension will be
//! calculated to match the cell area's aspect ratio.

use clap::Parser;
use quadratic_core::color::Rgba;
use quadratic_core::controller::GridController;
use quadratic_core::grid::file::import;
use quadratic_core::CellValue;
use quadratic_core::Pos;
use quadratic_renderer_core::emoji_loader::load_emoji_spritesheet;
use quadratic_renderer_core::font_loader::load_fonts_from_directory;
use quadratic_renderer_core::from_rgba;
use quadratic_renderer_core::parse_color_to_rgba;
use quadratic_renderer_core::{RenderCell, RenderFill};
use quadratic_renderer_native::{
    BorderLineStyle, ChartImage, ImageFormat, NativeRenderer, RenderRequest, SelectionRange,
    SheetBorders, TableNameIcon, TableOutline, TableOutlines,
};
use std::fs;
use std::path::PathBuf;
use std::time::Instant;

#[derive(Parser, Debug)]
#[command(name = "screenshot")]
#[command(about = "Render a Quadratic grid file to an image screenshot")]
struct Args {
    /// Input grid file (.grid)
    #[arg(short, long)]
    file: PathBuf,

    /// Cell range to render in A1 notation (e.g., "A1:J20")
    #[arg(short, long, default_value = "A1:J20")]
    range: String,

    /// Output image file
    #[arg(short, long, default_value = "output.png")]
    output: PathBuf,

    /// Output format: png, jpeg, or webp
    #[arg(long, default_value = "png")]
    format: String,

    /// Quality for JPEG (0-100). WebP is always lossless.
    #[arg(short = 'q', long, default_value = "90")]
    quality: u8,

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
    #[arg(long)]
    fonts: Option<PathBuf>,

    /// Device pixel ratio for higher resolution rendering (default 2 for crisp text)
    #[arg(long, default_value = "2")]
    dpr: u32,
}

fn main() -> anyhow::Result<()> {
    let start_time = Instant::now();

    // Initialize logging
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let args = Args::parse();

    // Load the grid file
    println!("Loading grid file: {:?}", args.file);
    let file_bytes = fs::read(&args.file)?;
    let grid = import(file_bytes)?;

    // Create GridController for conditional formatting support
    let gc = GridController::from_grid(grid, 0);

    // Get the sheet
    let sheet_ids = gc.sheet_ids();
    if args.sheet >= sheet_ids.len() {
        anyhow::bail!(
            "Sheet index {} out of range. Grid has {} sheets.",
            args.sheet,
            sheet_ids.len()
        );
    }
    let sheet_id = sheet_ids[args.sheet];
    let sheet = gc.try_sheet(sheet_id).ok_or_else(|| {
        anyhow::anyhow!("Sheet with id {:?} not found", sheet_id)
    })?;
    println!("Using sheet: {}", sheet.name());

    // Parse the range in A1 notation (e.g., "A1:J20")
    let (start_pos, end_pos) = parse_a1_range(&args.range)?;
    let selection = SelectionRange::new(start_pos.x, start_pos.y, end_pos.x, end_pos.y);

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

    // Get fills and convert from JsRenderFill to RenderFill
    let js_fills = sheet.get_render_fills_in_rect(render_rect);
    let mut fills: Vec<RenderFill> = js_fills.into_iter().map(RenderFill::from).collect();

    // Get conditional format fills and merge them (they render on top of static fills)
    let a1_context = gc.a1_context();
    let cf_fills = gc.get_conditional_format_fills(sheet_id, render_rect, a1_context);
    for (rect, color) in cf_fills {
        fills.push(RenderFill::new(
            rect.min.x,
            rect.min.y,
            (rect.max.x - rect.min.x + 1) as u32,
            (rect.max.y - rect.min.y + 1) as u32,
            parse_color_to_rgba(&color),
        ));
    }
    request.fills = fills;

    println!("Found {} fills", request.fills.len());

    // Get cells and convert from JsRenderCell to RenderCell
    let mut js_cells = sheet.get_render_cells(render_rect, a1_context);

    // Apply conditional formatting to cells (text styles: bold, italic, underline, strikethrough, text_color)
    gc.apply_conditional_formatting_to_cells(sheet_id, render_rect, &mut js_cells);

    let mut cells: Vec<RenderCell> = js_cells.into_iter().map(RenderCell::from).collect();

    // Table header text colors (matching TS renderer)
    let table_name_text_color = Rgba::rgb(255, 255, 255); // White on colored bg
    let column_header_text_color = Rgba::rgb(2, 8, 23); // Dark on white bg

    // Apply table header colors (these override cell colors for visibility)
    for cell in &mut cells {
        if cell.table_name == Some(true) {
            cell.text_color = Some(table_name_text_color);
        } else if cell.column_header == Some(true) {
            cell.text_color = Some(column_header_text_color);
        }
    }

    request.cells = cells;

    println!("Found {} cells", request.cells.len());

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

    // Get table outlines (code cells / data tables)
    // Only include tables that intersect with the selection, clipped to selection bounds
    let mut table_outlines = TableOutlines::new();
    let mut table_name_cells: Vec<RenderCell> = Vec::new();
    let mut table_name_icons: Vec<TableNameIcon> = Vec::new();

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

        // Check if table extends beyond selection bounds (clipped edges)
        let is_clipped_top = table_y < selection.start_row;
        let is_clipped_bottom = table_bottom > selection.end_row + 1;
        let is_clipped_left = table_x < selection.start_col;
        let is_clipped_right = table_right > selection.end_col + 1;

        // Only show name/columns if the top of the table is visible
        let show_name = code_cell.show_name && table_y >= selection.start_row;
        let show_columns = code_cell.show_columns
            && (table_y + if show_name { 1 } else { 0 }) >= selection.start_row;

        let mut table = TableOutline::new(clipped_x, clipped_y, clipped_w, clipped_h)
            .with_show_columns(show_columns)
            .with_active(false) // No active table in static render
            .with_clipped_top(is_clipped_top)
            .with_clipped_bottom(is_clipped_bottom)
            .with_clipped_left(is_clipped_left)
            .with_clipped_right(is_clipped_right);

        if show_name {
            table = table.with_name(&code_cell.name);

            // Add language icon for this table
            table_name_icons.push(TableNameIcon {
                x: table_x,
                y: table_y,
                language: code_cell.language.clone(),
            });

            // Add table name as a RenderCell for text rendering
            // The name text is offset to the right to make room for the icon
            table_name_cells.push(RenderCell {
                x: table_x,
                y: table_y,
                value: code_cell.name.clone(),
                bold: Some(true),
                text_color: Some(Rgba::rgb(255, 255, 255)), // White on colored bg
                table_name: Some(true),
                ..Default::default()
            });
        }

        table_outlines.add(table);
    }

    // Also process single-cell CellValue::Code cells (formulas, etc.)
    // These are 1x1 code cells that aren't stored as DataTables
    for pos in sheet.iter_code_cells_positions() {
        // Check if cell is in selection
        if pos.x < selection.start_col
            || pos.x > selection.end_col
            || pos.y < selection.start_row
            || pos.y > selection.end_row
        {
            continue;
        }

        // Get the code cell to extract language
        if let Some(CellValue::Code(_)) = sheet.cell_value_ref(pos) {
            // Create a 1x1 table outline for the code cell
            // Note: No language icon for single-cell code cells since show_name is false
            let table = TableOutline::new(pos.x, pos.y, 1, 1)
                .with_show_columns(false)
                .with_active(false);

            table_outlines.add(table);
        }
    }

    request.table_outlines = table_outlines;
    request.table_name_icons = table_name_icons;

    // Add table name cells to the cells list
    request.cells.extend(table_name_cells);
    println!(
        "Found {} table outlines",
        request.table_outlines.tables.len()
    );

    // Get chart images (HTML output with chart_image data)
    let mut chart_images = Vec::new();
    for html_output in sheet.get_html_output() {
        // Only include if we have chart_image data
        if let Some(chart_image_data) = html_output.chart_image {
            let chart_x = html_output.x as i64;
            // Offset y by 1 row if the chart has a title bar (show_name)
            let chart_y = html_output.y as i64 + if html_output.show_name { 1 } else { 0 };
            let chart_w = html_output.w as i64;
            let chart_h = html_output.h as i64;

            // Check if chart intersects with selection
            if chart_x + chart_w <= selection.start_col
                || chart_x > selection.end_col
                || chart_y + chart_h <= selection.start_row
                || chart_y > selection.end_row
            {
                continue; // Chart doesn't intersect with selection
            }

            // Get pixel dimensions from the HTML output
            // Note: w and h in JsHtmlOutput are in pixels, not cells
            chart_images.push(ChartImage {
                x: chart_x,
                y: chart_y,
                width: html_output.w as u32,
                height: html_output.h as u32,
                image_data: chart_image_data,
            });
        }
    }
    request.chart_images = chart_images;
    println!("Found {} chart images", request.chart_images.len());

    // Create renderer and render
    println!(
        "Creating renderer ({} x {} pixels, {}x DPR = {} x {})...",
        base_width, base_height, args.dpr, render_width, render_height
    );
    let mut renderer = NativeRenderer::new(render_width, render_height)?;

    // Find fonts directory
    let font_dir = find_fonts_directory(args.fonts.as_ref())?;
    println!("Loading fonts from {:?}", font_dir);

    // Standard OpenSans font variants
    let font_files = [
        "OpenSans.fnt",
        "OpenSans-Bold.fnt",
        "OpenSans-Italic.fnt",
        "OpenSans-BoldItalic.fnt",
    ];

    let (fonts, texture_infos) = load_fonts_from_directory(&font_dir, &font_files)?;

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

    // Upload chart images
    if !request.chart_images.is_empty() {
        println!("Uploading {} chart images...", request.chart_images.len());
        renderer.upload_chart_images(&request.chart_images)?;
    }

    // Upload language icons
    if !request.table_name_icons.is_empty() {
        if let Ok(icons_dir) = find_icons_directory() {
            println!(
                "Loading {} language icons from {:?}...",
                request.table_name_icons.len(),
                icons_dir
            );
            renderer.upload_language_icons(&request.table_name_icons, &icons_dir)?;
        } else {
            println!(
                "Warning: Icons directory not found, {} table icons will not render",
                request.table_name_icons.len()
            );
        }
    }

    // Load emoji spritesheet (textures are lazy-loaded when needed)
    if let Ok(emoji_dir) = find_emoji_directory() {
        println!("Loading emoji mapping from {:?}...", emoji_dir);
        match load_emoji_spritesheet(&emoji_dir) {
            Ok((spritesheet, _texture_infos)) => {
                println!(
                    "Loaded emoji mapping: {} emojis, {} texture pages (lazy loading)",
                    spritesheet.emoji_count(),
                    spritesheet.page_count()
                );
                renderer.set_emoji_spritesheet(spritesheet, emoji_dir);
            }
            Err(e) => {
                println!("Warning: Failed to load emoji mapping: {}", e);
            }
        }
    } else {
        println!("Note: Emoji directory not found, emojis will not render");
    }

    // Parse format
    let image_format = match args.format.to_lowercase().as_str() {
        "png" => ImageFormat::Png,
        "jpeg" | "jpg" => ImageFormat::Jpeg(args.quality),
        "webp" => ImageFormat::Webp(args.quality),
        _ => anyhow::bail!(
            "Unsupported format: '{}'. Use png, jpeg, or webp.",
            args.format
        ),
    };

    println!(
        "Rendering to {:?} format{}...",
        args.format.to_uppercase(),
        match image_format {
            ImageFormat::Jpeg(q) => format!(" (quality: {})", q),
            ImageFormat::Webp(_) => " (lossless)".to_string(),
            ImageFormat::Png => String::new(),
        }
    );
    let image_bytes = renderer.render_to_format(&request, image_format)?;

    // Save to file
    fs::write(&args.output, &image_bytes)?;
    let elapsed = start_time.elapsed();
    println!(
        "Saved to {:?} ({} bytes) in {:.2}s",
        args.output,
        image_bytes.len(),
        elapsed.as_secs_f64()
    );

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

/// Find the fonts directory, trying multiple locations.
fn find_fonts_directory(explicit_path: Option<&PathBuf>) -> anyhow::Result<PathBuf> {
    // If explicitly provided, use that
    if let Some(path) = explicit_path {
        if path.exists() {
            return Ok(path.clone());
        }
        anyhow::bail!("Specified fonts directory not found: {:?}", path);
    }

    // Try common locations relative to current directory
    let candidates = [
        // From workspace root
        "quadratic-client/public/fonts/opensans",
        // From quadratic-rust-renderer directory
        "../quadratic-client/public/fonts/opensans",
        // From native directory
        "../../quadratic-client/public/fonts/opensans",
        // From native/screenshot directory (when running example)
        "../../../quadratic-client/public/fonts/opensans",
    ];

    for candidate in &candidates {
        let path = PathBuf::from(candidate);
        if path.exists() && path.join("OpenSans.fnt").exists() {
            return Ok(path);
        }
    }

    // Try to find based on the executable path
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            // Go up from target/debug/examples to find workspace root
            for ancestor in exe_dir.ancestors().take(6) {
                let fonts_path = ancestor.join("quadratic-client/public/fonts/opensans");
                if fonts_path.exists() && fonts_path.join("OpenSans.fnt").exists() {
                    return Ok(fonts_path);
                }
            }
        }
    }

    anyhow::bail!(
        "Could not find fonts directory. Please specify with --fonts <path>\n\
         Expected location: quadratic-client/public/fonts/opensans"
    )
}

/// Parse an A1 range string like "A1:J20" into two Pos structs.
fn parse_a1_range(range: &str) -> anyhow::Result<(Pos, Pos)> {
    let parts: Vec<&str> = range.split(':').collect();
    if parts.len() != 2 {
        anyhow::bail!("Invalid range format: '{}'. Expected format like 'A1:J20'", range);
    }

    let start = Pos::try_a1_string(parts[0])
        .ok_or_else(|| anyhow::anyhow!("Invalid start cell: '{}'", parts[0]))?;
    let end = Pos::try_a1_string(parts[1])
        .ok_or_else(|| anyhow::anyhow!("Invalid end cell: '{}'", parts[1]))?;

    Ok((start, end))
}

/// Find the icons directory, trying multiple locations.
fn find_icons_directory() -> anyhow::Result<PathBuf> {
    // Try common locations relative to current directory
    let candidates = [
        // From workspace root
        "quadratic-client/public/images",
        // From quadratic-rust-renderer directory
        "../quadratic-client/public/images",
        // From native directory
        "../../quadratic-client/public/images",
        // From native/screenshot directory (when running example)
        "../../../quadratic-client/public/images",
    ];

    for candidate in &candidates {
        let path = PathBuf::from(candidate);
        if path.exists() && path.join("icon-python.png").exists() {
            return Ok(path);
        }
    }

    // Try to find based on the executable path
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            // Go up from target/debug/examples to find workspace root
            for ancestor in exe_dir.ancestors().take(6) {
                let icons_path = ancestor.join("quadratic-client/public/images");
                if icons_path.exists() && icons_path.join("icon-python.png").exists() {
                    return Ok(icons_path);
                }
            }
        }
    }

    anyhow::bail!("Could not find icons directory")
}

/// Find the emoji spritesheet directory, trying multiple locations.
fn find_emoji_directory() -> anyhow::Result<PathBuf> {
    // Try common locations relative to current directory
    let candidates = [
        // From workspace root
        "quadratic-client/public/emojis",
        // From quadratic-rust-renderer directory
        "../quadratic-client/public/emojis",
        // From native directory
        "../../quadratic-client/public/emojis",
        // From native/screenshot directory (when running example)
        "../../../quadratic-client/public/emojis",
    ];

    for candidate in &candidates {
        let path = PathBuf::from(candidate);
        if path.exists() && path.join("emoji-mapping.json").exists() {
            return Ok(path);
        }
    }

    // Try to find based on the executable path
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            // Go up from target/debug/examples to find workspace root
            for ancestor in exe_dir.ancestors().take(6) {
                let emoji_path = ancestor.join("quadratic-client/public/emojis");
                if emoji_path.exists() && emoji_path.join("emoji-mapping.json").exists() {
                    return Ok(emoji_path);
                }
            }
        }
    }

    anyhow::bail!("Could not find emoji directory")
}
