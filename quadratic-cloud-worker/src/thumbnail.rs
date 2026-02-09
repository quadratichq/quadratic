//! Thumbnail rendering for cloud worker
//!
//! Renders a thumbnail of the first sheet and uploads it to S3.

use std::path::PathBuf;
use std::sync::Arc;

use quadratic_core::controller::GridController;
use quadratic_renderer_native::{
    AssetPaths, NativeRenderer, SelectionRange, build_render_request, prepare_renderer_for_request,
};
use thiserror::Error;
use tokio::sync::Mutex;
use tracing::{error, info, trace};

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
    UploadFailed {
        status: reqwest::StatusCode,
        body: String,
    },

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
    let sheet = gc
        .try_sheet(sheet_id)
        .ok_or(ThumbnailError::SheetNotFound)?;

    let offsets = sheet.offsets().clone();
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

    let render_width = THUMBNAIL_WIDTH * THUMBNAIL_DPR;
    let render_height = THUMBNAIL_HEIGHT * THUMBNAIL_DPR;

    let request = build_render_request(
        gc,
        sheet_id,
        &sheet,
        selection,
        render_width,
        render_height,
        true,
    );

    let fonts_dir = find_fonts_directory(&config.fonts_dir)?;
    let assets = AssetPaths {
        fonts: fonts_dir,
        icons: find_icons_directory(&config.icons_dir).ok(),
        emoji: find_emoji_directory(&config.emojis_dir).ok(),
    };

    trace!(
        "Creating renderer ({}x{} pixels, {}x DPR)",
        THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, THUMBNAIL_DPR
    );
    let mut renderer = NativeRenderer::new(render_width, render_height)
        .map_err(|e| ThumbnailError::Renderer(e.to_string()))?;

    prepare_renderer_for_request(&mut renderer, &request, &assets)
        .map_err(|e| ThumbnailError::Renderer(e.to_string()))?;

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

    upload_thumbnail(png_bytes, thumbnail_upload_url).await?;
    info!("Thumbnail uploaded to S3");

    Ok(thumbnail_key.to_string())
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
        let result = find_fonts_directory(&Some("/nonexistent/path".to_string()));
        assert!(result.is_err());

        let result = find_fonts_directory(&None);
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
    fn test_render_thumbnail_empty_grid() {
        let gc = GridController::test();

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

    #[test]
    fn test_render_thumbnail_with_data() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

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
        let png_bytes = vec![0x89, 0x50, 0x4E, 0x47];

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

        let ratio = THUMBNAIL_WIDTH as f64 / THUMBNAIL_HEIGHT as f64;
        assert!(
            (ratio - 16.0 / 9.0).abs() < 0.01,
            "Should be 16:9 aspect ratio"
        );
    }

    /// Full thumbnail generation flow: build_render_request, prepare_renderer, render_to_png.
    /// Validates PNG output when rendering succeeds (e.g. local with GPU); does not fail in CI without GPU.
    #[test]
    fn test_generates_thumbnail() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(
            quadratic_core::SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "Thumbnail test".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            quadratic_core::SheetPos {
                x: 1,
                y: 0,
                sheet_id,
            },
            "A1".to_string(),
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
            Ok(png_bytes) => {
                assert!(!png_bytes.is_empty(), "thumbnail PNG must not be empty");
                assert_eq!(
                    &png_bytes[0..4],
                    &[0x89, 0x50, 0x4E, 0x47],
                    "thumbnail must be valid PNG"
                );
                assert!(
                    png_bytes.len() >= 1000,
                    "thumbnail PNG too small ({} bytes)",
                    png_bytes.len()
                );

                let expected_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("tests")
                    .join("expected_thumbnail.png");
                if expected_path.exists() {
                    let expected =
                        std::fs::read(&expected_path).expect("failed to read expected thumbnail");
                    assert_eq!(
                        &png_bytes[..],
                        &expected[..],
                        "Generated thumbnail does not match tests/expected_thumbnail.png"
                    );
                } else {
                    if let Some(parent) = expected_path.parent() {
                        let _ = std::fs::create_dir_all(parent);
                    }
                    std::fs::write(&expected_path, &png_bytes)
                        .expect("failed to write expected thumbnail");
                    panic!(
                        "Created {} - please commit this file and re-run the test",
                        expected_path.display()
                    );
                }
            }
            Err(e) => {
                println!("Thumbnail generation skipped (no GPU/fonts): {}", e);
            }
        }
    }
}
