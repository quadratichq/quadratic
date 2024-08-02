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

#[cfg(not(test))]
#[wasm_bindgen(
    module = "/../quadratic-client/src/app/web-workers/quadraticCore/worker/rustCallbacks.ts"
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

    pub fn jsRunJavascript(
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

    // todo: there should be a jsSheetFillUpdate instead of constantly passing back all sheet fills
    pub fn jsSheetFills(sheet_id: String, fills: String /* JsRenderFill */);

    pub fn jsSheetMetaFills(sheet_id: String, fills: String /* JsSheetFill */);

    pub fn jsAddSheet(sheetInfo: String /*SheetInfo*/, user: bool);
    pub fn jsDeleteSheet(sheetId: String, user: bool);
    pub fn jsRequestTransactions(sequence_num: u64);
    pub fn jsUpdateCodeCell(
        sheet_id: String,
        x: i64,
        y: i64,
        code_cell: Option<String>,        /*JsCodeCell*/
        render_code_cell: Option<String>, /*JsRenderCodeCell*/
    );
    pub fn jsOffsetsModified(sheet_id: String, column: Option<i64>, row: Option<i64>, size: f64);
    pub fn jsSetCursor(cursor: String);
    pub fn jsSetCursorSelection(selection: String);
    pub fn jsUpdateHtml(html: String /*JsHtmlOutput*/);
    pub fn jsClearHtml(sheet_id: String, x: i64, y: i64);
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
    pub fn jsTransactionStart(transaction_id: String, name: String);
    pub fn addUnsentTransaction(transaction_id: String, transaction: String, operations: u32);
    pub fn jsSendTransaction(transaction_id: String, transaction: &[u8]);

    pub fn jsTransactionProgress(transaction_id: String, remaining_operations: i32);

    pub fn jsUndoRedo(undo: bool, redo: bool);

    pub fn jsConnection(
        transactionId: String,
        x: i32,
        y: i32,
        sheet_id: String,
        query: String,
        connector_type: ConnectionKind,
        connection_id: String,
    );

    pub fn jsSendImage(
        sheet_id: String,
        x: i32,
        y: i32,
        image: Option<String>,
        w: Option<String>,
        h: Option<String>,
    );

    // rows: Vec<i64>
    pub fn jsRequestRowHeights(transaction_id: String, sheet_id: String, rows: String);
    // row_heights: Vec<JsRowHeight>
    pub fn jsResizeRowHeights(sheet_id: String, row_heights: String /*Vec<JsRowHeight>*/);
}

#[cfg(test)]
use std::sync::Mutex;

#[cfg(test)]
use lazy_static::lazy_static;

#[cfg(test)]
lazy_static! {
    static ref TEST_ARRAY: Mutex<Vec<TestFunction>> = Mutex::new(vec![]);
}

#[cfg(test)]
pub fn expect_js_call(name: &str, args: String, clear: bool) {
    let result = TestFunction {
        name: name.to_string(),
        args,
    };
    let index = TEST_ARRAY.lock().unwrap().iter().position(|x| *x == result);
    match index {
        Some(index) => {
            TEST_ARRAY.lock().unwrap().remove(index);
        }
        None => {
            dbg!(&TEST_ARRAY.lock().unwrap());
            panic!("Expected to find in TEST_ARRAY: {:?}", result)
        }
    }
    if clear {
        TEST_ARRAY.lock().unwrap().clear();
    }
}

#[cfg(test)]
pub fn expect_js_call_count(name: &str, count: usize, clear: bool) {
    let mut found = 0;
    TEST_ARRAY.lock().unwrap().retain(|x| {
        if x.name == name {
            found += 1;
            return false;
        }
        true
    });
    assert_eq!(found, count);
    if clear {
        TEST_ARRAY.lock().unwrap().clear();
    }
}

#[cfg(test)]
pub fn clear_js_calls() {
    TEST_ARRAY.lock().unwrap().clear();
}

