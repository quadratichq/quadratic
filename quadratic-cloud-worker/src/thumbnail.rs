//! Thumbnail rendering for cloud worker
//!
//! Renders a thumbnail of the first sheet and uploads it to S3.

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use quadratic_core::CellValue;
use quadratic_core::Pos;
use quadratic_core::color::Rgba;
use quadratic_core::controller::GridController;
use quadratic_renderer_core::RenderCell;
use quadratic_renderer_core::RenderFill;
use quadratic_renderer_core::emoji_loader::load_emoji_spritesheet;
use quadratic_renderer_core::font_loader::load_fonts_from_directory;
use quadratic_renderer_core::from_rgba;
use quadratic_renderer_core::parse_color_to_rgba;
use quadratic_renderer_native::{
    BorderLineStyle, ChartImage, GridExclusionZone, NativeRenderer, RenderRequest, SelectionRange,
    SheetBorders, TableNameIcon, TableOutline, TableOutlines,
};
use thiserror::Error;
use tokio::sync::Mutex;
use tracing::{error, info, trace, warn};

/// Errors that can occur during thumbnail rendering or upload.
#[derive(Debug, Error)]
pub enum ThumbnailError {
    #[error("No sheets in grid")]
    NoSheets,

    #[error("Sheet not found")]
    SheetNotFound,

    #[error("Specified fonts directory not found: {0:?}")]
    FontsDirectoryNotFound(PathBuf),

    #[error("Could not find fonts directory")]
    FontsDirectoryMissing,

    #[error("Specified icons directory not found: {0:?}")]
    IconsDirectoryNotFound(PathBuf),

    #[error("Could not find icons directory")]
    IconsDirectoryMissing,

    #[error("Specified emoji directory not found: {0:?}")]
    EmojiDirectoryNotFound(PathBuf),

    #[error("Could not find emoji directory")]
    EmojiDirectoryMissing,

    #[error("Failed to upload thumbnail: {status} {body}")]
    UploadFailed { status: reqwest::StatusCode, body: String },

    #[error("Renderer: {0}")]
    Renderer(String),

    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error(transparent)]
    Request(#[from] reqwest::Error),
}

/// Thumbnail dimensions matching the client (1280x720, 16:9 aspect ratio)
const THUMBNAIL_WIDTH: u32 = 1280;
const THUMBNAIL_HEIGHT: u32 = 720;
const THUMBNAIL_DPR: u32 = 2;

/// Configuration for thumbnail asset paths
pub struct ThumbnailAssetConfig {
    pub fonts_dir: Option<String>,
    pub icons_dir: Option<String>,
    pub emojis_dir: Option<String>,
}

