//! Rust-native cell rendering that produces RenderCell directly.
//!
//! This mirrors the logic in `rendering/cells.rs` but produces `RenderCell`
//! from `quadratic-core-shared` directly, eliminating conversion overhead.

use crate::{
    CellValue, Pos, Rect, RunError, RunErrorMsg,
    a1::A1Context,
    grid::{CellWrap, CodeCellLanguage, DataTable, Format, Sheet},
};
use quadratic_core_shared::{
    CellAlign, CellVerticalAlign, CellWrap as SharedCellWrap, NumericFormat, NumericFormatKind,
    RenderCell, RenderCellFormatSpan, RenderCellLinkSpan, RenderCellSpecial, RenderNumber, Rgba,
};

/// Parse a CSS color string to Rgba.
/// Supports hex (#RGB, #RRGGBB, #RRGGBBAA) and rgb()/rgba() formats.
fn parse_color(color: &str) -> Rgba {
    Rgba::from_css(color).unwrap_or(Rgba::TRANSPARENT)
}

/// Convert core CellAlign to shared CellAlign
fn convert_align(align: crate::grid::CellAlign) -> CellAlign {
    match align {
        crate::grid::CellAlign::Left => CellAlign::Left,
        crate::grid::CellAlign::Center => CellAlign::Center,
        crate::grid::CellAlign::Right => CellAlign::Right,
    }
}

/// Convert core CellVerticalAlign to shared CellVerticalAlign
fn convert_vertical_align(align: crate::grid::CellVerticalAlign) -> CellVerticalAlign {
    match align {
        crate::grid::CellVerticalAlign::Top => CellVerticalAlign::Top,
        crate::grid::CellVerticalAlign::Middle => CellVerticalAlign::Middle,
        crate::grid::CellVerticalAlign::Bottom => CellVerticalAlign::Bottom,
    }
}

/// Convert core CellWrap to shared CellWrap
fn convert_wrap(wrap: CellWrap) -> SharedCellWrap {
    match wrap {
        CellWrap::Wrap => SharedCellWrap::Wrap,
        CellWrap::Clip => SharedCellWrap::Clip,
        CellWrap::Overflow => SharedCellWrap::Overflow,
    }
}

/// Convert core NumericFormat to shared NumericFormat
fn convert_numeric_format(format: &crate::grid::NumericFormat) -> NumericFormat {
    NumericFormat {
        kind: match format.kind {
            crate::grid::NumericFormatKind::Number => NumericFormatKind::Number,
            crate::grid::NumericFormatKind::Currency => NumericFormatKind::Currency,
            crate::grid::NumericFormatKind::Percentage => NumericFormatKind::Percentage,
            crate::grid::NumericFormatKind::Exponential => NumericFormatKind::Exponential,
        },
        symbol: format.symbol.clone(),
    }
}

/// Convert Format to RenderNumber
fn format_to_render_number(format: &Format) -> RenderNumber {
    RenderNumber {
        decimals: format.numeric_decimals,
        commas: format.numeric_commas,
        format: format.numeric_format.as_ref().map(convert_numeric_format),
    }
}

