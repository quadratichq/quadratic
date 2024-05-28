use super::operation::Operation;
use crate::{
    controller::GridController,
    grid::formats::{FormatUpdate, Formats},
    selection::Selection,
};

impl GridController {
    pub(crate) fn clear_format_selection_operations(
        &self,
        selection: &Selection,
    ) -> Vec<Operation> {
        vec![Operation::SetCellFormatsSelection {
            selection: selection.clone(),
            formats: Formats::repeat(FormatUpdate::cleared(), selection.count()),
        }]
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        controller::{operations::operation::Operation, GridController},
        grid::formats::{FormatUpdate, Formats},
        selection::Selection,
        Rect,
    };

    #[test]
    fn clear_format_selection_operations() {
        let mut gc = GridController::test();
        let selection = Selection {
            sheet_id: gc.sheet_ids()[0],
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
            vec![Operation::SetCellFormatsSelection {
                selection,
                formats: Formats::repeat(FormatUpdate::cleared(), 1),
            }]
        );
    }
}
