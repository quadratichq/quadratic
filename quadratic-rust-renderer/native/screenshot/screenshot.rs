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
//! Thumbnail mode (auto-calculates range, 1280x720 PNG, outputs to thumbnail.png by default):
//!   npm run screenshot -- --file path/to/file.grid --thumbnail
//!
//! Note: Specify either --width OR --height. The other dimension will be
//! calculated to match the cell area's aspect ratio.

use clap::Parser;
use quadratic_core::controller::GridController;
use quadratic_core::grid::file::import;
use quadratic_core::Pos;
use quadratic_renderer_native::{
    build_render_request, prepare_renderer_for_request, AssetPaths, ImageFormat, NativeRenderer,
    SelectionRange,
};
use std::fs;
use std::path::PathBuf;
use std::time::Instant;

/// Thumbnail dimensions matching the client (1280x720, 16:9 aspect ratio)
const THUMBNAIL_WIDTH: u32 = 1280;
const THUMBNAIL_HEIGHT: u32 = 720;

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

    /// Output image file (defaults to thumbnail.png in thumbnail mode, output.png otherwise)
    #[arg(short, long)]
    output: Option<PathBuf>,

    /// Output format: png, jpeg, or webp
    #[arg(long, default_value = "png")]
    format: String,

    /// Quality for JPEG format (0-100, ignored for PNG and WebP)
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

    /// Generate a thumbnail (1280x720 PNG, auto-calculated range from top-left)
    #[arg(long)]
    thumbnail: bool,
}

fn main() -> anyhow::Result<()> {
    let start_time = Instant::now();

    // Initialize logging
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let args = Args::parse();

    // Load the grid file
    log::debug!("Loading grid file: {:?}", args.file);
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
    let sheet = gc
        .try_sheet(sheet_id)
        .ok_or_else(|| anyhow::anyhow!("Sheet with id {:?} not found", sheet_id))?;
    log::debug!("Using sheet: {}", sheet.name());

    // Get sheet offsets for column/row sizes
    let offsets = sheet.offsets().clone();

    // Calculate selection and dimensions based on thumbnail mode or manual settings
    let (selection, base_width, base_height, show_grid_lines, image_format) = if args.thumbnail {
        // Thumbnail mode: auto-calculate range, fixed size 1280x720, PNG format
        let thumbnail_rect = offsets.thumbnail();
        let selection = SelectionRange::new(
            thumbnail_rect.min.x,
            thumbnail_rect.min.y,
            thumbnail_rect.max.x,
            thumbnail_rect.max.y,
        );

        log::debug!(
            "Thumbnail mode: auto-calculated range (columns 0-{}, rows 0-{})",
            thumbnail_rect.max.x,
            thumbnail_rect.max.y
        );
        log::debug!("Output: {}x{} PNG", THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

        (
            selection,
            THUMBNAIL_WIDTH,
            THUMBNAIL_HEIGHT,
            true,
            ImageFormat::Png,
        )
    } else {
        // Parse the range in A1 notation (e.g., "A1:J20")
        let (start_pos, end_pos) = parse_a1_range(&args.range)?;
        let selection = SelectionRange::new(start_pos.x, start_pos.y, end_pos.x, end_pos.y);

        log::debug!(
            "Rendering range: {} (columns {}-{}, rows {}-{})",
            args.range,
            selection.start_col,
            selection.end_col,
            selection.start_row,
            selection.end_row
        );

        // Calculate the selection's world bounds to determine aspect ratio
        let (_world_x, _world_y, world_w, world_h) = selection.world_bounds(&offsets);
        let aspect_ratio = world_w / world_h;

        log::debug!(
            "Cell area: {:.1}x{:.1} pixels (aspect ratio: {:.3})",
            world_w,
            world_h,
            aspect_ratio
        );

        // Calculate output dimensions based on aspect ratio
        let (base_width, base_height) = match (args.width, args.height) {
            (Some(w), Some(_h)) => {
                log::warn!("Both width and height specified. Using width and calculating height from aspect ratio.");
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

        // Parse format
        let image_format = match args.format.to_lowercase().as_str() {
            "png" => ImageFormat::Png,
            "jpeg" | "jpg" => ImageFormat::Jpeg(args.quality),
            "webp" => ImageFormat::Webp,
            _ => anyhow::bail!(
                "Unsupported format: '{}'. Use png, jpeg, or webp.",
                args.format
            ),
        };

        (
            selection,
            base_width,
            base_height,
            args.grid_lines,
            image_format,
        )
    };

    // Apply DPR for higher resolution rendering
    let render_width = base_width * args.dpr;
    let render_height = base_height * args.dpr;

    let request = build_render_request(
        &gc,
        sheet_id,
        sheet,
        selection,
        render_width,
        render_height,
        show_grid_lines,
    );

    let font_dir = find_fonts_directory(args.fonts.as_ref())?;
    let assets = AssetPaths {
        fonts: font_dir,
        icons: find_icons_directory().ok(),
        emoji: find_emoji_directory().ok(),
    };

    log::debug!(
        "Creating renderer ({} x {} pixels, {}x DPR = {} x {})...",
        base_width,
        base_height,
        args.dpr,
        render_width,
        render_height
    );
    let mut renderer = NativeRenderer::new(render_width, render_height)?;
    prepare_renderer_for_request(&mut renderer, &request, &assets)?;

    log::debug!(
        "Rendering to {:?} format{}...",
        match image_format {
            ImageFormat::Png => "PNG",
            ImageFormat::Jpeg(_) => "JPEG",
            ImageFormat::Webp => "WEBP",
        },
        match image_format {
            ImageFormat::Jpeg(q) => format!(" (quality: {})", q),
            ImageFormat::Webp => " (lossless)".to_string(),
            ImageFormat::Png => String::new(),
        }
    );
    let image_bytes = renderer.render_to_format(&request, image_format)?;

    // Determine output filename
    let output_path = args.output.unwrap_or_else(|| {
        if args.thumbnail {
            PathBuf::from("thumbnail.png")
        } else {
            PathBuf::from("output.png")
        }
    });

    // Save to file
    fs::write(&output_path, &image_bytes)?;
    let elapsed = start_time.elapsed();
    log::info!(
        "Saved to {:?} ({} bytes) in {:.2}s",
        output_path,
        image_bytes.len(),
        elapsed.as_secs_f64()
    );

    Ok(())
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
        anyhow::bail!(
            "Invalid range format: '{}'. Expected format like 'A1:J20'",
            range
        );
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
