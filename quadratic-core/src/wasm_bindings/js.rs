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

    pub fn jsRunPython(
        transactionId: String,
        x: i32,
        y: i32,
        sheet_id: String,
        code: String,
    ) -> JsValue;

    // cells: Vec<JsRenderCell>
    pub fn jsRenderCellSheets(
        sheet_id: String,
        hash_x: i64,
        hash_y: i64,
        cells: String, /*Vec<JsRenderCell>*/
    );

    pub fn jsSheetInfo(sheets: String /* Vec<JsSheetInfo> */);
    pub fn jsSheetInfoUpdate(sheet: String /* JsSheetInfo */);
    pub fn jsSheetFills(sheet_id: String, fills: String /* JsRenderFill */);
    pub fn jsAddSheet(sheetInfo: String /*SheetInfo*/, user: bool);
    pub fn jsDeleteSheet(sheetId: String, user: bool);
    pub fn jsRequestTransactions(sequence_num: u64);
    pub fn jsUpdateCodeCell(
        sheet_id: String,
        code_cell: String,        /*JsCodeCell*/
        render_code_cell: String, /*JsRenderCodeCell*/
    );
    pub fn jsOffsetsModified(sheet_id: String, column: Option<i64>, row: Option<i64>, size: f64);
    pub fn jsSetCursor(cursor: String);
    pub fn jsUpdateHtml(html: String /*JsHtmlOutput*/);
    pub fn jsHtmlOutput(html: String /*Vec<JsHtmlOutput>*/);
    pub fn jsGenerateThumbnail();
    pub fn jsSheetBorders(sheet_id: String, borders: String);
    pub fn jsSheetCodeCell(sheet_id: String, code_cells: String);
    pub fn jsSheetBoundsUpdate(bounds: String);

    pub fn jsImportProgress(
        file_name: &str,
        current: u32,
        total: u32,
        x: i64,
        y: i64,
        w: u32,
        h: u32,
    );
    pub fn jsTransactionStart(
        transaction_id: String,
        name: String,
        sheet_id: Option<String>,
        x: Option<i64>,
        y: Option<i64>,
        w: Option<u32>,
        h: Option<u32>,
    );
    pub fn addUnsentTransaction(transaction_id: String, transaction: String);
    pub fn jsSendTransaction(transaction_id: String, transaction: String);

    pub fn jsTransactionProgress(transaction_id: String, remaining_operations: i32);
}
