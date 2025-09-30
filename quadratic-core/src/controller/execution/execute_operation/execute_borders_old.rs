use crate::{
    controller::{
        GridController, active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::sheet::borders::{BordersUpdates, borders_old::BorderStyleCellUpdates},
};

impl GridController {
    fn migrate_borders(
        borders_a1: &mut BordersUpdates,
        borders: &BorderStyleCellUpdates,
        x1: i64,
        y1: i64,
        x2: Option<i64>,
        y2: Option<i64>,
    ) {
        if let Some(border) = borders.iter_values().next() {
            if let Some(top) = border.top {
                borders_a1
                    .top
                    .get_or_insert_default()
                    .set_rect(x1, y1, x2, y2, Some(top.into()));
            }
            if let Some(bottom) = border.bottom {
                borders_a1.bottom.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2,
                    Some(bottom.into()),
                );
            }
            if let Some(left) = border.left {
                borders_a1
                    .left
                    .get_or_insert_default()
                    .set_rect(x1, y1, x2, y2, Some(left.into()));
            }
            if let Some(right) = border.right {
                borders_a1.right.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2,
                    Some(right.into()),
                );
            }
        }
    }

    /// **Deprecated** Nov 2024 in favor of [`Self::execute_set_borders_a1()`].
    pub(crate) fn execute_set_borders_selection(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        unwrap_op!(let SetBordersSelection { selection, borders } = op);

        let mut borders_a1 = BordersUpdates::default();

        if selection.all {
            GridController::migrate_borders(&mut borders_a1, &borders, 1, 1, None, None);
        } else {
            if let Some(columns) = selection.columns {
                for col in columns {
                    GridController::migrate_borders(
                        &mut borders_a1,
                        &borders,
                        col,
                        1,
                        Some(col),
                        None,
                    );
                }
            }
            if let Some(rows) = selection.rows {
                for row in rows {
                    GridController::migrate_borders(
                        &mut borders_a1,
                        &borders,
                        1,
                        row,
                        None,
                        Some(row),
                    );
                }
            }
            if let Some(rects) = selection.rects {
                for rect in rects {
                    GridController::migrate_borders(
                        &mut borders_a1,
                        &borders,
                        rect.min.x,
                        rect.min.y,
                        Some(rect.max.x),
                        Some(rect.max.y),
                    );
                }
            }
        }

        self.execute_set_borders_a1(
            transaction,
            Operation::SetBordersA1 {
                sheet_id: selection.sheet_id,
                borders: borders_a1,
            },
        );
    }
}
