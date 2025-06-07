use wasm_bindgen::prelude::*;

use crate::{
    Pos, SheetPos,
    grid::{SheetId, sheet::data_tables::cache::SheetDataTablesCache},
    input::{Direction, jump::jump_cursor, move_cursor::move_cursor},
    wasm_bindings::{js_a1_context::JsA1Context, sheet_content_cache::SheetContentCache},
};

/// Returns the SheetPos after a jump (ctrl/cmd + arrow key)
#[wasm_bindgen(js_name = "jumpCursor")]
pub fn js_jump_cursor(
    sheet_id: SheetId,
    col: i32,
    row: i32,
    direction: Direction,
    content_cache: &SheetContentCache,
    table_cache: &SheetDataTablesCache,
    context: &JsA1Context,
) -> Pos {
    let sheet_pos = SheetPos {
        x: col as i64,
        y: row as i64,
        sheet_id,
    };
    jump_cursor(
        sheet_pos,
        direction,
        content_cache,
        table_cache,
        context.get_context(),
    )
}

/// Returns the SheetPos after a move (arrow key)
#[wasm_bindgen(js_name = "moveCursor")]
pub fn js_move_cursor(
    sheet_id: SheetId,
    col: i32,
    row: i32,
    direction: Direction,
    table_cache: &SheetDataTablesCache,
    context: &JsA1Context,
) -> Pos {
    let pos = SheetPos {
        x: col as i64,
        y: row as i64,
        sheet_id,
    };
    move_cursor(pos, direction, table_cache, context.get_context())
}
