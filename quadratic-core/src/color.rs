use anyhow::{Result, anyhow, bail};
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

    pub fn from_str(color_str: &str) -> Result<Self> {
        if color_str.starts_with("#") {
            Self::color_from_str(color_str).map_err(|e| anyhow!("Invalid color string: {}", e))
        } else if color_str.starts_with("rgb(") {
            Self::from_css_str(color_str)
        } else {
            bail!("Invalid color string: {}", color_str);
        }
    }

    pub fn color_from_str(color_str: &str) -> Result<Self, ParseIntError> {
        // TODO(jrice): serde
        assert_eq!(&color_str[0..=0], "#");

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
        assert_eq!(Rgba::from_str(css).unwrap().as_string(), "#010203ff");

        let css = "#010203FF";
        assert_eq!(Rgba::from_str(css).unwrap().as_string(), "#010203ff");
    }
}
