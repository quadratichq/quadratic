use anyhow::{Error, Result};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use indexmap::IndexMap;
use lazy_static::lazy_static;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use super::operation::Operation;
use crate::Value;
use crate::cell_values::CellValues;
use crate::color::Rgba;
use crate::compression::CompressionFormat;
use crate::compression::SerializationFormat;
use crate::compression::decompress_and_deserialize;
use crate::compression::serialize_and_compress;
use crate::controller::GridController;
use crate::grid::CodeRun;
use crate::grid::DataTable;
use crate::grid::DataTableKind;
use crate::grid::Sheet;
use crate::grid::SheetFormatting;
use crate::grid::SheetId;
use crate::grid::formats::Format;
use crate::grid::formats::SheetFormatUpdates;
use crate::grid::js_types::JsClipboard;
use crate::grid::sheet::borders::Borders;
use crate::grid::sheet::borders::BordersUpdates;
use crate::grid::sheet::merge_cells::MergeCellsUpdate;
use crate::grid::sheet::validations::validation::Validation;
use crate::{CellValue, ClearOption, Pos, Rect, RefAdjust, RefError, SheetPos, SheetRect, a1::A1Selection};

lazy_static! {
    static ref CLIPBOARD_REGEX: Regex = Regex::new(r#"data-quadratic="(.*?)".*><tbody"#)
        .expect("Failed to compile CLIPBOARD_REGEX");
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub enum PasteSpecial {
    // paste normal
    None,
    // paste only values
    Values,
    // paste only formatting/borders
    Formats,
}
impl From<&str> for PasteSpecial {
    fn from(s: &str) -> Self {
        match s {
            "None" => PasteSpecial::None,
            "Values" => PasteSpecial::Values,
            "Formats" => PasteSpecial::Formats,
            _ => panic!("Invalid PasteSpecial: {s}"),
        }
    }
}

/// This is used to track the origin of copies from column, row, or all
/// selection. In order to paste a column, row, or all, we need to know the
/// origin of the copy.
///
/// For example, this is used to copy and paste a column
/// on top of another column, or a sheet on top of another sheet.
#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
pub struct ClipboardOrigin {
    pub x: i64,
    pub y: i64,
    pub sheet_id: SheetId,
    pub column: Option<i64>,
    pub row: Option<i64>,
    pub all: Option<(i64, i64)>,
}
impl ClipboardOrigin {
    pub fn default(sheet_id: SheetId) -> Self {
        Self {
            x: 0,
            y: 0,
            sheet_id,
            column: None,
            row: None,
            all: None,
        }
    }
}

#[derive(Default, Debug, Serialize, Deserialize)]
pub struct ClipboardSheetFormats {
    pub columns: HashMap<i64, Format>,
    pub rows: HashMap<i64, Format>,
    pub all: Option<Format>,
}

#[derive(Default, Clone, Debug, Serialize, Deserialize)]
pub struct ClipboardValidations {
    pub validations: Vec<Validation>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ClipboardOperation {
    Cut,
    Copy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Clipboard {
    pub origin: ClipboardOrigin,

    pub selection: A1Selection,

    pub w: u32,
    pub h: u32,

    pub cells: CellValues,

    // plain values for use with PasteSpecial::Values
    pub values: CellValues,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub formats: Option<SheetFormatUpdates>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub borders: Option<BordersUpdates>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub validations: Option<ClipboardValidations>,

    #[serde(
        skip_serializing_if = "IndexMap::is_empty",
        default,
        with = "crate::util::indexmap_serde"
    )]
    pub data_tables: IndexMap<Pos, DataTable>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub merge_rects: Option<Vec<Rect>>,

    pub operation: ClipboardOperation,
}

pub static CLIPBOARD_SERIALIZATION_FORMAT: SerializationFormat = SerializationFormat::Json;
pub static CLIPBOARD_COMPRESSION_FORMAT: CompressionFormat = CompressionFormat::Zstd;

impl Clipboard {
    /// Decode the clipboard html and return a Clipboard struct.
    pub fn decode(html: &str) -> Result<Self> {
        let error = |e, msg| Error::msg(format!("Clipboard decode {msg:?}: {e:?}"));

        // pull out the sub string
        let data = CLIPBOARD_REGEX
            .captures(html)
            .ok_or_else(|| error("".into(), "Regex capture error"))?
            .get(1)
            .map_or("", |m| m.as_str());

        // decode base64
        let data = URL_SAFE_NO_PAD
            .decode(data)
            .map_err(|e| error(e.to_string(), "Base64 decode error"))?;

        // decompress and deserialize
        decompress_and_deserialize::<Clipboard>(
            &CLIPBOARD_SERIALIZATION_FORMAT,
            &CLIPBOARD_COMPRESSION_FORMAT,
            &data,
        )
        .map_err(|e| error(e.to_string(), "Decompression/deserialization error"))
    }

    /// Return the largest rect that contains the clipboard, with `insert_at` as the top left corner
    pub fn to_rect(&self, insert_at: Pos) -> Rect {
        Rect::from_numbers(insert_at.x, insert_at.y, self.w as i64, self.h as i64)
    }
}

impl From<Clipboard> for JsClipboard {
    fn from(clipboard: Clipboard) -> Self {
        let mut plain_text = String::new();
        let mut html_body = String::new();

        let mut clipboard_formats = SheetFormatting::default();
        if let Some(formats) = &clipboard.formats {
            clipboard_formats.apply_updates(formats);
        }
        let is_formats_empty = clipboard_formats.is_all_default();

        let mut clipboard_borders = Borders::default();
        if let Some(borders) = &clipboard.borders {
            clipboard_borders.apply_updates(borders);
        }
        let is_borders_empty = clipboard_borders.is_default();

        for y in 0..clipboard.h {
            if y != 0 {
                plain_text.push('\n');
                html_body.push_str("</tr>");
            }

            html_body.push_str("<tr>");

            for x in 0..clipboard.w {
                if x != 0 {
                    plain_text.push('\t');
                    html_body.push_str("</td>");
                }

                let mut style = String::new();

                let pos = (clipboard.origin.x + x as i64, clipboard.origin.y + y as i64).into();

                if !is_formats_empty || !is_borders_empty {
                    let format = clipboard_formats.try_format(pos);

                    let border = clipboard_borders.get_style_cell(pos);

                    let has_style = format.as_ref().is_some_and(|format| !format.is_default())
                        || !border.is_empty();

                    if has_style {
                        style.push_str("style=\"");
                    }

                    if let Some(format) = format
                        && !format.is_default()
                    {
                        if let Some(align) = format.align {
                            style.push_str(align.as_css_string());
                        }
                        if let Some(vertical_align) = format.vertical_align {
                            style.push_str(vertical_align.as_css_string());
                        }
                        if let Some(wrap) = format.wrap {
                            style.push_str(wrap.as_css_string());
                        }
                        if format.bold == Some(true) {
                            style.push_str("font-weight:bold;");
                        }
                        if format.italic == Some(true) {
                            style.push_str("font-style:italic;");
                        }
                        if let Some(text_color) = format.text_color
                            && let Ok(text_color) = Rgba::try_from(text_color.as_str())
                        {
                            style.push_str(format!("color:{};", text_color.as_rgb_hex()).as_str());
                        }
                        if let Some(fill_color) = format.fill_color
                            && let Ok(fill_color) = Rgba::try_from(fill_color.as_str())
                        {
                            style.push_str(
                                format!("background-color:{};", fill_color.as_rgb_hex()).as_str(),
                            );
                        }
                        if format.underline == Some(true) && format.strike_through != Some(true) {
                            style.push_str("text-decoration:underline;");
                        } else if format.underline != Some(true)
                            && format.strike_through == Some(true)
                        {
                            style.push_str("text-decoration:line-through;");
                        } else if format.underline == Some(true)
                            && format.strike_through == Some(true)
                        {
                            style.push_str("text-decoration:underline line-through;");
                        }
                    }

                    if !border.is_empty() {
                        if border.left.is_some() {
                            style.push_str(
                                format!(
                                    "border-left: {} {};",
                                    border.left.unwrap().line.as_css_string(),
                                    border.left.unwrap().color.as_rgb_hex()
                                )
                                .as_str(),
                            );
                        }
                        if border.top.is_some() {
                            style.push_str(
                                format!(
                                    "border-top: {} {};",
                                    border.top.unwrap().line.as_css_string(),
                                    border.top.unwrap().color.as_rgb_hex()
                                )
                                .as_str(),
                            );
                        }
                        if border.right.is_some() {
                            style.push_str(
                                format!(
                                    "border-right: {} {};",
                                    border.right.unwrap().line.as_css_string(),
                                    border.right.unwrap().color.as_rgb_hex()
                                )
                                .as_str(),
                            );
                        }
                        if border.bottom.is_some() {
                            style.push_str(
                                format!(
                                    "border-bottom: {} {};",
                                    border.bottom.unwrap().line.as_css_string(),
                                    border.bottom.unwrap().color.as_rgb_hex()
                                )
                                .as_str(),
                            );
                        }
                    }

                    if has_style {
                        style.push('"');
                    }
                }

                html_body.push_str(format!("<td {style}>").as_str());

                let display_value = clipboard.values.get(x, y);
                if let Some(value) = display_value {
                    let value = value.to_string();
                    html_body.push_str(&value);
                    plain_text.push_str(&value.replace("\n", " ").replace("\t", " "));
                }
            }
        }
        html_body.push_str("</td></tr>");

        // add starting table tag with data-quadratic attribute
        let mut html = String::from("<table data-quadratic=\"");

        // compress and serialize
        let data = serialize_and_compress(
            &CLIPBOARD_SERIALIZATION_FORMAT,
            &CLIPBOARD_COMPRESSION_FORMAT,
            clipboard,
        )
        .unwrap_or_default();

        // encode to base64 string
        let data = URL_SAFE_NO_PAD.encode(&data);

        // add closing table tag
        html.push_str(&data);
        drop(data);

        // add starting tbody tag
        html.push_str(&String::from("\"><tbody>"));

        // add html body
        html.push_str(&html_body);

        // add closing tbody and table tags
        html.push_str("</tbody></table>");

        JsClipboard { plain_text, html }
    }
}

impl GridController {
    pub fn cut_to_clipboard_operations(
        &mut self,
        selection: &A1Selection,
        include_display_values: bool,
    ) -> Result<(Clipboard, Vec<Operation>), String> {
        let sheet = self
            .try_sheet(selection.sheet_id)
            .ok_or("Unable to find Sheet")?;

        let clipboard = sheet.copy_to_clipboard(
            selection,
            self.a1_context(),
            ClipboardOperation::Cut,
            include_display_values,
        );

        let operations = self.delete_values_and_formatting_operations(selection, true);

        Ok((clipboard, operations))
    }

    fn clipboard_code_operations(
        &self,
        start_pos: SheetPos,
        clipboard: &Clipboard,
    ) -> Result<Vec<Operation>> {
        let mut ops = vec![];

        if let Some(sheet) = self.try_sheet(start_pos.sheet_id) {
            for (pos, data_table) in clipboard.data_tables.iter() {
                let source_pos = Pos {
                    x: clipboard.origin.x + pos.x,
                    y: clipboard.origin.y + pos.y,
                };

                let target_pos = Pos {
                    x: start_pos.x + pos.x - clipboard.origin.x,
                    y: start_pos.y + pos.y - clipboard.origin.y,
                };

                // need to skip any paste where the source contains a table or
                // code except when the new data table overwrites the anchor cell
                let output_rect = data_table.output_rect(target_pos, true);
                if sheet
                    .data_tables_pos_intersect_rect(output_rect, false)
                    .any(|pos| sheet.data_table_at(&pos).is_none())
                {
                    let message = format!(
                        "Cannot place {} within a table",
                        data_table.kind_as_string()
                    );

                    // report the attempt to paste to the user
                    #[cfg(any(target_family = "wasm", test))]
                    {
                        let severity = crate::grid::js_types::JsSnackbarSeverity::Error;
                        crate::wasm_bindings::js::jsClientMessage(
                            message.clone(),
                            severity.to_string(),
                        );
                    }

                    return Err(Error::msg(message));
                }

                let paste_in_import = sheet
                    .iter_data_tables_in_rect(Rect::single_pos(target_pos))
                    .any(|(output_rect, data_table)| {
                        // this table is being moved in the same transaction
                        if matches!(clipboard.operation, ClipboardOperation::Cut)
                            && start_pos.sheet_id == clipboard.selection.sheet_id
                            && clipboard
                                .selection
                                .contains_pos(output_rect.min, self.a1_context())
                        {
                            return false;
                        }

                        target_pos != output_rect.min
                            && matches!(data_table.kind, DataTableKind::Import(_))
                    });

                if paste_in_import {
                    let message = format!(
                        "Cannot place {} within a table",
                        data_table.kind_as_string()
                    );

                    #[cfg(any(target_family = "wasm", test))]
                    {
                        let severity = crate::grid::js_types::JsSnackbarSeverity::Error;
                        crate::wasm_bindings::js::jsClientMessage(
                            message.to_owned(),
                            severity.to_string(),
                        );
                    }

                    return Err(Error::msg(message));
                }

                // adjust the code_runs if necessary
                let (data_table, adjusted_code_run) = if let Some(code_run) = data_table.code_run()
                {
                    let mut adjusted_code_run = code_run.clone();
                    match clipboard.operation {
                        ClipboardOperation::Cut => adjusted_code_run.adjust_references(
                            start_pos.sheet_id,
                            &self.a1_context,
                            source_pos.to_sheet_pos(clipboard.origin.sheet_id),
                            RefAdjust::NO_OP,
                        ),
                        ClipboardOperation::Copy => adjusted_code_run.adjust_references(
                            start_pos.sheet_id,
                            &self.a1_context,
                            target_pos.to_sheet_pos(start_pos.sheet_id),
                            RefAdjust {
                                sheet_id: None,
                                dx: target_pos.x - pos.x,
                                dy: target_pos.y - pos.y,
                                relative_only: true,

                                // ignored
                                x_start: 0,
                                y_start: 0,
                            },
                        ),
                    }

                    if &adjusted_code_run != code_run {
                        (
                            DataTable {
                                kind: DataTableKind::CodeRun(adjusted_code_run.clone()),
                                ..data_table.clone()
                            },
                            Some(adjusted_code_run),
                        )
                    } else {
                        (data_table.to_owned(), Some(code_run.clone()))
                    }
                } else {
                    (data_table.to_owned(), None)
                };

                // For a cut, only rerun the code if the cut rectangle overlaps
                // with the data table's cells accessed or if the paste rectangle
                // overlaps with the data table's cells accessed.
                let should_rerun =
                    self.clipboard_code_operations_should_rerun(clipboard, source_pos, start_pos);

                if let Some(code_run) = &adjusted_code_run
                    && should_rerun
                {
                    // Use SetComputeCode to re-execute the code and get fresh results.
                    // SetComputeCode internally creates an empty data table (via finalize_data_table)
                    // then triggers execution. We intentionally don't use SetDataTable here
                    // because we want new output, not the cached results from the clipboard.
                    // Pass the template to preserve presentation properties (show_name, show_columns,
                    // alternating_colors, etc.) from the original data table, consistent with autocomplete.
                    ops.push(Operation::SetComputeCode {
                        sheet_pos: target_pos.to_sheet_pos(start_pos.sheet_id),
                        language: code_run.language.clone(),
                        code: code_run.code.clone(),
                        template: Some((&data_table).into()),
                    });
                } else {
                    // When should_rerun is false (or this isn't a code cell), preserve the
                    // existing data table with its cached results. For code cells, this means
                    // the output won't change even though the code isn't re-executed.
                    ops.push(Operation::SetDataTable {
                        sheet_pos: target_pos.to_sheet_pos(start_pos.sheet_id),
                        data_table: Some(data_table),
                        index: usize::MAX,
                        ignore_old_data_table: true,
                    });
                }
            }
        }

        Ok(ops)
    }

    /// For a cut, only rerun the code if the cut rectangle overlaps
    /// with the data table's cells accessed or if the paste rectangle
    /// overlaps with the data table's cells accessed.
    fn clipboard_code_operations_should_rerun(
        &self,
        clipboard: &Clipboard,
        source_pos: Pos,
        start_pos: SheetPos,
    ) -> bool {
        match clipboard.operation {
            ClipboardOperation::Copy => true,
            ClipboardOperation::Cut => {
                let cut_rects = clipboard.selection.rects_unbounded(self.a1_context());
                let paste_rect = clipboard.to_rect(start_pos.into());

                let cells_accessed = clipboard
                    .data_tables
                    .get(&source_pos)
                    .and_then(|data_table| data_table.cells_accessed(start_pos.sheet_id));

                cells_accessed.as_ref().is_some_and(|ranges| {
                    ranges.iter().any(|range| {
                        let cut_intersects = cut_rects
                            .iter()
                            .any(|rect| range.might_intersect_rect(*rect, self.a1_context()));

                        let paste_intersects =
                            range.might_intersect_rect(paste_rect, self.a1_context());

                        cut_intersects || paste_intersects
                    })
                })
            }
        }
    }

    /// Adjust CellValue::Code references in cells for paste operations.
    /// For Copy: adjusts relative references based on paste offset.
    /// For Cut: keeps references as-is.
    /// Returns the positions of code cells that need compute operations.
    fn adjust_clipboard_code_cell_references(
        &self,
        start_pos: SheetPos,
        clipboard: &Clipboard,
        cells: &mut CellValues,
    ) -> Vec<SheetPos> {
        let mut code_cell_positions = Vec::new();

        // First pass: collect positions of code cells
        let mut positions_to_adjust: Vec<(u32, u32)> = Vec::new();
        for (col_x, column) in cells.columns.iter().enumerate() {
            for (&col_y, cell_value) in column.iter() {
                if matches!(cell_value, CellValue::Code(_)) {
                    positions_to_adjust.push((col_x as u32, col_y as u32));
                }
            }
        }

        // Second pass: adjust references in place
        for (col_x, col_y) in positions_to_adjust {
            let source_pos = Pos {
                x: clipboard.origin.x + col_x as i64,
                y: clipboard.origin.y + col_y as i64,
            };
            let target_pos = Pos {
                x: start_pos.x + col_x as i64,
                y: start_pos.y + col_y as i64,
            };

            // Get mutable reference and adjust in place
            if let Ok(CellValue::Code(code_cell)) = cells.get_mut(col_x, col_y) {
                match clipboard.operation {
                    ClipboardOperation::Cut => {
                        // For cut, keep references as-is but update sheet context
                        code_cell.code_run.adjust_references(
                            start_pos.sheet_id,
                            &self.a1_context,
                            source_pos.to_sheet_pos(clipboard.origin.sheet_id),
                            RefAdjust::NO_OP,
                        );
                    }
                    ClipboardOperation::Copy => {
                        // For copy, adjust relative references
                        code_cell.code_run.adjust_references(
                            start_pos.sheet_id,
                            &self.a1_context,
                            target_pos.to_sheet_pos(start_pos.sheet_id),
                            RefAdjust {
                                sheet_id: None,
                                dx: target_pos.x - source_pos.x,
                                dy: target_pos.y - source_pos.y,
                                relative_only: true,
                                x_start: 0,
                                y_start: 0,
                            },
                        );
                    }
                }
            }

            // Track this position for compute operations
            code_cell_positions.push(target_pos.to_sheet_pos(start_pos.sheet_id));
        }

        code_cell_positions
    }

    fn clipboard_formats_tables_operations(
        &self,
        sheet_id: SheetId,
        formats_rect: Rect,
        formats: &SheetFormatUpdates,
        selection: Option<&A1Selection>,
        delete_value: bool,
    ) -> Vec<Operation> {
        let mut ops = vec![];

        if let Some(sheet) = self.try_sheet(sheet_id) {
            for (output_rect, intersection_rect, data_table) in
                sheet.iter_data_tables_intersects_rect(formats_rect)
            {
                let data_table_pos = output_rect.min;

                let contains_source_cell = intersection_rect.contains(data_table_pos);
                if contains_source_cell {
                    continue;
                }

                let is_table_being_deleted = match (delete_value, selection) {
                    (true, Some(selection)) => {
                        sheet_id == selection.sheet_id
                            && selection.contains_pos(output_rect.min, self.a1_context())
                    }
                    _ => false,
                };
                if is_table_being_deleted {
                    continue;
                }
                let mut formats = formats.clone();
                let table_format_updates = data_table.transfer_formats_from_sheet_format_updates(
                    data_table_pos,
                    intersection_rect,
                    &mut formats,
                );

                if let Some(table_format_updates) = table_format_updates
                    && !table_format_updates.is_default()
                {
                    ops.push(Operation::DataTableFormats {
                        sheet_pos: data_table_pos.to_sheet_pos(sheet_id),
                        formats: table_format_updates,
                    });
                }
            }
        }

        ops
    }

    /// Gets operations to add validations from clipboard to sheet.
    fn clipboard_validations_operations(
        &self,
        validations: &Option<ClipboardValidations>,
        start_pos: SheetPos,
    ) -> Vec<Operation> {
        if let Some(validations) = validations {
            validations
                .to_owned()
                .validations
                .into_iter()
                .filter_map(|mut validation| {
                    validation.id = Uuid::new_v4();
                    validation.selection.sheet_id = start_pos.sheet_id;
                    validation.selection = validation
                        .selection
                        .saturating_translate(start_pos.x - 1, start_pos.y - 1)?;
                    Some(Operation::SetValidation { validation })
                })
                .collect()
        } else {
            vec![]
        }
    }

    // Collects the format operations
    fn get_formats_ops(
        &self,
        start_pos: SheetPos,
        formats: &mut SheetFormatUpdates,
        clipboard: &Clipboard,
        special: PasteSpecial,
        delete_value: bool,
    ) -> Vec<Operation> {
        let mut ops = vec![];
        if matches!(special, PasteSpecial::None | PasteSpecial::Formats) {
            // for formats and borders, we need to translate the clipboard to the start_pos
            let contiguous_2d_translate_x = start_pos.x - clipboard.origin.x;
            let contiguous_2d_translate_y = start_pos.y - clipboard.origin.y;
            if let Some(clipboard_formats) = &clipboard.formats
                && !clipboard_formats.is_default()
            {
                let mut copied_formats = clipboard_formats.clone();
                copied_formats
                    .translate_in_place(contiguous_2d_translate_x, contiguous_2d_translate_y);
                formats.merge(&copied_formats);
                let formats_rect = Rect::from_numbers(
                    start_pos.x,
                    start_pos.y,
                    clipboard.w as i64,
                    clipboard.h as i64,
                );

                let formats_ops = self.clipboard_formats_tables_operations(
                    start_pos.sheet_id,
                    formats_rect,
                    &copied_formats,
                    Some(&clipboard.selection),
                    delete_value,
                );

                ops.extend(formats_ops);
            }
        }
        ops
    }

    fn get_borders_ops(
        &self,
        start_pos: Pos,
        borders: &mut BordersUpdates,
        clipboard: &Clipboard,
        special: PasteSpecial,
    ) {
        // todo: this does not support tables (should be similar to get_formats_ops)
        if matches!(special, PasteSpecial::None | PasteSpecial::Formats)
            && let Some(original_borders) = &clipboard.borders
            && !original_borders.is_empty()
        {
            let mut new_borders = original_borders.clone();
            let contiguous_2d_translate_x = start_pos.x - clipboard.origin.x;
            let contiguous_2d_translate_y = start_pos.y - clipboard.origin.y;
            new_borders.translate_in_place(contiguous_2d_translate_x, contiguous_2d_translate_y);
            borders.merge(&new_borders);
        }
    }

    /// Collect the operations to paste the clipboard cells
    /// For cell values, formats and borders, we just add to the data structure to avoid extra operations
    #[allow(clippy::too_many_arguments)]
    fn get_clipboard_ops(
        &self,
        mut start_pos: Pos,
        cell_value_pos: Pos,
        cell_values: &mut CellValues,
        formats: &mut SheetFormatUpdates,
        borders: &mut BordersUpdates,
        selection: &A1Selection,
        clipboard: &Clipboard,
        special: PasteSpecial,
    ) -> Result<(Vec<Operation>, Vec<Operation>)> {
        let mut ops = vec![];
        let mut code_ops: Vec<_> = vec![];
        let mut cursor_translate_x = start_pos.x - clipboard.origin.x;
        let mut cursor_translate_y = start_pos.y - clipboard.origin.y;

        // we paste the entire sheet over the existing sheet
        if let Some((x, y)) = clipboard.origin.all {
            // set the start_pos to the origin of the clipboard for the
            // copied sheet
            start_pos.x = x;
            start_pos.y = y;
        } else {
            if let Some(column_origin) = clipboard.origin.column {
                start_pos.x += column_origin;
                cursor_translate_x += clipboard.origin.x;
            }
            if let Some(row_origin) = clipboard.origin.row {
                start_pos.y += row_origin;
                cursor_translate_y += clipboard.origin.y;
            }
        }

        let mut cursor = clipboard
            .selection
            .clone()
            .saturating_translate(cursor_translate_x, cursor_translate_y)
            .ok_or(RefError)?;

        cursor.sheet_id = selection.sheet_id;

        let delete_value = matches!(clipboard.operation, ClipboardOperation::Cut);

        match special {
            PasteSpecial::None => {
                let mut cells = clipboard.cells.to_owned();

                // Adjust CellValue::Code references and track positions for compute operations
                let code_cell_positions = self.adjust_clipboard_code_cell_references(
                    start_pos.to_sheet_pos(selection.sheet_id),
                    clipboard,
                    &mut cells,
                );

                if !cells.is_empty() {
                    let cell_value_ops = self.cell_values_operations(
                        Some(&clipboard.selection),
                        start_pos.to_sheet_pos(selection.sheet_id),
                        cell_value_pos,
                        cell_values,
                        cells,
                        delete_value,
                    )?;
                    ops.extend(cell_value_ops);
                }

                // Add compute operations for pasted CellValue::Code cells
                for sheet_pos in code_cell_positions {
                    code_ops.push(Operation::ComputeCode { sheet_pos });
                }

                code_ops.extend(self.clipboard_code_operations(
                    start_pos.to_sheet_pos(selection.sheet_id),
                    clipboard,
                )?);

                let validations_ops = self.clipboard_validations_operations(
                    &clipboard.validations,
                    start_pos.to_sheet_pos(selection.sheet_id),
                );
                ops.extend(validations_ops);
            }
            PasteSpecial::Values => {
                let values = clipboard.values.to_owned();

                if !values.is_empty() {
                    let cell_value_ops = self.cell_values_operations(
                        Some(&clipboard.selection),
                        start_pos.to_sheet_pos(selection.sheet_id),
                        cell_value_pos,
                        cell_values,
                        values,
                        delete_value,
                    )?;
                    ops.extend(cell_value_ops);
                }
            }
            PasteSpecial::Formats => (),
        }

        if matches!(special, PasteSpecial::None | PasteSpecial::Formats) {
            ops.extend(self.get_formats_ops(
                start_pos.to_sheet_pos(selection.sheet_id),
                formats,
                clipboard,
                special,
                delete_value,
            ));

            self.get_borders_ops(start_pos, borders, clipboard, special);
        }

        Ok((ops, code_ops))
    }

    /// Collect the operations to paste the clipboard cells from plain text
    pub fn paste_plain_text_operations(
        &mut self,
        start_pos: SheetPos,
        end_pos: Pos,
        selection: &A1Selection,
        plain_text: String,
        special: PasteSpecial,
    ) -> Result<Vec<Operation>> {
        // nothing to paste from plain text for formats
        if matches!(special, PasteSpecial::Formats) {
            return Ok(vec![]);
        }

        let lines: Vec<&str> = plain_text.split('\n').collect();
        let mut ops = vec![];
        let mut compute_code_ops = vec![];

        // calculate the width by checking the first line (with the assumption that all lines should have the same width)
        let w = lines
            .first()
            .map(|line| line.split('\t').count())
            .unwrap_or(0);
        let h = lines.len();

        // If the clipboard is larger than the selection, we need to paste multiple times.
        // We don't want the paste to exceed the bounds of the selection (e.g. end_pos).
        let (max_x, max_y, cell_value_width, cell_value_height) =
            Self::get_max_paste_area(start_pos.into(), end_pos, w as u32, h as u32);

        // collect all cell values, values and sheet format updates for a a single operation
        let mut cell_values = CellValues::new(cell_value_width as u32, cell_value_height as u32);
        let mut values = CellValues::new(cell_value_width as u32, cell_value_height as u32);
        let mut sheet_format_updates = SheetFormatUpdates::default();

        // collect the plain text clipboard cells
        lines.iter().enumerate().for_each(|(y, line)| {
            line.split('\t').enumerate().for_each(|(x, value)| {
                if let Some(formula_code) = value.strip_prefix('=') {
                    // code cell - store without the leading '='
                    let sheet_pos = SheetPos::new(
                        start_pos.sheet_id,
                        start_pos.x + x as i64,
                        start_pos.y + y as i64,
                    );
                    compute_code_ops.push(Operation::SetDataTable {
                        sheet_pos,
                        data_table: Some(DataTable::new(
                            DataTableKind::CodeRun(CodeRun::new_formula(formula_code.to_string())),
                            "Formula1",
                            Value::Single(CellValue::Blank),
                            false,
                            Some(true),
                            Some(true),
                            None,
                        )),
                        index: usize::MAX,
                        ignore_old_data_table: true,
                    });
                    compute_code_ops.push(Operation::ComputeCode { sheet_pos });
                } else {
                    let (cell_value, format_update) = CellValue::string_to_cell_value(value, false);
                    if cell_value != CellValue::Blank {
                        values.set(x as u32, y as u32, cell_value);
                    }

                    let pos = Pos {
                        x: start_pos.x + x as i64,
                        y: start_pos.y + y as i64,
                    };

                    if !format_update.is_default() {
                        sheet_format_updates.set_format_cell(pos, format_update);
                    }
                }
            });
        });

        // loop through the paste area and collect the operations
        for (start_x, x) in (start_pos.x..=max_x).enumerate().step_by(w) {
            for (start_y, y) in (start_pos.y..=max_y).enumerate().step_by(h) {
                let cell_value_pos = Pos::from((start_x, start_y));
                let sheet_pos = SheetPos::new(start_pos.sheet_id, x, y);

                ops.extend(self.cell_values_operations(
                    None,
                    sheet_pos,
                    cell_value_pos,
                    &mut cell_values,
                    values.to_owned(), // we need to copy the values for each paste block
                    false,             // we don't delete values for plain text
                )?);
            }
        }

        // Adjust paste data for merged cells in the target sheet
        // Plain text paste doesn't include borders, so we use an empty borders update
        let mut borders = BordersUpdates::default();
        let merge_cell_ops = self.adjust_paste_for_merge_cells(
            start_pos.sheet_id,
            start_pos.into(),
            &mut cell_values,
            &mut sheet_format_updates,
            &mut borders,
        );
        ops.extend(merge_cell_ops);

        ops.push(Operation::SetCellValues {
            sheet_pos: start_pos,
            values: cell_values,
        });

        if !sheet_format_updates.is_default() {
            let formats_rect =
                Rect::from_numbers(start_pos.x, start_pos.y, w as i64, lines.len() as i64);

            ops.extend(self.clipboard_formats_tables_operations(
                start_pos.sheet_id,
                formats_rect,
                &sheet_format_updates,
                Some(selection),
                false, // we don't delete values for plain text
            ));

            ops.push(Operation::SetCellFormatsA1 {
                sheet_id: start_pos.sheet_id,
                formats: sheet_format_updates,
            });
        }

        ops.push(Operation::SetCursorA1 {
            selection: selection.to_owned(),
        });

        ops.extend(compute_code_ops);

        Ok(ops)
    }

    // todo: parse table structure to provide better pasting experience from other spreadsheets
    #[function_timer::function_timer]
    pub fn paste_html_operations(
        &mut self,
        insert_at: Pos,
        end_pos: Pos,
        selection: &A1Selection,
        mut clipboard: Clipboard,
        special: PasteSpecial,
    ) -> Result<(Vec<Operation>, Vec<Operation>)> {
        let mut clipboard_ops = vec![];
        let mut compute_code_ops = vec![];
        let mut data_table_ops = vec![];
        let clipboard_rect = clipboard.to_rect(insert_at);

        let sheet_id = match clipboard.operation {
            ClipboardOperation::Cut => selection.sheet_id,
            ClipboardOperation::Copy => clipboard.origin.sheet_id,
        };

        let delete_value = matches!(clipboard.operation, ClipboardOperation::Cut);

        // If the clipboard is larger than the selection, we need to paste multiple times.
        // We don't want the paste to exceed the bounds of the selection (e.g. end_pos).
        let (max_x, max_y, cell_value_width, cell_value_height) =
            Self::get_max_paste_area(insert_at, end_pos, clipboard.w, clipboard.h);

        let _paste_rect = Rect::from_numbers(
            insert_at.x,
            insert_at.y,
            cell_value_width,
            cell_value_height,
        );

        // The actual area that will receive pasted data includes all tiled
        // copies. Use this for merge detection so overlapping merges are found
        // even when the selection-based paste_rect is smaller (e.g., when
        // paste_html_operations is called from execute_move_cells with a
        // single-cell selection).
        let full_paste_rect = Rect::new(
            insert_at.x,
            insert_at.y,
            max_x + clipboard.w as i64 - 1,
            max_y + clipboard.h as i64 - 1,
        );

        let unmerge_ops: Vec<Operation> = if !matches!(special, PasteSpecial::Values) {
            if let Some(sheet) = self.try_sheet(selection.sheet_id) {
                let existing = sheet.merge_cells.get_merge_cells(full_paste_rect);
                let single_merge_replace = existing.len() == 1
                    && existing[0].contains(full_paste_rect.min)
                    && existing[0].contains(full_paste_rect.max);
                if single_merge_replace {
                    vec![]
                } else {
                    existing
                        .into_iter()
                        .map(|merge_rect| {
                            let mut unmerge = MergeCellsUpdate::default();
                            unmerge.set_rect(
                                merge_rect.min.x,
                                merge_rect.min.y,
                                Some(merge_rect.max.x),
                                Some(merge_rect.max.y),
                                Some(ClearOption::Clear),
                            );
                            Operation::SetMergeCells {
                                sheet_id: selection.sheet_id,
                                merge_cells_updates: unmerge,
                            }
                        })
                        .collect()
                }
            } else {
                vec![]
            }
        } else {
            vec![]
        };

        let did_unmerge_in_paste_area = !unmerge_ops.is_empty();
        let mut ops = unmerge_ops;

        // collect all cell values, values and sheet format updates for a a single operation
        let mut cell_values = CellValues::new(cell_value_width as u32, cell_value_height as u32);
        let mut formats = SheetFormatUpdates::default();
        let mut borders = BordersUpdates::default();
        let source_columns = clipboard.cells.columns;

        // Remove code tables if their anchor cell is within the paste area.
        // This applies to both pasting code tables and regular cell values.
        if let Some(sheet) = self.try_sheet(selection.sheet_id) {
            let paste_rect_for_tables = Rect::new_span(insert_at, end_pos);
            sheet
                .data_tables_pos_intersect_rect(paste_rect_for_tables, false)
                .filter(|pos| {
                    paste_rect_for_tables.contains(*pos)
                        && sheet
                            .data_table_at(pos)
                            .is_some_and(|data_table| data_table.is_code())
                })
                .for_each(|pos| {
                    ops.push(Operation::DeleteDataTable {
                        sheet_pos: pos.to_sheet_pos(sheet_id),
                    });
                });
        }

        // collect information for growing data tables
        let mut data_table_columns: HashMap<SheetPos, Vec<u32>> = HashMap::new();
        let mut data_table_rows: HashMap<SheetPos, Vec<u32>> = HashMap::new();

        // move the clipboard rect left and up by 1 to make adjacent tables intersect
        let moved_left_up_rect = Rect::from_numbers(
            insert_at.x - 1,
            insert_at.y - 1,
            clipboard.w as i64 + 1,
            clipboard.h as i64 + 1,
        );
        let mut data_tables_rects = self
            .try_sheet(selection.sheet_id)
            .map(|sheet| {
                sheet
                    .data_tables_output_rects_intersect_rect(
                        moved_left_up_rect,
                        |&data_table_pos, data_table| {
                            !(data_table.is_code()
                                || (delete_value
                                    && clipboard
                                        .selection
                                        .contains_pos(data_table_pos, self.a1_context())))
                        },
                    )
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        let should_expand_data_table =
            Sheet::should_expand_data_table(&data_tables_rects, clipboard_rect);

        let sheet = self.try_sheet(selection.sheet_id);

        // loop through the clipboard and replace cell references in formulas
        // and other languages.  Also grow data tables if the cell value is touching
        // the right or bottom edge of the clipboard.
        for tile_start_x in (insert_at.x..=max_x).step_by(clipboard.w as usize) {
            for tile_start_y in (insert_at.y..=max_y).step_by(clipboard.h as usize) {
                let dx = tile_start_x - clipboard.origin.x;
                let dy = tile_start_y - clipboard.origin.y;
                let adjust = match clipboard.operation {
                    ClipboardOperation::Cut => RefAdjust::NO_OP,
                    ClipboardOperation::Copy => RefAdjust {
                        sheet_id: None,
                        relative_only: true,
                        dx,
                        dy,
                        x_start: 0,
                        y_start: 0,
                    },
                };

                // restore the original columns for each pass to avoid replacing the replaced code cells
                clipboard.cells.columns = source_columns.to_owned();

                if !(adjust.is_no_op() && sheet_id == clipboard.origin.sheet_id) {
                    for (cols_x, col) in clipboard.cells.columns.iter_mut().enumerate() {
                        for (&cols_y, cell) in col {
                            // for non-code cells, we need to grow the data table if the cell value is touching the right or bottom edge
                            if should_expand_data_table && let Some(sheet) = sheet {
                                let new_x = tile_start_x + cols_x as i64;
                                let new_y = tile_start_y + cols_y as i64;
                                let current_pos = Pos::new(new_x, new_y);
                                let within_data_table =
                                    sheet.data_table_pos_that_contains(current_pos).is_some();

                                // we're not within a data table
                                // expand the data table to the right or bottom if the
                                // cell value is touching the right or bottom edge
                                if !within_data_table {
                                    GridController::grow_data_table(
                                        sheet,
                                        &mut data_tables_rects,
                                        &mut data_table_columns,
                                        &mut data_table_rows,
                                        SheetPos::new(sheet_id, new_x, new_y),
                                        cell.to_display().is_empty(),
                                    );
                                }
                            }
                        }
                    }
                }

                let (clipboard_op, code_ops) = self.get_clipboard_ops(
                    Pos::new(tile_start_x, tile_start_y),
                    Pos::new(tile_start_x - insert_at.x, tile_start_y - insert_at.y),
                    &mut cell_values,
                    &mut formats,
                    &mut borders,
                    selection,
                    &clipboard,
                    special,
                )?;
                clipboard_ops.extend(clipboard_op);
                compute_code_ops.extend(code_ops);
            }
        }

        // Adjust paste data for merged cells in the target sheet. Skip when we unmerged
        // existing merges in the paste area, since those merges will be gone when values apply.
        let merge_cell_ops = if !did_unmerge_in_paste_area {
            self.adjust_paste_for_merge_cells(
                selection.sheet_id,
                insert_at,
                &mut cell_values,
                &mut formats,
                &mut borders,
            )
        } else {
            vec![]
        };

        // cell values need to be set before the compute_code_ops
        if matches!(special, PasteSpecial::None | PasteSpecial::Values) {
            ops.extend(clipboard_ops);

            // Add operations for values redirected to anchor cells outside paste area
            ops.extend(merge_cell_ops);

            if !matches!(special, PasteSpecial::Values)
                && let Some(merge_rects) = &clipboard.merge_rects
            {
                for tile_start_x in (insert_at.x..=max_x).step_by(clipboard.w as usize) {
                    for tile_start_y in (insert_at.y..=max_y).step_by(clipboard.h as usize) {
                        let dx = tile_start_x - clipboard.origin.x;
                        let dy = tile_start_y - clipboard.origin.y;
                        for rect in merge_rects {
                            let dest_min = Pos {
                                x: rect.min.x + dx,
                                y: rect.min.y + dy,
                            };
                            let dest_max = Pos {
                                x: rect.max.x + dx,
                                y: rect.max.y + dy,
                            };
                            let mut merge_update = MergeCellsUpdate::default();
                            merge_update.set_rect(
                                dest_min.x,
                                dest_min.y,
                                Some(dest_max.x),
                                Some(dest_max.y),
                                Some(ClearOption::Some(dest_min)),
                            );
                            ops.push(Operation::SetMergeCells {
                                sheet_id: selection.sheet_id,
                                merge_cells_updates: merge_update,
                            });
                        }
                    }
                }
            }

            if !cell_values.is_empty() {
                ops.push(Operation::SetCellValues {
                    sheet_pos: insert_at.to_sheet_pos(selection.sheet_id),
                    values: cell_values,
                });
            }

            ops.extend(compute_code_ops);

            data_table_ops.extend(GridController::grow_data_table_operations(
                data_table_columns,
                data_table_rows,
            ));
        }

        if matches!(special, PasteSpecial::None | PasteSpecial::Formats) {
            if !formats.is_default() {
                ops.push(Operation::SetCellFormatsA1 {
                    sheet_id: selection.sheet_id,
                    formats,
                });
            }

            if !borders.is_empty() {
                ops.push(Operation::SetBordersA1 {
                    sheet_id: selection.sheet_id,
                    borders,
                });
            }
        }

        ops.push(Operation::SetCursorA1 {
            selection: selection.to_owned(),
        });

        Ok((ops, data_table_ops))
    }

    /// Adjusts cell values, formats, and borders for paste operations when the paste area
    /// overlaps with merged cells. This ensures:
    /// - Values are redirected to anchor cells
    /// - Formats are spread across entire merged cell ranges
    /// - Borders are consolidated to anchor cells with proper edge handling
    ///
    /// Returns additional operations for values that need to be set at anchor cells
    /// outside the paste area.
    fn adjust_paste_for_merge_cells(
        &self,
        sheet_id: SheetId,
        insert_at: Pos,
        cell_values: &mut CellValues,
        formats: &mut SheetFormatUpdates,
        borders: &mut BordersUpdates,
    ) -> Vec<Operation> {
        let mut additional_ops = vec![];

        let Some(sheet) = self.try_sheet(sheet_id) else {
            return additional_ops;
        };

        // Calculate the paste rect in absolute coordinates
        let paste_rect = Rect::from_numbers(
            insert_at.x,
            insert_at.y,
            cell_values.w as i64,
            cell_values.h as i64,
        );

        // Get all merged cells that intersect with the paste area
        let merged_cells = sheet.merge_cells.get_merge_cells(paste_rect);
        if merged_cells.is_empty() {
            return additional_ops;
        }

        // Track which merged cells have been processed (by anchor position)
        let mut processed_merges: std::collections::HashSet<Pos> = std::collections::HashSet::new();

        // Process each merged cell that overlaps with the paste area
        for merge_rect in &merged_cells {
            let anchor = merge_rect.min;

            // Skip if we've already processed this merge
            if processed_merges.contains(&anchor) {
                continue;
            }
            processed_merges.insert(anchor);

            // Calculate the intersection between paste area and merged cell
            let Some(intersection) = paste_rect.intersection(merge_rect) else {
                continue;
            };

            // --- Handle Values ---
            // Find the first non-blank value being pasted into this merged cell
            // Priority: anchor position first, then top-left-most
            let mut value_to_use: Option<CellValue> = None;

            // First check if anchor is being pasted to (anchor is within paste area)
            if paste_rect.contains(anchor) {
                let rel_x = (anchor.x - insert_at.x) as u32;
                let rel_y = (anchor.y - insert_at.y) as u32;
                if let Some(value) = cell_values.get(rel_x, rel_y)
                    && *value != CellValue::Blank
                {
                    value_to_use = Some(value.clone());
                }
            }

            // If no value at anchor, find the top-left-most value in the intersection
            if value_to_use.is_none() {
                'outer: for y in intersection.y_range() {
                    for x in intersection.x_range() {
                        let rel_x = (x - insert_at.x) as u32;
                        let rel_y = (y - insert_at.y) as u32;
                        if let Some(value) = cell_values.get(rel_x, rel_y)
                            && *value != CellValue::Blank
                        {
                            value_to_use = Some(value.clone());
                            break 'outer;
                        }
                    }
                }
            }

            // Clear all values in the intersection
            for y in intersection.y_range() {
                for x in intersection.x_range() {
                    let rel_x = (x - insert_at.x) as u32;
                    let rel_y = (y - insert_at.y) as u32;
                    cell_values.remove(rel_x, rel_y);
                }
            }

            // Set the value at the anchor
            if let Some(value) = value_to_use {
                if paste_rect.contains(anchor) {
                    // Anchor is within paste area, set directly in cell_values
                    let rel_x = (anchor.x - insert_at.x) as u32;
                    let rel_y = (anchor.y - insert_at.y) as u32;
                    cell_values.set(rel_x, rel_y, value);
                } else {
                    // Anchor is outside paste area, create a separate operation
                    let mut anchor_values = CellValues::new(1, 1);
                    anchor_values.set(0, 0, value);
                    additional_ops.push(Operation::SetCellValues {
                        sheet_pos: anchor.to_sheet_pos(sheet_id),
                        values: anchor_values,
                    });
                }
            }

            // --- Handle Formats ---
            // Spread the format from the anchor (or first overlapping position) to the entire merge
            let format_to_use = if intersection.contains(anchor) {
                formats.format_update(anchor)
            } else {
                // Use format from top-left-most position in intersection
                let mut format = None;
                'outer: for y in intersection.y_range() {
                    for x in intersection.x_range() {
                        let pos = Pos { x, y };
                        let f = formats.format_update(pos);
                        if !f.is_default() {
                            format = Some(f);
                            break 'outer;
                        }
                    }
                }
                format.unwrap_or_default()
            };

            // Apply format to entire merged cell rect (that's within paste bounds)
            // For cells outside paste area, we still want to apply formats to the whole merge
            if !format_to_use.is_default() {
                for y in merge_rect.y_range() {
                    for x in merge_rect.x_range() {
                        let pos = Pos { x, y };
                        formats.set_format_cell(pos, format_to_use.clone());
                    }
                }
            }

            // --- Handle Borders ---
            // Consolidate borders to the anchor cell
            // Clear internal borders within the merged cell
            Self::adjust_borders_for_merge_cell(merge_rect, &intersection, borders);
        }

        additional_ops
    }

    /// Adjusts borders for a single merged cell during paste.
    /// - Collects edge borders from the paste area
    /// - Stores them at the anchor cell
    /// - Clears internal borders
    fn adjust_borders_for_merge_cell(
        merge_rect: &Rect,
        intersection: &Rect,
        borders: &mut BordersUpdates,
    ) {
        use crate::ClearOption;
        use crate::grid::sheet::borders::BorderStyleTimestamp;

        let anchor = merge_rect.min;

        // Collect edge borders that should be applied to the anchor
        let mut anchor_top: Option<ClearOption<BorderStyleTimestamp>> = None;
        let mut anchor_bottom: Option<ClearOption<BorderStyleTimestamp>> = None;
        let mut anchor_left: Option<ClearOption<BorderStyleTimestamp>> = None;
        let mut anchor_right: Option<ClearOption<BorderStyleTimestamp>> = None;

        // Check if we're pasting to the top edge of the merged cell
        if intersection.min.y == merge_rect.min.y {
            // Get top border from any cell on the top row of intersection
            if let Some(ref top_borders) = borders.top {
                for x in intersection.x_range() {
                    if let Some(border) = top_borders.get(Pos {
                        x,
                        y: intersection.min.y,
                    }) {
                        anchor_top = Some(border);
                        break;
                    }
                }
            }
        }

        // Check if we're pasting to the bottom edge of the merged cell
        if intersection.max.y == merge_rect.max.y
            && let Some(ref bottom_borders) = borders.bottom
        {
            for x in intersection.x_range() {
                if let Some(border) = bottom_borders.get(Pos {
                    x,
                    y: intersection.max.y,
                }) {
                    anchor_bottom = Some(border);
                    break;
                }
            }
        }

        // Check if we're pasting to the left edge of the merged cell
        if intersection.min.x == merge_rect.min.x
            && let Some(ref left_borders) = borders.left
        {
            for y in intersection.y_range() {
                if let Some(border) = left_borders.get(Pos {
                    x: intersection.min.x,
                    y,
                }) {
                    anchor_left = Some(border);
                    break;
                }
            }
        }

        // Check if we're pasting to the right edge of the merged cell
        if intersection.max.x == merge_rect.max.x
            && let Some(ref right_borders) = borders.right
        {
            for y in intersection.y_range() {
                if let Some(border) = right_borders.get(Pos {
                    x: intersection.max.x,
                    y,
                }) {
                    anchor_right = Some(border);
                    break;
                }
            }
        }

        // Clear all borders within the intersection
        for y in intersection.y_range() {
            for x in intersection.x_range() {
                let pos = Pos { x, y };
                if let Some(ref mut top) = borders.top {
                    top.set(pos, None);
                }
                if let Some(ref mut bottom) = borders.bottom {
                    bottom.set(pos, None);
                }
                if let Some(ref mut left) = borders.left {
                    left.set(pos, None);
                }
                if let Some(ref mut right) = borders.right {
                    right.set(pos, None);
                }
            }
        }

        // Set the collected borders at the anchor
        if let Some(top) = anchor_top {
            borders.top.get_or_insert_default().set(anchor, Some(top));
        }
        if let Some(bottom) = anchor_bottom {
            borders
                .bottom
                .get_or_insert_default()
                .set(anchor, Some(bottom));
        }
        if let Some(left) = anchor_left {
            borders.left.get_or_insert_default().set(anchor, Some(left));
        }
        if let Some(right) = anchor_right {
            borders
                .right
                .get_or_insert_default()
                .set(anchor, Some(right));
        }
    }

    /// If the clipboard is larger than the selection, we need to paste multiple times.
    /// We don't want the paste to exceed the bounds of the selection (e.g. end_pos).
    fn get_max_paste_area(
        insert_at: Pos,
        end_pos: Pos,
        clipboard_width: u32,
        clipboard_height: u32,
    ) -> (i64, i64, i64, i64) {
        let max_x = {
            let width = (end_pos.x - insert_at.x + 1) as f64;
            let multiples = ((width / clipboard_width as f64).floor() as i64).max(0);
            let max_x = insert_at.x + (multiples * clipboard_width as i64) - 1;

            max_x.max(insert_at.x)
        };
        let max_y = {
            let height = (end_pos.y - insert_at.y + 1) as f64;
            let multiples = ((height / clipboard_height as f64).floor() - 1.0).max(0.0) as i64;
            let max_y = insert_at.y + (multiples * clipboard_height as i64);

            max_y.max(insert_at.y)
        };

        let cell_value_width = max_x - insert_at.x + 1;
        let cell_value_height = max_y - insert_at.y + 1;

        (max_x, max_y, cell_value_width, cell_value_height)
    }

    pub fn move_cells_operations(
        &mut self,
        source: SheetRect,
        dest: SheetPos,
        columns: bool,
        rows: bool,
    ) -> Vec<Operation> {
        vec![Operation::MoveCells {
            source,
            dest,
            columns,
            rows,
        }]
    }
}

#[cfg(test)]
mod test {
    use super::{PasteSpecial, *};
    use crate::Rect;
    use crate::a1::{A1Context, A1Selection, CellRefRange, ColRange, TableRef};
    use crate::controller::active_transactions::transaction_name::TransactionName;
    use crate::controller::user_actions::import::tests::{simple_csv, simple_csv_at};
    use crate::grid::js_types::JsClipboard;
    use crate::grid::sheet::validations::rules::ValidationRule;
    use crate::grid::{CellWrap, CodeCellLanguage, SheetId};
    use crate::test_util::*;
    use crate::wasm_bindings::js::{clear_js_calls, expect_js_call};

    fn paste(
        gc: &mut GridController,
        sheet_id: SheetId,
        x: i64,
        y: i64,
        js_clipboard: JsClipboard,
    ) {
        gc.paste_from_clipboard(
            &A1Selection::from_xy(x, y, sheet_id),
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );
    }

    fn simple_csv_selection(
        sheet_id: SheetId,
        table_ref: TableRef,
        rect: Rect,
    ) -> (A1Selection, A1Context) {
        let cell_ref_range = CellRefRange::Table { range: table_ref };
        let context = A1Context::test(
            &[("Sheet1", sheet_id)],
            &[(
                "simple.csv",
                &["city", "region", "country", "population"],
                rect,
            )],
        );
        let selection = A1Selection::from_range(cell_ref_range, sheet_id, &context);

        (selection, context)
    }

    #[test]
    fn move_cell_operations() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let source = (0, 0, 2, 2, sheet_id).into();
        let dest = (2, 2, sheet_id).into();
        let operations = gc.move_cells_operations(source, dest, false, false);
        assert_eq!(operations.len(), 1);
        assert_eq!(
            operations[0],
            Operation::MoveCells {
                source,
                dest,
                columns: false,
                rows: false
            }
        );
    }

    #[test]
    fn paste_clipboard_cells_columns() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_values(1, 5, 1, 5, vec!["1", "2", "3", "4", "5"]);
        let selection = A1Selection::test_a1("A");
        let sheet = gc.sheet(sheet_id);
        let clipboard =
            sheet.copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true);
        let selection = A1Selection::test_a1("E");
        let insert_at = selection.cursor;
        let operations = gc
            .paste_html_operations(
                insert_at,
                insert_at,
                &selection,
                clipboard,
                PasteSpecial::None,
            )
            .unwrap()
            .0;
        gc.start_user_ai_transaction(operations, None, TransactionName::PasteClipboard, false);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_value_ref((5, 5).into()),
            Some(&CellValue::Number(1.into()))
        );
    }

    #[test]
    fn paste_clipboard_cells_rows() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_values(5, 2, 5, 1, vec!["1", "2", "3", "4", "5"]);
        let selection: A1Selection = A1Selection::test_a1("2");
        let sheet = gc.sheet(sheet_id);
        let clipboard =
            sheet.copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true);
        let selection = A1Selection::test_a1("5");
        let insert_at = selection.cursor;
        let operations = gc
            .paste_html_operations(
                insert_at,
                insert_at,
                &selection,
                clipboard,
                PasteSpecial::None,
            )
            .unwrap()
            .0;
        gc.start_user_ai_transaction(operations, None, TransactionName::PasteClipboard, false);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_value_ref((9, 5).into()),
            Some(&CellValue::Number(5.into()))
        );
    }

    #[test]
    fn paste_clipboard_cells_all() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_values(3, 3, 2, 2, vec!["1", "2", "3", "4"]);

        let a1_context = gc.a1_context().to_owned();
        gc.sheet_mut(sheet_id).recalculate_bounds(&a1_context);
        let selection = A1Selection::all(sheet_id);
        let sheet = gc.sheet(sheet_id);
        let clipboard =
            sheet.copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true);
        gc.add_sheet(None, None, None, false);

        let sheet_id = gc.sheet_ids()[1];
        let insert_at = selection.cursor;
        let operations = gc
            .paste_html_operations(
                insert_at,
                insert_at,
                &A1Selection::all(sheet_id),
                clipboard,
                PasteSpecial::None,
            )
            .unwrap()
            .0;
        gc.start_user_ai_transaction(operations, None, TransactionName::PasteClipboard, false);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_value_ref((3, 3).into()),
            Some(&CellValue::Number(1.into()))
        );
    }

    #[test]
    fn sheet_formats_operations_column_rows() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.formats.bold.set_rect(1, 1, Some(2), None, Some(true));
        sheet
            .formats
            .italic
            .set_rect(1, 3, None, Some(4), Some(true));

        let sheet = gc.sheet(sheet_id);
        let selection = A1Selection::test_a1("A:B,3:4,A3");
        let js_clipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        gc.paste_from_clipboard(
            &A1Selection::from_xy(3, 3, sheet_id),
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.formats.italic.get(pos![C3]), None);
        assert_eq!(sheet.formats.italic.get(pos![C4]), None);
        assert_eq!(sheet.formats.italic.get(pos![C5]), Some(true));
        assert_eq!(sheet.formats.italic.get(pos![C6]), Some(true));

        assert_eq!(sheet.formats.italic.get(pos![A3]), Some(true));
        assert_eq!(sheet.formats.bold.get(pos![A3]), Some(true));
        assert_eq!(sheet.formats.italic.get(pos![B3]), Some(true));
        assert_eq!(sheet.formats.bold.get(pos![B3]), Some(true));
    }

    #[test]
    fn set_clipboard_validations() {
        let gc = GridController::test();
        let validations = ClipboardValidations {
            validations: vec![Validation {
                id: Uuid::new_v4(),
                selection: A1Selection::test_a1("A1:B2"),
                rule: ValidationRule::Logical(Default::default()),
                message: Default::default(),
                error: Default::default(),
            }],
        };
        let operations = gc.clipboard_validations_operations(
            &Some(validations),
            SheetPos {
                x: 2,
                y: 2,
                sheet_id: SheetId::TEST,
            },
        );
        assert_eq!(operations.len(), 1);
        if let Operation::SetValidation { validation } = &operations[0] {
            assert_eq!(validation.selection, A1Selection::test_a1("B2:C3"));
        } else {
            panic!("Expected SetValidation operation");
        }
    }

    #[test]
    fn paste_clipboard_with_formula() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        gc.set_cell_values(
            pos![sheet_id!B1],
            vec![vec!["1".into()], vec!["2".into()], vec!["3".into()]],
            None,
            false,
        );

        gc.set_code_cell(
            pos![sheet_id!A4],
            CodeCellLanguage::Formula,
            "SUM(B1:B3)".to_string(),
            None,
            None,
            false,
        );

        assert_eq!(
            gc.sheet(sheet_id).get_code_cell_value(pos![A4]),
            Some(CellValue::Number(6.into()))
        );

        let selection = A1Selection::test_a1("A1:B5");
        let js_clipboard = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        gc.paste_from_clipboard(
            &A1Selection::test_a1("E6"),
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );

        assert_code_language(
            &gc,
            pos![sheet_id!E9],
            CodeCellLanguage::Formula,
            "SUM(F6:F8)".to_string(),
        );

        assert_eq!(
            gc.sheet(sheet_id).get_code_cell_value(pos![E9]),
            Some(CellValue::Number(6.into()))
        );
    }

    #[test]
    fn paste_clipboard_across_sheets_with_formula() {
        let mut gc = GridController::new();
        gc.add_sheet(None, None, None, false);
        let sheet1 = gc.sheet_ids()[0];
        let sheet2 = gc.sheet_ids()[1];

        gc.set_cell_value(pos![sheet1!B1], "1".into(), None, false);
        gc.set_cell_value(pos![sheet1!B2], "2".into(), None, false);
        gc.set_cell_value(pos![sheet1!B3], "3".into(), None, false);
        gc.set_cell_value(pos![sheet1!B4], "4".into(), None, false);
        gc.set_cell_value(pos![sheet1!B5], "5".into(), None, false);
        gc.set_cell_value(pos![sheet1!B6], "6".into(), None, false);
        gc.set_cell_value(pos![sheet1!C4], "100".into(), None, false);

        gc.set_cell_value(pos![sheet2!B2], "50".into(), None, false);
        gc.set_cell_value(pos![sheet2!C4], "1000".into(), None, false);

        let s1 = gc.sheet(sheet1).name.clone();
        let s2 = gc.sheet(sheet2).name.clone();
        assert_ne!(s1, s2);

        gc.set_code_cell(
            pos![sheet1!A4],
            CodeCellLanguage::Formula,
            format!("SUM(B1:B3, B4:B6, {s1}!C4, {s2}!C4)"),
            None,
            None,
            false,
        );

        let get_code_cell_value_str = |gc: &GridController, sheet_pos: SheetPos| {
            gc.sheet(sheet_pos.sheet_id)
                .get_code_cell_value(sheet_pos.into())
                .unwrap()
                .to_string()
        };

        assert_eq!("1121", get_code_cell_value_str(&gc, pos![sheet1!A4]));

        let a4_sel = A1Selection::from_single_cell(pos![sheet1!A4]);
        let a3_sel = A1Selection::from_single_cell(pos![sheet1!A3]);

        // copy within sheet
        let js_clipboard = gc
            .sheet(sheet1)
            .copy_to_clipboard(&a4_sel, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();
        gc.paste_from_clipboard(&a3_sel, js_clipboard, PasteSpecial::None, None, false);

        // all references should have updated
        assert_code_language(
            &gc,
            pos![sheet1!A3],
            CodeCellLanguage::Formula,
            format!("SUM(#REF!, B3:B5, {s1}!C3, {s2}!C3)"),
        );
        // code cell should have been re-evaluated
        assert_eq!(
            "Bad cell reference",
            get_code_cell_value_str(&gc, pos![sheet1!A3])
        );

        // cut within sheet
        let js_clipboard = gc
            .sheet(sheet1)
            .copy_to_clipboard(&a4_sel, gc.a1_context(), ClipboardOperation::Cut, true)
            .into();
        gc.paste_from_clipboard(&a3_sel, js_clipboard, PasteSpecial::None, None, false);
        // all references should have stayed the same
        assert_code_language(
            &gc,
            pos![sheet1!A3],
            CodeCellLanguage::Formula,
            format!("SUM(B1:B3, B4:B6, {s1}!C4, {s2}!C4)"),
        );
        // code cell should have the same value
        assert_eq!("1121", get_code_cell_value_str(&gc, pos![sheet1!A3]));

        // copy to other sheet
        let js_clipboard = gc
            .sheet(sheet1)
            .copy_to_clipboard(&a3_sel, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();
        gc.paste_from_clipboard(
            &A1Selection::from_single_cell(pos![sheet2!A4]),
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );
        // all references should have updated
        assert_code_language(
            &gc,
            pos![sheet2!A4],
            CodeCellLanguage::Formula,
            format!("SUM(B2:B4, B5:B7, {s1}!C5, {s2}!C5)"),
        );
        // code cell should have been re-evaluated
        assert_eq!("50", get_code_cell_value_str(&gc, pos![sheet2!A4]));

        // cut to other sheet
        let js_clipboard = gc
            .sheet(sheet1)
            .copy_to_clipboard(&a3_sel, gc.a1_context(), ClipboardOperation::Cut, true)
            .into();
        gc.paste_from_clipboard(
            &A1Selection::from_single_cell(pos![sheet2!A4]),
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );
        // all references should have updated to have a sheet name
        assert_code_language(
            &gc,
            pos![sheet2!A4],
            CodeCellLanguage::Formula,
            format!("SUM({s1}!B1:B3, {s1}!B4:B6, {s1}!C4, {s2}!C4)"),
        );
        // code cell should have the same value
        assert_eq!("1121", get_code_cell_value_str(&gc, pos![sheet2!A4]));
    }

    #[test]
    fn copy_paste_clipboard_with_data_table() {
        clear_js_calls();

        let (mut gc, sheet_id, _, _) = simple_csv();
        let paste = |gc: &mut GridController, x, y, js_clipboard| {
            let selection = A1Selection::from_xy(x, y, sheet_id);
            gc.paste_from_clipboard(&selection, js_clipboard, PasteSpecial::None, None, false);
        };

        let table_ref = TableRef::new("simple.csv");
        let (selection, context) =
            simple_csv_selection(sheet_id, table_ref, Rect::test_a1("A1:D11"));

        let js_clipboard = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, &context, ClipboardOperation::Copy, true)
            .into();

        let expected_row1 = vec!["city", "region", "country", "population"];

        // paste side by side
        paste(&mut gc, 10, 1, js_clipboard);
        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(10, 1, 4, 11));
        assert_cell_value_row(&gc, sheet_id, 10, 13, 2, expected_row1);

        let cursor = A1Selection::from_rect(SheetRect::from_numbers(10, 1, 1, 1, sheet_id));
        expect_js_call("jsSetCursor", serde_json::to_string(&cursor).unwrap(), true);
    }

    #[test]
    fn cut_paste_clipboard_with_data_table() {
        let (mut gc, sheet_id, _, _) = simple_csv();
        let table_ref = TableRef::new("simple.csv");
        let (selection, _) = simple_csv_selection(sheet_id, table_ref, Rect::test_a1("A1:BV11"));

        let (clipboard, ops) = gc.cut_to_clipboard_operations(&selection, true).unwrap();
        gc.start_user_ai_transaction(ops, None, TransactionName::CutClipboard, false);

        let expected_row1 = vec!["city", "region", "country", "population"];

        // paste side by side
        let js_clipboard = clipboard.into();
        paste(&mut gc, sheet_id, 10, 1, js_clipboard);
        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(10, 1, 4, 11));
        assert_cell_value_row(&gc, sheet_id, 10, 13, 2, expected_row1);
    }

    #[test]
    fn copy_paste_clipboard_first_column_of_data_table() {
        clear_js_calls();

        let (mut gc, sheet_id, _, _) = simple_csv();

        let table_ref = TableRef {
            table_name: "simple.csv".to_string(),
            data: true,
            headers: false,
            totals: false,
            col_range: ColRange::Col("city".to_string()),
        };
        let (selection, context) =
            simple_csv_selection(sheet_id, table_ref, Rect::test_a1("A1:D11"));

        let js_clipboard = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, &context, ClipboardOperation::Copy, true)
            .into();

        let expected_header_row = vec!["city", "", "", ""];
        let expected_first_data = vec!["Southborough", "", "", ""];

        // paste side by side
        paste(&mut gc, sheet_id, 10, 1, js_clipboard);
        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(10, 1, 4, 11));
        assert_cell_value_row(&gc, sheet_id, 10, 13, 1, expected_header_row);
        assert_cell_value_row(&gc, sheet_id, 10, 13, 2, expected_first_data);

        // let cursor = A1Selection::table(pos![J2].to_sheet_pos(sheet_id), "simple.csv1");
        // expect_js_call("jsSetCursor", serde_json::to_string(&cursor).unwrap(), true);
    }

    #[test]
    fn copy_paste_clipboard_first_2_columns_of_data_table() {
        clear_js_calls();

        let (mut gc, sheet_id, _, _) = simple_csv();

        let table_ref = TableRef {
            table_name: "simple.csv".to_string(),
            data: true,
            headers: false,
            totals: false,
            col_range: ColRange::ColRange("city".to_string(), "region".to_string()),
        };
        let (selection, context) =
            simple_csv_selection(sheet_id, table_ref, Rect::test_a1("A1:D11"));

        let js_clipboard = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, &context, ClipboardOperation::Copy, true)
            .into();

        let expected_header_row = vec!["city", "region", "", ""];
        let expected_first_data = vec!["Southborough", "MA", "", ""];

        // paste side by side
        paste(&mut gc, sheet_id, 10, 1, js_clipboard);
        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(10, 1, 4, 11));
        assert_cell_value_row(&gc, sheet_id, 10, 13, 1, expected_header_row);
        assert_cell_value_row(&gc, sheet_id, 10, 13, 2, expected_first_data);

        // let cursor = A1Selection::table(pos![J2].to_sheet_pos(sheet_id), "simple.csv1");
        // expect_js_call("jsSetCursor", serde_json::to_string(&cursor).unwrap(), true);
    }

    #[test]
    fn copy_paste_clipboard_last_2_columns_of_data_table() {
        clear_js_calls();

        let (mut gc, sheet_id, _, _) = simple_csv();

        let table_ref = TableRef {
            table_name: "simple.csv".to_string(),
            data: true,
            headers: false,
            totals: false,
            col_range: ColRange::ColRange("country".to_string(), "population".to_string()),
        };
        let (selection, context) =
            simple_csv_selection(sheet_id, table_ref, Rect::test_a1("A1:D11"));

        let js_clipboard = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, &context, ClipboardOperation::Copy, true)
            .into();

        let expected_header_row = vec!["country", "population", "", ""];
        let expected_first_data = vec!["United States", "9686", "", ""];

        // paste side by side
        paste(&mut gc, sheet_id, 10, 1, js_clipboard);
        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(10, 1, 4, 11));
        assert_cell_value_row(&gc, sheet_id, 10, 13, 1, expected_header_row);
        assert_cell_value_row(&gc, sheet_id, 10, 13, 2, expected_first_data);

        // let cursor = A1Selection::table(pos![J2].to_sheet_pos(sheet_id), "simple.csv1");
        // expect_js_call("jsSetCursor", serde_json::to_string(&cursor).unwrap(), true);
    }

    // TODO(ddimaria): implement once we decide to take on the work
    // we currently copy a single rectangle, so copying two non-touching columns captures the gap
    // #[test]
    // fn copy_paste_clipboard_2_non_touching_columns_of_data_table() {
    //     clear_js_calls();

    //     let (mut gc, sheet_id, _, _) = simple_csv();

    //     let context = A1Context::test(
    //         &[("Sheet1", sheet_id)],
    //         &[(
    //             "simple.csv",
    //             &["city", "region", "country", "population"],
    //             Rect::test_a1("A1:D11"),
    //         )],
    //     );

    //     let mut range = TableRef {
    //         table_name: "simple.csv".to_string(),
    //         data: true,
    //         headers: false,
    //         totals: false,
    //         col_range: ColRange::Col("city".to_string()),
    //     };
    //     let cell_ref_range_1 = CellRefRange::Table {
    //         range: range.clone(),
    //     };
    //     range.col_range = ColRange::Col("country".to_string());
    //     let cell_ref_range_2 = CellRefRange::Table { range };

    //     let selection =
    //         A1Selection::from_ranges(vec![cell_ref_range_1, cell_ref_range_2], sheet_id, &context)
    //             .unwrap();
    //     let JsClipboard { html, .. } = gc
    //         .sheet(sheet_id)
    //         .copy_to_clipboard(&selection, &context, ClipboardOperation::Copy, false)
    //         .unwrap();

    //     let expected_header_row = vec!["city", "country"];
    //     let expected_first_data = vec!["Southborough", "United States"];

    //     // paste side by side
    //     paste(&mut gc, sheet_id, 10, 1, html.clone());
    //     print_table(&gc, sheet_id, Rect::from_numbers(10, 1, 4, 11));
    //     assert_cell_value_row(&gc, sheet_id, 10, 13, 1, expected_header_row);
    //     assert_cell_value_row(&gc, sheet_id, 10, 13, 2, expected_first_data);

    //     // let cursor = A1Selection::table(pos![J2].to_sheet_pos(sheet_id), "simple.csv1");
    //     // expect_js_call("jsSetCursor", serde_json::to_string(&cursor).unwrap(), true);
    // }

    #[test]
    fn update_code_cell_references_python() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_code_cell(
            pos![C3].to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            r#"q.cells("A1:B2", first_row_header=True)"#.to_string(),
            None,
            None,
            false,
        );

        let selection = A1Selection::test_a1("A1:E5");
        let js_clipboard = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        gc.paste_from_clipboard(
            &A1Selection::test_a1("E6"),
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );

        assert_code_language(
            &gc,
            pos![sheet_id!G8],
            CodeCellLanguage::Python,
            r#"q.cells("E6:F7", first_row_header=True)"#.to_string(),
        );
    }

    #[test]
    fn paste_clipboard_on_top_of_data_table() {
        let (mut gc, sheet_id, _, _) = simple_csv_at(Pos { x: 2, y: 0 });
        let sheet = gc.sheet_mut(sheet_id);
        let rect = SheetRect::from_numbers(10, 0, 2, 2, sheet.id);

        sheet.test_set_values(10, 0, 2, 2, vec!["1", "2", "3", "4"]);
        let sheet = gc.sheet(sheet_id);
        let js_clipboard: JsClipboard = sheet
            .copy_to_clipboard(
                &A1Selection::from_rect(rect),
                gc.a1_context(),
                ClipboardOperation::Copy,
                true,
            )
            .into();

        let paste = |gc: &mut GridController, x, y, js_clipboard| {
            gc.paste_from_clipboard(
                &A1Selection::from_xy(x, y, sheet_id),
                js_clipboard,
                PasteSpecial::None,
                None,
                false,
            );
        };

        let expected_row1 = vec!["1", "2"];
        let expected_row2 = vec!["3", "4"];

        // paste overlap inner
        paste(&mut gc, 4, 2, js_clipboard.clone());
        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(0, 0, 8, 11));
        assert_cell_value_row(&gc, sheet_id, 4, 5, 2, expected_row1.clone());
        assert_cell_value_row(&gc, sheet_id, 4, 5, 3, expected_row2.clone());
        gc.undo(1, None, false);

        // paste overlap with right grid
        paste(&mut gc, 5, 2, js_clipboard.clone());
        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(0, 0, 8, 11));
        assert_cell_value_row(&gc, sheet_id, 5, 6, 2, expected_row1.clone());
        assert_cell_value_row(&gc, sheet_id, 5, 6, 3, expected_row2.clone());
        gc.undo(1, None, false);

        // paste overlap with bottom grid
        paste(&mut gc, 4, 10, js_clipboard.clone());
        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(0, 0, 8, 12));
        assert_cell_value_row(&gc, sheet_id, 4, 5, 10, expected_row1.clone());
        assert_cell_value_row(&gc, sheet_id, 4, 5, 11, expected_row2.clone());
        gc.undo(1, None, false);

        // paste overlap with bottom left grid
        paste(&mut gc, 1, 10, js_clipboard.clone());
        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(0, 0, 8, 12));
        // print_table(&gc, sheet_id, Rect::from_numbers(1, 10, 2, 2));
        assert_cell_value_row(&gc, sheet_id, 1, 2, 10, expected_row1.clone());
        assert_cell_value_row(&gc, sheet_id, 1, 2, 11, expected_row2.clone());
        gc.undo(1, None, false);

        // paste overlap with top left grid
        paste(&mut gc, 3, 0, js_clipboard);
        print_table_in_rect(&gc, sheet_id, Rect::from_numbers(2, 0, 4, 4));
        // print_table(&gc, sheet_id, Rect::from_numbers(2, 0, 4, 4));
        // assert_cell_value_row(&gc, sheet_id, 1, 2, 10, expected_row1.clone());
        // assert_cell_value_row(&gc, sheet_id, 1, 2, 11, expected_row2.clone());
        gc.undo(1, None, false);
    }

    #[test]
    fn update_code_cell_references_javascript() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_code_cell(
            pos![C3].to_sheet_pos(sheet_id),
            CodeCellLanguage::Javascript,
            r#"return q.cells("A1:B2");"#.to_string(),
            None,
            None,
            false,
        );

        let selection = A1Selection::test_a1("A1:E5");
        let js_clipboard = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        gc.paste_from_clipboard(
            &A1Selection::test_a1("E6"),
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );

        assert_code_language(
            &gc,
            pos![sheet_id!G8],
            CodeCellLanguage::Javascript,
            r#"return q.cells("E6:F7");"#.to_string(),
        );
    }

    #[test]
    fn paste_code_cell_inside_data_table() {
        clear_js_calls();

        let (mut gc, sheet_id, _, _) = simple_csv_at(pos![A1]);

        gc.set_code_cell(
            pos![J1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Javascript,
            r#"return "test";"#.to_string(),
            None,
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let rect = SheetRect::single_pos(pos![J1], sheet_id);
        let clipboard = sheet.copy_to_clipboard(
            &A1Selection::from_rect(rect),
            gc.a1_context(),
            ClipboardOperation::Copy,
            true,
        );
        let selection = A1Selection::test_a1_sheet_id("B2", sheet_id);
        let insert_at = selection.cursor;

        assert!(
            gc.paste_html_operations(
                insert_at,
                insert_at,
                &selection,
                clipboard,
                PasteSpecial::None,
            )
            .is_err()
        );

        expect_js_call(
            "jsClientMessage",
            format!(
                "Cannot place JavaScript within a table,{}",
                crate::grid::js_types::JsSnackbarSeverity::Error
            ),
            true,
        );

        assert_display_cell_value(&gc, sheet_id, 2, 3, "MA");
    }

    #[test]
    fn paste_plain_html_inside_data_table() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos![E2]);

        gc.set_cell_value(
            pos![B2].to_sheet_pos(sheet_id),
            "1".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            pos![C2].to_sheet_pos(sheet_id),
            "123,456".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            pos![B3].to_sheet_pos(sheet_id),
            "654,321".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            pos![C3].to_sheet_pos(sheet_id),
            "4".to_string(),
            None,
            false,
        );

        // hide the second column
        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();
        let mut column_headers = data_table.column_headers.to_owned().unwrap();
        column_headers[1].display = false;
        gc.test_data_table_update_meta(
            pos.to_sheet_pos(sheet_id),
            Some(column_headers),
            None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(pos![E13]).unwrap(),
            CellValue::Text("Concord".to_string())
        );
        assert_eq!(
            sheet.display_value(pos![F13]).unwrap(),
            CellValue::Text("United States".to_string())
        );
        assert!(sheet.cell_format(pos![E13]).is_table_default());
        assert!(sheet.cell_format(pos![F13]).is_table_default());
        assert!(sheet.cell_format(pos![E14]).is_default());
        assert!(sheet.cell_format(pos![F14]).is_default());

        let js_clipboard = gc
            .sheet(sheet_id)
            .copy_to_clipboard(
                &A1Selection::test_a1_sheet_id("B2:C3", sheet_id),
                gc.a1_context(),
                ClipboardOperation::Copy,
                true,
            )
            .into();

        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("E13", sheet_id),
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(pos![E13]).unwrap(),
            CellValue::Number(1.into())
        );
        assert_eq!(
            sheet.display_value(pos![F13]).unwrap(),
            CellValue::Number(123456.into())
        );
        assert_eq!(
            sheet.display_value(pos![E14]).unwrap(),
            CellValue::Number(654321.into())
        );
        assert_eq!(
            sheet.display_value(pos![F14]).unwrap(),
            CellValue::Number(4.into())
        );
        assert!(sheet.cell_format(pos![E13]).is_table_default());
        assert_eq!(
            sheet.cell_format(pos![F13]),
            Format {
                wrap: Some(CellWrap::Clip),
                numeric_commas: Some(true),
                ..Default::default()
            }
        );
        // maybe it shouldn't adjust it when you merge the table? just translate the formats
        assert_eq!(
            sheet.cell_format(pos![E14]),
            Format {
                wrap: Some(CellWrap::Clip),
                numeric_commas: Some(true),
                ..Default::default()
            }
        );

        // show the second column
        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();
        let mut column_headers = data_table.column_headers.to_owned().unwrap();
        column_headers[1].display = true;
        gc.test_data_table_update_meta(
            pos.to_sheet_pos(sheet_id),
            Some(column_headers),
            None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(pos![E13]).unwrap(),
            CellValue::Number(1.into())
        );
        assert_eq!(
            sheet.display_value(pos![F13]).unwrap(),
            CellValue::Text("NH".to_string())
        );
        assert_eq!(
            sheet.display_value(pos![G13]).unwrap(),
            CellValue::Number(123456.into())
        );
        assert_eq!(
            sheet.display_value(pos![E14]).unwrap(),
            CellValue::Number(654321.into())
        );

        // todo: pasting formatting does not handle hidden columns properly
        // assert_eq!(
        //     sheet.display_value(pos![F14]).unwrap(),
        //     CellValue::Number(4.into())
        // );
        // assert!(sheet.cell_format(pos![E13]).is_table_default());
        // assert!(!sheet.cell_format(pos![F14]).is_table_default());
        // assert!(sheet.cell_format(pos![F13]).is_table_default());
        assert_eq!(
            sheet.cell_format(pos![G13]),
            Format {
                wrap: Some(CellWrap::Clip),
                numeric_commas: Some(true),
                ..Default::default()
            }
        );
        assert_eq!(
            sheet.cell_format(pos![E14]),
            Format {
                wrap: Some(CellWrap::Clip),
                numeric_commas: Some(true),
                ..Default::default()
            }
        );
    }

    #[test]
    fn paste_plain_text_inside_data_table() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos![E2]);

        gc.set_cell_value(
            pos![B2].to_sheet_pos(sheet_id),
            "1".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            pos![C2].to_sheet_pos(sheet_id),
            "123,456".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            pos![B3].to_sheet_pos(sheet_id),
            "654,321".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            pos![C3].to_sheet_pos(sheet_id),
            "4".to_string(),
            None,
            false,
        );

        // hide the second column
        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();
        let mut column_headers = data_table.column_headers.to_owned().unwrap();
        column_headers[1].display = false;
        gc.test_data_table_update_meta(
            pos.to_sheet_pos(sheet_id),
            Some(column_headers),
            None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(pos![E13]).unwrap(),
            CellValue::Text("Concord".to_string())
        );
        assert_eq!(
            sheet.display_value(pos![F13]).unwrap(),
            CellValue::Text("United States".to_string())
        );
        assert!(sheet.cell_format(pos![E13]).is_table_default());
        assert!(sheet.cell_format(pos![F13]).is_table_default());
        assert!(sheet.cell_format(pos![E14]).is_default());
        assert!(sheet.cell_format(pos![F14]).is_default());

        let mut js_clipboard: JsClipboard = gc
            .sheet(sheet_id)
            .copy_to_clipboard(
                &A1Selection::test_a1_sheet_id("B2:C3", sheet_id),
                gc.a1_context(),
                ClipboardOperation::Copy,
                true,
            )
            .into();
        js_clipboard.html = "".to_string();

        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("E13", sheet_id),
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(pos![E13]).unwrap(),
            CellValue::Number(1.into())
        );
        assert_eq!(
            sheet.display_value(pos![F13]).unwrap(),
            CellValue::Number(123456.into())
        );
        assert_eq!(
            sheet.display_value(pos![E14]).unwrap(),
            CellValue::Number(654321.into())
        );
        assert_eq!(
            sheet.display_value(pos![F14]).unwrap(),
            CellValue::Number(4.into())
        );
        assert!(sheet.cell_format(pos![E13]).is_table_default());
        assert!(sheet.cell_format(pos![F13]).is_table_default());
        assert!(sheet.cell_format(pos![E14]).is_default());
        assert!(sheet.cell_format(pos![F14]).is_default());

        // show the second column
        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();
        let mut column_headers = data_table.column_headers.to_owned().unwrap();
        column_headers[1].display = true;
        gc.test_data_table_update_meta(
            pos.to_sheet_pos(sheet_id),
            Some(column_headers),
            None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(pos![E13]).unwrap(),
            CellValue::Number(1.into())
        );
        assert_eq!(
            sheet.display_value(pos![F13]).unwrap(),
            CellValue::Text("NH".to_string())
        );
        assert_eq!(
            sheet.display_value(pos![G13]).unwrap(),
            CellValue::Number(123456.into())
        );
        assert_eq!(
            sheet.display_value(pos![E14]).unwrap(),
            CellValue::Number(654321.into())
        );
        assert_eq!(
            sheet.display_value(pos![F14]).unwrap(),
            CellValue::Number(4.into())
        );
        assert!(sheet.cell_format(pos![E13]).is_table_default());
        assert!(sheet.cell_format(pos![F13]).is_table_default());
        assert!(sheet.cell_format(pos![G13]).is_table_default());
        assert!(sheet.cell_format(pos![E14]).is_default());
        assert!(sheet.cell_format(pos![F14]).is_default());
    }

    #[test]
    fn test_paste_chart_over_chart() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        let dt = test_create_html_chart(&mut gc, sheet_id, pos![A1], 5, 5);
        let mut selection = A1Selection::table(pos![sheet_id!A1], dt.name());
        selection.cursor = pos![A1];
        let sheet = gc.sheet(sheet_id);
        let js_clipboard = sheet
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        gc.paste_from_clipboard(&selection, js_clipboard, PasteSpecial::None, None, false);

        // ensures we're pasting over the chart (there was a bug where it would
        // paste under the chart and cause a spill)
        assert_table_count(&gc, sheet_id, 1);
    }

    #[test]
    fn test_paste_clipboard_next_to_data_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![A1], 3, 3);
        let data_table = gc.sheet(sheet_id).data_table_at(&pos![A1]).unwrap();
        assert_eq!(data_table.width(), 3);
        assert_eq!(data_table.height(false), 5);

        let rect = SheetRect::single_pos(pos![A3], sheet_id);
        let js_clipboard: JsClipboard = gc
            .sheet(sheet_id)
            .copy_to_clipboard(
                &A1Selection::from_rect(rect),
                gc.a1_context(),
                ClipboardOperation::Copy,
                true,
            )
            .into();

        // paste cell to the right of the data table
        paste(&mut gc, sheet_id, 4, 3, js_clipboard.clone());
        let data_table = gc.sheet(sheet_id).data_table_at(&pos![A1]).unwrap();
        assert_eq!(data_table.width(), 4);

        // paste cell to the bottom of the data table
        paste(&mut gc, sheet_id, 1, 6, js_clipboard);
        let data_table = gc.sheet(sheet_id).data_table_at(&pos![A1]).unwrap();
        assert_eq!(data_table.height(false), 6);
    }

    #[test]
    fn test_paste_special() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_values(
            SheetPos {
                x: 2,
                y: 1,
                sheet_id,
            },
            vec![vec!["1".into(), "2".into(), "3".into()]],
            None,
            false,
        );

        gc.set_bold(
            &A1Selection::from_single_cell(pos![sheet_id!B1]),
            Some(true),
            None,
            false,
        )
        .unwrap();

        assert_cell_value_row(&gc, sheet_id, 2, 4, 1, vec!["1", "2", "3"]);
        assert_cell_format_bold_row(&gc, sheet_id, 2, 4, 1, vec![true, false, false]);

        let js_clipboard: JsClipboard = gc
            .sheet(sheet_id)
            .copy_to_clipboard(
                &A1Selection::from_rect(rect![B1:D1].to_sheet_rect(sheet_id)),
                gc.a1_context(),
                ClipboardOperation::Copy,
                true,
            )
            .into();

        // paste values only
        gc.paste_from_clipboard(
            &A1Selection::from_single_cell(pos![sheet_id!B2]),
            js_clipboard.clone(),
            PasteSpecial::Values,
            None,
            false,
        );
        // values are pasted
        assert_cell_value_row(&gc, sheet_id, 2, 4, 2, vec!["1", "2", "3"]);
        // formats are not pasted
        assert_cell_format_bold_row(&gc, sheet_id, 2, 4, 2, vec![false, false, false]);

        // paste formats only, offset by 1 column to check for values getting overwritten
        gc.paste_from_clipboard(
            &A1Selection::from_single_cell(pos![sheet_id!C2]),
            js_clipboard,
            PasteSpecial::Formats,
            None,
            false,
        );
        // values should be the same
        assert_cell_value_row(&gc, sheet_id, 2, 4, 2, vec!["1", "2", "3"]);
        // formats should be pasted, offset by 1 column
        assert_cell_format_bold_row(&gc, sheet_id, 2, 5, 2, vec![false, true, false, false]);
    }

    #[test]
    fn test_clipboard_code_operations_should_rerun() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let pos_1_1 = SheetPos::new(sheet_id, 1, 1);
        let pos_1_2 = SheetPos::new(sheet_id, 1, 2);

        gc.set_cell_value(pos_1_1, "1".to_string(), None, false);
        // Use a multi-cell formula to ensure it stays as a DataTable (not CellValue::Code)
        gc.set_cell_value(pos_1_2, "={A1+1;A1+2}".to_string(), None, false);

        // cutting A1:A3 and pasting on B1 should rerun the code because A1 is in cells_accessed
        let selection_rect = SheetRect::from_numbers(1, 1, 1, 3, sheet_id);
        let selection = A1Selection::from_rect(selection_rect);
        let (clipboard, _) = gc.cut_to_clipboard_operations(&selection, false).unwrap();
        let should_rerun = gc.clipboard_code_operations_should_rerun(
            &clipboard,
            pos![A2],
            pos![B1].to_sheet_pos(sheet_id),
        );
        assert!(should_rerun);

        // cutting just A2:A3 (the formula output) and pasting on B1 should not rerun the code
        // because A1 is not in the cut selection
        let selection_rect = SheetRect::from_numbers(1, 2, 1, 2, sheet_id);
        let selection = A1Selection::from_rect(selection_rect);
        let (clipboard, _) = gc.cut_to_clipboard_operations(&selection, false).unwrap();
        let should_rerun = gc.clipboard_code_operations_should_rerun(
            &clipboard,
            pos![A2],
            pos![B1].to_sheet_pos(sheet_id),
        );
        assert!(!should_rerun);

        // unbounded cut should rerun the code
        let selection = A1Selection::from_range(
            CellRefRange::new_relative_column(1),
            SheetId::TEST,
            gc.a1_context(),
        );
        let (clipboard, _) = gc.cut_to_clipboard_operations(&selection, false).unwrap();
        let should_rerun = gc.clipboard_code_operations_should_rerun(
            &clipboard,
            pos![A2],
            pos![B1].to_sheet_pos(sheet_id),
        );
        assert!(should_rerun);
    }

    #[test]
    fn test_copy_paste_table_column() {
        let (mut gc, sheet_id, pos, file_name) = simple_csv_at(pos![E2]);

        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();

        assert_data_table_column(
            data_table,
            1,
            vec![
                "region", "MA", "MA", "MA", "MA", "MA", "MO", "NJ", "OH", "OR", "NH",
            ],
        );

        assert_data_table_column(
            data_table,
            3,
            vec![
                "population",
                "9686",
                "14061",
                "29313",
                "38334",
                "152227",
                "150443",
                "14976",
                "64325",
                "56032",
                "42605",
            ],
        );

        let js_clipboard = gc
            .sheet(sheet_id)
            .copy_to_clipboard(
                &A1Selection::test_a1_context(&format!("{file_name}[region]"), gc.a1_context()),
                gc.a1_context(),
                ClipboardOperation::Copy,
                true,
            )
            .into();

        gc.paste_from_clipboard(
            &A1Selection::test_a1_context(&format!("{file_name}[population]"), gc.a1_context()),
            js_clipboard,
            PasteSpecial::Values,
            None,
            false,
        );

        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();

        assert_data_table_column(
            data_table,
            1,
            vec![
                "region", "MA", "MA", "MA", "MA", "MA", "MO", "NJ", "OH", "OR", "NH",
            ],
        );

        assert_data_table_column(
            data_table,
            3,
            vec![
                "region2", "MA", "MA", "MA", "MA", "MA", "MO", "NJ", "OH", "OR", "NH",
            ],
        );
    }

    #[test]
    fn paste_plain_text_with_newline_and_tab() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let pos = pos![sheet_id!B2];

        gc.set_cell_value(pos, "ab\ncd\tef".to_string(), None, false);

        let mut js_clipboard: JsClipboard = gc
            .sheet(sheet_id)
            .copy_to_clipboard(
                &A1Selection::test_a1_sheet_id("B2", sheet_id),
                gc.a1_context(),
                ClipboardOperation::Copy,
                true,
            )
            .into();
        js_clipboard.html = "".to_string();

        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("E2", sheet_id),
            js_clipboard,
            PasteSpecial::Values,
            None,
            false,
        );

        assert_eq!(
            gc.sheet(sheet_id).display_value(pos![E2]).unwrap(),
            CellValue::Text("ab cd ef".to_string())
        );
    }

    #[test]
    fn paste_tiled_formatting() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // red from B2:B5
        gc.set_fill_color(
            &A1Selection::test_a1("B2:B5"),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();

        // copy B2:B5 to B2:E5 (all cells should be red)
        let sheet = gc.grid.try_sheet(sheet_id).unwrap();
        let clipboard = sheet.copy_to_clipboard(
            &A1Selection::test_a1("B2:B5"),
            gc.a1_context(),
            ClipboardOperation::Copy,
            true,
        );

        gc.paste_from_clipboard(
            &A1Selection::test_a1("B2:E5"),
            clipboard.into(),
            PasteSpecial::None,
            None,
            false,
        );

        dbg!(&gc.sheet(sheet_id).formats.fill_color);

        assert_fill_color(&gc, pos![sheet_id!B2], "red");
        assert_fill_color(&gc, pos![sheet_id!E5], "red");
    }

    #[test]
    fn paste_formatting() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        gc.set_fill_color(
            &A1Selection::test_a1("B2:B5"),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();

        let sheet = gc.grid.try_sheet(sheet_id).unwrap();
        let clipboard = sheet.copy_to_clipboard(
            &A1Selection::test_a1("B2:B5"),
            gc.a1_context(),
            ClipboardOperation::Copy,
            true,
        );

        gc.paste_from_clipboard(
            &A1Selection::test_a1("B10:B10"),
            clipboard.into(),
            PasteSpecial::None,
            None,
            false,
        );

        assert_fill_color(&gc, pos![sheet_id!B10], "red");
        dbg!(&gc.sheet(sheet_id).formats.fill_color);
    }

    #[test]
    fn test_paste_formula_strips_equals_prefix() {
        use crate::grid::js_types::JsClipboard;

        // Test that when pasting a formula from plain text clipboard,
        // the '=' prefix is stripped before storing (matching direct entry behavior)
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Paste a formula as plain text (like copying from external source)
        let clipboard = JsClipboard {
            plain_text: "=1+2".to_string(),
            html: String::new(),
        };
        gc.paste_from_clipboard(
            &A1Selection::test_a1("A1"),
            clipboard,
            PasteSpecial::None,
            None,
            false,
        );

        // Get the stored formula code
        let a1_context = gc.a1_context();
        let code_cell = gc
            .sheet(sheet_id)
            .edit_code_value(pos![A1], a1_context)
            .expect("Should have a code cell at A1");

        // The stored code should NOT have the '=' prefix
        assert_eq!(
            code_cell.code_string, "1+2",
            "Formula should be stored without '=' prefix"
        );

        // FORMULATEXT should add the '=' back when returning
        let result = crate::formulas::tests::eval_to_string(&gc, "FORMULATEXT(A1)");
        assert_eq!(
            result, "=1+2",
            "FORMULATEXT should return formula with '=' prefix"
        );
    }

    #[test]
    fn test_paste_value_into_merged_cell_anchor() {
        // Pasting a single value directly into the anchor cell of a merged cell
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a 2x2 merged cell at B2:C3
        gc.merge_cells(
            A1Selection::test_a1_sheet_id("B2:C3", sheet_id),
            None,
            false,
        );

        // Set a value at A1 to copy
        gc.set_cell_value(pos![sheet_id!A1], "test".to_string(), None, false);

        // Copy A1
        let sheet = gc.sheet(sheet_id);
        let clipboard = sheet.copy_to_clipboard(
            &A1Selection::test_a1("A1"),
            gc.a1_context(),
            ClipboardOperation::Copy,
            true,
        );

        // Paste at B2 (anchor of the merged cell)
        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("B2", sheet_id),
            clipboard.into(),
            PasteSpecial::None,
            None,
            false,
        );

        // Verify value is at anchor
        assert_eq!(
            gc.sheet(sheet_id).display_value(pos![B2]),
            Some(CellValue::Text("test".to_string()))
        );
        // Non-anchor cells should have no value
        assert_eq!(gc.sheet(sheet_id).display_value(pos![C2]), None);
        assert_eq!(gc.sheet(sheet_id).display_value(pos![B3]), None);
        assert_eq!(gc.sheet(sheet_id).display_value(pos![C3]), None);
    }

    #[test]
    fn test_paste_value_into_merged_cell_non_anchor() {
        // Pasting a single value into a non-anchor cell of a merged cell
        // should redirect the value to the anchor
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a 2x2 merged cell at B2:C3
        gc.merge_cells(
            A1Selection::test_a1_sheet_id("B2:C3", sheet_id),
            None,
            false,
        );

        // Set a value at A1 to copy
        gc.set_cell_value(pos![sheet_id!A1], "test".to_string(), None, false);

        // Copy A1
        let sheet = gc.sheet(sheet_id);
        let clipboard = sheet.copy_to_clipboard(
            &A1Selection::test_a1("A1"),
            gc.a1_context(),
            ClipboardOperation::Copy,
            true,
        );

        // Paste at C3 (non-anchor of the merged cell)
        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("C3", sheet_id),
            clipboard.into(),
            PasteSpecial::None,
            None,
            false,
        );

        // Verify value is redirected to anchor B2
        assert_eq!(
            gc.sheet(sheet_id).display_value(pos![B2]),
            Some(CellValue::Text("test".to_string()))
        );
        // Non-anchor cells should have no value
        assert_eq!(gc.sheet(sheet_id).display_value(pos![C2]), None);
        assert_eq!(gc.sheet(sheet_id).display_value(pos![B3]), None);
        assert_eq!(gc.sheet(sheet_id).display_value(pos![C3]), None);
    }

    #[test]
    fn test_paste_multiple_values_overlapping_merged_cell() {
        // Pasting multiple values that overlap a merged cell
        // should use the anchor value if present, otherwise top-left-most
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a 2x2 merged cell at B2:C3
        gc.merge_cells(
            A1Selection::test_a1_sheet_id("B2:C3", sheet_id),
            None,
            false,
        );

        // Set up a 2x2 grid of values at E1:F2
        gc.set_cell_value(pos![sheet_id!E1], "1".to_string(), None, false);
        gc.set_cell_value(pos![sheet_id!F1], "2".to_string(), None, false);
        gc.set_cell_value(pos![sheet_id!E2], "3".to_string(), None, false);
        gc.set_cell_value(pos![sheet_id!F2], "4".to_string(), None, false);

        // Copy E1:F2
        let sheet = gc.sheet(sheet_id);
        let clipboard = sheet.copy_to_clipboard(
            &A1Selection::test_a1("E1:F2"),
            gc.a1_context(),
            ClipboardOperation::Copy,
            true,
        );

        // Paste at B2 (overlapping the merged cell)
        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("B2", sheet_id),
            clipboard.into(),
            PasteSpecial::None,
            None,
            false,
        );

        // Verify only the anchor position value (1) is kept at B2
        assert_eq!(
            gc.sheet(sheet_id).display_value(pos![B2]),
            Some(CellValue::Number(1.into()))
        );
        // Non-anchor cells in the merge should have no value
        assert_eq!(gc.sheet(sheet_id).display_value(pos![C2]), None);
        assert_eq!(gc.sheet(sheet_id).display_value(pos![B3]), None);
        assert_eq!(gc.sheet(sheet_id).display_value(pos![C3]), None);
    }

    #[test]
    fn test_paste_format_spreads_across_merged_cell() {
        // Pasting format to any cell in a merged cell should spread to entire merge
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a 2x2 merged cell at B2:C3
        gc.merge_cells(
            A1Selection::test_a1_sheet_id("B2:C3", sheet_id),
            None,
            false,
        );

        // Set fill color at A1
        gc.set_fill_color(
            &A1Selection::test_a1("A1"),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();

        // Copy A1 (with format)
        let sheet = gc.sheet(sheet_id);
        let clipboard = sheet.copy_to_clipboard(
            &A1Selection::test_a1("A1"),
            gc.a1_context(),
            ClipboardOperation::Copy,
            true,
        );

        // Paste at C3 (non-anchor of the merged cell)
        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("C3", sheet_id),
            clipboard.into(),
            PasteSpecial::None,
            None,
            false,
        );

        // Verify format is spread to all cells in the merged cell
        assert_fill_color(&gc, pos![sheet_id!B2], "red");
        assert_fill_color(&gc, pos![sheet_id!C2], "red");
        assert_fill_color(&gc, pos![sheet_id!B3], "red");
        assert_fill_color(&gc, pos![sheet_id!C3], "red");
    }

    #[test]
    fn test_paste_plain_text_into_merged_cell() {
        // Pasting plain text that overlaps a merged cell
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a 2x2 merged cell at B2:C3
        gc.merge_cells(
            A1Selection::test_a1_sheet_id("B2:C3", sheet_id),
            None,
            false,
        );

        // Paste plain text at C3 (non-anchor)
        let clipboard = JsClipboard {
            plain_text: "hello".to_string(),
            html: String::new(),
        };
        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("C3", sheet_id),
            clipboard,
            PasteSpecial::None,
            None,
            false,
        );

        // Verify value is redirected to anchor B2
        assert_eq!(
            gc.sheet(sheet_id).display_value(pos![B2]),
            Some(CellValue::Text("hello".to_string()))
        );
        // Non-anchor cells should have no value
        assert_eq!(gc.sheet(sheet_id).display_value(pos![C2]), None);
        assert_eq!(gc.sheet(sheet_id).display_value(pos![B3]), None);
        assert_eq!(gc.sheet(sheet_id).display_value(pos![C3]), None);
    }

    #[test]
    fn test_paste_undo_restores_merged_cell_state() {
        // Verify that undo properly restores state after pasting into merged cells
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set initial value at anchor
        gc.set_cell_value(pos![sheet_id!B2], "original".to_string(), None, false);

        // Create a 2x2 merged cell at B2:C3
        gc.merge_cells(
            A1Selection::test_a1_sheet_id("B2:C3", sheet_id),
            None,
            false,
        );

        // Verify initial state
        assert_eq!(
            gc.sheet(sheet_id).display_value(pos![B2]),
            Some(CellValue::Text("original".to_string()))
        );

        // Set a value at A1 to copy
        gc.set_cell_value(pos![sheet_id!A1], "new".to_string(), None, false);

        // Copy A1
        let sheet = gc.sheet(sheet_id);
        let clipboard = sheet.copy_to_clipboard(
            &A1Selection::test_a1("A1"),
            gc.a1_context(),
            ClipboardOperation::Copy,
            true,
        );

        // Paste at B2
        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("B2", sheet_id),
            clipboard.into(),
            PasteSpecial::None,
            None,
            false,
        );

        // Verify new value is at anchor
        assert_eq!(
            gc.sheet(sheet_id).display_value(pos![B2]),
            Some(CellValue::Text("new".to_string()))
        );

        // Undo the paste
        gc.undo(1, None, false);

        // Verify original value is restored
        assert_eq!(
            gc.sheet(sheet_id).display_value(pos![B2]),
            Some(CellValue::Text("original".to_string()))
        );
    }

    #[test]
    fn test_paste_over_multiple_merges_unmerges_then_pastes() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.merge_cells(
            A1Selection::test_a1_sheet_id("B2:B3", sheet_id),
            None,
            false,
        );
        gc.merge_cells(
            A1Selection::test_a1_sheet_id("D2:D3", sheet_id),
            None,
            false,
        );
        gc.set_cell_value(pos![sheet_id!B2], "left".to_string(), None, false);
        gc.set_cell_value(pos![sheet_id!D2], "right".to_string(), None, false);

        gc.set_cell_value(pos![sheet_id!A1], "a".to_string(), None, false);
        gc.set_cell_value(pos![sheet_id!A2], "b".to_string(), None, false);
        let sheet = gc.sheet(sheet_id);
        let clipboard = sheet.copy_to_clipboard(
            &A1Selection::test_a1("A1:A2"),
            gc.a1_context(),
            ClipboardOperation::Copy,
            true,
        );

        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("B2:C3", sheet_id),
            clipboard.into(),
            PasteSpecial::None,
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let paste_rect = Rect::new(2, 2, 3, 3);
        let merges_in_paste = sheet.merge_cells.get_merge_cells(paste_rect);
        assert!(
            merges_in_paste.is_empty(),
            "Existing merges in paste area should be unmerged"
        );
        assert_eq!(sheet.cell_value(pos![B2]), Some(CellValue::Text("a".to_string())));
        assert_eq!(sheet.cell_value(pos![B3]), Some(CellValue::Text("b".to_string())));
    }

    #[test]
    fn test_paste_tiling_values_and_formats() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a 1×2 source with values and a fill
        gc.set_cell_value(pos![sheet_id!A1], "x".to_string(), None, false);
        gc.set_cell_value(pos![sheet_id!A2], "y".to_string(), None, false);
        let _ = gc.set_fill_color(
            &A1Selection::test_a1_sheet_id("A1:A2", sheet_id),
            Some("red".to_string()),
            None,
            false,
        );

        // Copy A1:A2 (1 column × 2 rows)
        let sheet = gc.sheet(sheet_id);
        let clipboard = sheet.copy_to_clipboard(
            &A1Selection::test_a1("A1:A2"),
            gc.a1_context(),
            ClipboardOperation::Copy,
            true,
        );

        // Paste into B1:C4 (2 columns × 4 rows) — should tile 2×2 times
        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("B1:C4", sheet_id),
            clipboard.into(),
            PasteSpecial::None,
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);

        // Values should tile: columns B and C each get "x","y","x","y"
        assert_eq!(sheet.cell_value(pos![B1]), Some(CellValue::Text("x".to_string())));
        assert_eq!(sheet.cell_value(pos![B2]), Some(CellValue::Text("y".to_string())));
        assert_eq!(sheet.cell_value(pos![B3]), Some(CellValue::Text("x".to_string())));
        assert_eq!(sheet.cell_value(pos![B4]), Some(CellValue::Text("y".to_string())));
        assert_eq!(sheet.cell_value(pos![C1]), Some(CellValue::Text("x".to_string())));
        assert_eq!(sheet.cell_value(pos![C2]), Some(CellValue::Text("y".to_string())));
        assert_eq!(sheet.cell_value(pos![C3]), Some(CellValue::Text("x".to_string())));
        assert_eq!(sheet.cell_value(pos![C4]), Some(CellValue::Text("y".to_string())));

        // Formats should tile: all pasted cells get the red fill
        assert_eq!(sheet.formats.fill_color.get(pos![B1]), Some("red".to_string()));
        assert_eq!(sheet.formats.fill_color.get(pos![B4]), Some("red".to_string()));
        assert_eq!(sheet.formats.fill_color.get(pos![C1]), Some("red".to_string()));
        assert_eq!(sheet.formats.fill_color.get(pos![C4]), Some("red".to_string()));

        // Outside the paste area should have no fill
        assert_eq!(sheet.formats.fill_color.get(pos![D1]), None);
        assert_eq!(sheet.formats.fill_color.get(pos![B5]), None);
    }

    #[test]
    fn test_paste_into_single_merge_keeps_merge() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.merge_cells(
            A1Selection::test_a1_sheet_id("B2:C3", sheet_id),
            None,
            false,
        );
        gc.set_cell_value(pos![sheet_id!A1], "new".to_string(), None, false);
        let sheet = gc.sheet(sheet_id);
        let clipboard = sheet.copy_to_clipboard(
            &A1Selection::test_a1("A1"),
            gc.a1_context(),
            ClipboardOperation::Copy,
            true,
        );

        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("B2", sheet_id),
            clipboard.into(),
            PasteSpecial::None,
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let merge_rect = Rect::new(2, 2, 3, 3);
        let merges = sheet.merge_cells.get_merge_cells(merge_rect);
        assert_eq!(merges.len(), 1, "Single merge should be preserved when pasting into it");
        assert_eq!(merges[0], merge_rect);
        assert_eq!(
            sheet.display_value(pos![B2]),
            Some(CellValue::Text("new".to_string()))
        );
    }

    #[test]
    fn test_paste_special_values_over_merges_only_anchor_gets_value() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.merge_cells(
            A1Selection::test_a1_sheet_id("B2:C3", sheet_id),
            None,
            false,
        );
        gc.set_cell_value(pos![sheet_id!A1], "val".to_string(), None, false);
        let sheet = gc.sheet(sheet_id);
        let clipboard = sheet.copy_to_clipboard(
            &A1Selection::test_a1("A1"),
            gc.a1_context(),
            ClipboardOperation::Copy,
            true,
        );

        gc.paste_from_clipboard(
            &A1Selection::test_a1_sheet_id("C3", sheet_id),
            clipboard.into(),
            PasteSpecial::Values,
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let merge_rect = Rect::new(2, 2, 3, 3);
        let merges = sheet.merge_cells.get_merge_cells(merge_rect);
        assert_eq!(merges.len(), 1, "Merge should remain for Paste Special Values");
        assert_eq!(
            sheet.display_value(pos![B2]),
            Some(CellValue::Text("val".to_string())),
            "Value should be in anchor only"
        );
    }
}
