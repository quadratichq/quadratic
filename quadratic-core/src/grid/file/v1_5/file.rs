#[cfg(test)]
mod tests {
    use super::*;
    use crate::grid::file::v1_5::schema::GridSchema;
    use anyhow::{anyhow, Result};

    const V1_5_FILE: &str = include_str!("../../../../examples/v1_5.json");

    fn import(file_contents: &str) -> Result<GridSchema> {
        Ok(serde_json::from_str::<GridSchema>(&file_contents)
            .map_err(|e| anyhow!("Could not import file: {:?}", e))?)
    }

    fn export(grid_schema: &GridSchema) -> Result<String> {
        Ok(serde_json::to_string(grid_schema)
            .map_err(|e| anyhow!("Could not export file: {:?}", e))?)
    }

    #[test]
    fn import_and_export_a_v1_5_file() {
        let imported = import(V1_5_FILE).unwrap();
        let exported = export(&imported).unwrap();
        println!("{}", exported);
        // assert_eq!(V1_5_FILE, exported);
    }
}
