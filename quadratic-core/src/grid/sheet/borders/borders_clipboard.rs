use crate::{controller::operations::clipboard::ClipboardOrigin, selection::Selection};

use super::{BorderStyleCellUpdates, Borders};

impl Borders {
    /// Prepares borders within the selection for copying to the clipboard.
    ///
    /// Returns `None` if there are no borders to copy.
    pub fn to_clipboard(
        &self,
        selection: &Selection,
        _origin: &ClipboardOrigin,
    ) -> Option<BorderStyleCellUpdates> {
        let mut updates = BorderStyleCellUpdates::default();

        if selection.all {
            updates.push(self.all.into());
        }
        if let Some(column) = selection.columns.as_ref() {
            for col in column {
                updates.push(self.columns.get(&col).cloned().unwrap_or_default().into());
            }
        }
        if let Some(row) = selection.rows.as_ref() {
            for row in row {
                updates.push(self.rows.get(&row).cloned().unwrap_or_default().into());
            }
        }

        if updates.is_empty() {
            None
        } else {
            Some(updates)
        }
    }
}
