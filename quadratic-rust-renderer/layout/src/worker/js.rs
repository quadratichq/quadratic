//! JavaScript interop

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    /// Send a message to the Core worker
    #[wasm_bindgen(js_name = jsSendToCore)]
    pub fn js_send_to_core(data: Vec<u8>);

    /// Send render batch to Render worker (as transferable buffer)
    #[wasm_bindgen(js_name = jsSendToRender)]
    pub fn js_send_to_render(data: Vec<u8>);
}
