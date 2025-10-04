pub mod assert;
mod assert_data_table;
mod assert_formats;
mod assert_values;
mod create_chart;
mod create_code_table;
mod create_data_table;
mod create_values;
mod get_sheets;
mod print_gc;
pub mod print_sheet;
mod print_table;
mod validations;

#[allow(unused_imports)]
pub use {
    assert_data_table::*, assert_formats::*, assert_values::*, create_chart::*,
    create_code_table::*, create_data_table::*, create_values::*, get_sheets::*, print_gc::*,
    print_sheet::*, print_table::*, validations::*,
};

#[track_caller]
#[cfg(test)]
pub(crate) fn str_vec_to_string_vec(values: &Vec<&str>) -> Vec<String> {
    values.iter().map(|s| s.to_string()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_str_vec_to_string_vec() {
        let input = vec!["test", "convert", "strings"];
        let result = str_vec_to_string_vec(&input);
        assert_eq!(
            result,
            vec![
                "test".to_string(),
                "convert".to_string(),
                "strings".to_string()
            ]
        );
    }
}