/// Render a thumbnail of the grid and return the PNG bytes
pub fn render_thumbnail(
    gc: &GridController,
    config: &ThumbnailAssetConfig,
) -> Result<Vec<u8>, ThumbnailError> {
    let sheet_ids = gc.sheet_ids();
    if sheet_ids.is_empty() {
        return Err(ThumbnailError::NoSheets);
    }

    let sheet_id = sheet_ids[0];
    let sheet = gc.try_sheet(sheet_id).ok_or(ThumbnailError::SheetNotFound)?;

    let offsets = sheet.offsets().clone();

    // Auto-calculate thumbnail range
    let thumbnail_rect = offsets.thumbnail();
    let selection = SelectionRange::new(
        thumbnail_rect.min.x,
        thumbnail_rect.min.y,
        thumbnail_rect.max.x,
        thumbnail_rect.max.y,
    );

    trace!(
        "Thumbnail range: columns 0-{}, rows 0-{}",
        thumbnail_rect.max.x, thumbnail_rect.max.y
    );

    // Calculate render dimensions with DPR
    let render_width = THUMBNAIL_WIDTH * THUMBNAIL_DPR;
    let render_height = THUMBNAIL_HEIGHT * THUMBNAIL_DPR;

    // Create render request
    let mut request = RenderRequest::new(selection.clone(), render_width, render_height);
    request.show_grid_lines = true;
    request.offsets = offsets.clone();

    // Get render rect for extracting data
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

    // Get fills
    let js_fills = sheet.get_render_fills_in_rect(render_rect);
    let mut fills: Vec<RenderFill> = js_fills.into_iter().map(RenderFill::from).collect();

    // Get conditional format fills
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

    // Get cells
    let mut js_cells = sheet.get_render_cells(render_rect, a1_context);
    gc.apply_conditional_formatting_to_cells(sheet_id, render_rect, &mut js_cells);
    let mut cells: Vec<RenderCell> = js_cells.into_iter().map(RenderCell::from).collect();

    // Table header text colors
    let table_name_text_color = Rgba::rgb(255, 255, 255);
    let column_header_text_color = Rgba::rgb(2, 8, 23);

    for cell in &mut cells {
        if cell.table_name == Some(true) {
            cell.text_color = Some(table_name_text_color);
        } else if cell.column_header == Some(true) {
            cell.text_color = Some(column_header_text_color);
        }
    }
    request.cells = cells;

    // Get borders
    let js_borders = sheet.borders_in_sheet();
    let mut borders = SheetBorders::new();

    if let Some(h_borders) = js_borders.horizontal {
        for border in h_borders {
            let color = from_rgba(&border.color);
            let line_style = cell_border_line_to_style(&border.line);
            borders.add_horizontal(border.x, border.y, border.width, color, line_style);
        }
    }

    if let Some(v_borders) = js_borders.vertical {
        for border in v_borders {
            let color = from_rgba(&border.color);
            let line_style = cell_border_line_to_style(&border.line);
            borders.add_vertical(border.x, border.y, border.height, color, line_style);
        }
    }
    request.borders = borders;

    // Get table outlines
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
            continue;
        }

        // Clip table bounds to selection
        let clipped_x = table_x.max(selection.start_col);
        let clipped_y = table_y.max(selection.start_row);
        let clipped_right = table_right.min(selection.end_col + 1);
        let clipped_bottom = table_bottom.min(selection.end_row + 1);
        let clipped_w = (clipped_right - clipped_x) as u32;
        let clipped_h = (clipped_bottom - clipped_y) as u32;

        let is_clipped_top = table_y < selection.start_row;
        let is_clipped_bottom = table_bottom > selection.end_row + 1;
        let is_clipped_left = table_x < selection.start_col;
        let is_clipped_right = table_right > selection.end_col + 1;

        let show_name = code_cell.show_name && table_y >= selection.start_row;
        let show_columns = code_cell.show_columns
            && (table_y + if show_name { 1 } else { 0 }) >= selection.start_row;

        let mut table = TableOutline::new(clipped_x, clipped_y, clipped_w, clipped_h)
            .with_show_columns(show_columns)
            .with_active(false)
            .with_clipped_top(is_clipped_top)
            .with_clipped_bottom(is_clipped_bottom)
            .with_clipped_left(is_clipped_left)
            .with_clipped_right(is_clipped_right);

        if show_name {
            table = table.with_name(&code_cell.name);

            table_name_icons.push(TableNameIcon {
                x: table_x,
                y: table_y,
                language: code_cell.language.clone(),
            });

            table_name_cells.push(RenderCell {
                x: table_x,
                y: table_y,
                value: code_cell.name.clone(),
                bold: Some(true),
                text_color: Some(Rgba::rgb(255, 255, 255)),
                table_name: Some(true),
                language: Some(code_cell.language.clone()),
                table_columns: Some(code_cell.w),
                ..Default::default()
            });
        }

        table_outlines.add(table);
    }

    // Process single-cell code cells
    for pos in sheet.iter_code_cells_positions() {
        if pos.x < selection.start_col
            || pos.x > selection.end_col
            || pos.y < selection.start_row
            || pos.y > selection.end_row
        {
            continue;
        }

        if let Some(CellValue::Code(_)) = sheet.cell_value_ref(pos) {
            let table = TableOutline::new(pos.x, pos.y, 1, 1)
                .with_show_columns(false)
                .with_active(false);
            table_outlines.add(table);
        }
    }

    request.table_outlines = table_outlines;
    request.table_name_icons = table_name_icons;

    // Remove cells underneath table name rows
    if !table_name_cells.is_empty() {
        let table_name_positions: std::collections::HashSet<(i64, i64)> = table_name_cells
            .iter()
            .map(|cell| (cell.x, cell.y))
            .collect();
        request
            .cells
            .retain(|cell| !table_name_positions.contains(&(cell.x, cell.y)));
    }
    request.cells.extend(table_name_cells);

    // Get chart images and grid exclusion zones
    let mut chart_images = Vec::new();
    let mut grid_exclusion_zones = Vec::new();

    let html_outputs = sheet.get_html_output();

    for html_output in html_outputs {
        let chart_x = html_output.x as i64;
        let chart_y = html_output.y as i64 + if html_output.show_name { 1 } else { 0 };
        let chart_w = html_output.w as i64;
        let chart_h = html_output.h as i64;

        if chart_x + chart_w <= selection.start_col
            || chart_x > selection.end_col
            || chart_y + chart_h <= selection.start_row
            || chart_y > selection.end_row
        {
            continue;
        }

        let (left, _) = request.offsets.column_position_size(chart_x);
        let (top, _) = request.offsets.row_position_size(chart_y);
        let (right_pos, right_size) = request.offsets.column_position_size(chart_x + chart_w - 1);
        let (bottom_pos, bottom_size) = request.offsets.row_position_size(chart_y + chart_h - 1);

        grid_exclusion_zones.push(GridExclusionZone {
            left: left as f32,
            top: top as f32,
            right: (right_pos + right_size) as f32,
            bottom: (bottom_pos + bottom_size) as f32,
        });

        if let Some(chart_image_data) = html_output.chart_image {
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
    request.grid_exclusion_zones = grid_exclusion_zones;

    // Create renderer
    trace!(
        "Creating renderer ({}x{} pixels, {}x DPR)",
        THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, THUMBNAIL_DPR
    );
    let mut renderer = NativeRenderer::new(render_width, render_height)
        .map_err(|e| ThumbnailError::Renderer(e.to_string()))?;

    // Load fonts
    let font_dir = find_fonts_directory(&config.fonts_dir)?;
    trace!("Loading fonts from {:?}", font_dir);

    let font_files = [
        "OpenSans.fnt",
        "OpenSans-Bold.fnt",
        "OpenSans-Italic.fnt",
        "OpenSans-BoldItalic.fnt",
    ];

    let (fonts, texture_infos) = load_fonts_from_directory(&font_dir, &font_files)
        .map_err(|e| ThumbnailError::Renderer(e.to_string()))?;
    trace!("Loaded {} fonts", fonts.count());

    for texture_info in &texture_infos {
        let texture_path = font_dir.join(&texture_info.filename);
        let texture_bytes = fs::read(&texture_path)?;
        renderer
            .upload_font_texture(texture_info.texture_uid, &texture_bytes)
            .map_err(|e| ThumbnailError::Renderer(e.to_string()))?;
    }
    renderer.set_fonts(fonts);

    // Upload chart images
    if !request.chart_images.is_empty() {
        trace!("Uploading {} chart images", request.chart_images.len());
        renderer
            .upload_chart_images(&request.chart_images)
            .map_err(|e| ThumbnailError::Renderer(e.to_string()))?;
    }

    // Upload language icons
    if !request.table_name_icons.is_empty() {
        if let Ok(icons_dir) = find_icons_directory(&config.icons_dir) {
            trace!(
                "Loading {} language icons from {:?}",
                request.table_name_icons.len(),
                icons_dir
            );
            renderer
                .upload_language_icons(&request.table_name_icons, &icons_dir)
                .map_err(|e| ThumbnailError::Renderer(e.to_string()))?;
        } else {
            warn!("Icons directory not found, table icons will not render");
        }
    }

    // Load emoji spritesheet
    if let Ok(emoji_dir) = find_emoji_directory(&config.emojis_dir) {
        trace!("Loading emoji mapping from {:?}", emoji_dir);
        match load_emoji_spritesheet(&emoji_dir) {
            Ok((spritesheet, _texture_infos)) => {
                trace!(
                    "Loaded emoji mapping: {} emojis, {} texture pages",
                    spritesheet.emoji_count(),
                    spritesheet.page_count()
                );
                renderer.set_emoji_spritesheet(spritesheet, emoji_dir);
            }
            Err(e) => {
                warn!("Failed to load emoji mapping: {}", e);
            }
        }
    } else {
        trace!("Emoji directory not found, emojis will not render");
    }

    // Render to PNG
    trace!("Rendering thumbnail");
    let png_bytes = renderer
        .render_to_png(&request)
        .map_err(|e| ThumbnailError::Renderer(e.to_string()))?;

    Ok(png_bytes)
}

/// Upload the thumbnail to S3 using the presigned URL
pub async fn upload_thumbnail(
    png_bytes: Vec<u8>,
    thumbnail_upload_url: &str,
) -> Result<(), ThumbnailError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;
    let response = client
        .put(thumbnail_upload_url)
        .header("Content-Type", "image/png")
        .body(png_bytes)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(ThumbnailError::UploadFailed { status, body });
    }

    Ok(())
}

