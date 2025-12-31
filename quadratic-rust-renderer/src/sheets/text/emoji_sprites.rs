//! Emoji spritesheet handling
//!
//! Loads pre-generated emoji spritesheets and provides emoji character lookup.
//! Emojis are rendered as sprites rather than MSDF text.
//!
//! Uses lazy loading - only fetches texture pages when emojis from that page
//! are actually needed for rendering.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

use crate::renderers::primitives::UVRect;

/// Constants matching the spritesheet generator
pub const EMOJI_PAGE_SIZE: f32 = 1024.0;
pub const EMOJI_CHARACTER_SIZE: f32 = 125.0;
pub const EMOJI_SCALE: f32 = 0.81;

/// Texture UID offset for emoji spritesheets (after font textures)
/// We reserve UIDs 0-999 for fonts, emoji spritesheets start at 1000
pub const EMOJI_TEXTURE_UID_BASE: u32 = 1000;

/// Location of an emoji in the spritesheet
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmojiLocation {
    /// Spritesheet page index
    pub page: u32,
    /// X position in the spritesheet (pixels)
    pub x: f32,
    /// Y position in the spritesheet (pixels)
    pub y: f32,
    /// Width in pixels
    pub width: f32,
    /// Height in pixels
    pub height: f32,
}

/// Metadata for a spritesheet page
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmojiPage {
    /// Filename of the PNG
    pub filename: String,
    /// Number of emojis on this page
    #[serde(rename = "emojiCount")]
    pub emoji_count: u32,
}

/// The emoji mapping JSON structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmojiMapping {
    /// Page size in pixels
    #[serde(rename = "pageSize")]
    pub page_size: u32,
    /// Character size in pixels
    #[serde(rename = "characterSize")]
    pub character_size: u32,
    /// Scale factor for emoji rendering
    #[serde(rename = "scaleEmoji")]
    pub scale_emoji: f32,
    /// List of spritesheet pages
    pub pages: Vec<EmojiPage>,
    /// Map from emoji string to location
    pub emojis: HashMap<String, EmojiLocation>,
}

/// Emoji render data (for integration with text rendering)
#[derive(Debug, Clone)]
pub struct EmojiRenderData {
    /// Texture UID for the spritesheet page
    pub texture_uid: u32,
    /// UV coordinates for sampling
    pub uv: UVRect,
    /// Width of the emoji in the spritesheet
    pub width: f32,
    /// Height of the emoji in the spritesheet
    pub height: f32,
}

/// Page loading state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PageState {
    /// Page hasn't been requested yet
    NotLoaded,
    /// Page is needed but loading hasn't started
    Needed,
    /// Page is currently being loaded
    Loading,
    /// Page is loaded and ready
    Loaded,
    /// Page failed to load
    Failed,
}

/// Emoji sprites manager with lazy loading
///
/// Handles loading and lookup of emoji spritesheets.
/// Only loads texture pages when emojis from that page are needed.
#[derive(Debug, Default)]
pub struct EmojiSprites {
    /// The loaded mapping (loaded once at startup from JSON)
    mapping: Option<EmojiMapping>,

    /// Base URL for loading emoji textures (e.g., "/emojis/")
    base_url: String,

    /// State of each page
    page_states: Vec<PageState>,

    /// Texture UIDs for each page (indexed by page number)
    /// UID = EMOJI_TEXTURE_UID_BASE + page_index
    texture_uids: Vec<u32>,

    /// Pages that need to be loaded (collected during layout)
    needed_pages: HashSet<usize>,
}

impl EmojiSprites {
    /// Create a new empty emoji sprites manager
    pub fn new() -> Self {
        Self {
            mapping: None,
            base_url: String::from("/emojis/"),
            page_states: Vec::new(),
            texture_uids: Vec::new(),
            needed_pages: HashSet::new(),
        }
    }

    /// Set the base URL for loading emoji textures
    pub fn set_base_url(&mut self, base_url: &str) {
        self.base_url = base_url.to_string();
        if !self.base_url.ends_with('/') {
            self.base_url.push('/');
        }
    }

