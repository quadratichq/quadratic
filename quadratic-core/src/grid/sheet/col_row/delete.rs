use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::Sheet,
};

impl Sheet {
    pub fn delete_columns(&mut self, transaction: &mut PendingTransaction, columns: Vec<i64>) {
        let mut columns = columns.clone();
        columns.sort_unstable();
        columns.dedup();
        columns.reverse();

        // let min_column = columns[columns.len() - 1].clone();
        // let max_column = columns[0].clone();
        for column in columns {
            self.delete_column(transaction, column);
        }

        // // also need to remove any tables completely enclosed by the deleted columns
        // let dt_to_remove = self
        //     .data_tables
        //     .iter()
        //     .filter_map(|(pos, dt)| {
        //         let rect = dt.output_rect(*pos, false);
        //         if rect.min.x >= min_column && rect.max.x <= max_column {
        //             Some(pos.clone())
        //         } else {
        //             None
        //         }
        //     })
        //     .collect::<Vec<_>>();

        // for pos in dt_to_remove {
        //     let Some(index) = self.data_tables.get_index_of(&pos) else {
        //         continue;
        //     };
        //     if let Some(table) = self.data_tables.shift_remove(&pos) {
        //         transaction
        //             .reverse_operations
        //             .push(Operation::SetDataTable {
        //                 sheet_pos: pos.to_sheet_pos(self.id),
        //                 data_table: Some(table),
        //                 index,
        //             });
        //     }
        // }

        self.recalculate_bounds();
    }

    pub fn delete_rows(&mut self, transaction: &mut PendingTransaction, rows: Vec<i64>) {
        let mut rows = rows.clone();
        rows.sort_unstable();
        rows.dedup();
        rows.reverse();

        for row in rows {
            self.delete_row(transaction, row);
        }
        self.recalculate_bounds();
    }
}
