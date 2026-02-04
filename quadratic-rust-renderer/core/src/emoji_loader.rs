//! Emoji spritesheet loader
//!
//! Loads emoji mapping JSON and provides UV lookup for emoji rendering.

use serde::Deserialize;
use std::collections::HashMap;

/// Base texture UID for emoji spritesheets (to avoid collision with fonts and other textures)
pub const EMOJI_TEXTURE_BASE: u32 = 50000;

/// Emoji scale factor (from TypeScript SCALE_EMOJI)
pub const EMOJI_SCALE: f32 = 0.918;

/// Emoji X offset ratio (from TypeScript)
pub const EMOJI_X_OFFSET_RATIO: f32 = 0.03;

/// Emoji Y offset ratio (from TypeScript)
pub const EMOJI_Y_OFFSET_RATIO: f32 = 0.1;

/// Emoji advance ratio (width/height ratio for text flow)
pub const EMOJI_ADVANCE_RATIO: f32 = 1.0625;

/// Emoji mapping JSON structure
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmojiMapping {
    /// Size of each spritesheet page in pixels (typically 1024)
    pub page_size: u32,

    /// Size of each emoji character in pixels (typically 125)
    pub character_size: u32,

    /// Scale factor for emoji rendering
    pub scale_emoji: f32,

    /// List of spritesheet pages
    pub pages: Vec<EmojiPage>,

    /// Mapping from emoji string to location info
    pub emojis: HashMap<String, EmojiLocation>,
}

/// A single spritesheet page
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmojiPage {
    /// Filename of the PNG spritesheet
    pub filename: String,

    /// Number of emojis on this page
    pub emoji_count: u32,
}

/// Location of an emoji in the spritesheet
#[derive(Debug, Clone, Deserialize)]
pub struct EmojiLocation {
    /// Page index
    pub page: u32,

    /// X position in pixels
    pub x: u32,

    /// Y position in pixels
    pub y: u32,

    /// Width in pixels
    pub width: u32,

    /// Height in pixels
    pub height: u32,
}

/// Loaded emoji spritesheet data
#[derive(Debug, Clone)]
pub struct EmojiSpritesheet {
    /// The parsed mapping data
    mapping: EmojiMapping,
}

/// Information about an emoji texture page
#[derive(Debug, Clone)]
pub struct EmojiTextureInfo {
    /// Global texture UID
    pub texture_uid: u32,

    /// Page index
    pub page: u32,

    /// Filename of the texture
    pub filename: String,
}

/// Emoji UV lookup result
#[derive(Debug, Clone)]
pub struct EmojiUV {
    /// Texture UID for this emoji's page
    pub texture_uid: u32,

    /// UV coordinates [u0, v0, u1, v1]
    pub uvs: [f32; 4],
}

impl EmojiSpritesheet {
    /// Parse emoji mapping from JSON string
    pub fn from_json(json: &str) -> anyhow::Result<Self> {
        let mapping: EmojiMapping = serde_json::from_str(json)
            .map_err(|e| anyhow::anyhow!("Failed to parse emoji mapping JSON: {}", e))?;

        log::debug!(
            "Loaded emoji mapping: {} pages, {} emojis",
            mapping.pages.len(),
            mapping.emojis.len()
        );

        Ok(Self { mapping })
    }

    /// Get texture info for all pages
    pub fn texture_pages(&self) -> Vec<EmojiTextureInfo> {
        self.mapping
            .pages
            .iter()
            .enumerate()
            .map(|(i, page)| EmojiTextureInfo {
                texture_uid: EMOJI_TEXTURE_BASE + i as u32,
                page: i as u32,
                filename: page.filename.clone(),
            })
            .collect()
    }

    /// Look up UV coordinates for an emoji
    ///
    /// Returns None if the emoji is not found in the spritesheet.
    /// Handles variation selector normalization.
    pub fn get_emoji_uv(&self, emoji: &str) -> Option<EmojiUV> {
        // Try exact match first
        if let Some(location) = self.mapping.emojis.get(emoji) {
            return Some(self.location_to_uv(location));
        }

        // Try with variation selectors stripped (U+FE0F and U+FE0E)
        let normalized: String = emoji
            .chars()
            .filter(|c| *c != '\u{FE0F}' && *c != '\u{FE0E}')
            .collect();
        if normalized != emoji {
            if let Some(location) = self.mapping.emojis.get(&normalized) {
                return Some(self.location_to_uv(location));
            }
        }

        // Try with variation selector added
        let with_vs = format!("{}\u{FE0F}", emoji);
        if let Some(location) = self.mapping.emojis.get(&with_vs) {
            return Some(self.location_to_uv(location));
        }

        None
    }

