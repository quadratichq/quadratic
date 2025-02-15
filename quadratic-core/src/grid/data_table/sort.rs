//! DataTable sorting

use anyhow::{Ok, Result};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::DataTable;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub enum SortDirection {
    Ascending,
    Descending,
    None,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct DataTableSort {
    pub column_index: usize,
    pub direction: SortDirection,
}

impl DataTable {
    pub fn sort_column(
        &mut self,
        column_index: usize,
        direction: SortDirection,
    ) -> Result<Option<DataTableSort>> {
        let old = self.prepend_sort(column_index, direction.clone());

        self.sort_all()?;

        Ok(old)
    }

    pub fn sort_all(&mut self) -> Result<()> {
        self.display_buffer = None;

        if let Some(ref mut sort) = self.sort.to_owned() {
            let value = self.display_value(true)?.into_array()?;
            let mut display_buffer = (0..value.height()).map(|i| i as u64).collect::<Vec<u64>>();

            for sort in sort
                .iter()
                .rev()
                .filter(|s| s.direction != SortDirection::None)
            {
                display_buffer = display_buffer
                    .into_iter()
                    .skip(self.adjust_for_header(0))
                    .filter_map(|i| {
                        value
                            .get(sort.column_index as u32, i as u32)
                            .ok()
                            .map(|v| (i, v))
                    })
                    .sorted_by(|a, b| match sort.direction {
                        SortDirection::Ascending => a.1.total_cmp(b.1),
                        SortDirection::Descending => b.1.total_cmp(a.1),
                        SortDirection::None => std::cmp::Ordering::Equal,
                    })
                    .map(|(i, _)| i)
                    .collect::<Vec<u64>>();

                if self.header_is_first_row {
                    display_buffer.insert(0, 0);
                }
            }
            self.display_buffer = Some(display_buffer);
        }

        Ok(())
    }

    pub fn prepend_sort(
        &mut self,
        column_index: usize,
        direction: SortDirection,
    ) -> Option<DataTableSort> {
        let data_table_sort = DataTableSort {
            column_index,
            direction,
        };

        let old = self.sort.as_mut().and_then(|sort| {
            let index = sort
                .iter()
                .position(|sort| sort.column_index == column_index);

            index.map(|index| sort.remove(index))
        });

        match self.sort {
            Some(ref mut sort) => sort.insert(0, data_table_sort),
            None => self.sort = Some(vec![data_table_sort]),
        }

        old
    }
}

#[cfg(test)]
pub mod test {

    use super::*;
    use crate::grid::test::{
        assert_data_table_row, new_data_table, pretty_print_data_table, test_csv_values,
    };

    #[test]
    fn test_data_table_sort() {
        let (_, mut data_table) = new_data_table();
        data_table.apply_first_row_as_header();

        let values = test_csv_values();
        pretty_print_data_table(&data_table, Some("Original Data Table"), None);

        // sort by population city ascending
        data_table.sort_column(0, SortDirection::Ascending).unwrap();
        pretty_print_data_table(&data_table, Some("Sorted by City"), None);
        assert_data_table_row(&data_table, 1, values[2].clone());
        assert_data_table_row(&data_table, 2, values[3].clone());
        assert_data_table_row(&data_table, 3, values[1].clone());

        // sort by population descending
        data_table
            .sort_column(3, SortDirection::Descending)
            .unwrap();
        pretty_print_data_table(&data_table, Some("Sorted by Population Descending"), None);
        assert_data_table_row(&data_table, 1, values[2].clone());
        assert_data_table_row(&data_table, 2, values[1].clone());
        assert_data_table_row(&data_table, 3, values[3].clone());
    }

    #[test]
    fn test_data_table_sort_with_hidden_columns() {
        let (_, mut data_table) = new_data_table();
        data_table.apply_first_row_as_header();

        let column_headers = data_table.column_headers.as_mut().unwrap();
        column_headers[0].display = false;

        let values = test_csv_values()
            .into_iter()
            .map(|v| v.into_iter().skip(1).collect::<Vec<&'static str>>())
            .collect::<Vec<Vec<&'static str>>>();

        pretty_print_data_table(&data_table, Some("Original Data Table"), None);

        // sort by population city ascending
        data_table.sort_column(0, SortDirection::Ascending).unwrap();
        pretty_print_data_table(&data_table, Some("Sorted by City"), None);
        assert_data_table_row(&data_table, 1, values[2].clone());
        assert_data_table_row(&data_table, 2, values[3].clone());
        assert_data_table_row(&data_table, 3, values[1].clone());

        // sort by population descending
        data_table
            .sort_column(3, SortDirection::Descending)
            .unwrap();
        pretty_print_data_table(&data_table, Some("Sorted by Population Descending"), None);
        assert_data_table_row(&data_table, 1, values[2].clone());
        assert_data_table_row(&data_table, 2, values[1].clone());
        assert_data_table_row(&data_table, 3, values[3].clone());
    }
}
