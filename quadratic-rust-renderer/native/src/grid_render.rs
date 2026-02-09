//! Prepare a NativeRenderer with assets (fonts, icons, emoji) for a RenderRequest.
//! Callers resolve asset paths; this module loads and uploads them.

use std::fs;
use std::path::PathBuf;

use quadratic_renderer_core::emoji_loader::load_emoji_spritesheet;
use quadratic_renderer_core::font_loader::load_fonts_from_directory;

use crate::request::RenderRequest;
use crate::NativeRenderer;

/// Resolved paths to font, icon, and emoji assets. Callers build this from their own discovery.
#[derive(Debug, Clone)]
pub struct AssetPaths {
    pub fonts: PathBuf,
    pub icons: Option<PathBuf>,
    pub emoji: Option<PathBuf>,
}

const FONT_FILES: &[&str] = &[
    "OpenSans.fnt",
    "OpenSans-Bold.fnt",
    "OpenSans-Italic.fnt",
    "OpenSans-BoldItalic.fnt",
];

/// Load fonts, chart images, language icons, and emoji spritesheet into the renderer
/// according to the request and the given asset paths. No path discovery is done here.
pub fn prepare_renderer_for_request(
    renderer: &mut NativeRenderer,
    request: &RenderRequest,
    assets: &AssetPaths,
) -> anyhow::Result<()> {
    let (fonts, texture_infos) = load_fonts_from_directory(&assets.fonts, FONT_FILES)?;

    for texture_info in &texture_infos {
        let texture_path = assets.fonts.join(&texture_info.filename);
        let texture_bytes = fs::read(&texture_path)?;
        renderer.upload_font_texture(texture_info.texture_uid, &texture_bytes)?;
    }
    renderer.set_fonts(fonts);

    if !request.chart_images.is_empty() {
        renderer.upload_chart_images(&request.chart_images)?;
    }

    if !request.table_name_icons.is_empty() {
        if let Some(icons_dir) = &assets.icons {
            renderer.upload_language_icons(&request.table_name_icons, icons_dir)?;
        }
    }

    if let Some(emoji_dir) = &assets.emoji {
        match load_emoji_spritesheet(emoji_dir) {
            Ok((spritesheet, _texture_infos)) => {
                renderer.set_emoji_spritesheet(spritesheet, emoji_dir.clone());
            }
            Err(e) => {
                log::warn!("Failed to load emoji mapping: {}", e);
            }
        }
    }

    Ok(())
}