impl Sheet {
    /// Creates a RenderCell for a single cell (Rust-native version).
    fn get_rust_render_cell(
        x: i64,
        y: i64,
        value: &CellValue,
        mut format: Format,
        language: Option<CodeCellLanguage>,
        special: Option<RenderCellSpecial>,
    ) -> RenderCell {
        if let CellValue::Html(_) = value {
            return RenderCell {
                x,
                y,
                language,
                special: Some(RenderCellSpecial::Chart),
                ..Default::default()
            };
        } else if let CellValue::Error(error) = value {
            let spill_error = matches!(error.msg, RunErrorMsg::Spill);
            return RenderCell {
                x,
                y,
                language,
                special: Some(if spill_error {
                    RenderCellSpecial::SpillError
                } else {
                    RenderCellSpecial::RunError
                }),
                ..Default::default()
            };
        } else if let CellValue::Image(_) = value {
            return RenderCell {
                x,
                y,
                language,
                special: Some(RenderCellSpecial::Chart),
                ..Default::default()
            };
        }

        let align = if matches!(value, CellValue::Number(_))
            || matches!(value, CellValue::DateTime(_))
            || matches!(value, CellValue::Date(_))
            || matches!(value, CellValue::Time(_))
        {
            Some(CellAlign::Right)
        } else {
            None
        };

        // Extract hyperlink spans and formatting spans from RichText
        let (link_spans, format_spans) = if let CellValue::RichText(spans) = value {
            let mut char_offset: u32 = 0;
            let mut links = Vec::new();
            let mut formats = Vec::new();

            for span in spans.iter() {
                let start = char_offset;
                let len = span.text.chars().count() as u32;
                char_offset += len;
                let end = char_offset;

                // Extract hyperlink span
                if let Some(url) = &span.link {
                    links.push(RenderCellLinkSpan {
                        start,
                        end,
                        url: url.clone(),
                    });
                }

                // Extract formatting span if it has any formatting overrides
                if span.bold.is_some()
                    || span.italic.is_some()
                    || span.underline.is_some()
                    || span.strike_through.is_some()
                    || span.text_color.is_some()
                    || span.link.is_some()
                {
                    formats.push(RenderCellFormatSpan {
                        start,
                        end,
                        bold: span.bold,
                        italic: span.italic,
                        underline: span.underline,
                        strike_through: span.strike_through,
                        text_color: span.text_color.as_ref().map(|c| parse_color(c)),
                        link: span.link.clone(),
                    });
                }
            }

            (links, formats)
        } else {
            (vec![], vec![])
        };

        let mut number: Option<RenderNumber> = None;
        let display_value = match value {
            CellValue::Number(_) => {
                format.align = format.align.or(Some(crate::grid::CellAlign::Right));
                number = Some(format_to_render_number(&format));
                value.to_display()
            }
            CellValue::Date(_) | CellValue::DateTime(_) | CellValue::Time(_) => {
                Self::value_date_time(value, format.date_time)
            }
            _ => value.to_display(),
        };

        RenderCell {
            x,
            y,
            value: display_value,
            language,
            align: format.align.map(convert_align).or(align),
            vertical_align: format.vertical_align.map(convert_vertical_align),
            wrap: format.wrap.map(convert_wrap),
            bold: format.bold,
            italic: format.italic,
            underline: format.underline,
            strike_through: format.strike_through,
            text_color: format.text_color.as_ref().map(|c| parse_color(c)),
            font_size: format.font_size,
            special,
            number,
            table_name: None,
            column_header: None,
            link_spans,
            format_spans,
        }
    }

    /// Ensure that list cells are always clipped or wrapped
    fn ensure_lists_are_clipped_rust(format: &mut Format, special: &Option<RenderCellSpecial>) {
        if special
            .as_ref()
            .is_some_and(|s| matches!(s, RenderCellSpecial::List))
            && !format.wrap.is_some_and(|w| matches!(w, CellWrap::Wrap))
        {
            format.wrap = Some(CellWrap::Clip);
        }
    }

    /// Get render special for validations (Rust-native version)
    fn rust_render_special_pos(&self, pos: Pos, context: &A1Context) -> Option<RenderCellSpecial> {
        self.validations
            .render_special_pos(pos, context)
            .map(|js_special| match js_special {
                crate::grid::js_types::JsRenderCellSpecial::Chart => RenderCellSpecial::Chart,
                crate::grid::js_types::JsRenderCellSpecial::SpillError => {
                    RenderCellSpecial::SpillError
                }
                crate::grid::js_types::JsRenderCellSpecial::RunError => RenderCellSpecial::RunError,
                crate::grid::js_types::JsRenderCellSpecial::Logical => RenderCellSpecial::Logical,
                crate::grid::js_types::JsRenderCellSpecial::Checkbox => RenderCellSpecial::Checkbox,
                crate::grid::js_types::JsRenderCellSpecial::List => RenderCellSpecial::List,
            })
    }

