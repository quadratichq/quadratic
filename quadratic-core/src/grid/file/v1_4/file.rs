#[cfg(test)]
mod tests {
    use crate::grid::file::v1_4::schema::GridSchema;
    use anyhow::{anyhow, Result};

    const V1_4_FILE: &str = include_str!("../../../../examples/v1_4_simple.grid");

    fn import(file_contents: &str) -> Result<GridSchema> {
        serde_json::from_str::<GridSchema>(file_contents)
            .map_err(|e| anyhow!("Could not import file: {:?}", e))
    }

    fn export(grid_schema: &GridSchema) -> Result<String> {
        serde_json::to_string(grid_schema).map_err(|e| anyhow!("Could not export file: {:?}", e))
    }

    #[test]
    fn import_and_export_a_v1_4_file() {
        let imported = import(V1_4_FILE).unwrap();
        let exported = export(&imported).unwrap();
        println!("{}", exported);
        // assert_eq!(V1_4_FILE, exported);
    }
}