#[cfg(test)]
#[derive(serde::Serialize, Debug, PartialEq)]
pub struct TestFunction {
    pub name: String,
    pub args: String,
}

#[cfg(test)]
impl TestFunction {
    pub fn new(name: &str, args: String) -> Self {
        Self {
            name: name.to_string(),
            args,
        }
    }
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsTime(name: String) {
    TEST_ARRAY
        .lock()
        .unwrap()
        .push(TestFunction::new("jsTime", name));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsTimeEnd(name: String) {
    TEST_ARRAY
        .lock()
        .unwrap()
        .push(TestFunction::new("jsTimeEnd", name));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsRunPython(
    transactionId: String,
    x: i32,
    y: i32,
    sheet_id: String,
    code: String,
) -> JsValue {
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsRunPython",
        format!("{},{},{},{},{}", transactionId, x, y, sheet_id, code),
    ));
    JsValue::NULL
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsRunJavascript(
    transactionId: String,
    x: i32,
    y: i32,
    sheet_id: String,
    code: String,
) -> JsValue {
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsRunJavascript",
        format!("{},{},{},{},{}", transactionId, x, y, sheet_id, code),
    ));
    JsValue::NULL
}

#[cfg(test)]
pub fn hash_test<T: std::hash::Hash>(value: &T) -> u64 {
    use std::hash::{DefaultHasher, Hasher};
    let mut hasher = DefaultHasher::new();
    value.hash(&mut hasher);
    hasher.finish()
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsRenderCellSheets(
    sheet_id: String,
    hash_x: i64,
    hash_y: i64,
    cells: String, /*Vec<JsRenderCell>*/
) {
    // we use a hash of cells to avoid storing too large test data
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsRenderCellSheets",
        format!("{},{},{},{}", sheet_id, hash_x, hash_y, hash_test(&cells)),
    ));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsSheetInfo(sheets: String /* Vec<JsSheetInfo> */) {
    TEST_ARRAY
        .lock()
        .unwrap()
        .push(TestFunction::new("jsSheetInfo", sheets));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsSheetInfoUpdate(sheet: String /* JsSheetInfo */) {
    TEST_ARRAY
        .lock()
        .unwrap()
        .push(TestFunction::new("jsSheetInfoUpdate", sheet));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsSheetFills(sheet_id: String, fills: String /* JsRenderFill */) {
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsSheetFills",
        format!("{},{}", sheet_id, fills),
    ));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsSheetMetaFills(sheet_id: String, fills: String /* JsSheetFill */) {
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsSheetMetaFills",
        format!("{},{}", sheet_id, fills),
    ));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsAddSheet(sheetInfo: String /*SheetInfo*/, user: bool) {
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsAddSheet",
        format!("{},{}", sheetInfo, user),
    ));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsDeleteSheet(sheetId: String, user: bool) {
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsDeleteSheet",
        format!("{},{}", sheetId, user),
    ));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsRequestTransactions(sequence_num: u64) {
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsRequestTransactions",
        sequence_num.to_string(),
    ));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsUpdateCodeCell(
    sheet_id: String,
    x: i64,
    y: i64,
    code_cell: Option<String>,        /*JsCodeCell*/
    render_code_cell: Option<String>, /*JsRenderCodeCell*/
) {
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsUpdateCodeCell",
        format!(
            "{},{},{},{:?},{:?}",
            sheet_id, x, y, code_cell, render_code_cell
        ),
    ));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsOffsetsModified(sheet_id: String, column: Option<i64>, row: Option<i64>, size: f64) {
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsOffsetsModified",
        format!("{},{:?},{:?},{}", sheet_id, column, row, size),
    ));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsSetCursor(cursor: String) {
    TEST_ARRAY
        .lock()
        .unwrap()
        .push(TestFunction::new("jsSetCursor", cursor));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsSetCursorSelection(selection: String) {
    TEST_ARRAY
        .lock()
        .unwrap()
        .push(TestFunction::new("jsSetCursorSelection", selection));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsUpdateHtml(html: String /*JsHtmlOutput*/) {
    TEST_ARRAY
        .lock()
        .unwrap()
        .push(TestFunction::new("jsUpdateHtml", html));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsClearHtml(sheet_id: String, x: i64, y: i64) {
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsClearHtml",
        format!("{},{},{}", sheet_id, x, y),
    ));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsHtmlOutput(html: String /*Vec<JsHtmlOutput>*/) {
    TEST_ARRAY
        .lock()
        .unwrap()
        .push(TestFunction::new("jsHtmlOutput", html));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsGenerateThumbnail() {
    TEST_ARRAY
        .lock()
        .unwrap()
        .push(TestFunction::new("jsGenerateThumbnail", "".to_string()));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsSheetBorders(sheet_id: String, borders: String) {
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsSheetBorders",
        format!("{},{}", sheet_id, borders),
    ));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsSheetCodeCell(sheet_id: String, code_cells: String) {
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsSheetCodeCell",
        format!("{},{}", sheet_id, code_cells),
    ));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsSheetBoundsUpdate(bounds: String) {
    TEST_ARRAY
        .lock()
        .unwrap()
        .push(TestFunction::new("jsSheetBoundsUpdate", bounds));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsImportProgress(file_name: &str, current: u32, total: u32, x: i64, y: i64, w: u32, h: u32) {
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsImportProgress",
        format!(
            "{},{},{},{},{},{},{}",
            file_name, current, total, x, y, w, h
        ),
    ));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsTransactionStart(transaction_id: String, name: String) {
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsTransactionStart",
        format!("{},{}", transaction_id, name,),
    ));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn addUnsentTransaction(transaction_id: String, transaction: String, operations: u32) {
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "addUnsentTransaction",
        format!("{},{},{}", transaction_id, transaction, operations),
    ));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsSendTransaction(transaction_id: String, _transaction: &[u8]) {
    // We do not include the actual transaction as we don't want to save that in
    // the TEST_ARRAY because of its potential size.
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsSendTransaction",
        transaction_id.to_string(),
    ));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsTransactionProgress(transaction_id: String, remaining_operations: i32) {
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsTransactionProgress",
        format!("{},{}", transaction_id, remaining_operations),
    ));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsUndoRedo(undo: bool, redo: bool) {
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsUndoRedo",
        format!("{},{}", undo, redo),
    ));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsConnection(
    transactionId: String,
    x: i32,
    y: i32,
    sheet_id: String,
    query: String,
    connector_type: ConnectionKind,
    connection_id: String,
) -> JsValue {
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsConnection",
        format!(
            "{},{},{},{},{},{},{}",
            transactionId, x, y, sheet_id, query, connector_type, connection_id
        ),
    ));
    JsValue::NULL
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsSendImage(
    sheet_id: String,
    x: i32,
    y: i32,
    image: Option<String>,
    w: Option<String>,
    h: Option<String>,
) {
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsSendImage",
        format!(
            "{},{},{},{:?},{:?},{:?}",
            sheet_id,
            x,
            y,
            image.is_some(),
            w,
            h
        ),
    ));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsRequestRowHeights(
    transaction_id: String,
    sheet_id: String,
    rows: String, /*Vec<i64>*/
) {
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsRequestRowHeights",
        format!("{},{},{}", transaction_id, sheet_id, rows),
    ));
}

#[cfg(test)]
#[allow(non_snake_case)]
pub fn jsResizeRowHeights(sheet_id: String, row_heights: String /*Vec<JsRowHeight>*/) {
    TEST_ARRAY.lock().unwrap().push(TestFunction::new(
        "jsResizeRowHeights",
        format!("{},{}", sheet_id, row_heights),
    ));
}
