use crate::a1::{A1Error, A1Selection};
use crate::controller::GridController;

use super::SheetId;

impl GridController {
    pub(crate) fn a1_selection_from_string(
        &self,
        a1: &str,
        default_sheet_id: SheetId,
    ) -> Result<A1Selection, A1Error> {
        A1Selection::parse_a1(a1, default_sheet_id, self.a1_context())
    }
}

#[cfg(test)]
mod test {
    use crate::a1::CellRefRange;
    use crate::constants::SHEET_NAME;
    use crate::controller::GridController;

    #[test]
    fn a1_selection_from_string() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let selection = gc
            .a1_selection_from_string(&format!("'{SHEET_NAME}1'!A1:B2"), sheet_id)
            .unwrap();
        assert_eq!(selection.sheet_id, sheet_id);
        assert_eq!(selection.cursor, pos![A1]);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:B2")]);
    }

    #[test]
    fn a1_selection_from_string_long_sheet_name() {
        let mut gc = GridController::test();
        gc.add_sheet_with_name("Types: sequences, mapping, sets".to_string(), None, false);
        let sheet_id = gc.sheet_ids()[1];
        let selection = gc
            .a1_selection_from_string("'Types: sequences, mapping, sets'!A1:B2", sheet_id)
            .unwrap();
        assert_eq!(selection.sheet_id, sheet_id);
        assert_eq!(selection.cursor, pos![A1]);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:B2")]);
    }
}
