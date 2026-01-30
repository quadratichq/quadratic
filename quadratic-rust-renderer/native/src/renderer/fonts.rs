//! Font and emoji texture management

use quadratic_renderer_core::emoji_loader::EmojiSpritesheet;
use quadratic_renderer_core::sheets::text::BitmapFonts;

use super::NativeRenderer;

impl NativeRenderer {
    /// Set the bitmap fonts for text rendering
    pub fn set_fonts(&mut self, fonts: BitmapFonts) {
        log::debug!("Setting {} fonts", fonts.count());
        self.fonts = fonts;
    }

    /// Upload a font texture from PNG bytes
    pub fn upload_font_texture(
        &mut self,
        texture_uid: u32,
        png_bytes: &[u8],
    ) -> anyhow::Result<()> {
        // Decode the PNG image
        let img = image::load_from_memory(png_bytes)?;
        let rgba = img.into_rgba8();
        let (width, height) = (rgba.width(), rgba.height());
        let data = rgba.into_raw();

        log::debug!(
            "Uploading font texture UID {} ({}x{}, {} bytes)",
            texture_uid,
            width,
            height,
            data.len()
        );

        // Upload to wgpu
        self.wgpu
            .upload_texture(texture_uid, width, height, &data)?;

        Ok(())
    }

    /// Check if fonts are loaded
    pub fn has_fonts(&self) -> bool {
        !self.fonts.is_empty()
    }

    /// Set the emoji spritesheet for emoji rendering
    ///
    /// The directory is used for lazy loading of texture pages - textures are only
    /// uploaded when emojis from that page are actually needed.
    pub fn set_emoji_spritesheet(
        &mut self,
        spritesheet: EmojiSpritesheet,
        emoji_dir: std::path::PathBuf,
    ) {
        log::debug!(
            "Setting emoji spritesheet with {} emojis, {} pages (lazy loading from {:?})",
            spritesheet.emoji_count(),
            spritesheet.page_count(),
            emoji_dir
        );
        self.emoji_spritesheet = Some(spritesheet);
        self.emoji_directory = Some(emoji_dir);
        self.uploaded_emoji_pages.clear();
    }

    /// Check if emoji spritesheet is loaded
    pub fn has_emoji_spritesheet(&self) -> bool {
        self.emoji_spritesheet.is_some()
    }

    /// Ensure an emoji texture page is uploaded (lazy loading)
    pub(super) fn ensure_emoji_page_uploaded(&mut self, texture_uid: u32) -> anyhow::Result<bool> {
        // Already uploaded?
        if self.uploaded_emoji_pages.contains(&texture_uid) {
            return Ok(true);
        }

        // Get the spritesheet and directory
        let (spritesheet, emoji_dir) = match (&self.emoji_spritesheet, &self.emoji_directory) {
            (Some(s), Some(d)) => (s, d),
            _ => return Ok(false),
        };

        // Find the texture info for this page
        let page_info = spritesheet
            .texture_pages()
            .into_iter()
            .find(|p| p.texture_uid == texture_uid);

        let Some(page_info) = page_info else {
            return Ok(false);
        };

        // Load and upload the texture
        let texture_path = emoji_dir.join(&page_info.filename);
        if !texture_path.exists() {
            log::warn!("Emoji texture not found: {:?}", texture_path);
            return Ok(false);
        }

        let png_bytes = std::fs::read(&texture_path)?;
        let img = image::load_from_memory(&png_bytes)?;
        let rgba = img.into_rgba8();
        let (width, height) = (rgba.width(), rgba.height());
        let data = rgba.into_raw();

        log::debug!(
            "Lazy loading emoji texture page {} ({}x{}) from {:?}",
            texture_uid,
            width,
            height,
            page_info.filename
        );

        self.wgpu
            .upload_texture(texture_uid, width, height, &data)?;
        self.uploaded_emoji_pages.insert(texture_uid);

        Ok(true)
    }
}
