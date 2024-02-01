use crate::grid::js_types::JsRenderBorder;
use crate::grid::Sheet;

pub fn get_render_vertical_borders(sheet: &Sheet) -> Vec<JsRenderBorder> {
    sheet
        .borders
        .render_lookup
        .vertical
        .iter()
        .flat_map(|(&column_index, column)| {
            column.blocks().map(move |block| JsRenderBorder {
                x: column_index,
                y: block.start(),
                w: None,
                h: Some(block.len()),
                style: block.content().value,
            })
        })
        .collect()
}

pub fn get_render_horizontal_borders(sheet: &Sheet) -> Vec<JsRenderBorder> {
    sheet
        .borders
        .render_lookup
        .horizontal
        .iter()
        .flat_map(|(&column_index, column)| {
            column.blocks().map(move |block| JsRenderBorder {
                x: block.start(),
                y: column_index,
                w: Some(block.len()),
                h: None,
                style: block.content().value,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::color::Rgba;
    use crate::grid::borders::sheet::set_rect_border_selection;
    use crate::grid::{BorderSelection, BorderStyle, CellBorderLine, SheetId};
    use crate::{Pos, Rect};

    use super::*;

    // mod timing {
    //     use super::*;
    //
    //     #[test]
    //     fn single_block() {
    //         for _ in 0..5 {
    //             let mut sheet =
    //                 Sheet::new(SheetId::new(), "Test Sheet".to_string(), "".to_string());
    //             let rect = Rect::new_span(Pos { x: 3, y: 10 }, Pos { x: 506, y: 515 });
    //             let (region, _) = sheet.region(rect);
    //
    //             let selection = vec![BorderSelection::All];
    //
    //             let style = BorderStyle {
    //                 color: Rgb::from_str("#000000").unwrap(),
    //                 line: CellBorderLine::Line1,
    //             };
    //
    //             let timer = Instant::now();
    //             set_region_border_selection(&mut sheet, &region, selection, Some(style));
    //
    //             let vertical_render = get_render_vertical_borders(&sheet);
    //             let horizontal_render = get_render_horizontal_borders(&sheet);
    //             let elapsed = timer.elapsed();
    //             println!("Total: {elapsed:?}");
    //         }
    //     }
    // }

    mod vertical {
        use crate::grid::set_rect_borders;

        use super::*;

        #[test]
        fn single_block() {
            let mut sheet = Sheet::new(SheetId::new(), "Test Sheet".to_string(), "".to_string());
            let rect = Rect::new_span(Pos { x: 3, y: 10 }, Pos { x: 6, y: 15 });

            let selection = vec![BorderSelection::All];

            let style = BorderStyle {
                color: Rgba::from_str("#000000").unwrap(),
                line: CellBorderLine::Line1,
            };

            set_rect_border_selection(&mut sheet, &rect, selection, Some(style));

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

            let selection_1 = vec![BorderSelection::All];
            let selection_2 = selection_1.clone();

            let style = BorderStyle {
                color: Rgba::from_str("#000000").unwrap(),
                line: CellBorderLine::Line1,
            };

            set_rect_border_selection(&mut sheet, &rect_1, selection_1, Some(style));
            set_rect_border_selection(&mut sheet, &rect_2, selection_2, Some(style));

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

            let selection_1 = vec![BorderSelection::All];
            let selection_2 = selection_1.clone();

            let style = BorderStyle {
                color: Rgba::from_str("#000000").unwrap(),
                line: CellBorderLine::Line1,
            };

            set_rect_border_selection(&mut sheet, &rect_1, selection_1, Some(style));
            set_rect_border_selection(&mut sheet, &rect_2, selection_2, Some(style));

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

            let selection_1 = vec![BorderSelection::All];
            let selection_2 = selection_1.clone();

            let style_1 = BorderStyle {
                color: Rgba::from_str("#000000").unwrap(),
                line: CellBorderLine::Line1,
            };
            let style_2 = BorderStyle {
                color: Rgba::from_str("#FFFFFF").unwrap(),
                line: CellBorderLine::Line1,
            };

            set_rect_border_selection(&mut sheet, &rect_1, selection_1, Some(style_1));
            set_rect_border_selection(&mut sheet, &rect_2, selection_2, Some(style_2));

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

        #[test]
        fn undo_horizontal_adjacent_insertion() {
            let mut sheet = Sheet::new(SheetId::new(), "Test Sheet".to_string(), "".to_string());
            let rect_1 = Rect::new_span(Pos { x: 3, y: 10 }, Pos { x: 4, y: 11 });
            let rect_2 = Rect::new_span(Pos { x: 5, y: 10 }, Pos { x: 6, y: 11 });

            let selection_1 = vec![BorderSelection::All];
            let selection_2 = selection_1.clone();

            let style = BorderStyle {
                color: Rgba::from_str("#000000").unwrap(),
                line: CellBorderLine::Line1,
            };

            set_rect_border_selection(&mut sheet, &rect_1, selection_1, Some(style));
            let vertical_render_initial = get_render_vertical_borders(&sheet);

            let replaced = set_rect_border_selection(&mut sheet, &rect_2, selection_2, Some(style));

            set_rect_borders(&mut sheet, &rect_2, replaced); // Undo
            let vertical_render_after_undo = get_render_vertical_borders(&sheet);

            assert_eq!(
                vertical_render_initial.len(),
                vertical_render_after_undo.len()
            );
            for initial in &vertical_render_initial {
                assert!(vertical_render_after_undo.contains(initial));
            }
        }

        #[test]
        fn undo_insert_different_color_border_across_block() {
            let mut sheet = Sheet::new(SheetId::new(), "Test Sheet".to_string(), "".to_string());
            let rect_1 = Rect::new_span(Pos { x: 3, y: 10 }, Pos { x: 6, y: 15 });
            let rect_2 = Rect::new_span(Pos { x: 2, y: 11 }, Pos { x: 7, y: 14 });

            let selection_1 = vec![BorderSelection::All];
            let selection_2 = selection_1.clone();

            let style_1 = BorderStyle {
                color: Rgba::from_str("#000000").unwrap(),
                line: CellBorderLine::Line1,
            };
            let style_2 = BorderStyle {
                color: Rgba::from_str("#FFFFFF").unwrap(),
                line: CellBorderLine::Line1,
            };

            set_rect_border_selection(&mut sheet, &rect_1, selection_1, Some(style_1));
            let vertical_render_initial = get_render_vertical_borders(&sheet);

            let replaced =
                set_rect_border_selection(&mut sheet, &rect_2, selection_2, Some(style_2));

            set_rect_borders(&mut sheet, &rect_2, replaced); // Undo
            let vertical_render_after_undo = get_render_vertical_borders(&sheet);

            assert_eq!(
                vertical_render_initial.len(),
                vertical_render_after_undo.len()
            );
            for initial in &vertical_render_initial {
                assert!(vertical_render_after_undo.contains(initial));
            }
        }
    }

    mod horizontal {
        use crate::grid::set_rect_borders;

        use super::*;

        #[test]
        fn single_block() {
            let mut sheet = Sheet::new(SheetId::new(), "Test Sheet".to_string(), "".to_string());
            let rect = Rect::new_span(Pos { x: 3, y: 10 }, Pos { x: 6, y: 15 });

            let selection = vec![BorderSelection::All];

            let style = BorderStyle {
                color: Rgba::from_str("#000000").unwrap(),
                line: CellBorderLine::Line1,
            };

            set_rect_border_selection(&mut sheet, &rect, selection, Some(style));

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

            let selection_1 = vec![BorderSelection::All];
            let selection_2 = selection_1.clone();

            let style = BorderStyle {
                color: Rgba::from_str("#000000").unwrap(),
                line: CellBorderLine::Line1,
            };

            set_rect_border_selection(&mut sheet, &rect_1, selection_1, Some(style));
            set_rect_border_selection(&mut sheet, &rect_2, selection_2, Some(style));

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

            let selection_1 = vec![BorderSelection::All];
            let selection_2 = selection_1.clone();

            let style = BorderStyle {
                color: Rgba::from_str("#000000").unwrap(),
                line: CellBorderLine::Line1,
            };

            set_rect_border_selection(&mut sheet, &rect_1, selection_1, Some(style));
            set_rect_border_selection(&mut sheet, &rect_2, selection_2, Some(style));

            let horizontal_render = get_render_horizontal_borders(&sheet);

            let in_left_block: Vec<_> = horizontal_render
                .iter()
                .filter(|render_border| render_border.w.is_some_and(|w| w as u32 == rect_1.width()))
                .collect();
            assert_eq!(in_left_block.len() as u32, rect_1.height() + 1);

            let in_right_block: Vec<_> = horizontal_render
                .iter()
                .filter(|render_border| render_border.w.is_some_and(|w| w as u32 == rect_2.width()))
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

            let selection_1 = vec![BorderSelection::All];
            let selection_2 = selection_1.clone();

            let style_1 = BorderStyle {
                color: Rgba::from_str("#FFFFFF").unwrap(),
                line: CellBorderLine::Line1,
            };
            let style_2 = BorderStyle {
                color: Rgba::from_str("#000000").unwrap(),
                line: CellBorderLine::Line1,
            };

            set_rect_border_selection(&mut sheet, &rect_1, selection_1, Some(style_1));
            set_rect_border_selection(&mut sheet, &rect_2, selection_2, Some(style_2));

            let horizontal_render = get_render_horizontal_borders(&sheet);

            let expected_left_block_starts = (11..=15).map(|y| Pos { x: 2, y });
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

        #[test]
        fn undo_insert_different_color_border_across_block() {
            let mut sheet = Sheet::new(SheetId::new(), "Test Sheet".to_string(), "".to_string());
            let rect_1 = Rect::new_span(Pos { x: 2, y: 11 }, Pos { x: 7, y: 14 });
            let rect_2 = Rect::new_span(Pos { x: 3, y: 10 }, Pos { x: 6, y: 15 });

            let selection_1 = vec![BorderSelection::All];
            let selection_2 = selection_1.clone();

            let style_1 = BorderStyle {
                color: Rgba::from_str("#FFFFFF").unwrap(),
                line: CellBorderLine::Line1,
            };
            let style_2 = BorderStyle {
                color: Rgba::from_str("#000000").unwrap(),
                line: CellBorderLine::Line1,
            };

            set_rect_border_selection(&mut sheet, &rect_1, selection_1, Some(style_1));
            let horizontal_render_initial = get_render_horizontal_borders(&sheet);

            let replaced =
                set_rect_border_selection(&mut sheet, &rect_2, selection_2, Some(style_2));

            set_rect_borders(&mut sheet, &rect_2, replaced); // Undo
            let horizontal_render_after_undo = get_render_horizontal_borders(&sheet);

            assert_eq!(
                horizontal_render_initial.len(),
                horizontal_render_after_undo.len()
            );
            for initial in &horizontal_render_initial {
                assert!(horizontal_render_after_undo.contains(initial));
            }
        }
    }
}
