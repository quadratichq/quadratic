//! Used by client to encode and decode scheduled task operations.

use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

use crate::{
    controller::{operations::operation::Operation, transaction::Transaction},
    wasm_bindings::js_selection::JsSelection,
};

/// Computes the code for a selection. If sheet_id and selection are not
/// provided, then all code cells in the file are computed.
#[wasm_bindgen(js_name = "scheduledTaskEncode")]
pub fn js_scheduled_task_encode(selection: Option<JsSelection>) -> Result<JsValue, String> {
    let ops = if let Some(selection) = selection {
        let selection = selection.get_owned_selection();
        vec![Operation::ComputeCodeSelection {
            selection: Some(selection),
        }]
    } else {
        vec![Operation::ComputeCodeSelection { selection: None }]
    };
    let binary_ops = Transaction::serialize_and_compress(ops).map_err(|e| e.to_string())?;

    serde_wasm_bindgen::to_value(&binary_ops).map_err(|e| e.to_string())
}

#[wasm_bindgen(js_name = "scheduledTaskDecode")]
pub fn js_scheduled_task_decode(binary_ops: Vec<u8>) -> Result<Option<JsSelection>, String> {
    let ops = Transaction::decompress_and_deserialize::<Vec<Operation>>(&binary_ops)
        .map_err(|e| e.to_string())?;
    if ops.len() == 1
        && let Operation::ComputeCodeSelection { selection } = &ops[0]
    {
        if let Some(selection) = selection {
            Ok(Some(JsSelection::new_with_selection(selection.clone())))
        } else {
            Ok(None)
        }
    } else {
        Err(format!(
            "Could not decode: Expected exactly one ComputeCodeSelection operation, got {ops:?}"
        ))
    }
}
