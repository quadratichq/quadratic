//! Column and row headings

use crate::sheets::text::FontManager;
use crate::types::{FillBuffer, HeadingsRenderData, LineBuffer};
use crate::viewport::Viewport;

/// Column and row headings
pub struct Headings {
    /// Whether headings are visible
    visible: bool,

    /// Heading width (row header width)
    width: f32,

    /// Heading height (column header height)
    height: f32,

    /// Whether headings are dirty
    dirty: bool,

    /// Debug: show label bounds
    pub debug_label_bounds: bool,

    /// Cached render data
    render_data: Option<HeadingsRenderData>,
}

impl Headings {
    pub fn new() -> Self {
        Self {
            visible: true,
            width: 50.0,
            height: 21.0,
            dirty: true,
            debug_label_bounds: false,
            render_data: None,
        }
    }

    /// Set visibility
    pub fn set_visible(&mut self, visible: bool) {
        if self.visible != visible {
            self.visible = visible;
            self.dirty = true;
        }
    }

    /// Check if visible
    pub fn is_visible(&self) -> bool {
        self.visible
    }

    /// Get heading width
    pub fn width(&self) -> f32 {
        if self.visible {
            self.width
        } else {
            0.0
        }
    }

    /// Get heading height
    pub fn height(&self) -> f32 {
        if self.visible {
            self.height
        } else {
            0.0
        }
    }

    /// Check if dirty
    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    /// Mark as clean
    pub fn mark_clean(&mut self) {
        self.dirty = false;
    }

    /// Mark as dirty
    pub fn mark_dirty(&mut self) {
        self.dirty = true;
    }

    /// Update heading geometry
    pub fn update(
        &mut self,
        _viewport: &Viewport,
        _offsets: &quadratic_core::sheet_offsets::SheetOffsets,
    ) {
        if !self.dirty || !self.visible {
            return;
        }

        // TODO: Generate heading geometry based on viewport and offsets
        self.render_data = Some(HeadingsRenderData {
            corner: FillBuffer::new(),
            column_bg: FillBuffer::new(),
            row_bg: FillBuffer::new(),
            column_text: Vec::new(),
            row_text: Vec::new(),
            dividers: LineBuffer::new(),
            heading_width: self.width,
            heading_height: self.height,
        });

        self.dirty = false;
    }

    /// Layout text (called before rendering)
    pub fn layout(&mut self, _fonts: &FontManager) {
        // TODO: Layout heading text
    }

    /// Get render data
    pub fn get_render_data(&self) -> Option<HeadingsRenderData> {
        self.render_data.clone()
    }
}

impl Default for Headings {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::viewport::Viewport;

    #[test]
    fn test_headings_new() {
        let headings = Headings::new();
        assert!(headings.is_visible());
        assert!(headings.is_dirty());
        assert!(headings.width() > 0.0);
        assert!(headings.height() > 0.0);
    }

    #[test]
    fn test_headings_default() {
        let headings = Headings::default();
        assert!(headings.is_visible());
    }

    #[test]
    fn test_set_visible() {
        let mut headings = Headings::new();
        headings.mark_clean();

        headings.set_visible(false);
        assert!(!headings.is_visible());
        assert!(headings.is_dirty());

        headings.mark_clean();
        headings.set_visible(true);
        assert!(headings.is_visible());
        assert!(headings.is_dirty());
    }

    #[test]
    fn test_set_visible_no_change() {
        let mut headings = Headings::new();
        headings.mark_clean();

        // Setting same visibility should not dirty
        headings.set_visible(true);
        assert!(!headings.is_dirty());
    }

    #[test]
    fn test_width_when_visible() {
        let headings = Headings::new();
        assert!(headings.width() > 0.0);
    }

    #[test]
    fn test_width_when_hidden() {
        let mut headings = Headings::new();
        headings.set_visible(false);
        assert_eq!(headings.width(), 0.0);
    }

    #[test]
    fn test_height_when_visible() {
        let headings = Headings::new();
        assert!(headings.height() > 0.0);
    }

    #[test]
    fn test_height_when_hidden() {
        let mut headings = Headings::new();
        headings.set_visible(false);
        assert_eq!(headings.height(), 0.0);
    }

    #[test]
    fn test_mark_clean_dirty() {
        let mut headings = Headings::new();

        headings.mark_clean();
        assert!(!headings.is_dirty());

        headings.mark_dirty();
        assert!(headings.is_dirty());
    }

    #[test]
    fn test_update_clears_dirty() {
        let mut headings = Headings::new();
        let viewport = Viewport::new();
        let offsets = quadratic_core::sheet_offsets::SheetOffsets::default();

        assert!(headings.is_dirty());

        headings.update(&viewport, &offsets);
        assert!(!headings.is_dirty());
    }

    #[test]
    fn test_update_generates_render_data() {
        let mut headings = Headings::new();
        let viewport = Viewport::new();
        let offsets = quadratic_core::sheet_offsets::SheetOffsets::default();

        assert!(headings.get_render_data().is_none());

        headings.update(&viewport, &offsets);

        assert!(headings.get_render_data().is_some());
    }

    #[test]
    fn test_update_skipped_when_clean() {
        let mut headings = Headings::new();
        let viewport = Viewport::new();
        let offsets = quadratic_core::sheet_offsets::SheetOffsets::default();

        headings.update(&viewport, &offsets);
        headings.mark_clean();

        // This update should be skipped
        headings.update(&viewport, &offsets);
        assert!(!headings.is_dirty());
    }

    #[test]
    fn test_update_skipped_when_hidden() {
        let mut headings = Headings::new();
        let viewport = Viewport::new();
        let offsets = quadratic_core::sheet_offsets::SheetOffsets::default();

        headings.set_visible(false);
        headings.mark_dirty();

        headings.update(&viewport, &offsets);
        // Update still clears dirty flag even when hidden
        // because the hidden state itself means nothing to render
        assert!(headings.is_dirty()); // Stays dirty since render_data isn't generated
    }

    #[test]
    fn test_render_data_has_dimensions() {
        let mut headings = Headings::new();
        let viewport = Viewport::new();
        let offsets = quadratic_core::sheet_offsets::SheetOffsets::default();

        headings.update(&viewport, &offsets);
        let data = headings.get_render_data().unwrap();

        assert!(data.heading_width > 0.0);
        assert!(data.heading_height > 0.0);
    }
}