    /// Load emoji mapping from JSON string
    pub fn load_mapping(&mut self, json: &str) -> Result<(), String> {
        let mapping: EmojiMapping = serde_json::from_str(json)
            .map_err(|e| format!("Failed to parse emoji mapping: {}", e))?;

        let page_count = mapping.pages.len();
        self.page_states = vec![PageState::NotLoaded; page_count];
        self.texture_uids = (0..page_count)
            .map(|i| EMOJI_TEXTURE_UID_BASE + i as u32)
            .collect();
        self.needed_pages.clear();
        self.mapping = Some(mapping);

        log::info!(
            "[EmojiSprites] Loaded mapping with {} pages, {} emojis",
            page_count,
            self.mapping.as_ref().map(|m| m.emojis.len()).unwrap_or(0)
        );

        Ok(())
    }

    /// Check if the mapping is loaded
    pub fn is_loaded(&self) -> bool {
        self.mapping.is_some()
    }

    /// Get the number of pages
    pub fn page_count(&self) -> usize {
        self.mapping.as_ref().map(|m| m.pages.len()).unwrap_or(0)
    }

    /// Get the filename for a page
    pub fn page_filename(&self, page: usize) -> Option<String> {
        self.mapping
            .as_ref()
            .and_then(|m| m.pages.get(page))
            .map(|p| p.filename.clone())
    }

    /// Get the full URL for loading a page
    pub fn page_url(&self, page: usize) -> Option<String> {
        self.page_filename(page)
            .map(|filename| format!("{}{}", self.base_url, filename))
    }

    /// Get texture UID for a page
    pub fn texture_uid(&self, page: usize) -> u32 {
        EMOJI_TEXTURE_UID_BASE + page as u32
    }

    /// Check if a string is an emoji in the spritesheet
    pub fn has_emoji(&self, emoji: &str) -> bool {
        self.mapping
            .as_ref()
            .map(|m| m.emojis.contains_key(emoji))
            .unwrap_or(false)
    }

    /// Get the page index for an emoji (for checking if page is loaded)
    pub fn get_emoji_page(&self, emoji: &str) -> Option<usize> {
        self.mapping
            .as_ref()
            .and_then(|m| m.emojis.get(emoji))
            .map(|loc| loc.page as usize)
    }

    /// Mark a page as needed (called during layout when an emoji is found)
    pub fn mark_page_needed(&mut self, page: usize) {
        if page < self.page_states.len() && self.page_states[page] == PageState::NotLoaded {
            self.page_states[page] = PageState::Needed;
            self.needed_pages.insert(page);
            log::debug!("[EmojiSprites] Page {} marked as needed", page);
        }
    }

    /// Get pages that need to be loaded
    pub fn get_needed_pages(&self) -> Vec<usize> {
        self.needed_pages.iter().copied().collect()
    }

    /// Check if there are pages that need loading
    pub fn has_needed_pages(&self) -> bool {
        !self.needed_pages.is_empty()
    }

    /// Mark a page as loading (called when fetch starts)
    pub fn mark_page_loading(&mut self, page: usize) {
        if page < self.page_states.len() {
            self.page_states[page] = PageState::Loading;
            self.needed_pages.remove(&page);
        }
    }

    /// Mark a page as loaded (called when texture is uploaded)
    pub fn mark_page_loaded(&mut self, page: usize) {
        if page < self.page_states.len() {
            self.page_states[page] = PageState::Loaded;
            self.needed_pages.remove(&page);
            log::info!("[EmojiSprites] Page {} loaded", page);
        }
    }

    /// Mark a page as failed (called when loading fails)
    pub fn mark_page_failed(&mut self, page: usize) {
        if page < self.page_states.len() {
            self.page_states[page] = PageState::Failed;
            self.needed_pages.remove(&page);
            log::warn!("[EmojiSprites] Page {} failed to load", page);
        }
    }

    /// Check if a page is loaded
    pub fn is_page_loaded(&self, page: usize) -> bool {
        page < self.page_states.len() && self.page_states[page] == PageState::Loaded
    }

