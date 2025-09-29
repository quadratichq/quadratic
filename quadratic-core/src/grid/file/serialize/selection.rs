use std::str::FromStr;

use crate::{
    Pos,
    a1::{A1Selection, CellRefCoord, CellRefRange, CellRefRangeEnd, RefRangeBounds},
    grid::SheetId,
};

use super::{
    current,
    data_table::{export_cell_ref_range, import_cell_ref_range},
};

pub(crate) fn import_selection(selection: current::A1SelectionSchema) -> A1Selection {
    A1Selection {
        // todo: handle error more gracefully
        sheet_id: SheetId::from_str(&selection.sheet_id.to_string()).unwrap(),
        cursor: Pos {
            x: selection.cursor.x,
            y: selection.cursor.y,
        },
        ranges: selection
            .ranges
            .into_iter()
            .map(import_cell_ref_range)
            .collect(),
    }
}

pub(crate) fn export_selection(selection: A1Selection) -> current::A1SelectionSchema {
    current::A1SelectionSchema {
        sheet_id: selection.sheet_id.to_string().into(),
        cursor: current::PosSchema {
            x: selection.cursor.x,
            y: selection.cursor.y,
        },
        ranges: selection
            .ranges
            .into_iter()
            .map(export_cell_ref_range)
            .collect(),
    }
}

#[cfg(test)]
mod tests {

    use super::*;

    #[test]
    fn import_export_selection() {
        let selection = A1Selection::test_a1("A2,C4:E6,G8:I10,1:3,D:E");
        let imported = import_selection(export_selection(selection.clone()));
        assert_eq!(selection, imported);
    }
}
