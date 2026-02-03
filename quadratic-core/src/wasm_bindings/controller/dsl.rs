//! WASM bindings for DSL parsing and execution

use crate::controller::active_transactions::transaction_name::TransactionName;
use crate::controller::GridController;
use crate::dsl;
use crate::wasm_bindings::capture_core_error;
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::JsValue;

#[wasm_bindgen]
impl GridController {
    /// Parses DSL content and executes the operations to populate the grid.
    ///
    /// The DSL is a simple text-based language for creating spreadsheet content.
    /// See `quadratic-core/src/dsl/AI_SPEC.md` for the full specification.
    ///
    /// # Arguments
    /// * `dsl_content` - The DSL text to parse and execute
    ///
    /// # Returns
    /// A JsValue indicating success or containing an error message
    #[wasm_bindgen(js_name = "parseDsl")]
    pub fn js_parse_dsl(&mut self, dsl_content: String) -> JsValue {
        capture_core_error(|| {
            // Parse the DSL text into an AST
            let doc = dsl::parse(&dsl_content).map_err(|e| e.to_string())?;

            // Get the first sheet ID to compile operations for
            let sheet_id = self.grid().first_sheet_id();

            // Compile the AST into operations
            let result = dsl::compile(doc, sheet_id).map_err(|e| e.to_string())?;

            // Execute each operation as a transaction
            // Group operations by type for efficiency
            if !result.operations.is_empty() {
                self.start_user_ai_transaction(
                    result.operations,
                    None, // no cursor
                    TransactionName::Import,
                    false, // not AI-generated (the DSL itself may be, but this is a system operation)
                );
            }

            Ok(None)
        })
    }

    /// Validates DSL content without executing it.
    ///
    /// # Arguments
    /// * `dsl_content` - The DSL text to validate
    ///
    /// # Returns
    /// A JsValue with result=true if valid, or result=false with an error message
    #[wasm_bindgen(js_name = "validateDsl")]
    pub fn js_validate_dsl(&self, dsl_content: String) -> JsValue {
        capture_core_error(|| {
            // Parse the DSL text
            let doc = dsl::parse(&dsl_content).map_err(|e| e.to_string())?;

            // Compile to validate (but don't execute)
            let sheet_id = self.grid().first_sheet_id();
            let _result = dsl::compile(doc, sheet_id).map_err(|e| e.to_string())?;

            Ok(None)
        })
    }
}