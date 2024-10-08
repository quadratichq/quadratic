use super::current;
use crate::selection::Selection;

pub fn import_selection(selection: current::SelectionSchema) -> Selection {
    Selection {
        sheet_id: selection.sheet_id.to_owned(),
        x: selection.x,
        y: selection.y,
        rects: selection
            .rects
            .map(|rects| rects.iter().map(|r| r.into()).collect()),
        rows: selection.rows,
        columns: selection.columns,
        all: selection.all,
    }
}

pub fn export_selection(selection: Selection) -> current::SelectionSchema {
    current::SelectionSchema {
        sheet_id: selection.sheet_id,
        x: selection.x,
        y: selection.y,
        rects: selection
            .rects
            .map(|rects| rects.iter().map(|r| r.into()).collect()),
        rows: selection.rows,
        columns: selection.columns,
        all: selection.all,
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use super::*;
    use crate::{grid::SheetId, Rect};

    #[test]
    #[parallel]
    fn import_export_selection() {
        let selection = Selection {
            sheet_id: SheetId::test(),
            x: 1,
            y: 2,
            rects: Some(vec![Rect::new(3, 4, 5, 6), Rect::new(7, 8, 9, 10)]),
            rows: Some(vec![1, 2, 3]),
            columns: Some(vec![4, 5, 6]),
            all: true,
        };
        let imported = import_selection(export_selection(selection.clone()));
        assert_eq!(selection, imported);
    }
}