    /// Converts a CodeValue::Code and CodeRun into a vector of RenderCell (Rust-native version).
    pub(crate) fn get_rust_render_code_cells(
        &self,
        data_table: &DataTable,
        render_rect: &Rect,
        code_rect: &Rect,
        context: &A1Context,
    ) -> Vec<RenderCell> {
        let mut cells = vec![];

        if data_table.has_spill() {
            cells.push(Self::get_rust_render_cell(
                code_rect.min.x,
                code_rect.min.y,
                &CellValue::Error(Box::new(RunError {
                    span: None,
                    msg: RunErrorMsg::Spill,
                })),
                Format::default(),
                Some(data_table.get_language()),
                Some(RenderCellSpecial::SpillError),
            ));
        } else if let Some(error) = data_table.get_error() {
            cells.push(Self::get_rust_render_cell(
                code_rect.min.x,
                code_rect.min.y,
                &CellValue::Error(Box::new(error)),
                Format::default(),
                Some(data_table.get_language()),
                None,
            ));
        } else if let Some(intersection) = code_rect.intersection(render_rect) {
            let y_adjustment = data_table.y_adjustment(false);
            for y in intersection.y_range() {
                let is_header = y < code_rect.min.y + y_adjustment;
                let is_table_name = data_table.get_show_name() && y == code_rect.min.y;
                let is_column_headers = is_header && !is_table_name;

                for x in intersection.x_range() {
                    let pos = Pos {
                        x: x - code_rect.min.x,
                        y: y - code_rect.min.y,
                    };

                    let value = data_table.cell_value_at(pos.x as u32, pos.y as u32);

                    if let Some(value) = value {
                        let mut format = if is_header {
                            Format {
                                wrap: Some(CellWrap::Clip),
                                bold: Some(true),
                                ..Default::default()
                            }
                        } else {
                            let table_format = data_table.get_format(pos);
                            let sheet_format =
                                self.formats.try_format(Pos { x, y }).unwrap_or_default();
                            table_format.combine(&sheet_format)
                        };

                        let language = if x == code_rect.min.x && y == code_rect.min.y {
                            Some(data_table.get_language())
                        } else {
                            None
                        };

                        let special = self.rust_render_special_pos(Pos { x, y }, context).or({
                            if matches!(value, CellValue::Logical(_)) {
                                Some(RenderCellSpecial::Logical)
                            } else {
                                None
                            }
                        });

                        Self::ensure_lists_are_clipped_rust(&mut format, &special);

                        let mut render_cell =
                            Self::get_rust_render_cell(x, y, &value, format, language, special);

                        if is_table_name {
                            render_cell.table_name = Some(true);
                        }

                        if is_column_headers {
                            render_cell.column_header = Some(true);
                        }

                        cells.push(render_cell);
                    }
                }
            }
        }

        cells
    }

    /// Returns cell data for rendering (Rust-native version).
    /// This produces RenderCell directly instead of JsRenderCell.
    pub fn get_rust_render_cells(&self, rect: Rect, a1_context: &A1Context) -> Vec<RenderCell> {
        let mut render_cells = vec![];

        // Fetch ordinary value cells
        rect.x_range()
            .filter_map(|x| Some((x, self.get_column(x)?)))
            .for_each(|(x, column)| {
                column.values.range(rect.y_range()).for_each(|(&y, value)| {
                    let special = self.rust_render_special_pos(Pos { x, y }, a1_context).or({
                        if matches!(value, CellValue::Logical(_)) {
                            Some(RenderCellSpecial::Logical)
                        } else {
                            None
                        }
                    });

                    let mut format = self.formats.try_format(Pos { x, y }).unwrap_or_default();

                    Self::ensure_lists_are_clipped_rust(&mut format, &special);

                    render_cells.push(Self::get_rust_render_cell(
                        x, y, value, format, None, special,
                    ));
                });
            });

        // Fetch values from code cells
        self.iter_data_tables_in_rect(rect)
            .for_each(|(data_table_rect, data_table)| {
                render_cells.extend(self.get_rust_render_code_cells(
                    data_table,
                    &rect,
                    &data_table_rect,
                    a1_context,
                ));
            });

        // Populate validations for cells that are not yet in the render_cells
        self.validations
            .in_rect_unbounded(rect, a1_context)
            .iter()
            .rev()
            .for_each(|validation| {
                if let Some(js_special) = validation.render_special() {
                    let special = match js_special {
                        crate::grid::js_types::JsRenderCellSpecial::Chart => {
                            RenderCellSpecial::Chart
                        }
                        crate::grid::js_types::JsRenderCellSpecial::SpillError => {
                            RenderCellSpecial::SpillError
                        }
                        crate::grid::js_types::JsRenderCellSpecial::RunError => {
                            RenderCellSpecial::RunError
                        }
                        crate::grid::js_types::JsRenderCellSpecial::Logical => {
                            RenderCellSpecial::Logical
                        }
                        crate::grid::js_types::JsRenderCellSpecial::Checkbox => {
                            RenderCellSpecial::Checkbox
                        }
                        crate::grid::js_types::JsRenderCellSpecial::List => RenderCellSpecial::List,
                    };

                    validation
                        .selection
                        .ranges
                        .iter()
                        .for_each(|validations_range| {
                            if let Some(validation_rect) =
                                validations_range.to_rect_unbounded(a1_context)
                                && let Some(validation_intersect) =
                                    validation_rect.intersection(&rect)
                            {
                                validation_intersect
                                    .iter()
                                    .filter(|pos| rect.contains(*pos))
                                    .for_each(|pos| {
                                        if !render_cells
                                            .iter()
                                            .any(|cell| cell.x == pos.x && cell.y == pos.y)
                                        {
                                            render_cells.push(RenderCell {
                                                x: pos.x,
                                                y: pos.y,
                                                special: Some(special.clone()),
                                                ..Default::default()
                                            });
                                        }
                                    });
                            }
                        });
                }
            });

        render_cells
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        controller::GridController,
        grid::{CellVerticalAlign as CoreCellVerticalAlign, CodeRun, DataTableKind},
        Value,
    };

