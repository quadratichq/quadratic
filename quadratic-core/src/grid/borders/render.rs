use std::collections::HashMap;

use crate::grid::block::SameValue;
use crate::grid::borders::cell::CellSide;
use crate::grid::borders::style::BorderStyle;
use crate::grid::js_types::JsRenderBorder;
use crate::grid::{ColumnData, Sheet};

// TODO: Tests, validate longest possible line is returned
pub fn get_render_vertical_borders(sheet: &Sheet) -> Vec<JsRenderBorder> {
    let borders = &sheet.borders.cell_borders;
    let mut render_borders: HashMap<i64, ColumnData<SameValue<BorderStyle>>> = HashMap::new();

    let column_ids = &sheet.column_ids;
    borders.iter().for_each(|(right_col_id, right_col)| {
        let right_col_index = column_ids
            .index_of(*right_col_id)
            .expect("Column exists but its index is invalid");
        let _left_col_index = right_col_index - 1;
        let render_column = render_borders.entry(right_col_index).or_default();
        right_col.values().for_each(|(y_index, cell_borders)| {
            let side_style = cell_borders.get(&CellSide::Left);
            render_column.set(y_index, side_style.cloned());
        });
    });

    render_borders
        .iter()
        .flat_map(|(&column_index, column)| {
            column.blocks().map(move |block| JsRenderBorder {
                x: column_index,
                y: block.start(),
                w: None,
                h: Some(block.len()),
                style: block.content().value.clone(),
            })
        })
        .collect()
}
//     pub fn get_render_horizontal_borders(&self) -> Vec<JsRenderBorder> {
//         self.horizontal
//             .iter()
//             .flat_map(|(&y, row)| {
//                 row.blocks().map(move |block| JsRenderBorder {
//                     x: block.start(),
//                     y,
//                     w: Some(block.len()),
//                     h: None,
//                     style: LegacyCellBorder::from_border_style(&block.content().value),
//                 })
//             })
//             .collect()
//     }
//     pub fn get_render_vertical_borders(&self) -> Vec<JsRenderBorder> {
//         self.vertical
//             .iter()
//             .flat_map(|(&x, column)| {
//                 column.blocks().map(move |block| JsRenderBorder {
//                     x,
//                     y: block.start(),
//                     w: None,
//                     h: Some(block.len()),
//                     style: LegacyCellBorder::from_border_style(&block.content().value),
//                 })
//             })
//             .collect()
//     }
