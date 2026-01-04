//! JavaScript FFI bindings for worker communication.
//!
//! These bindings allow the Rust renderer to communicate with JavaScript
//! in the web worker context.

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    /// Send a bincode-encoded message to the core worker.
    /// This is called from Rust to send RendererToCore messages.
    /// The JavaScript side will forward this via the MessagePort to core.
    #[wasm_bindgen(js_name = "jsSendToCore")]
    pub fn js_send_to_core(data: Vec<u8>);
}