    #[test]
    fn test_get_rust_render_cells() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos = pos![1, 2];
        gc.set_cell_value(pos.to_sheet_pos(sheet_id), "test".into(), None, false);
        gc.sheet_mut(sheet_id).formats.bold.set(pos, Some(true));
        gc.sheet_mut(sheet_id)
            .formats
            .align
            .set(pos, Some(crate::grid::CellAlign::Center));
        gc.sheet_mut(sheet_id)
            .formats
            .vertical_align
            .set(pos, Some(CoreCellVerticalAlign::Middle));
        gc.sheet_mut(sheet_id)
            .formats
            .wrap
            .set(pos, Some(CellWrap::Wrap));

        gc.set_cell_value(pos![sheet_id!1,3], "123".into(), None, false);
        gc.sheet_mut(sheet_id)
            .formats
            .italic
            .set(pos![1, 3], Some(true));

        let sheet = gc.sheet(sheet_id);
        let render = sheet.get_rust_render_cells(
            Rect {
                min: Pos { x: 0, y: 0 },
                max: Pos { x: 10, y: 10 },
            },
            gc.a1_context(),
        );

        assert_eq!(render.len(), 2);

        let get = |x: i64, y: i64| -> Option<&RenderCell> {
            render.iter().find(|r| r.x == x && r.y == y)
        };

        assert_eq!(get(0, 0), None);

        let cell = get(1, 2).unwrap();
        assert_eq!(cell.value, "test");
        assert_eq!(cell.align, Some(CellAlign::Center));
        assert_eq!(cell.vertical_align, Some(CellVerticalAlign::Middle));
        assert_eq!(cell.wrap, Some(SharedCellWrap::Wrap));
        assert_eq!(cell.bold, Some(true));

        let cell = get(1, 3).unwrap();
        assert_eq!(cell.value, "123");
        assert_eq!(cell.align, Some(CellAlign::Right));
        assert_eq!(cell.italic, Some(true));
        assert!(cell.number.is_some());
    }

    #[test]
    fn test_rust_render_cells_boolean() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value((0, 0, sheet_id).into(), "true".to_string(), None, false);
        gc.set_cell_value((1, 1, sheet_id).into(), "false".to_string(), None, false);

        let sheet = gc.sheet(sheet_id);
        let rendering = sheet.get_rust_render_cells(
            Rect {
                min: (0, 0).into(),
                max: (1, 1).into(),
            },
            gc.a1_context(),
        );

        assert_eq!(rendering.len(), 2);
        assert_eq!(rendering[0].value, "true");
        assert_eq!(rendering[0].special, Some(RenderCellSpecial::Logical));
        assert_eq!(rendering[1].value, "false");
        assert_eq!(rendering[1].special, Some(RenderCellSpecial::Logical));
    }

    #[test]
    fn test_rust_render_code_cells() {
        let sheet = Sheet::test();
        let code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: "".to_string(),
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("text".into()),
            line_number: None,
            output_type: None,
        };

        let data_table = crate::grid::DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Array(vec![vec!["1", "2", "3"], vec!["4", "5", "6"]].into()),
            false,
            Some(false),
            Some(false),
            None,
        );

        let context = crate::a1::A1Context::default();

        let code_cells = sheet.get_rust_render_code_cells(
            &data_table,
            &Rect::from_numbers(0, 0, 10, 10),
            &Rect::from_numbers(5, 5, 3, 2),
            &context,
        );

        assert_eq!(code_cells.len(), 6);
        assert_eq!(code_cells[0].value, "1");
        assert_eq!(code_cells[0].language, Some(CodeCellLanguage::Python));
        assert_eq!(code_cells[5].value, "6");
        assert_eq!(code_cells[5].language, None);
    }
}
