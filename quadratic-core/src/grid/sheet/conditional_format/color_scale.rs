//! Color scale (gradient) conditional formatting.
//!
//! Color scales apply a gradient of colors to cells based on their numeric values.
//! Unlike formula-based conditional formats that apply a single style when a condition
//! is true, color scales compute a unique color for each cell based on where its value
//! falls within the range.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::color::interpolate_color;

/// Determines how a color scale threshold value is calculated.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub enum ColorScaleThresholdValueType {
    /// Automatically use the minimum value in the selection.
    Min,

    /// Automatically use the maximum value in the selection.
    Max,

    /// Use a fixed numeric value.
    Number(f64),

    /// Use a percentile (0-100) of the values in the selection.
    /// For example, 25 means the 25th percentile.
    Percentile(f64),

    /// Use a percent of the range (0-100).
    /// Calculated as: min + (max - min) * percent / 100
    Percent(f64),
}

impl Default for ColorScaleThresholdValueType {
    fn default() -> Self {
        Self::Number(0.0)
    }
}

/// A single threshold point in a color scale.
/// Each threshold defines a value and the color to use at that value.
/// Colors are interpolated between thresholds.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ColorScaleThreshold {
    /// How to determine the threshold value.
    pub value_type: ColorScaleThresholdValueType,

    /// The color at this threshold (hex format, e.g., "#ff0000").
    pub color: String,
}

impl ColorScaleThreshold {
    /// Creates a new threshold with the given value type and color.
    pub fn new(value_type: ColorScaleThresholdValueType, color: impl Into<String>) -> Self {
        Self {
            value_type,
            color: color.into(),
        }
    }

    /// Creates a threshold that uses the minimum value with the given color.
    pub fn min(color: impl Into<String>) -> Self {
        Self::new(ColorScaleThresholdValueType::Min, color)
    }

    /// Creates a threshold that uses the maximum value with the given color.
    pub fn max(color: impl Into<String>) -> Self {
        Self::new(ColorScaleThresholdValueType::Max, color)
    }

    /// Creates a threshold at a specific number with the given color.
    pub fn number(value: f64, color: impl Into<String>) -> Self {
        Self::new(ColorScaleThresholdValueType::Number(value), color)
    }

    /// Creates a threshold at a percentile with the given color.
    pub fn percentile(percentile: f64, color: impl Into<String>) -> Self {
        Self::new(ColorScaleThresholdValueType::Percentile(percentile), color)
    }

    /// Creates a threshold at a percent of the range with the given color.
    pub fn percent(percent: f64, color: impl Into<String>) -> Self {
        Self::new(ColorScaleThresholdValueType::Percent(percent), color)
    }
}

/// A color scale configuration with arbitrary number of threshold points.
/// Minimum 2 thresholds (min and max), with optional thresholds in between.
/// Thresholds should be ordered from lowest to highest value.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct ColorScale {
    /// The threshold points defining the color scale.
    /// Must have at least 2 thresholds (min and max).
    /// Thresholds should be ordered from lowest to highest value.
    pub thresholds: Vec<ColorScaleThreshold>,

    /// When true, automatically inverts text color (white/black) based on
    /// the fill color's luminance to ensure readability.
    #[serde(default)]
    pub invert_text_on_dark: bool,
}

impl Default for ColorScale {
    /// Creates a default 2-color scale from red (min) to green (max).
    fn default() -> Self {
        Self::two_color("#f8696b", "#63be7b")
    }
}

impl ColorScale {
    /// Creates a 2-color scale from min color to max color.
    pub fn two_color(min_color: impl Into<String>, max_color: impl Into<String>) -> Self {
        Self {
            thresholds: vec![
                ColorScaleThreshold::min(min_color),
                ColorScaleThreshold::max(max_color),
            ],
            invert_text_on_dark: false,
        }
    }

    /// Creates a 3-color scale with a midpoint at the 50th percentile.
    pub fn three_color(
        min_color: impl Into<String>,
        mid_color: impl Into<String>,
        max_color: impl Into<String>,
    ) -> Self {
        Self {
            thresholds: vec![
                ColorScaleThreshold::min(min_color),
                ColorScaleThreshold::percentile(50.0, mid_color),
                ColorScaleThreshold::max(max_color),
            ],
            invert_text_on_dark: false,
        }
    }

    /// Creates a 3-color scale: red (min) → yellow (mid) → green (max).
    pub fn red_yellow_green() -> Self {
        Self::three_color("#f8696b", "#ffeb84", "#63be7b")
    }

    /// Creates a 3-color scale: green (min) → yellow (mid) → red (max).
    pub fn green_yellow_red() -> Self {
        Self::three_color("#63be7b", "#ffeb84", "#f8696b")
    }

    /// Validates that the color scale has at least 2 thresholds.
    pub fn is_valid(&self) -> bool {
        self.thresholds.len() >= 2
    }

    /// Adds a threshold at the specified index.
    pub fn add_threshold(&mut self, index: usize, threshold: ColorScaleThreshold) {
        if index <= self.thresholds.len() {
            self.thresholds.insert(index, threshold);
        }
    }

