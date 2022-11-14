use crate::utils::log;
use arrow2::array::Array;
use arrow2::chunk::Chunk;
use wasm_bindgen::prelude::*;

mod fetch;
mod reader;
mod utils;

// We expose the Struct QCore and its methods to JS
#[wasm_bindgen]
pub struct QuadraticCore {
    matrices: Vec<Vec<Vec<String>>>,
    chunks: Vec<Chunk<Box<dyn Array>>>,
}

#[wasm_bindgen]
impl QuadraticCore {
    pub fn new() -> Self {
        QuadraticCore {
            matrices: vec![],
            chunks: vec![],
        }
    }

    pub fn copy_string_rects_to_javascript(&self) -> JsValue {
        serde_wasm_bindgen::to_value(&self.matrices).unwrap() // Unwrap should be properly handled
    }

    pub fn print_matrices(&self) {
        log(&format!("Number of matrices {}", self.matrices.len()));
        for m in &self.matrices {
            log(&format!("Number of vectors {}", m.len()));
            for v in m {
                log(&format!("Number of values {}", v.len()));
                for val in v {
                    log(&val)
                }
            }
        }
    }

    pub fn read_parquet_meta_data(parquet_file: &[u8]) -> String {
        match reader::read_metadata(parquet_file) {
            Ok(m) => {
                format!("{:?}", m)
            }
            Err(_) => "failed to read metadata".to_string(),
        }
    }

    pub fn load_parquet(&mut self, parquet_file: &[u8]) {
        match utils::assert_parquet_file_not_empty(parquet_file) {
            Ok(_) => reader::read_parquet(self, parquet_file),
            Err(_) => utils::log("Parquet file is empty..."),
        }
    }

    pub fn generate_string_matrices(&mut self) {
        reader::generate_string_matrices(self);
    }
}