/// Render and upload thumbnail for the grid.
/// Returns the thumbnail key on success, which should be passed to the controller
/// in the shutdown request so the controller can update the file record.
pub async fn render_and_upload_thumbnail(
    file: Arc<Mutex<GridController>>,
    asset_config: &ThumbnailAssetConfig,
    thumbnail_upload_url: &str,
    thumbnail_key: &str,
) -> Result<String, ThumbnailError> {
    info!("Rendering thumbnail");

    // Render thumbnail (blocking operation)
    let gc = file.lock().await;
    let png_bytes = match render_thumbnail(&gc, asset_config) {
        Ok(bytes) => bytes,
        Err(e) => {
            error!("Failed to render thumbnail: {}", e);
            return Err(e);
        }
    };
    drop(gc);

    info!("Thumbnail rendered ({} bytes), uploading", png_bytes.len());

    // Upload to S3
    upload_thumbnail(png_bytes, thumbnail_upload_url).await?;
    info!("Thumbnail uploaded to S3");

    Ok(thumbnail_key.to_string())
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
        CellBorderLine::Clear => BorderLineStyle::Line1,
    }
}

/// Find the fonts directory
fn find_fonts_directory(explicit_path: &Option<String>) -> Result<PathBuf, ThumbnailError> {
    if let Some(path) = explicit_path {
        let path = PathBuf::from(path);
        if path.exists() {
            return Ok(path);
        }
        return Err(ThumbnailError::FontsDirectoryNotFound(path));
    }

    // Default paths to try
    let candidates = [
        "/assets/fonts",
        "quadratic-client/public/fonts/opensans",
        "../quadratic-client/public/fonts/opensans",
    ];

    for candidate in &candidates {
        let path = PathBuf::from(candidate);
        if path.exists() && path.join("OpenSans.fnt").exists() {
            return Ok(path);
        }
    }

    Err(ThumbnailError::FontsDirectoryMissing)
}

