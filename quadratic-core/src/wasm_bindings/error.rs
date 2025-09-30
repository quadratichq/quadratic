// handle errors from the core
//
// example:
// handle_core_result( || {
//    self.autocomplete(sheet_id, initial_range, final_range, cursor)?;
// });

pub(crate) fn handle_core_result<F>(f: F)
where
    F: FnOnce() -> Result<(), String>,
{
    let result = f();

    if let Err(e) = result {
        let severity = crate::grid::js_types::JsSnackbarSeverity::Error;
        crate::wasm_bindings::js::jsClientMessage(e.to_string(), severity.to_string());
    }
}
