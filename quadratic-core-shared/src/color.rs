//! Color types for cell formatting.

use bincode::{Decode, Encode};
use serde::{Deserialize, Serialize};

/// RGBA color with 8-bit components.
#[derive(Debug, Default, Copy, Clone, PartialEq, Eq, Hash, Encode, Decode, Serialize, Deserialize)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct Rgba {
    pub red: u8,
    pub green: u8,
    pub blue: u8,
    pub alpha: u8,
}

impl Rgba {
    /// Create a new RGBA color
    #[inline]
    pub const fn new(red: u8, green: u8, blue: u8, alpha: u8) -> Self {
        Self {
            red,
            green,
            blue,
            alpha,
        }
    }

    /// Create an opaque RGB color (alpha = 255)
    #[inline]
    pub const fn rgb(red: u8, green: u8, blue: u8) -> Self {
        Self {
            red,
            green,
            blue,
            alpha: 255,
        }
    }

    /// Black color
    pub const BLACK: Self = Self::rgb(0, 0, 0);

    /// White color
    pub const WHITE: Self = Self::rgb(255, 255, 255);

    /// Transparent color
    pub const TRANSPARENT: Self = Self::new(0, 0, 0, 0);

    /// Parse a hex color string like "#RRGGBB" or "#RRGGBBAA"
    pub fn from_hex(hex: &str) -> Option<Self> {
        let hex = hex.strip_prefix('#')?;

        let parse_byte = |s: &str| u8::from_str_radix(s, 16).ok();

        match hex.len() {
            6 => Some(Self::rgb(
                parse_byte(&hex[0..2])?,
                parse_byte(&hex[2..4])?,
                parse_byte(&hex[4..6])?,
            )),
            8 => Some(Self::new(
                parse_byte(&hex[0..2])?,
                parse_byte(&hex[2..4])?,
                parse_byte(&hex[4..6])?,
                parse_byte(&hex[6..8])?,
            )),
            _ => None,
        }
    }

    /// Convert to a hex string like "#RRGGBBAA"
    pub fn to_hex(&self) -> String {
        format!(
            "#{:02x}{:02x}{:02x}{:02x}",
            self.red, self.green, self.blue, self.alpha
        )
    }

    /// Convert to a hex string like "#RRGGBB" (without alpha)
    pub fn to_hex_rgb(&self) -> String {
        format!("#{:02x}{:02x}{:02x}", self.red, self.green, self.blue)
    }

    /// Alias for `to_hex_rgb` - returns hex string like "#RRGGBB"
    pub fn as_rgb_hex(&self) -> String {
        self.to_hex_rgb()
    }

    /// Returns the color as a string in hex format
    pub fn as_string(&self) -> String {
        self.to_hex()
    }

    /// Convert to a packed u32 (RGBA format)
    #[inline]
    pub const fn to_u32(&self) -> u32 {
        ((self.red as u32) << 24)
            | ((self.green as u32) << 16)
            | ((self.blue as u32) << 8)
            | (self.alpha as u32)
    }

    /// Create from a packed u32 (RGBA format)
    #[inline]
    pub const fn from_u32(rgba: u32) -> Self {
        Self {
            red: ((rgba >> 24) & 0xFF) as u8,
            green: ((rgba >> 16) & 0xFF) as u8,
            blue: ((rgba >> 8) & 0xFF) as u8,
            alpha: (rgba & 0xFF) as u8,
        }
    }
}

/// Error parsing a color from a string.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParseColorError;

impl std::fmt::Display for ParseColorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "invalid color format")
    }
}

impl std::error::Error for ParseColorError {}

impl TryFrom<&str> for Rgba {
    type Error = ParseColorError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        Self::from_hex(value).ok_or(ParseColorError)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rgba_new() {
        let color = Rgba::new(0x22, 0x44, 0x66, 0xFF);
        assert_eq!(color.red, 0x22);
        assert_eq!(color.green, 0x44);
        assert_eq!(color.blue, 0x66);
        assert_eq!(color.alpha, 0xFF);
    }

    #[test]
    fn test_rgba_size() {
        // Ensure compact representation
        assert_eq!(std::mem::size_of::<Rgba>(), 4);
    }

    #[test]
    fn test_from_hex() {
        let color = Rgba::from_hex("#224466").unwrap();
        assert_eq!(color, Rgba::rgb(0x22, 0x44, 0x66));

        let color = Rgba::from_hex("#224466FF").unwrap();
        assert_eq!(color, Rgba::new(0x22, 0x44, 0x66, 0xFF));

        assert!(Rgba::from_hex("invalid").is_none());
        assert!(Rgba::from_hex("#12345").is_none());
    }

    #[test]
    fn test_to_hex() {
        let color = Rgba::new(0x22, 0x44, 0x66, 0xFF);
        assert_eq!(color.to_hex(), "#224466ff");
        assert_eq!(color.to_hex_rgb(), "#224466");
    }

    #[test]
    fn test_u32_roundtrip() {
        let color = Rgba::new(0x12, 0x34, 0x56, 0x78);
        let packed = color.to_u32();
        assert_eq!(packed, 0x12345678);
        assert_eq!(Rgba::from_u32(packed), color);
    }
}
