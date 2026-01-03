//! Color utilities

/// Parse a CSS color string to RGBA floats [0.0-1.0]
pub fn parse_color_string(color: &str) -> [f32; 4] {
    // Handle hex colors
    if let Some(hex) = color.strip_prefix('#') {
        return parse_hex_color(hex);
    }

    // Handle rgba() format
    if let Some(rgba) = color.strip_prefix("rgba(") {
        if let Some(values) = rgba.strip_suffix(')') {
            return parse_rgba_values(values);
        }
    }

    // Handle rgb() format
    if let Some(rgb) = color.strip_prefix("rgb(") {
        if let Some(values) = rgb.strip_suffix(')') {
            return parse_rgb_values(values);
        }
    }

    // Default to black
    [0.0, 0.0, 0.0, 1.0]
}

fn parse_hex_color(hex: &str) -> [f32; 4] {
    let hex = hex.trim();
    match hex.len() {
        3 => {
            // #RGB -> #RRGGBB
            let r = u8::from_str_radix(&hex[0..1].repeat(2), 16).unwrap_or(0);
            let g = u8::from_str_radix(&hex[1..2].repeat(2), 16).unwrap_or(0);
            let b = u8::from_str_radix(&hex[2..3].repeat(2), 16).unwrap_or(0);
            [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0, 1.0]
        }
        6 => {
            let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0);
            let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0);
            let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0);
            [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0, 1.0]
        }
        8 => {
            let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0);
            let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0);
            let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0);
            let a = u8::from_str_radix(&hex[6..8], 16).unwrap_or(255);
            [
                r as f32 / 255.0,
                g as f32 / 255.0,
                b as f32 / 255.0,
                a as f32 / 255.0,
            ]
        }
        _ => [0.0, 0.0, 0.0, 1.0],
    }
}

fn parse_rgba_values(values: &str) -> [f32; 4] {
    let parts: Vec<&str> = values.split(',').map(|s| s.trim()).collect();
    if parts.len() >= 4 {
        let r = parts[0].parse::<f32>().unwrap_or(0.0) / 255.0;
        let g = parts[1].parse::<f32>().unwrap_or(0.0) / 255.0;
        let b = parts[2].parse::<f32>().unwrap_or(0.0) / 255.0;
        let a = parts[3].parse::<f32>().unwrap_or(1.0);
        return [r, g, b, a];
    }
    [0.0, 0.0, 0.0, 1.0]
}

fn parse_rgb_values(values: &str) -> [f32; 4] {
    let parts: Vec<&str> = values.split(',').map(|s| s.trim()).collect();
    if parts.len() >= 3 {
        let r = parts[0].parse::<f32>().unwrap_or(0.0) / 255.0;
        let g = parts[1].parse::<f32>().unwrap_or(0.0) / 255.0;
        let b = parts[2].parse::<f32>().unwrap_or(0.0) / 255.0;
        return [r, g, b, 1.0];
    }
    [0.0, 0.0, 0.0, 1.0]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_hex() {
        let c = parse_color_string("#ff0000");
        assert!((c[0] - 1.0).abs() < 0.01);
        assert!(c[1].abs() < 0.01);
        assert!(c[2].abs() < 0.01);
        assert!((c[3] - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_parse_rgba() {
        let c = parse_color_string("rgba(255, 128, 0, 0.5)");
        assert!((c[0] - 1.0).abs() < 0.01);
        assert!((c[1] - 0.5).abs() < 0.01);
        assert!(c[2].abs() < 0.01);
        assert!((c[3] - 0.5).abs() < 0.01);
    }
}
