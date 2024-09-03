use super::operation::Operation;
use crate::{
    controller::GridController,
    grid::{
        formats::{format_update::FormatUpdate, Formats},
        sheet::borders::BorderStyleCellUpdate,
    },
    selection::Selection,
    RunLengthEncoding,
};

impl GridController {
    pub(crate) fn clear_format_selection_operations(
        &self,
        selection: &Selection,
    ) -> Vec<Operation> {
        vec![
            Operation::SetCellFormatsSelection {
                selection: selection.clone(),
                formats: Formats::repeat(FormatUpdate::cleared(), selection.count()),
            },
            Operation::SetBordersSelection {
                selection: selection.clone(),
                borders: RunLengthEncoding::repeat(
                    BorderStyleCellUpdate::clear(),
                    selection.count(),
                ),
            },
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Rect;
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn clear_format_selection_operations() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let selection = Selection {
            sheet_id,
            x: 0,
            y: 0,
            rects: Some(vec![Rect::from_numbers(0, 0, 1, 1)]),
            rows: None,
            columns: None,
            all: false,
        };
        let ops = gc.clear_format_selection_operations(&selection);
        assert_eq!(
            ops,
            vec![
                Operation::SetCellFormatsSelection {
                    selection: selection.clone(),
                    formats: Formats::repeat(FormatUpdate::cleared(), 1),
                },
                Operation::SetBordersSelection {
                    selection: selection.clone(),
                    borders: RunLengthEncoding::repeat(
                        BorderStyleCellUpdate::clear(),
                        selection.count(),
                    ),
                },
            ]
        );
    }
}
