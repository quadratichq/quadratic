use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fmt::Debug;

use super::Grid;

pub mod current;
mod v1_3;
mod v1_5;

pub static CURRENT_VERSION: &str = "1.5";

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "version")]
enum GridFile {
    #[serde(rename = "1.5")]
    V1_5 {
        #[serde(flatten)]
        grid: v1_5::schema::GridSchema,
    },
    #[serde(rename = "1.3")]
    V1_3 {
        #[serde(flatten)]
        grid: v1_3::schema::GridSchema,
    },
}

impl GridFile {
    fn into_latest(self) -> Result<v1_5::schema::GridSchema> {
        match self {
            GridFile::V1_5 { grid } => Ok(grid),
            GridFile::V1_3 { grid } => v1_3::file::upgrade(grid),
        }
    }
}

pub fn import(file_contents: &str) -> Result<Grid> {
    // println!("{}", &file_contents);
    let file = serde_json::from_str::<GridFile>(file_contents)
        .map_err(|e| anyhow!(e))?
        .into_latest()?;

    current::import(file)
}

pub fn export(grid: &mut Grid) -> Result<String> {
    let converted = current::export(grid)?;
    let serialized = serde_json::to_string(&converted).map_err(|e| anyhow!(e))?;

    Ok(serialized)
}

#[cfg(test)]
mod tests {
    use super::*;

    const V1_3_FILE: &str = include_str!("../../../examples/v1_3.json");
    const V1_5_FILE: &str = include_str!("../../../examples/v1_5.json");

    #[test]
    fn process_a_v1_3_file() {
        // TODO(ddimaria): validate that elements of the imported and exported file are valid
        let mut imported = import(V1_3_FILE).unwrap();
        let exported = export(&mut imported).unwrap();
    }

    #[test]
    fn process_a_v1_5_file() {
        // TODO(ddimaria): validate that elements of the imported and exported file are valid
        let mut imported = import(V1_5_FILE).unwrap();
        let exported = export(&mut imported).unwrap();
    }
}
