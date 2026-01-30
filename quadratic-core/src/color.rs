use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};
use std::fmt::Write;
use std::num::ParseIntError;
use ts_rs::TS;

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, Serialize, Deserialize, TS)]
pub struct Rgba {
    pub red: u8,
    pub green: u8,
    pub blue: u8,
    pub alpha: u8,
}

impl Default for Rgba {
    fn default() -> Self {
        Self {
            red: 0,
            green: 0,
            blue: 0,
            alpha: 255,
        }
    }
}

impl Rgba {
    pub fn new(red: u8, green: u8, blue: u8, alpha: u8) -> Self {
        Self {
            red,
            green,
            blue,
            alpha,
        }
    }

    pub fn color_from_str(color_str: &str) -> Result<Self> {
        if !color_str.starts_with('#') {
            bail!("Color string must start with '#'");
        }

        // Check length of the string
        let len = color_str.len();
        let alpha = if len == 9 {
            u8::from_str_radix(&color_str[7..=8], 16)?
        } else {
            0xff
        };

        Ok(Self {
            red: u8::from_str_radix(&color_str[1..=2], 16)?,
            green: u8::from_str_radix(&color_str[3..=4], 16)?,
            blue: u8::from_str_radix(&color_str[5..=6], 16)?,
            alpha,
        })
    }

    pub fn from_css_str(css: &str) -> Result<Self> {
        let colors = css
            .trim_start_matches("rgb(")
            .trim_end_matches(')')
            .split(',')
            .map(|s| s.trim().parse::<u8>())
            .collect::<Result<Vec<u8>, ParseIntError>>()?;

        if colors.len() != 3 {
            bail!("Invalid number of colors");
        }

        Ok(Rgba {
            red: colors[0],
            green: colors[1],
            blue: colors[2],
            alpha: 255,
        })
    }
    pub fn as_string(&self) -> String {
        let mut s = String::with_capacity(1 + 4 * 2);
        write!(&mut s, "#").unwrap();
        write!(&mut s, "{:02x}", self.red).unwrap();
        write!(&mut s, "{:02x}", self.green).unwrap();
        write!(&mut s, "{:02x}", self.blue).unwrap();
        write!(&mut s, "{:02x}", self.alpha).unwrap();
        s
    }
    pub fn as_rgb_hex(&self) -> String {
        let s = self.as_string();
        if s.len() < 8 { s } else { s[0..7].to_string() }
    }

    /// Convert to a normalized f32 array [r, g, b, a] with values in 0.0..1.0 range.
    /// Useful for GPU rendering where colors are typically normalized floats.
    pub fn to_f32_array(&self) -> [f32; 4] {
        [
            self.red as f32 / 255.0,
            self.green as f32 / 255.0,
            self.blue as f32 / 255.0,
            self.alpha as f32 / 255.0,
        ]
    }

    /// Create an Rgba from RGB values (alpha defaults to 255).
    pub const fn rgb(red: u8, green: u8, blue: u8) -> Self {
        Self {
            red,
            green,
            blue,
            alpha: 255,
        }
    }

    /// Compute the relative luminance of this color.
    /// Uses the sRGB luminance formula: L = 0.2126*R + 0.7152*G + 0.0722*B
    /// Returns a value between 0.0 (black) and 1.0 (white).
    pub fn luminance(&self) -> f64 {
        // Convert to linear RGB (simplified gamma approximation)
        let r_linear = (self.red as f64 / 255.0).powf(2.2);
        let g_linear = (self.green as f64 / 255.0).powf(2.2);
        let b_linear = (self.blue as f64 / 255.0).powf(2.2);

        0.2126 * r_linear + 0.7152 * g_linear + 0.0722 * b_linear
    }

