//use js_sys::Uint8Array;
use wasm_bindgen::{prelude::wasm_bindgen, JsError};

pub fn assert_parquet_file_not_empty(parquet_file: &[u8]) -> Result<(), JsError> {
    if parquet_file.is_empty() {
        return Err(JsError::new("Empty input provided or not a Uint8Array."));
    }
    Ok(())
}
// Copy Vec<u8> to a Uint8Array
// pub fn copy_vec_to_uint8_array(buffer: Vec<u8>) -> Result<Uint8Array, JsError> {
//     let return_len = match (buffer.len() as usize).try_into() {
//         Ok(return_len) => return_len,
//         Err(error) => return Err(JsError::new(format!("{}", error).as_str())),
//     };
//     let return_vec = Uint8Array::new_with_length(return_len);
//     return_vec.copy_from(&buffer);
//     Ok(return_vec)
// }

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    pub fn log(s: &str);
}
