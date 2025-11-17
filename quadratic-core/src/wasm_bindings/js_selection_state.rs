use crate::{
    Pos,
    a1::{SelectionMode, SelectionState},
};
use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, Copy)]
#[wasm_bindgen]
pub struct JsSelectionState {
    state: SelectionState,
}

#[wasm_bindgen]
impl JsSelectionState {
    #[wasm_bindgen(constructor)]
    pub fn new(
        anchor_x: i64,
        anchor_y: i64,
        selection_end_x: i64,
        selection_end_y: i64,
        mode: u8,
    ) -> Self {
        let anchor = Pos {
            x: anchor_x,
            y: anchor_y,
        };
        let selection_end = Pos {
            x: selection_end_x,
            y: selection_end_y,
        };
        let mode = match mode {
            0 => SelectionMode::KeyboardShift,
            1 => SelectionMode::MouseDrag,
            2 => SelectionMode::MouseShiftClick,
            3 => SelectionMode::MouseCtrlClick,
            4 => SelectionMode::Single,
            _ => SelectionMode::Single,
        };
        Self {
            state: SelectionState {
                anchor,
                selection_end,
                mode,
            },
        }
    }

    #[wasm_bindgen(js_name = "fromSelection")]
    pub fn from_selection(
        selection: &super::js_selection::JsSelection,
        context: &super::js_a1_context::JsA1Context,
    ) -> Self {
        let state =
            SelectionState::from_selection(selection.get_selection(), context.get_context());
        Self { state }
    }

    #[wasm_bindgen(getter)]
    pub fn anchor_x(&self) -> i64 {
        self.state.anchor.x
    }

    #[wasm_bindgen(getter)]
    pub fn anchor_y(&self) -> i64 {
        self.state.anchor.y
    }

    #[wasm_bindgen(getter)]
    pub fn selection_end_x(&self) -> i64 {
        self.state.selection_end.x
    }

    #[wasm_bindgen(getter)]
    pub fn selection_end_y(&self) -> i64 {
        self.state.selection_end.y
    }

    #[wasm_bindgen(getter)]
    pub fn mode(&self) -> u8 {
        match self.state.mode {
            SelectionMode::KeyboardShift => 0,
            SelectionMode::MouseDrag => 1,
            SelectionMode::MouseShiftClick => 2,
            SelectionMode::MouseCtrlClick => 3,
            SelectionMode::Single => 4,
        }
    }

    #[wasm_bindgen(getter)]
    pub fn is_drag(&self) -> bool {
        self.state.is_drag()
    }
}

// Separate impl block for internal methods (not exposed to WASM)
impl JsSelectionState {
    pub(crate) fn get_state(&self) -> SelectionState {
        self.state
    }
}
