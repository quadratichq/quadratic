use std::collections::HashMap;

use crate::grid::block::SameValue;
use crate::grid::borders::cell::CellSide;
use crate::grid::borders::style::BorderStyle;
use crate::grid::js_types::JsRenderBorder;
use crate::grid::{ColumnData, Sheet};

pub fn get_render_vertical_borders(sheet: &Sheet) -> Vec<JsRenderBorder> {
    let borders = &sheet.borders.cell_borders;
    let mut overlapped_borders: HashMap<i64, ColumnData<SameValue<BorderStyle>>> = HashMap::new();

    let column_ids = &sheet.column_ids;
    borders.iter().for_each(|(column_id, column)| {
        let column_index = column_ids
            .index_of(*column_id)
            .expect("Column exists but its index is invalid");

        let left_border_render_index = column_index;
        let right_border_render_index = left_border_render_index + 1;

        // TODO(jrice): Right column overwrites left. Merge them instead somehow
        column.values().for_each(|(y_index, cell_borders)| {
            if let Some(left_style) = cell_borders.get(&CellSide::Left) {
                overlapped_borders
                    .entry(left_border_render_index)
                    .or_default()
                    .set(y_index, Some(left_style.clone()));
            }
            if let Some(right_style) = cell_borders.get(&CellSide::Right) {
                overlapped_borders
                    .entry(right_border_render_index)
                    .or_default()
                    .set(y_index, Some(right_style.clone()));
            }
        });
    });

    overlapped_borders
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

pub fn get_render_horizontal_borders(sheet: &Sheet) -> Vec<JsRenderBorder> {
    let borders = &sheet.borders.cell_borders;
    let mut overlapped_borders: HashMap<i64, ColumnData<SameValue<BorderStyle>>> = HashMap::new();

    let column_ids = &sheet.column_ids;
    borders.iter().for_each(|(column_id, column)| {
        let column_index = column_ids
            .index_of(*column_id)
            .expect("Column exists but its index is invalid");

        println!("Column Index: {column_index}");

        column.values().for_each(|(y_index, cell_borders)| {
            let top_border_render_index = y_index;
            let bottom_border_render_index = top_border_render_index + 1;

            println!("  Render: top={top_border_render_index}, bottom={bottom_border_render_index}");

            if let Some(left_style) = cell_borders.get(&CellSide::Top) {
                overlapped_borders
                    .entry(top_border_render_index)
                    .or_default()
                    .set(column_index, Some(left_style.clone()));
            }
            if let Some(right_style) = cell_borders.get(&CellSide::Bottom) {
                overlapped_borders
                    .entry(bottom_border_render_index)
                    .or_default()
                    .set(column_index, Some(right_style.clone()));
            }
        });
    });

    overlapped_borders
        .iter()
        .flat_map(|(&column_index, column)| {
            column.blocks().map(move |block| JsRenderBorder {
                x: block.start(),
                y: column_index,
                w: Some(block.len()),
                h: None,
                style: block.content().value.clone(),
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::color::Rgb;
    use crate::grid::borders::sheet::set_region_border_selection;
    use crate::grid::{BorderSelection, CellBorderLine, SheetId};
    use crate::{Pos, Rect};
    use std::collections::HashSet;

    mod vertical {
        use super::*;

        #[test]
        fn single_block() {
            let mut sheet = Sheet::new(SheetId::new(), "Test Sheet".to_string(), "".to_string());
            let rect = Rect::new_span(Pos { x: 3, y: 10 }, Pos { x: 6, y: 15 });
            let region = sheet.region(rect);

            let selection = vec![BorderSelection::All];

            let style = BorderStyle {
                color: Rgb::from_str("#000000").unwrap(),
                line: CellBorderLine::Line1,
            };

            set_region_border_selection(&mut sheet, &region, selection, Some(style));

            let vertical_render = get_render_vertical_borders(&sheet);

            let expected_render: HashSet<_> = (3..=7)
                .map(|x| Pos { x, y: 10 })
                .map(|start| JsRenderBorder::new(start.x, start.y, None, Some(6), style))
                .collect();

            let actual_render = HashSet::from_iter(vertical_render.iter().cloned());

            assert_eq!(actual_render, expected_render);
        }

        #[test]
        fn two_blocks_merge_for_render() {
            let mut sheet = Sheet::new(SheetId::new(), "Test Sheet".to_string(), "".to_string());
            let rect_1 = Rect::new_span(Pos { x: 3, y: 10 }, Pos { x: 4, y: 10 });
            let rect_2 = Rect::new_span(Pos { x: 4, y: 11 }, Pos { x: 5, y: 11 });

            let region_1 = sheet.region(rect_1);
            let region_2 = sheet.region(rect_2);

            let selection_1 = vec![BorderSelection::All];
            let selection_2 = selection_1.clone();

            let style = BorderStyle {
                color: Rgb::from_str("#000000").unwrap(),
                line: CellBorderLine::Line1,
            };

            set_region_border_selection(&mut sheet, &region_1, selection_1, Some(style));
            set_region_border_selection(&mut sheet, &region_2, selection_2, Some(style));

            let vertical_render = get_render_vertical_borders(&sheet);

            let expected_render = HashSet::from([
                JsRenderBorder::new(3, 10, None, Some(1), style),
                JsRenderBorder::new(4, 10, None, Some(2), style),
                JsRenderBorder::new(5, 10, None, Some(2), style),
                JsRenderBorder::new(6, 11, None, Some(1), style),
            ]);

            let actual_render = HashSet::from_iter(vertical_render.iter().cloned());

            assert_eq!(actual_render, expected_render);
        }

        #[test]
        fn two_vertical_blocks_with_gap() {
            let mut sheet = Sheet::new(SheetId::new(), "Test Sheet".to_string(), "".to_string());
            let rect_1 = Rect::new_span(Pos { x: 3, y: 10 }, Pos { x: 6, y: 15 });
            let rect_2 = Rect::new_span(Pos { x: 3, y: 17 }, Pos { x: 9, y: 20 });

            let region_1 = sheet.region(rect_1);
            let region_2 = sheet.region(rect_2);

            let selection_1 = vec![BorderSelection::All];
            let selection_2 = selection_1.clone();

            let style = BorderStyle {
                color: Rgb::from_str("#000000").unwrap(),
                line: CellBorderLine::Line1,
            };

            set_region_border_selection(&mut sheet, &region_1, selection_1, Some(style));
            set_region_border_selection(&mut sheet, &region_2, selection_2, Some(style));

            let vertical_render = get_render_vertical_borders(&sheet);

            let in_top_block: Vec<_> = vertical_render
                .iter()
                .filter(|render_border| {
                    render_border.h.is_some_and(|h| h as u32 == rect_1.height())
                })
                .collect();
            assert_eq!(in_top_block.len() as u32, rect_1.width() + 1);

            let in_bottom_block: Vec<_> = vertical_render
                .iter()
                .filter(|render_border| {
                    render_border.h.is_some_and(|h| h as u32 == rect_2.height())
                })
                .collect();
            assert_eq!(in_bottom_block.len() as u32, rect_2.width() + 1);

            assert_eq!(
                vertical_render.len(),
                in_top_block.len() + in_bottom_block.len()
            );
        }

        #[test]
        fn insert_different_color_border_across_block() {
            let mut sheet = Sheet::new(SheetId::new(), "Test Sheet".to_string(), "".to_string());
            let rect_1 = Rect::new_span(Pos { x: 3, y: 10 }, Pos { x: 6, y: 15 });
            let rect_2 = Rect::new_span(Pos { x: 2, y: 11 }, Pos { x: 7, y: 14 });

            let region_1 = sheet.region(rect_1);
            let region_2 = sheet.region(rect_2);

            let selection_1 = vec![BorderSelection::All];
            let selection_2 = selection_1.clone();

            let style_1 = BorderStyle {
                color: Rgb::from_str("#000000").unwrap(),
                line: CellBorderLine::Line1,
            };
            let style_2 = BorderStyle {
                color: Rgb::from_str("#FFFFFF").unwrap(),
                line: CellBorderLine::Line1,
            };

            set_region_border_selection(&mut sheet, &region_1, selection_1, Some(style_1));
            set_region_border_selection(&mut sheet, &region_2, selection_2, Some(style_2));

            let vertical_render = get_render_vertical_borders(&sheet);

            let expected_top_block_starts = (3..=7).map(|x| Pos { x, y: 10 });
            let expected_middle_block_starts = (2..=8).map(|x| Pos { x, y: 11 });
            let expected_bottom_block_starts = (3..=7).map(|x| Pos { x, y: 15 });

            let expected_starts: HashSet<_> = expected_top_block_starts
                .chain(expected_middle_block_starts.chain(expected_bottom_block_starts))
                .collect();

            let actual_starts: HashSet<_> = vertical_render
                .iter()
                .map(|border| Pos {
                    x: border.x,
                    y: border.y,
                })
                .collect();

            assert_eq!(expected_starts, actual_starts);
        }
    }

    mod horizontal {
        use super::*;

        #[test]
        fn single_block() {
            let mut sheet = Sheet::new(SheetId::new(), "Test Sheet".to_string(), "".to_string());
            let rect = Rect::new_span(Pos { x: 3, y: 10 }, Pos { x: 6, y: 15 });
            let region = sheet.region(rect);

            let selection = vec![BorderSelection::All];

            let style = BorderStyle {
                color: Rgb::from_str("#000000").unwrap(),
                line: CellBorderLine::Line1,
            };

            set_region_border_selection(&mut sheet, &region, selection, Some(style));

            let horizontal_render = get_render_horizontal_borders(&sheet);

            let expected_render: HashSet<_> = (10..=16)
                .map(|y| Pos { x: 3, y })
                .map(|start| JsRenderBorder::new(start.x, start.y, Some(4), None, style))
                .collect();

            let actual_render = HashSet::from_iter(horizontal_render.iter().cloned());

            assert_eq!(actual_render, expected_render);
        }

        #[test]
        fn two_blocks_merge_for_render() {
            let mut sheet = Sheet::new(SheetId::new(), "Test Sheet".to_string(), "".to_string());
            let rect_1 = Rect::new_span(Pos { x: 3, y: 10 }, Pos { x: 3, y: 11 });
            let rect_2 = Rect::new_span(Pos { x: 4, y: 11 }, Pos { x: 4, y: 12 });

            let region_1 = sheet.region(rect_1);
            let region_2 = sheet.region(rect_2);

            let selection_1 = vec![BorderSelection::All];
            let selection_2 = selection_1.clone();

            let style = BorderStyle {
                color: Rgb::from_str("#000000").unwrap(),
                line: CellBorderLine::Line1,
            };

            set_region_border_selection(&mut sheet, &region_1, selection_1, Some(style));
            set_region_border_selection(&mut sheet, &region_2, selection_2, Some(style));

            let horizontal_render = get_render_horizontal_borders(&sheet);

            let expected_render = HashSet::from([
                JsRenderBorder::new(3, 10, Some(1), None, style),
                JsRenderBorder::new(3, 11, Some(2), None, style),
                JsRenderBorder::new(3, 12, Some(2), None, style),
                JsRenderBorder::new(4, 13, Some(1), None, style),
            ]);

            let actual_render = HashSet::from_iter(horizontal_render.iter().cloned());

            assert_eq!(actual_render, expected_render);
        }

        #[test]
        fn two_horizontal_blocks_with_gap() {
            let mut sheet = Sheet::new(SheetId::new(), "Test Sheet".to_string(), "".to_string());
            let rect_1 = Rect::new_span(Pos { x: 3, y: 10 }, Pos { x: 5, y: 13 });
            let rect_2 = Rect::new_span(Pos { x: 7, y: 10 }, Pos { x: 10, y: 15 });

            let region_1 = sheet.region(rect_1);
            let region_2 = sheet.region(rect_2);

            let selection_1 = vec![BorderSelection::All];
            let selection_2 = selection_1.clone();

            let style = BorderStyle {
                color: Rgb::from_str("#000000").unwrap(),
                line: CellBorderLine::Line1,
            };

            set_region_border_selection(&mut sheet, &region_1, selection_1, Some(style));
            set_region_border_selection(&mut sheet, &region_2, selection_2, Some(style));

            let horizontal_render = get_render_horizontal_borders(&sheet);

            let in_left_block: Vec<_> = horizontal_render
                .iter()
                .filter(|render_border| {
                    render_border.w.is_some_and(|w| w as u32 == rect_1.width())
                })
                .collect();
            assert_eq!(in_left_block.len() as u32, rect_1.height() + 1);

            let in_right_block: Vec<_> = horizontal_render
                .iter()
                .filter(|render_border| {
                    render_border.w.is_some_and(|w| w as u32 == rect_2.width())
                })
                .collect();
            assert_eq!(in_right_block.len() as u32, rect_2.height() + 1);

            assert_eq!(
                horizontal_render.len(),
                in_left_block.len() + in_right_block.len()
            );
        }

        #[test]
        fn insert_different_color_border_across_block() {
            let mut sheet = Sheet::new(SheetId::new(), "Test Sheet".to_string(), "".to_string());
            let rect_1 = Rect::new_span(Pos { x: 2, y: 11 }, Pos { x: 7, y: 14 });
            let rect_2 = Rect::new_span(Pos { x: 3, y: 10 }, Pos { x: 6, y: 15 });

            let region_1 = sheet.region(rect_1);
            let region_2 = sheet.region(rect_2);

            let selection_1 = vec![BorderSelection::All];
            let selection_2 = selection_1.clone();

            let style_1 = BorderStyle {
                color: Rgb::from_str("#FFFFFF").unwrap(),
                line: CellBorderLine::Line1,
            };
            let style_2 = BorderStyle {
                color: Rgb::from_str("#000000").unwrap(),
                line: CellBorderLine::Line1,
            };

            set_region_border_selection(&mut sheet, &region_1, selection_2, Some(style_1));
            set_region_border_selection(&mut sheet, &region_2, selection_1, Some(style_2));

            let horizontal_render = get_render_horizontal_borders(&sheet);

            let expected_left_block_starts = (11..=15).map(|y| Pos { x: 2 , y });
            let expected_middle_block_starts = (10..=16).map(|y| Pos { x: 3, y });
            let expected_right_block_starts = (11..=15).map(|y| Pos { x: 7, y });

            let expected_starts: HashSet<_> = expected_left_block_starts
                .chain(expected_middle_block_starts.chain(expected_right_block_starts))
                .collect();

            let actual_starts: HashSet<_> = horizontal_render
                .iter()
                .map(|border| Pos {
                    x: border.x,
                    y: border.y,
                })
                .collect();

            assert_eq!(expected_starts, actual_starts);
        }
    }
}