    /// Determines the appropriate contrasting text color (black or white) for this
    /// background color to ensure readability.
    /// Returns black for light backgrounds and white for dark backgrounds.
    pub fn contrasting_text_color(&self) -> Rgba {
        // Use 0.179 as threshold (WCAG recommendation for contrast ratio of 4.5:1)
        if self.luminance() > 0.179 {
            Rgba::new(0, 0, 0, 255) // Dark text on light background
        } else {
            Rgba::new(255, 255, 255, 255) // Light text on dark background
        }
    }
}

/// Parse a hex color string (e.g., "#ff0000" or "ff0000") into RGB components.
pub fn parse_hex_color(color: &str) -> Option<(u8, u8, u8)> {
    let hex = color.trim_start_matches('#');
    if hex.len() != 6 {
        return None;
    }
    let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
    let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
    let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
    Some((r, g, b))
}

/// Convert RGB components to a hex color string (e.g., "#ff0000").
pub fn rgb_to_hex(r: u8, g: u8, b: u8) -> String {
    format!("#{:02x}{:02x}{:02x}", r, g, b)
}

/// Linear interpolation between two values.
pub fn lerp(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}

/// Interpolate between two hex colors based on a normalized value (0.0 to 1.0).
/// Returns the interpolated color as a hex string.
pub fn interpolate_color(color1: &str, color2: &str, t: f64) -> Option<String> {
    let t = t.clamp(0.0, 1.0);
    let (r1, g1, b1) = parse_hex_color(color1)?;
    let (r2, g2, b2) = parse_hex_color(color2)?;

    let r = lerp(r1 as f64, r2 as f64, t).round() as u8;
    let g = lerp(g1 as f64, g2 as f64, t).round() as u8;
    let b = lerp(b1 as f64, b2 as f64, t).round() as u8;

    Some(rgb_to_hex(r, g, b))
}

/// Determines the appropriate text color (black or white) for a given fill color
/// hex string to ensure readability.
/// Returns "#000000" for light backgrounds and "#ffffff" for dark.
pub fn contrasting_text_color_hex(fill_color: &str) -> Option<String> {
    let (r, g, b) = parse_hex_color(fill_color)?;
    let color = Rgba::new(r, g, b, 255);
    Some(color.contrasting_text_color().as_rgb_hex())
}

impl TryFrom<&str> for Rgba {
    type Error = anyhow::Error;

