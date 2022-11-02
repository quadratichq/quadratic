use crate::fetch::fetch_text_file;
use crate::utils::log;
use js_sys::Uint8Array;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::JsFuture;
use web_sys::{Request, RequestInit, RequestMode, Response};

mod fetch;
mod reader;
mod utils;

type WasmResult<T> = std::result::Result<T, JsError>;
const FILE_PATH: &str = "./data/test-data.txt";

// We expose the Struct QCore and it's methods to JS
#[wasm_bindgen]
pub struct QuadraticCore {
    pub data: usize,
}

#[wasm_bindgen]
impl QuadraticCore {
    pub fn new() -> Self {
        QuadraticCore { data: 8 }
    }
    pub async fn wasm_fetch_file() -> Result<JsValue, JsValue> {
        let mut opts = RequestInit::new();
        opts.method("GET");
        opts.mode(RequestMode::Cors);

        let request = Request::new_with_str_and_init(FILE_PATH, &opts)?;

        request.headers().set("Accept", "application/binary")?;

        let window = web_sys::window().unwrap();
        let resp_value = JsFuture::from(window.fetch_with_request(&request)).await?;

        // `resp_value` is a `Response` object.
        assert!(resp_value.is_instance_of::<Response>());
        let resp: Response = resp_value.dyn_into().unwrap();

        // Convert this other `Promise` into a rust `Future`.
        let text = JsFuture::from(resp.text()?).await?;

        // Send the JSON response back to JS.
        Ok(text)
    }

    pub fn read_parquet_meta_data(parquet_file: &[u8]) -> String {
        match reader::read_metadata(parquet_file) {
            Ok(m) => {
                format!("{:?}", m)
            }
            Err(_) => "failed to read metadata".to_string(),
        }
    }

    pub fn read_parquet(parquet_file: &[u8]) -> WasmResult<Uint8Array> {
        utils::assert_parquet_file_not_empty(parquet_file)?;

        let buffer = reader::read_parquet(parquet_file)?;

        utils::copy_vec_to_uint8_array(buffer)
    }

    pub fn read_csv() {
        let csv_path = "./data/addresses.csv";
        let csv = fetch_text_file(csv_path);
    }
}
