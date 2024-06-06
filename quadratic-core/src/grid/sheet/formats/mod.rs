use super::Sheet;
use crate::{
    controller::operations::operation::Operation,
    grid::formats::{format::Format, format_update::FormatUpdate, Formats},
    selection::Selection,
};

pub mod format_all;
pub mod format_cell;
pub mod format_columns;
pub mod format_rects;
pub mod format_rows;

impl Sheet {
    /// This returns a FormatUpdate to undo a change to Format from a FormatUpdate.
    pub(crate) fn undo_format_update(
        update: &FormatUpdate,
        format: &Format,
    ) -> Option<FormatUpdate> {
        let mut undo = FormatUpdate::default();
        if update.align.is_some() {
            undo.align = Some(format.align);
        }
        if update.wrap.is_some() {
            undo.wrap = Some(format.wrap);
        }
        if update.numeric_format.is_some() {
            undo.numeric_format = Some(format.numeric_format.clone());
        }
        if update.numeric_decimals.is_some() {
            undo.numeric_decimals = Some(format.numeric_decimals);
        }
        if update.numeric_commas.is_some() {
            undo.numeric_commas = Some(format.numeric_commas);
        }
        if update.bold.is_some() {
            undo.bold = Some(format.bold);
        }
        if update.italic.is_some() {
            undo.italic = Some(format.italic);
        }
        if update.text_color.is_some() {
            undo.text_color = Some(format.text_color.clone());
        }
        if update.fill_color.is_some() {
            undo.fill_color = Some(format.fill_color.clone());
        }
        if update.render_size.is_some() {
            undo.render_size = Some(format.render_size.clone());
        }
        if undo.is_default() {
            None
        } else {
            Some(undo)
        }
    }

    pub fn set_formats_selection(
        &mut self,
        selection: &Selection,
        formats: &Formats,
    ) -> Vec<Operation> {
        if selection.all {
            self.set_format_all(formats)
        } else if let Some(columns) = selection.columns.as_ref() {
            self.set_formats_columns(columns, formats)
        } else if let Some(rows) = selection.rows.as_ref() {
            self.set_formats_rows(rows, formats)
        } else if let Some(rects) = selection.rects.as_ref() {
            self.set_formats_rects(rects, formats)
        } else {
            vec![]
        }
    }
}
