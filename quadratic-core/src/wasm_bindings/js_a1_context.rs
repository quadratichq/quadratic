use wasm_bindgen::prelude::*;

use crate::{
    a1::A1Context,
    compression::{SerializationFormat, deserialize},
};

#[derive(Debug, Default)]
#[wasm_bindgen]
pub struct JsA1Context {
    context: A1Context,
}

impl JsA1Context {
    pub(crate) fn get_context(&self) -> &A1Context {
        &self.context
    }
}

#[wasm_bindgen]
impl JsA1Context {
    #[wasm_bindgen(constructor)]
    pub fn new(context: Vec<u8>) -> Self {
        match deserialize::<A1Context>(&SerializationFormat::Bincode, &context) {
            Ok(context) => Self { context },
            Err(e) => {
                dbgjs!(&format!("Error creating JsA1Context: {e}"));
                Self::default()
            }
        }
    }

    #[wasm_bindgen(js_name = "newEmpty")]
    pub fn new_empty() -> Self {
        Self {
            context: A1Context::default(),
        }
    }
}
