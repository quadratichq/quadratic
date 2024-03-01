use super::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = JSON)]
    pub(crate) fn stringify(value: &JsValue) -> String;
}

#[wasm_bindgen]
extern "C" {
    // Use `js_namespace` here to bind `console.log(..)` instead of just
    // `log(..)`
    #[wasm_bindgen(js_namespace = console)]
    pub(crate) fn log(s: &str);
}

#[wasm_bindgen(
    module = "/../quadratic-client/src/web-workers/quadraticCore/worker/rustCallbacks.ts"
)]
extern "C" {
    pub fn jsTime(name: String);
    pub fn jsTimeEnd(name: String);

    pub fn runPython(
        transactionId: String,
        x: i32,
        y: i32,
        sheet_id: String,
        code: String,
    ) -> JsValue;
    pub fn addUnsentTransaction(transaction_id: String, transaction: String);

    pub fn jsSendTransaction(transaction_id: String, transaction: String);

    pub fn jsImportProgress(
        file_name: &str,
        current: u32,
        total: u32,
        x: i64,
        y: i64,
        w: u32,
        h: u32,
    );

    // cells: Vec<JsRenderCell>
    pub fn jsRenderCellSheets(
        sheet_id: String,
        hash_x: i64,
        hash_y: i64,
        cells: String, /*Vec<JsRenderCell>*/
    );

    pub fn jsSheetInfo(sheets: String); // Vec<JsSheetInfo>
    pub fn jsSheetInfoUpdate(sheet: String); // JsSheetInfo
    pub fn jsSheetFills(sheet_id: String, fills: String); // JsRenderFill
    pub fn jsAddSheet(sheetInfo: String /*SheetInfo*/, user: bool);
    pub fn jsDeleteSheet(sheetId: String, user: bool);
    pub fn jsRequestTransactions(sequence_num: u64);
    pub fn jsUpdateHtml(sheet_id: String, x: i64, y: i64, html: String /*JsHtmlOutput*/);
    pub fn jsUpdateCodeCell(
        sheet_id: String,
        x: i64,
        y: i64,
        code_cell: String, /*JsCodeCell*/
    );
    pub fn jsOffsetsModified(sheet_id: String, offsets: String);

    pub fn jsSetCursor(cursor: String);
}