    /// Removes a threshold at the specified index.
    /// Returns None if removal would leave fewer than 2 thresholds.
    pub fn remove_threshold(&mut self, index: usize) -> Option<ColorScaleThreshold> {
        if self.thresholds.len() > 2 && index < self.thresholds.len() {
            Some(self.thresholds.remove(index))
        } else {
            None
        }
    }
}

/// Compute the interpolated color for a value based on the color scale thresholds.
/// `threshold_values` is a parallel array of the computed numeric values for each threshold.
/// Returns None if the value cannot be mapped (e.g., invalid colors).
///
/// This function handles thresholds in any order (e.g., when Min and Max are swapped
/// to reverse the color gradient). It sorts thresholds by their values internally
/// to correctly interpolate colors.
pub fn compute_color_for_value(
    color_scale: &ColorScale,
    threshold_values: &[f64],
    value: f64,
) -> Option<String> {
    if color_scale.thresholds.len() != threshold_values.len() || threshold_values.is_empty() {
        return None;
    }

    let thresholds = &color_scale.thresholds;
    let n = thresholds.len();

    // Create sorted pairs of (value, color) to handle inverted thresholds
    // (e.g., when user swaps Min and Max to reverse the gradient)
    let mut sorted_pairs: Vec<(f64, &str)> = threshold_values
        .iter()
        .zip(thresholds.iter())
        .map(|(val, thresh)| (*val, thresh.color.as_str()))
        .collect();
    sorted_pairs.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

    // Handle edge cases using sorted values
    if value <= sorted_pairs[0].0 {
        return Some(sorted_pairs[0].1.to_string());
    }
    if value >= sorted_pairs[n - 1].0 {
        return Some(sorted_pairs[n - 1].1.to_string());
    }

    // Find the segment this value falls into using sorted pairs
    for i in 0..(n - 1) {
        let (low_val, low_color) = sorted_pairs[i];
        let (high_val, high_color) = sorted_pairs[i + 1];

        if value >= low_val && value <= high_val {
            // Calculate interpolation factor
            let range = high_val - low_val;
            let t = if range > 0.0 {
                (value - low_val) / range
            } else {
                0.0
            };

            return interpolate_color(low_color, high_color, t);
        }
    }

    // Fallback (shouldn't reach here)
    Some(sorted_pairs[0].1.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::color::parse_hex_color;

    #[test]
    fn test_color_scale_default() {
        let scale = ColorScale::default();
        assert_eq!(scale.thresholds.len(), 2);
        assert!(scale.is_valid());
    }

    #[test]
    fn test_color_scale_two_color() {
        let scale = ColorScale::two_color("#ff0000", "#00ff00");
        assert_eq!(scale.thresholds.len(), 2);
        assert!(matches!(
            scale.thresholds[0].value_type,
            ColorScaleThresholdValueType::Min
        ));
        assert!(matches!(
            scale.thresholds[1].value_type,
            ColorScaleThresholdValueType::Max
        ));
    }

    #[test]
    fn test_color_scale_three_color() {
        let scale = ColorScale::three_color("#ff0000", "#ffff00", "#00ff00");
        assert_eq!(scale.thresholds.len(), 3);
        assert!(matches!(
            scale.thresholds[1].value_type,
            ColorScaleThresholdValueType::Percentile(p) if p == 50.0
        ));
    }

    #[test]
    fn test_add_remove_threshold() {
        let mut scale = ColorScale::two_color("#ff0000", "#00ff00");
        assert_eq!(scale.thresholds.len(), 2);

        // Add a middle threshold
        scale.add_threshold(1, ColorScaleThreshold::percentile(50.0, "#ffff00"));
        assert_eq!(scale.thresholds.len(), 3);

        // Remove the middle threshold
        let removed = scale.remove_threshold(1);
        assert!(removed.is_some());
        assert_eq!(scale.thresholds.len(), 2);

        // Cannot remove below 2 thresholds
        let removed = scale.remove_threshold(0);
        assert!(removed.is_none());
        assert_eq!(scale.thresholds.len(), 2);
    }

    #[test]
    fn test_threshold_constructors() {
        let t = ColorScaleThreshold::min("#ff0000");
        assert!(matches!(t.value_type, ColorScaleThresholdValueType::Min));

        let t = ColorScaleThreshold::max("#00ff00");
        assert!(matches!(t.value_type, ColorScaleThresholdValueType::Max));

        let t = ColorScaleThreshold::number(50.0, "#ffff00");
        assert!(matches!(
            t.value_type,
            ColorScaleThresholdValueType::Number(n) if n == 50.0
        ));

        let t = ColorScaleThreshold::percentile(75.0, "#ff00ff");
        assert!(matches!(
            t.value_type,
            ColorScaleThresholdValueType::Percentile(p) if p == 75.0
        ));

        let t = ColorScaleThreshold::percent(25.0, "#00ffff");
        assert!(matches!(
            t.value_type,
            ColorScaleThresholdValueType::Percent(p) if p == 25.0
        ));
    }

    #[test]
    fn test_compute_color_for_value_two_color() {
        let scale = ColorScale::two_color("#ff0000", "#00ff00");
        let threshold_values = vec![0.0, 100.0];

        // At min
        assert_eq!(
            compute_color_for_value(&scale, &threshold_values, 0.0),
            Some("#ff0000".to_string())
        );
        // At max
        assert_eq!(
            compute_color_for_value(&scale, &threshold_values, 100.0),
            Some("#00ff00".to_string())
        );
        // Below min
        assert_eq!(
            compute_color_for_value(&scale, &threshold_values, -10.0),
            Some("#ff0000".to_string())
        );
        // Above max
        assert_eq!(
            compute_color_for_value(&scale, &threshold_values, 150.0),
            Some("#00ff00".to_string())
        );
        // In middle
        let mid = compute_color_for_value(&scale, &threshold_values, 50.0).unwrap();
        let (r, g, _) = parse_hex_color(&mid).unwrap();
        assert!(r > 100 && r < 150);
        assert!(g > 100 && g < 150);
    }

    #[test]
    fn test_compute_color_for_value_three_color() {
        let scale = ColorScale::three_color("#ff0000", "#ffff00", "#00ff00");
        let threshold_values = vec![0.0, 50.0, 100.0];

        // At min
        assert_eq!(
            compute_color_for_value(&scale, &threshold_values, 0.0),
            Some("#ff0000".to_string())
        );
        // At mid
        assert_eq!(
            compute_color_for_value(&scale, &threshold_values, 50.0),
            Some("#ffff00".to_string())
        );
        // At max
        assert_eq!(
            compute_color_for_value(&scale, &threshold_values, 100.0),
            Some("#00ff00".to_string())
        );
        // Between min and mid (25%) - should be orange-ish
        let quarter = compute_color_for_value(&scale, &threshold_values, 25.0).unwrap();
        let (r, g, _) = parse_hex_color(&quarter).unwrap();
        assert_eq!(r, 255); // Full red
        assert!(g > 100 && g < 150); // Partial green
    }

    #[test]
    fn test_compute_color_for_value_inverted_thresholds() {
        // Test when Min and Max are swapped (user wants to reverse the gradient)
        // Thresholds: [Max (green), Min (red)] with values [100, 0]
        let scale = ColorScale {
            thresholds: vec![
                ColorScaleThreshold::max("#00ff00"), // Green at max (first position)
                ColorScaleThreshold::min("#ff0000"), // Red at min (second position)
            ],
            invert_text_on_dark: false,
        };
        // The threshold_values will be inverted: [100.0, 0.0]
        let threshold_values = vec![100.0, 0.0];

        // At min value (0) - should be red (the color associated with Min)
        assert_eq!(
            compute_color_for_value(&scale, &threshold_values, 0.0),
            Some("#ff0000".to_string()),
            "Value 0 should get red (Min color)"
        );

        // At max value (100) - should be green (the color associated with Max)
        assert_eq!(
            compute_color_for_value(&scale, &threshold_values, 100.0),
            Some("#00ff00".to_string()),
            "Value 100 should get green (Max color)"
        );

        // In middle (50) - should interpolate between red and green
        let mid = compute_color_for_value(&scale, &threshold_values, 50.0).unwrap();
        let (r, g, _) = parse_hex_color(&mid).unwrap();
        assert!(
            r > 100 && r < 150,
            "Middle value should have partial red: got {}",
            r
        );
        assert!(
            g > 100 && g < 150,
            "Middle value should have partial green: got {}",
            g
        );

        // Below min (clamped to min color)
        assert_eq!(
            compute_color_for_value(&scale, &threshold_values, -10.0),
            Some("#ff0000".to_string()),
            "Value below min should clamp to red"
        );

        // Above max (clamped to max color)
        assert_eq!(
            compute_color_for_value(&scale, &threshold_values, 150.0),
            Some("#00ff00".to_string()),
            "Value above max should clamp to green"
        );
    }

    #[test]
    fn test_compute_color_for_value_inverted_three_color() {
        // Test inverted three-color scale: Max -> Mid -> Min
        let scale = ColorScale {
            thresholds: vec![
                ColorScaleThreshold::max("#00ff00"), // Green at max (first)
                ColorScaleThreshold::percentile(50.0, "#ffff00"), // Yellow at mid
                ColorScaleThreshold::min("#ff0000"), // Red at min (last)
            ],
            invert_text_on_dark: false,
        };
        // Threshold values will be: [100.0, 50.0, 0.0] (inverted order)
        let threshold_values = vec![100.0, 50.0, 0.0];

        // At min (0) - should be red
        assert_eq!(
            compute_color_for_value(&scale, &threshold_values, 0.0),
            Some("#ff0000".to_string())
        );

        // At mid (50) - should be yellow
        assert_eq!(
            compute_color_for_value(&scale, &threshold_values, 50.0),
            Some("#ffff00".to_string())
        );

        // At max (100) - should be green
        assert_eq!(
            compute_color_for_value(&scale, &threshold_values, 100.0),
            Some("#00ff00".to_string())
        );
    }
}
