use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};
use std::{fmt::Write, str::FromStr};
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
        // TODO(jrice): serde
        Self::try_from(color_str)
    }

    pub fn from_css_str(css: &str) -> Result<Self> {
        Self::try_from(css)
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
        if s.len() < 8 {
            s
        } else {
            s[0..7].to_string()
        }
    }
}

impl FromStr for Rgba {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::try_from(s)
    }
}

impl TryFrom<&'_ str> for Rgba {
    type Error = anyhow::Error;

    fn try_from(hex: &'_ str) -> Result<Self, Self::Error> {
        let hex = hex.trim();
        const RGB: usize = 3;
        const RGBA: usize = 4;
        const RRGGBB: usize = 6;
        const RRGGBBAA: usize = 8;

        const fn dup(value: u8) -> u8 {
            value << 4 | value
        }
        // Hex formats
        if let Some(hex) = hex.strip_prefix('#') {
            match hex.len() {
                format @ (RGB | RGBA) => {
                    let red = u8::from_str_radix(&hex[0..1], 16)?;
                    let green = u8::from_str_radix(&hex[1..2], 16)?;
                    let blue = u8::from_str_radix(&hex[2..3], 16)?;
                    let alpha = if format == RGBA {
                        u8::from_str_radix(&hex[3..4].repeat(2), 16)?
                    } else {
                        0xff
                    };

                    return Ok(Rgba {
                        red: dup(red),
                        green: dup(green),
                        blue: dup(blue),
                        alpha: dup(alpha),
                    });
                }

                format @ (RRGGBB | RRGGBBAA) => {
                    let red = u8::from_str_radix(&hex[0..2], 16)?;
                    let green = u8::from_str_radix(&hex[2..4], 16)?;
                    let blue = u8::from_str_radix(&hex[4..6], 16)?;

                    let alpha = if format == RRGGBBAA {
                        u8::from_str_radix(&hex[6..8], 16)?
                    } else {
                        0xff
                    };

                    return Ok(Rgba {
                        red,
                        green,
                        blue,
                        alpha,
                    });
                }
                _ => bail!(
                    "invalid hex color format: '{}' expected #rgb, #rgba, #rrggbb or #rrggbbaa",
                    hex
                ),
            }
        }

        // Functional formats: rgb(r, g, b) | rgba(r, g, b, a)
        if hex.starts_with("rgb(") || hex.starts_with("rgba(") {
            let is_rgba = hex.starts_with("rgba(");
            let inner = hex
                .strip_prefix("rgb(")
                .or_else(|| hex.strip_prefix("rgba("))
                .and_then(|s| s.strip_suffix(')'))
                .ok_or_else(|| anyhow::anyhow!("invalid functional color format"))?;

            let parts: Vec<&str> = inner.split(',').map(str::trim).collect();
            if (is_rgba && parts.len() == 4) || (!is_rgba && parts.len() == 3) {
                let red: u8 = parts[0].parse()?;
                let green: u8 = parts[1].parse()?;
                let blue: u8 = parts[2].parse()?;
                let alpha: u8 = if is_rgba {
                    (parts[3].parse::<f32>()? * 255.0).round() as u8
                } else {
                    255
                };
                return Ok(Rgba {
                    red,
                    green,
                    blue,
                    alpha,
                });
            } else {
                bail!("invalid functional color format: '{}'", hex);
            }
        }

        bail!(
            "invalid RGBA color format: '{}'. Expected #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(r, g, b), or rgba(r, g, b, a)",
            hex
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn new() {
        let color = Rgba::new(0x22, 0x44, 0x66, 0xff);

        assert_eq!(color.red, 0x22);
        assert_eq!(color.green, 0x44);
        assert_eq!(color.blue, 0x66);
        assert_eq!(color.alpha, 0xff);
    }

    #[test]
    #[parallel]
    fn test_size() {
        // This is an important guarantee due to the number of instances
        assert_eq!(std::mem::size_of::<Rgba>(), 4);
    }

    #[test]
    #[parallel]
    fn test_from_str() {
        let color = Rgba::color_from_str("#224466FF").expect("should parse color from hex string");
        assert_eq!(color, Rgba::new(0x22, 0x44, 0x66, 0xff));
    }

    #[test]
    #[parallel]
    fn test_from_css_str() {
        let css = Rgba::from_css_str("rgb(1, 2, 3)").expect("should parse from css string");

        assert_eq!(css, Rgba::new(0x1, 0x2, 0x3, 0xff));
    }

    #[test]
    #[parallel]
    fn test_hex_formats() {
        let color = Rgba::color_from_str("#abc").expect("should parse #rgb");
        assert_eq!(color, Rgba::new(0xaa, 0xbb, 0xcc, 0xff));

        let color = Rgba::color_from_str("#abcd1234").expect("should parse #rgba");
        assert_eq!(color, Rgba::new(0xab, 0xcd, 0x12, 0x34));

        let color = Rgba::color_from_str("#aabbcc").expect("should parse #rrggbb");
        assert_eq!(color, Rgba::new(0xaa, 0xbb, 0xcc, 0xff));

        let color = Rgba::color_from_str("#aabbccdd").expect("should parse #rrggbbaa");
        assert_eq!(color, Rgba::new(0xaa, 0xbb, 0xcc, 0xdd));
    }

    #[test]
    #[parallel]
    fn test_invalid_hex() {
        // Invalid length
        let result = Rgba::color_from_str("#abcdd");
        assert!(result.is_err(), "Expected error for invalid hex format");

        // Invalid characters
        let result = Rgba::color_from_str("#xyz123");
        assert!(result.is_err(), "Expected error for invalid hex characters");
    }

    #[test]
    #[parallel]
    fn test_rgb_functional() {
        let color = Rgba::color_from_str("rgb(255, 0, 0)").expect("should parse rgb");
        assert_eq!(color, Rgba::new(255, 0, 0, 255));

        let color = Rgba::color_from_str("rgba(255, 0, 0, 0.5)").expect("should parse rgba");
        assert_eq!(color, Rgba::new(255, 0, 0, 128));
    }

    #[test]
    #[parallel]
    fn test_as_string() {
        let color = Rgba::new(0x22, 0x44, 0x66, 0xff);
        assert_eq!(color.as_string(), "#224466ff");
    }

    #[test]
    #[parallel]
    fn parse_from_string() {
        let color = "#ffffff".parse::<Rgba>().expect("should parse to string");
        assert_eq!(color, Rgba::new(0xff, 0xff, 0xff, 0xff));
    }
}