    /// Convert emoji location to UV coordinates
    fn location_to_uv(&self, location: &EmojiLocation) -> EmojiUV {
        let page_size = self.mapping.page_size as f32;

        let u0 = location.x as f32 / page_size;
        let v0 = location.y as f32 / page_size;
        let u1 = (location.x + location.width) as f32 / page_size;
        let v1 = (location.y + location.height) as f32 / page_size;

        EmojiUV {
            texture_uid: EMOJI_TEXTURE_BASE + location.page,
            uvs: [u0, v0, u1, v1],
        }
    }

    /// Check if an emoji exists in the spritesheet
    pub fn has_emoji(&self, emoji: &str) -> bool {
        self.get_emoji_uv(emoji).is_some()
    }

    /// Get the number of emoji pages
    pub fn page_count(&self) -> usize {
        self.mapping.pages.len()
    }

    /// Get the number of emojis in the mapping
    pub fn emoji_count(&self) -> usize {
        self.mapping.emojis.len()
    }

    /// Get the character size (in pixels)
    pub fn character_size(&self) -> u32 {
        self.mapping.character_size
    }
}

// Implement EmojiLookup trait for emoji detection during text layout
impl crate::sheets::text::EmojiLookup for EmojiSpritesheet {
    fn is_potential_emoji(&self, c: char) -> bool {
        crate::sheets::text::is_potential_emoji(c)
    }

    fn has_emoji(&self, emoji: &str) -> bool {
        self.has_emoji(emoji)
    }
}

/// Load emoji spritesheet from a directory
///
/// This is a helper for native environments. Returns the spritesheet and texture info.
#[cfg(not(target_arch = "wasm32"))]
pub fn load_emoji_spritesheet(
    emoji_dir: &std::path::Path,
) -> anyhow::Result<(EmojiSpritesheet, Vec<EmojiTextureInfo>)> {
    use std::fs;

    let mapping_path = emoji_dir.join("emoji-mapping.json");
    let json = fs::read_to_string(&mapping_path)?;

    let spritesheet = EmojiSpritesheet::from_json(&json)?;
    let textures = spritesheet.texture_pages();

    Ok((spritesheet, textures))
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_JSON: &str = r#"{
        "pageSize": 1024,
        "characterSize": 125,
        "scaleEmoji": 0.81,
        "pages": [
            { "filename": "emoji-0.png", "emojiCount": 64 }
        ],
        "emojis": {
            "😀": { "page": 0, "x": 0, "y": 0, "width": 125, "height": 125 },
            "😃": { "page": 0, "x": 125, "y": 0, "width": 125, "height": 125 }
        }
    }"#;

    #[test]
    fn test_parse_emoji_mapping() {
        let sheet = EmojiSpritesheet::from_json(SAMPLE_JSON).unwrap();
        assert_eq!(sheet.page_count(), 1);
        assert_eq!(sheet.emoji_count(), 2);
        assert_eq!(sheet.character_size(), 125);
    }

    #[test]
    fn test_emoji_uv_lookup() {
        let sheet = EmojiSpritesheet::from_json(SAMPLE_JSON).unwrap();

        let uv = sheet.get_emoji_uv("😀").unwrap();
        assert_eq!(uv.texture_uid, EMOJI_TEXTURE_BASE);
        assert_eq!(uv.uvs[0], 0.0); // u0
        assert_eq!(uv.uvs[1], 0.0); // v0

        let uv2 = sheet.get_emoji_uv("😃").unwrap();
        assert!((uv2.uvs[0] - 125.0 / 1024.0).abs() < 0.001); // Second emoji at x=125
    }

    #[test]
    fn test_missing_emoji() {
        let sheet = EmojiSpritesheet::from_json(SAMPLE_JSON).unwrap();
        assert!(sheet.get_emoji_uv("🎉").is_none());
    }
}
