use crate::grid::{Grid, GridBounds};

pub(crate) fn migrate_all_data_table_spills(grid: &mut Grid) {
    for sheet in grid.sheets.values_mut() {
        if let GridBounds::NonEmpty(bounds) = sheet.bounds(true) {
            sheet.data_tables_update_spill(bounds);
        }
    }
}
