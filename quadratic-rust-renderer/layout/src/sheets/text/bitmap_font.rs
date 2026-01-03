//! Bitmap font metrics for text layout
//!
//! This module only handles font metrics - texture data stays in the render worker.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Character metrics from bitmap font
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharData {
    pub id: u32,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    #[serde(rename = "xoffset")]
    pub x_offset: f32,
    #[serde(rename = "yoffset")]
    pub y_offset: f32,
    #[serde(rename = "xadvance")]
    pub x_advance: f32,
    pub page: u32,
}

/// Kerning pair
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KerningPair {
    pub first: u32,
    pub second: u32,
    pub amount: f32,
}

/// Bitmap font definition (metrics only)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitmapFont {
    pub font: String,
    pub size: f32,
    #[serde(rename = "lineHeight")]
    pub line_height: f32,
    #[serde(default)]
    pub base: f32,
    #[serde(rename = "distanceRange", default = "default_distance_range")]
    pub distance_range: f32,
    #[serde(rename = "scaleW", default = "default_scale")]
    pub scale_w: f32,
    #[serde(rename = "scaleH", default = "default_scale")]
    pub scale_h: f32,
    pub pages: Vec<String>,
    #[serde(default)]
    pub chars: HashMap<String, CharData>,
    #[serde(default)]
    pub kernings: Vec<KerningPair>,
}

fn default_distance_range() -> f32 {
    4.0
}

fn default_scale() -> f32 {
    512.0
}

impl BitmapFont {
    /// Get character data by char code
    pub fn get_char(&self, char_code: u32) -> Option<&CharData> {
        self.chars.get(&char_code.to_string())
    }

    /// Get kerning between two characters
    pub fn get_kerning(&self, first: u32, second: u32) -> f32 {
        self.kernings
            .iter()
            .find(|k| k.first == first && k.second == second)
            .map(|k| k.amount)
            .unwrap_or(0.0)
    }

    /// Calculate global texture UID for a page
    /// font_index * 16 + page
    pub fn texture_uid(&self, font_index: usize, page: u32) -> u32 {
        (font_index * 16 + page as usize) as u32
    }
}

/// Collection of bitmap fonts
#[derive(Default)]
pub struct BitmapFonts {
    fonts: HashMap<String, BitmapFont>,
    font_indices: HashMap<String, usize>,
    next_index: usize,
}

impl BitmapFonts {
    pub fn new() -> Self {
        Self::default()
    }

    /// Add a font
    pub fn add(&mut self, font: BitmapFont) {
        let name = font.font.clone();
        let index = self.next_index;
        self.next_index += 1;
        self.font_indices.insert(name.clone(), index);
        self.fonts.insert(name, font);
    }

    /// Get a font by name
    pub fn get(&self, name: &str) -> Option<&BitmapFont> {
        self.fonts.get(name)
    }

    /// Get font index for texture UID calculation
    pub fn font_index(&self, name: &str) -> Option<usize> {
        self.font_indices.get(name).copied()
    }

    pub fn is_empty(&self) -> bool {
        self.fonts.is_empty()
    }

    /// Get default font (OpenSans or first available)
    pub fn default_font(&self) -> Option<&BitmapFont> {
        self.fonts.get("OpenSans").or_else(|| self.fonts.values().next())
    }

    /// Get required texture UIDs for all fonts
    pub fn get_required_texture_uids(&self) -> Vec<u32> {
        let mut uids = Vec::new();
        for (name, font) in &self.fonts {
            if let Some(index) = self.font_indices.get(name) {
                for page in 0..font.pages.len() {
                    uids.push((*index * 16 + page) as u32);
                }
            }
        }
        uids
    }
}
