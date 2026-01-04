//! Color utilities

/// Convert a hex color string to RGBA floats
pub fn hex_to_rgba(hex: &str) -> Option<[f32; 4]> {
    let hex = hex.trim_start_matches('#');

    match hex.len() {
        6 => {
            let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
            let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
            let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
            Some([
                r as f32 / 255.0,
                g as f32 / 255.0,
                b as f32 / 255.0,
                1.0,
            ])
        }
        8 => {
            let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
            let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
            let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
            let a = u8::from_str_radix(&hex[6..8], 16).ok()?;
            Some([
                r as f32 / 255.0,
                g as f32 / 255.0,
                b as f32 / 255.0,
                a as f32 / 255.0,
            ])
        }
        _ => None,
    }
}

/// Convert an integer color (0xRRGGBB) to RGBA floats
pub fn int_to_rgba(color: u32) -> [f32; 4] {
    let r = ((color >> 16) & 0xFF) as f32 / 255.0;
    let g = ((color >> 8) & 0xFF) as f32 / 255.0;
    let b = (color & 0xFF) as f32 / 255.0;
    [r, g, b, 1.0]
}

/// Convert RGBA floats to a CSS color string
pub fn rgba_to_css(color: [f32; 4]) -> String {
    format!(
        "rgba({}, {}, {}, {})",
        (color[0] * 255.0) as u8,
        (color[1] * 255.0) as u8,
        (color[2] * 255.0) as u8,
        color[3]
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hex_to_rgba() {
        assert_eq!(hex_to_rgba("#FF0000"), Some([1.0, 0.0, 0.0, 1.0]));
        assert_eq!(hex_to_rgba("00FF00"), Some([0.0, 1.0, 0.0, 1.0]));
        assert_eq!(hex_to_rgba("#0000FF80"), Some([0.0, 0.0, 1.0, 128.0 / 255.0]));
    }

    #[test]
    fn test_int_to_rgba() {
        assert_eq!(int_to_rgba(0xFF0000), [1.0, 0.0, 0.0, 1.0]);
        assert_eq!(int_to_rgba(0x00FF00), [0.0, 1.0, 0.0, 1.0]);
        assert_eq!(int_to_rgba(0x0000FF), [0.0, 0.0, 1.0, 1.0]);
    }
}

