use serde::{Deserialize, Serialize};
use std::fmt::Write;
use std::num::ParseIntError;

#[cfg(feature = "js")]
use wasm_bindgen::prelude::wasm_bindgen;

#[cfg_attr(feature = "js", wasm_bindgen, derive(ts_rs::TS))]
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, Serialize, Deserialize)]
pub struct Rgba {
    pub red: u8,
    pub green: u8,
    pub blue: u8,
    pub alpha: u8,
}
#[wasm_bindgen]
impl Rgba {
    #[cfg_attr(feature = "js", wasm_bindgen(constructor))]
    pub fn from_js(red: f64, green: f64, blue: f64, alpha: f64) -> Self {
        Self {
            red: red.clamp(0.0f64, 255.0f64) as u8,
            green: green.clamp(0.0f64, 255.0f64) as u8,
            blue: blue.clamp(0.0f64, 255.0f64) as u8,
            alpha: alpha.clamp(0.0f64, 255.0f64) as u8,
        }
    }

    #[wasm_bindgen]
    pub fn tint(&self) -> u32 {
        ((self.red as u32) << 16) | ((self.green as u32) << 8) | (self.blue as u32)
    }

    #[wasm_bindgen]
    pub fn alpha(&self) -> f32 {
        (self.alpha as f32) / 255.0
    }
}
impl Rgba {
    pub fn from_str(color_str: &str) -> Result<Self, ParseIntError> {
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
    pub fn as_string(&self) -> String {
        let mut s = String::with_capacity(1 + 3 * 2);
        write!(&mut s, "#").unwrap();
        write!(&mut s, "{:02x}", self.red).unwrap();
        write!(&mut s, "{:02x}", self.green).unwrap();
        write!(&mut s, "{:02x}", self.blue).unwrap();
        write!(&mut s, "{:02x}", self.alpha).unwrap();
        s
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_size() {
        // This is an important guarantee due to the number of instances
        assert_eq!(std::mem::size_of::<Rgba>(), 4);
    }

    #[test]
    fn test_from_str() {
        let maybe_color = Rgba::from_str("#224466FF");
        assert!(maybe_color.is_ok());

        let color = maybe_color.unwrap();
        assert_eq!(color.red, 0x22);
        assert_eq!(color.green, 0x44);
        assert_eq!(color.blue, 0x66);
        assert_eq!(color.alpha, 0xff);
    }
}
