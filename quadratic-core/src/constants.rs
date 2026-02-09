pub const SHEET_NAME: &str = "Sheet";

/// Default pixel width for HTML/code cell output (e.g. charts). Keep in sync with HtmlCell.ts.
pub const DEFAULT_HTML_WIDTH: f32 = 600.0;
/// Default pixel height for HTML/code cell output (e.g. charts). Keep in sync with HtmlCell.ts.
pub const DEFAULT_HTML_HEIGHT: f32 = 460.0;

// Font size adjustment between internal and user-facing values.
// Internal default is 14, user-facing default is 10 (similar to Excel).
// This must match FONT_SIZE_DISPLAY_ADJUSTMENT in gridConstants.ts
pub const FONT_SIZE_DISPLAY_ADJUSTMENT: i16 = -4;
