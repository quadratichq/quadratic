use crate::grid::formats::{Formats, SheetFormatUpdates};

use super::*;

impl GridController {
    fn migrate_formats(
        formats_a1: &mut SheetFormatUpdates,
        formats: &Formats,
        x1: i64,
        y1: i64,
        x2: Option<i64>,
        y2: Option<i64>,
    ) {
        if let Some(format) = formats.iter_values().next() {
            if let Some(align) = format.align {
                formats_a1.align.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2,
                    Some(align.into()),
                );
            }
            if let Some(vertical_align) = format.vertical_align {
                formats_a1.vertical_align.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2,
                    Some(vertical_align.into()),
                );
            }
            if let Some(wrap) = format.wrap {
                formats_a1
                    .wrap
                    .get_or_insert_default()
                    .set_rect(x1, y1, x2, y2, Some(wrap.into()));
            }
            if let Some(numeric_format) = &format.numeric_format {
                formats_a1.numeric_format.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2,
                    Some(numeric_format.clone().into()),
                );
            }
            if let Some(numeric_decimals) = format.numeric_decimals {
                formats_a1
                    .numeric_decimals
                    .get_or_insert_default()
                    .set_rect(x1, y1, x2, y2, Some(numeric_decimals.into()));
            }
            if let Some(numeric_commas) = format.numeric_commas {
                formats_a1.numeric_commas.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2,
                    Some(numeric_commas.into()),
                );
            }
            if let Some(bold) = format.bold {
                formats_a1
                    .bold
                    .get_or_insert_default()
                    .set_rect(x1, y1, x2, y2, Some(bold.into()));
            }
            if let Some(italic) = format.italic {
                formats_a1.italic.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2,
                    Some(italic.into()),
                );
            }
            if let Some(text_color) = &format.text_color {
                formats_a1.text_color.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2,
                    Some(text_color.clone().into()),
                );
            }
            if let Some(fill_color) = &format.fill_color {
                formats_a1.fill_color.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2,
                    Some(fill_color.clone().into()),
                );
            }
            if let Some(date_time) = &format.date_time {
                formats_a1.date_time.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2,
                    Some(date_time.clone().into()),
                );
            }
            if let Some(underline) = format.underline {
                formats_a1.underline.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2,
                    Some(underline.into()),
                );
            }
            if let Some(strike_through) = format.strike_through {
                formats_a1.strike_through.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2,
                    Some(strike_through.into()),
                );
            }
        }
    }

    /// Executes SetCellFormatsSelection operation.
    pub(crate) fn execute_set_cell_formats_selection(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::SetCellFormatsSelection {
            selection,
            formats: old_formats,
        } = op
        {
            let mut formats_a1 = SheetFormatUpdates::default();
            if selection.all {
                GridController::migrate_formats(&mut formats_a1, &old_formats, 1, 1, None, None);
            } else {
                if let Some(columns) = selection.columns {
                    for col in columns {
                        GridController::migrate_formats(
                            &mut formats_a1,
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
                        GridController::migrate_formats(
                            &mut formats_a1,
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
                        GridController::migrate_formats(
                            &mut formats_a1,
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
                    formats: formats_a1,
                },
            );
        }
    }
}
