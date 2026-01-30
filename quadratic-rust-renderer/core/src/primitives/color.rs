//! Color type and parsing utilities

/// RGBA color as [r, g, b, a] where each component is 0.0-1.0
pub type Color = [f32; 4];

/// Common color constants
pub mod colors {
    use super::Color;

    pub const WHITE: Color = [1.0, 1.0, 1.0, 1.0];
    pub const BLACK: Color = [0.0, 0.0, 0.0, 1.0];
    pub const TRANSPARENT: Color = [0.0, 0.0, 0.0, 0.0];
    pub const RED: Color = [1.0, 0.0, 0.0, 1.0];
    pub const GREEN: Color = [0.0, 1.0, 0.0, 1.0];
    pub const BLUE: Color = [0.0, 0.0, 1.0, 1.0];
    pub const YELLOW: Color = [1.0, 1.0, 0.0, 1.0];
    pub const CYAN: Color = [0.0, 1.0, 1.0, 1.0];
    pub const MAGENTA: Color = [1.0, 0.0, 1.0, 1.0];
    pub const ORANGE: Color = [1.0, 0.647, 0.0, 1.0];
    pub const PINK: Color = [1.0, 0.753, 0.796, 1.0];
    pub const PURPLE: Color = [0.5, 0.0, 0.5, 1.0];
    pub const GRAY: Color = [0.5, 0.5, 0.5, 1.0];
    pub const LIGHT_GRAY: Color = [0.8, 0.8, 0.8, 1.0];

    /// Light gray for grid lines
    pub const GRID_LINE: Color = [0.9, 0.9, 0.9, 1.0];
}

/// Default fallback color (light gray)
pub const DEFAULT_COLOR: Color = [0.8, 0.8, 0.8, 1.0];

/// Parse a hex color string to Color
/// Supports formats: "#RRGGBB", "#RRGGBBAA", "RRGGBB", "RRGGBBAA"
pub fn from_hex(hex: &str) -> Option<Color> {
    let hex = hex.trim_start_matches('#');

    let (r, g, b, a) = match hex.len() {
        6 => {
            let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
            let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
            let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
            (r, g, b, 255u8)
        }
        8 => {
            let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
            let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
            let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
            let a = u8::from_str_radix(&hex[6..8], 16).ok()?;
            (r, g, b, a)
        }
        _ => return None,
    };

    Some([
        r as f32 / 255.0,
        g as f32 / 255.0,
        b as f32 / 255.0,
        a as f32 / 255.0,
    ])
}

/// Parse "rgba(r, g, b, a)" format where r,g,b are 0-255 and a is 0.0-1.0
pub fn from_rgba_str(s: &str) -> Option<Color> {
    let inner = s.strip_prefix("rgba(")?.strip_suffix(')')?;
    let parts: Vec<&str> = inner.split(',').collect();
    if parts.len() != 4 {
        return None;
    }

    let r: f32 = parts[0].trim().parse().ok()?;
    let g: f32 = parts[1].trim().parse().ok()?;
    let b: f32 = parts[2].trim().parse().ok()?;
    let a: f32 = parts[3].trim().parse().ok()?;

    Some([r / 255.0, g / 255.0, b / 255.0, a])
}

/// Parse "rgb(r, g, b)" format where r,g,b are 0-255
pub fn from_rgb_str(s: &str) -> Option<Color> {
    let inner = s.strip_prefix("rgb(")?.strip_suffix(')')?;
    let parts: Vec<&str> = inner.split(',').collect();
    if parts.len() != 3 {
        return None;
    }

    let r: f32 = parts[0].trim().parse().ok()?;
    let g: f32 = parts[1].trim().parse().ok()?;
    let b: f32 = parts[2].trim().parse().ok()?;

    Some([r / 255.0, g / 255.0, b / 255.0, 1.0])
}

/// Parse a named color (case-insensitive)
pub fn from_name(name: &str) -> Option<Color> {
    Some(match name.to_lowercase().as_str() {
        "red" => colors::RED,
        "green" => colors::GREEN,
        "blue" => colors::BLUE,
        "yellow" => colors::YELLOW,
        "cyan" => colors::CYAN,
        "magenta" => colors::MAGENTA,
        "white" => colors::WHITE,
        "black" => colors::BLACK,
        "gray" | "grey" => colors::GRAY,
        "orange" => colors::ORANGE,
        "pink" => colors::PINK,
        "purple" => colors::PURPLE,
        "transparent" => colors::TRANSPARENT,
        _ => return None,
    })
}

/// Parse any color string format
///
/// Supports:
/// - Hex: "#RRGGBB", "#RRGGBBAA"
/// - RGB: "rgb(r, g, b)"
/// - RGBA: "rgba(r, g, b, a)"
/// - Named: "red", "blue", etc.
///
/// Returns default light gray if parsing fails.
pub fn parse(s: &str) -> Color {
    parse_opt(s).unwrap_or(DEFAULT_COLOR)
}

/// Parse any color string format, returning None on failure
pub fn parse_opt(s: &str) -> Option<Color> {
    if s.starts_with('#') || s.chars().all(|c| c.is_ascii_hexdigit()) && s.len() >= 6 {
        from_hex(s)
    } else if s.starts_with("rgba(") {
        from_rgba_str(s)
    } else if s.starts_with("rgb(") {
        from_rgb_str(s)
    } else {
        from_name(s)
    }
}

/// Convert from quadratic_core::color::Rgba
pub fn from_rgba(rgba: &quadratic_core::color::Rgba) -> Color {
    [
        rgba.red as f32 / 255.0,
        rgba.green as f32 / 255.0,
        rgba.blue as f32 / 255.0,
        rgba.alpha as f32 / 255.0,
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_from_hex() {
        assert_eq!(from_hex("#FF0000"), Some([1.0, 0.0, 0.0, 1.0]));
        assert_eq!(from_hex("#00FF00"), Some([0.0, 1.0, 0.0, 1.0]));
        assert_eq!(from_hex("#0000FF"), Some([0.0, 0.0, 1.0, 1.0]));
        assert_eq!(from_hex("#FF000080"), Some([1.0, 0.0, 0.0, 0.5019608]));
        assert_eq!(from_hex("invalid"), None);
    }

    #[test]
    fn test_from_rgba_str() {
        assert_eq!(from_rgba_str("rgba(255, 0, 0, 1.0)"), Some([1.0, 0.0, 0.0, 1.0]));
        assert_eq!(from_rgba_str("rgba(0, 255, 0, 0.5)"), Some([0.0, 1.0, 0.0, 0.5]));
    }

    #[test]
    fn test_from_rgb_str() {
        assert_eq!(from_rgb_str("rgb(255, 0, 0)"), Some([1.0, 0.0, 0.0, 1.0]));
    }

    #[test]
    fn test_from_name() {
        assert_eq!(from_name("red"), Some(colors::RED));
        assert_eq!(from_name("RED"), Some(colors::RED));
        assert_eq!(from_name("unknown"), None);
    }

    #[test]
    fn test_parse() {
        assert_eq!(parse("#FF0000"), [1.0, 0.0, 0.0, 1.0]);
        assert_eq!(parse("rgba(255, 0, 0, 1.0)"), [1.0, 0.0, 0.0, 1.0]);
        assert_eq!(parse("rgb(255, 0, 0)"), [1.0, 0.0, 0.0, 1.0]);
        assert_eq!(parse("red"), colors::RED);
        assert_eq!(parse("invalid"), DEFAULT_COLOR);
    }
}
