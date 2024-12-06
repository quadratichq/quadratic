use crate::grid::formats::{Formats, SheetFormatUpdates};

use super::*;

impl GridController {
    fn set_format(
        a1_formats: &mut SheetFormatUpdates,
        formats: &Formats,
        x1: i64,
        y1: i64,
        x2: Option<i64>,
        y2: Option<i64>,
    ) {
        if let Some(format) = formats.iter_values().next() {
            if let Some(align) = format.align {
                a1_formats
                    .align
                    .get_or_insert_default()
                    .set_rect(x1, y1, x2, y2, Some(align));
            }
            if let Some(vertical_align) = format.vertical_align {
                a1_formats.vertical_align.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2,
                    Some(vertical_align),
                );
            }
            if let Some(wrap) = format.wrap {
                a1_formats
                    .wrap
                    .get_or_insert_default()
                    .set_rect(x1, y1, x2, y2, Some(wrap));
            }
            if let Some(numeric_format) = &format.numeric_format {
                a1_formats.numeric_format.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2,
                    Some(numeric_format.clone()),
                );
            }
            if let Some(numeric_decimals) = format.numeric_decimals {
                a1_formats
                    .numeric_decimals
                    .get_or_insert_default()
                    .set_rect(x1, y1, x2, y2, Some(numeric_decimals));
            }
            if let Some(numeric_commas) = format.numeric_commas {
                a1_formats.numeric_commas.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2,
                    Some(numeric_commas),
                );
            }
            if let Some(bold) = format.bold {
                a1_formats
                    .bold
                    .get_or_insert_default()
                    .set_rect(x1, y1, x2, y2, Some(bold));
            }
            if let Some(italic) = format.italic {
                a1_formats
                    .italic
                    .get_or_insert_default()
                    .set_rect(x1, y1, x2, y2, Some(italic));
            }
            if let Some(text_color) = &format.text_color {
                a1_formats.text_color.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2,
                    Some(text_color.clone()),
                );
            }
            if let Some(fill_color) = &format.fill_color {
                a1_formats.fill_color.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2,
                    Some(fill_color.clone()),
                );
            }
            if let Some(render_size) = &format.render_size {
                a1_formats.render_size.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2,
                    Some(render_size.clone()),
                );
            }
            if let Some(date_time) = &format.date_time {
                a1_formats.date_time.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2,
                    Some(date_time.clone()),
                );
            }
            if let Some(underline) = format.underline {
                a1_formats.underline.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2,
                    Some(underline),
                );
            }
            if let Some(strike_through) = format.strike_through {
                a1_formats.strike_through.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2,
                    Some(strike_through),
                );
            }
        }
    }

    /// Executes SetCellFormatsSelection operation.
    pub fn execute_set_cell_formats_selection(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::SetCellFormatsSelection {
            selection,
            formats: old_formats,
        } = op
        {
            let mut a1_formats = SheetFormatUpdates::default();
            if selection.all {
                GridController::set_format(&mut a1_formats, &old_formats, 1, 1, None, None);
            } else {
                if let Some(columns) = selection.columns {
                    for col in columns {
                        GridController::set_format(
                            &mut a1_formats,
                            &old_formats,
                            col,
                            1,
                            Some(col),
                            None,
                        );
                    }
                }
                if let Some(rows) = selection.rows {
                    for row in rows {
                        GridController::set_format(
                            &mut a1_formats,
                            &old_formats,
                            1,
                            row,
                            None,
                            Some(row),
                        );
                    }
                }
                if let Some(rects) = selection.rects {
                    for rect in rects {
                        GridController::set_format(
                            &mut a1_formats,
                            &old_formats,
                            rect.min.x,
                            rect.min.y,
                            Some(rect.max.x),
                            Some(rect.max.y),
                        );
                    }
                }
            }

            self.execute_set_cell_formats_a1(
                transaction,
                Operation::SetCellFormatsA1 {
                    sheet_id: selection.sheet_id,
                    formats: a1_formats,
                },
            );
        }
    }
}
