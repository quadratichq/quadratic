use crate::controller::{transaction_summary::TransactionSummary, GridController};
use crate::{grid::SheetId, Pos};
use anyhow::Result;

impl GridController {
    /// Imports a CSV file into the grid.
    ///
    /// Returns a [`TransactionSummary`].
    pub fn import_csv(
        &mut self,
        sheet_id: SheetId,
        file: &[u8],
        file_name: &str,
        insert_at: Pos,
        cursor: Option<String>,
    ) -> Result<TransactionSummary> {
        let ops = self.import_csv_operations(sheet_id, file, file_name, insert_at)?;
        Ok(self.start_user_transaction(ops, cursor))
    }
}

#[cfg(test)]
mod tests {

    use crate::{
        test_util::{assert_cell_value_row, print_table},
        Rect,
    };

    use super::*;

    const SIMPLE_CSV: &str = r#"city,region,country,population
Southborough,MA,United States,9686
Northbridge,MA,United States,14061
Westborough,MA,United States,29313
Marlborough,MA,United States,38334
Springfield,MA,United States,152227
Springfield,MO,United States,150443
Springfield,NJ,United States,14976
Springfield,OH,United States,64325
Springfield,OR,United States,56032
Concord,NH,United States,42605
"#;

    #[test]
    fn imports_a_simple_csv() {
        let mut grid_controller = GridController::test();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };

        let _ =
            grid_controller.import_csv(sheet_id, SIMPLE_CSV.as_bytes(), "smallpop.csv", pos, None);

        print_table(
            &grid_controller,
            sheet_id,
            Rect::new_span(pos, Pos { x: 3, y: 10 }),
        );

        assert_cell_value_row(
            &grid_controller,
            sheet_id,
            0,
            3,
            0,
            vec!["city", "region", "country", "population"],
        );

        assert_cell_value_row(
            &grid_controller,
            sheet_id,
            0,
            3,
            10,
            vec!["Concord", "NH", "United States", "42605"],
        );
    }

    #[test]
    fn errors_on_an_empty_csv() {
        let mut grid_controller = GridController::test();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };

        let result = grid_controller.import_csv(sheet_id, "".as_bytes(), "smallpop.csv", pos, None);
        assert!(result.is_err());
    }
}
