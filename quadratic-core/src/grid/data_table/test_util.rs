#[cfg(test)]
use crate::grid::{DataTable, Sheet};

#[cfg(test)]
use crate::{Array, cellvalue::Import, controller::GridController};

#[cfg(test)]
pub fn test_csv_values() -> Vec<Vec<&'static str>> {
    vec![
        vec!["city", "region", "country", "population"],
        vec!["Southborough", "MA", "United States", "1000"],
        vec!["Denver", "CO", "United States", "10000"],
        vec!["Seattle", "WA", "United States", "100"],
    ]
}

#[cfg(test)]
pub fn new_data_table() -> (Sheet, DataTable) {
    let gc = GridController::test();
    let grid = gc.grid();
    let sheet = grid.sheets()[0].clone();
    let file_name = "test.csv";
    let values = test_csv_values();
    let import = Import::new(file_name.into());
    let array = Array::from_str_vec(values, true).unwrap();
    let context = gc.a1_context();
    let data_table = DataTable::from((import.clone(), array, context));

    (sheet, data_table)
}