    fn try_from(value: &str) -> Result<Self> {
        if value.starts_with('#') {
            Self::color_from_str(value)
        } else if value.starts_with("rgb(") {
            Self::from_css_str(value)
        } else {
            bail!("Invalid color string: {}", value);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new() {
        let color = Rgba::new(0x22, 0x44, 0x66, 0xff);
        assert_eq!(color.red, 0x22);
        assert_eq!(color.green, 0x44);
        assert_eq!(color.blue, 0x66);
        assert_eq!(color.alpha, 0xff);
    }

    #[test]
    fn test_size() {
        // This is an important guarantee due to the number of instances
        assert_eq!(std::mem::size_of::<Rgba>(), 4);
    }

    #[test]
    fn test_color_from_str() {
        let maybe_color = Rgba::color_from_str("#224466FF");
        assert!(maybe_color.is_ok());

        let color = maybe_color.unwrap();
        assert_eq!(color.red, 0x22);
        assert_eq!(color.green, 0x44);
        assert_eq!(color.blue, 0x66);
        assert_eq!(color.alpha, 0xff);
    }

    #[test]
    fn test_from_css_str() {
        let css = "rgb(1, 2, 3)";
        assert_eq!(Rgba::from_css_str(css).unwrap().as_string(), "#010203ff");
    }

    #[test]
    fn test_from_str() {
        let css = "rgb(1, 2, 3)";
        assert_eq!(Rgba::try_from(css).unwrap().as_string(), "#010203ff");

        let css = "#010203FF";
        assert_eq!(Rgba::try_from(css).unwrap().as_string(), "#010203ff");
    }

    #[test]
    fn test_luminance() {
        // Black should have luminance 0
        let black = Rgba::new(0, 0, 0, 255);
        assert!((black.luminance() - 0.0).abs() < 0.001);

        // White should have luminance ~1
        let white = Rgba::new(255, 255, 255, 255);
        assert!((white.luminance() - 1.0).abs() < 0.001);

        // Mid-gray should be somewhere in between
        let gray = Rgba::new(128, 128, 128, 255);
        assert!(gray.luminance() > 0.1 && gray.luminance() < 0.3);
    }

    #[test]
    fn test_contrasting_text_color() {
        // White background -> black text
        let white = Rgba::new(255, 255, 255, 255);
        let contrast = white.contrasting_text_color();
        assert_eq!(contrast.red, 0);
        assert_eq!(contrast.green, 0);
        assert_eq!(contrast.blue, 0);

        // Black background -> white text
        let black = Rgba::new(0, 0, 0, 255);
        let contrast = black.contrasting_text_color();
        assert_eq!(contrast.red, 255);
        assert_eq!(contrast.green, 255);
        assert_eq!(contrast.blue, 255);

        // Dark red -> white text
        let dark_red = Rgba::new(128, 0, 0, 255);
        let contrast = dark_red.contrasting_text_color();
        assert_eq!(contrast.red, 255);

        // Yellow (bright) -> black text
        let yellow = Rgba::new(255, 255, 0, 255);
        let contrast = yellow.contrasting_text_color();
        assert_eq!(contrast.red, 0);
    }

    #[test]
    fn test_parse_hex_color() {
        assert_eq!(super::parse_hex_color("#ff0000"), Some((255, 0, 0)));
        assert_eq!(super::parse_hex_color("00ff00"), Some((0, 255, 0)));
        assert_eq!(super::parse_hex_color("#0000ff"), Some((0, 0, 255)));
        assert_eq!(super::parse_hex_color("invalid"), None);
    }

    #[test]
    fn test_contrasting_text_color_hex() {
        assert_eq!(
            super::contrasting_text_color_hex("#ffffff"),
            Some("#000000".to_string())
        );
        assert_eq!(
            super::contrasting_text_color_hex("#000000"),
            Some("#ffffff".to_string())
        );
    }

    #[test]
    fn test_rgb_to_hex() {
        assert_eq!(super::rgb_to_hex(255, 0, 0), "#ff0000");
        assert_eq!(super::rgb_to_hex(0, 255, 0), "#00ff00");
        assert_eq!(super::rgb_to_hex(0, 0, 255), "#0000ff");
        assert_eq!(super::rgb_to_hex(255, 255, 255), "#ffffff");
        assert_eq!(super::rgb_to_hex(0, 0, 0), "#000000");
    }

    #[test]
    fn test_lerp() {
        assert!((super::lerp(0.0, 100.0, 0.0) - 0.0).abs() < 0.001);
        assert!((super::lerp(0.0, 100.0, 1.0) - 100.0).abs() < 0.001);
        assert!((super::lerp(0.0, 100.0, 0.5) - 50.0).abs() < 0.001);
        assert!((super::lerp(10.0, 20.0, 0.25) - 12.5).abs() < 0.001);
    }

    #[test]
    fn test_interpolate_color() {
        // Interpolate from red to green
        assert_eq!(
            super::interpolate_color("#ff0000", "#00ff00", 0.0),
            Some("#ff0000".to_string())
        );
        assert_eq!(
            super::interpolate_color("#ff0000", "#00ff00", 1.0),
            Some("#00ff00".to_string())
        );
        // 50% should give yellow-ish
        let mid = super::interpolate_color("#ff0000", "#00ff00", 0.5).unwrap();
        let (r, g, b) = super::parse_hex_color(&mid).unwrap();
        assert!(r > 100 && r < 150);
        assert!(g > 100 && g < 150);
        assert_eq!(b, 0);

        // Invalid colors
        assert_eq!(super::interpolate_color("invalid", "#00ff00", 0.5), None);
    }
}