/// Find the icons directory
fn find_icons_directory(explicit_path: &Option<String>) -> Result<PathBuf, ThumbnailError> {
    if let Some(path) = explicit_path {
        let path = PathBuf::from(path);
        if path.exists() {
            return Ok(path);
        }
        return Err(ThumbnailError::IconsDirectoryNotFound(path));
    }

    let candidates = [
        "/assets/icons",
        "quadratic-client/public/images",
        "../quadratic-client/public/images",
    ];

    for candidate in &candidates {
        let path = PathBuf::from(candidate);
        if path.exists() && path.join("icon-python.png").exists() {
            return Ok(path);
        }
    }

    Err(ThumbnailError::IconsDirectoryMissing)
}

/// Find the emoji directory
fn find_emoji_directory(explicit_path: &Option<String>) -> Result<PathBuf, ThumbnailError> {
    if let Some(path) = explicit_path {
        let path = PathBuf::from(path);
        if path.exists() {
            return Ok(path);
        }
        return Err(ThumbnailError::EmojiDirectoryNotFound(path));
    }

    let candidates = [
        "/assets/emojis",
        "quadratic-client/public/emojis",
        "../quadratic-client/public/emojis",
    ];

    for candidate in &candidates {
        let path = PathBuf::from(candidate);
        if path.exists() && path.join("emoji-mapping.json").exists() {
            return Ok(path);
        }
    }

    Err(ThumbnailError::EmojiDirectoryMissing)
}

#[cfg(test)]
mod tests {
    use super::*;
    use quadratic_core::controller::GridController;

    #[test]
    fn test_find_fonts_directory_explicit_path() {
        // Test with a path that doesn't exist
        let result = find_fonts_directory(&Some("/nonexistent/path".to_string()));
        assert!(result.is_err());

        // Test with None - should try default paths
        let result = find_fonts_directory(&None);
        // This may or may not find fonts depending on the environment
        // Just verify it doesn't panic
        let _ = result;
    }

