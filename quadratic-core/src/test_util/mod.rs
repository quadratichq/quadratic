mod assert_data_table;
mod assert_formats;
mod assert_values;
mod create_data_table;
mod print;

#[allow(unused_imports)]
pub use assert_data_table::*;
#[allow(unused_imports)]
pub use assert_formats::*;
#[allow(unused_imports)]
pub use assert_values::*;
#[allow(unused_imports)]
pub use create_data_table::*;
#[allow(unused_imports)]
pub use print::*;

#[track_caller]
#[cfg(test)]
pub fn str_vec_to_string_vec(values: &Vec<&str>) -> Vec<String> {
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