    /// Get render data for an emoji (returns data even if page not loaded yet)
    /// The texture UID and UVs are deterministic from the mapping.
    /// Caller should check is_page_loaded() before rendering.
    pub fn get_emoji(&self, emoji: &str) -> Option<EmojiRenderData> {
        let mapping = self.mapping.as_ref()?;
        let location = mapping.emojis.get(emoji)?;

        let page = location.page as usize;
        let texture_uid = self.texture_uids.get(page).copied().unwrap_or(0);
        let page_size = mapping.page_size as f32;

        // Calculate UV coordinates
        let uv = UVRect::new(
            location.x / page_size,
            location.y / page_size,
            (location.x + location.width) / page_size,
            (location.y + location.height) / page_size,
        );

        Some(EmojiRenderData {
            texture_uid,
            uv,
            width: location.width,
            height: location.height,
        })
    }

    /// Get the scale factor for emoji rendering
    pub fn scale(&self) -> f32 {
        self.mapping
            .as_ref()
            .map(|m| m.scale_emoji)
            .unwrap_or(EMOJI_SCALE)
    }

    /// Get the character size in the spritesheet
    pub fn character_size(&self) -> f32 {
        self.mapping
            .as_ref()
            .map(|m| m.character_size as f32)
            .unwrap_or(EMOJI_CHARACTER_SIZE)
    }

    /// Clear all data
    pub fn clear(&mut self) {
        self.mapping = None;
        self.page_states.clear();
        self.texture_uids.clear();
        self.needed_pages.clear();
    }
}

/// Check if a character is likely an emoji (basic heuristic)
///
/// This is a fast check to avoid HashMap lookups for regular ASCII characters.
/// Returns true if the character *might* be an emoji (requires further lookup).
pub fn is_potential_emoji(c: char) -> bool {
    let code = c as u32;

    // Most emojis are in these ranges:
    // - Miscellaneous Symbols and Pictographs: U+1F300–U+1F5FF
    // - Emoticons: U+1F600–U+1F64F
    // - Transport and Map Symbols: U+1F680–U+1F6FF
    // - Supplemental Symbols and Pictographs: U+1F900–U+1F9FF
    // - Symbols and Pictographs Extended-A: U+1FA00–U+1FAFF
    // - Dingbats: U+2700–U+27BF
    // - Miscellaneous Symbols: U+2600–U+26FF
    // - Regional Indicator Symbols: U+1F1E0–U+1F1FF
    // - Skin tone modifiers: U+1F3FB–U+1F3FF

    matches!(
        code,
        0x1F300..=0x1F5FF  // Misc Symbols & Pictographs (includes skin tones)
            | 0x1F600..=0x1F64F  // Emoticons
            | 0x1F680..=0x1F6FF  // Transport & Map
            | 0x1F900..=0x1F9FF  // Supplemental Symbols
            | 0x1FA00..=0x1FAFF  // Extended-A
            | 0x2600..=0x27BF    // Misc Symbols + Dingbats
            | 0x1F1E0..=0x1F1FF  // Regional Indicators (flags)
            | 0x2190..=0x21FF    // Arrows
            | 0x2200..=0x22FF    // Math operators
            | 0x25A0..=0x25FF    // Geometric shapes
            | 0x00A9            // ©
            | 0x00AE            // ®
            | 0x2122            // ™
            | 0x203C            // ‼
            | 0x2049            // ⁉
            | 0xFE0F            // Variation selector (emoji presentation)
            | 0x200D            // Zero-width joiner (for ZWJ sequences)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_potential_emoji() {
        assert!(is_potential_emoji('😀'));
        assert!(is_potential_emoji('🎉'));
        assert!(is_potential_emoji('❤'));
        assert!(!is_potential_emoji('A'));
        assert!(!is_potential_emoji('1'));
        assert!(!is_potential_emoji(' '));
    }

    #[test]
    fn test_texture_uid() {
        let sprites = EmojiSprites::new();
        assert_eq!(sprites.texture_uid(0), 1000);
        assert_eq!(sprites.texture_uid(5), 1005);
        assert_eq!(sprites.texture_uid(43), 1043);
    }
}