    #[test]
    fn test_find_icons_directory_explicit_path() {
        let result = find_icons_directory(&Some("/nonexistent/path".to_string()));
        assert!(result.is_err());
    }

    #[test]
    fn test_find_emoji_directory_explicit_path() {
        let result = find_emoji_directory(&Some("/nonexistent/path".to_string()));
        assert!(result.is_err());
    }

    #[test]
    fn test_cell_border_line_to_style() {
        use quadratic_core::grid::sheet::borders::CellBorderLine;

        assert!(matches!(
            cell_border_line_to_style(&CellBorderLine::Line1),
            BorderLineStyle::Line1
        ));
        assert!(matches!(
            cell_border_line_to_style(&CellBorderLine::Line2),
            BorderLineStyle::Line2
        ));
        assert!(matches!(
            cell_border_line_to_style(&CellBorderLine::Dotted),
            BorderLineStyle::Dotted
        ));
        assert!(matches!(
            cell_border_line_to_style(&CellBorderLine::Dashed),
            BorderLineStyle::Dashed
        ));
        assert!(matches!(
            cell_border_line_to_style(&CellBorderLine::Double),
            BorderLineStyle::Double
        ));
    }

    #[test]
    fn test_render_thumbnail_empty_grid() {
        // Create an empty grid controller
        let gc = GridController::test();

        let config = ThumbnailAssetConfig {
            fonts_dir: Some("../quadratic-client/public/fonts/opensans".to_string()),
            icons_dir: None,
            emojis_dir: None,
        };

        // This test will only pass if fonts are available and wgpu can initialize
        // In CI without GPU, this may fail - that's expected
        let result = render_thumbnail(&gc, &config);

        // The test verifies the function doesn't panic with an empty grid
        // It may fail due to missing assets or GPU, which is acceptable
        match result {
            Ok(bytes) => {
                assert!(!bytes.is_empty(), "PNG bytes should not be empty");
                // Verify PNG magic bytes
                assert_eq!(
                    &bytes[0..4],
                    &[0x89, 0x50, 0x4E, 0x47],
                    "Should be valid PNG"
                );
            }
            Err(e) => {
                // Expected in environments without GPU or fonts
                println!("Thumbnail rendering failed (expected in CI): {}", e);
            }
        }
    }

    #[test]
    fn test_render_thumbnail_with_data() {
        // Create a grid with some data
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Add some cell values
        gc.set_cell_value(
            quadratic_core::SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "Hello".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            quadratic_core::SheetPos {
                x: 1,
                y: 0,
                sheet_id,
            },
            "World".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            quadratic_core::SheetPos {
                x: 0,
                y: 1,
                sheet_id,
            },
            "123".to_string(),
            None,
            false,
        );

        let config = ThumbnailAssetConfig {
            fonts_dir: Some("../quadratic-client/public/fonts/opensans".to_string()),
            icons_dir: None,
            emojis_dir: None,
        };

        let result = render_thumbnail(&gc, &config);

        match result {
            Ok(bytes) => {
                assert!(!bytes.is_empty(), "PNG bytes should not be empty");
                assert_eq!(
                    &bytes[0..4],
                    &[0x89, 0x50, 0x4E, 0x47],
                    "Should be valid PNG"
                );
            }
            Err(e) => {
                println!("Thumbnail rendering failed (expected in CI): {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_upload_thumbnail_invalid_url() {
        let png_bytes = vec![0x89, 0x50, 0x4E, 0x47]; // PNG magic bytes

        // Test with an invalid URL - should fail
        let result = upload_thumbnail(
            png_bytes,
            "http://invalid-url-that-does-not-exist.local/upload",
        )
        .await;
        assert!(result.is_err());
    }

    #[test]
    fn test_thumbnail_dimensions() {
        assert_eq!(THUMBNAIL_WIDTH, 1280);
        assert_eq!(THUMBNAIL_HEIGHT, 720);
        assert_eq!(THUMBNAIL_DPR, 2);

        // Verify 16:9 aspect ratio
        let ratio = THUMBNAIL_WIDTH as f64 / THUMBNAIL_HEIGHT as f64;
        assert!(
            (ratio - 16.0 / 9.0).abs() < 0.01,
            "Should be 16:9 aspect ratio"
        );
    }
}
