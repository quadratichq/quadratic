//! Headings layout (column/row headers)

use quadratic_core_shared::SheetOffsets;
use quadratic_renderer_core::HeadingsRenderData;

use crate::sheets::text::BitmapFonts;
use crate::viewport::Viewport;

/// Heading size in pixels
const HEADING_WIDTH: f32 = 46.0;
const HEADING_HEIGHT: f32 = 21.0;

/// Headings layout
#[derive(Default)]
pub struct HeadingsLayout {
    pub dirty: bool,

    /// Whether headings are visible
    pub visible: bool,

    /// Selected columns [start, end] pairs
    selected_columns: Vec<(i64, i64)>,

    /// Selected rows [start, end] pairs
    selected_rows: Vec<(i64, i64)>,

    /// DPR for font sizing
    dpr: f32,

    /// Cached render data
    cached_data: Option<HeadingsRenderData>,
}

impl HeadingsLayout {
    pub fn new() -> Self {
        Self {
            dirty: true,
            visible: true,
            selected_columns: Vec::new(),
            selected_rows: Vec::new(),
            dpr: 1.0,
            cached_data: None,
        }
    }

    pub fn set_visible(&mut self, visible: bool) {
        self.visible = visible;
        self.dirty = true;
    }

    pub fn set_selected_columns(&mut self, selections: Vec<(i64, i64)>) {
        self.selected_columns = selections;
        self.dirty = true;
    }

    pub fn set_selected_rows(&mut self, selections: Vec<(i64, i64)>) {
        self.selected_rows = selections;
        self.dirty = true;
    }

    pub fn set_dpr(&mut self, dpr: f32) {
        self.dpr = dpr;
        self.dirty = true;
    }

    pub fn set_dirty(&mut self) {
        self.dirty = true;
    }

    pub fn heading_size(&self) -> (f32, f32) {
        if self.visible {
            (HEADING_WIDTH, HEADING_HEIGHT)
        } else {
            (0.0, 0.0)
        }
    }

    pub fn update(&mut self, _viewport: &Viewport, _offsets: &SheetOffsets) {
        // Basic update - full implementation would generate text meshes
        if !self.dirty {
            return;
        }

        // TODO: Generate heading text meshes
        self.dirty = false;
    }

    pub fn layout(&mut self, _fonts: &BitmapFonts) {
        // TODO: Layout heading text
    }

    pub fn get_render_data(&self) -> Option<&HeadingsRenderData> {
        self.cached_data.as_ref()
    }

    pub fn take_render_data(&mut self) -> Option<HeadingsRenderData> {
        self.cached_data.take()
    }
}
