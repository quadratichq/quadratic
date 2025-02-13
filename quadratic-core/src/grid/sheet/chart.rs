use crate::SheetPos;

use super::*;

impl Sheet {
    /// Returns a list of charts that overlap a given column.
    pub fn charts_in_column(&self, column: u32) -> Vec<(SheetPos, (u32, u32))> {
        self.data_tables
            .iter()
            .filter_map(|(pos, data_table)| {
                if data_table.is_html_or_image() {
                    let rect = data_table.output_rect(*pos, true);
                    if column as i64 >= rect.min.x && column as i64 <= rect.max.x {
                        if let Some(chart_output) = data_table.chart_output {
                            return Some((pos.to_sheet_pos(self.id), chart_output));
                        }
                    }
                }
                None
            })
            .collect()
    }

    /// Returns a list of charts that overlap a given row.
    pub fn charts_in_row(&self, row: u32) -> Vec<(SheetPos, (u32, u32))> {
        self.data_tables
            .iter()
            .filter_map(|(pos, data_table)| {
                if data_table.is_html_or_image() {
                    let rect = data_table.output_rect(*pos, true);
                    if row as i64 >= rect.min.y && row as i64 <= rect.max.y {
                        if let Some(chart_output) = data_table.chart_output {
                            return Some((pos.to_sheet_pos(self.id), chart_output));
                        }
                    }
                }
                None
            })
            .collect()
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_charts_in_column() {
        let mut sheet = Sheet::test();

        sheet.test_set_chart(pos![A1], 3, 3);
        sheet.test_set_chart(pos![B5], 3, 3);

        // normal data tables should be ignored
        sheet.test_set_data_table(pos![A20], 6, 6, false, false);

        assert_eq!(sheet.charts_in_column(1).len(), 1);
        assert_eq!(sheet.charts_in_column(2).len(), 2);
        assert_eq!(sheet.charts_in_column(4).len(), 1);
        assert_eq!(sheet.charts_in_column(5).len(), 0);
    }

    #[test]
    fn test_charts_in_row() {
        let mut sheet = Sheet::test();

        sheet.test_set_chart(pos![A1], 3, 3);
        sheet.test_set_chart(pos![E2], 3, 3);

        // normal data tables should be ignored
        sheet.test_set_data_table(pos![G1], 6, 6, false, false);

        assert_eq!(sheet.charts_in_row(1).len(), 1);
        assert_eq!(sheet.charts_in_row(2).len(), 2);
        assert_eq!(sheet.charts_in_row(5).len(), 1);
        assert_eq!(sheet.charts_in_row(6).len(), 0);
    }
}
