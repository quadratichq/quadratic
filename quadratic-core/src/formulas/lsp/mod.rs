//! Language server implementation for Monaco editor

use itertools::Itertools;
use lazy_static::lazy_static;
use serde::Serialize;
use wasm_bindgen::prelude::*;

pub mod types;

pub use types::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = JSON)]
    fn stringify(value: &JsValue) -> String;
}

#[derive(Serialize, Debug, Clone)]
struct CompletionList<'a> {
    suggestions: &'a [CompletionItem],
}

lazy_static! {
    static ref FUNCTION_COMPLETION_ITEMS: Vec<CompletionItem> = super::functions::CATEGORIES
        .iter()
        .filter(|category| category.include_in_completions)
        .flat_map(|category| (category.get_functions)())
        .map(|f| CompletionItem {
            detail: Some(f.usages_strings().join("\n")),
            documentation: Some(Documentation::Markdown {
                value: f.lsp_full_docs(),
            }),
            insert_text: Some(f.autocomplete_snippet()),
            insert_text_rules: Some(CompletionItemInsertTextRule::INSERT_AS_SNIPPET),
            kind: CompletionItemKind::Function,
            label: f.name.to_string(),
            ..Default::default()
        })
        .collect();
}

#[wasm_bindgen(js_name = "provideCompletionItems")]
pub fn provide_completion_items(
    _text_model: JsValue,
    _position: JsValue,
    _context: JsValue,
    _token: JsValue,
) -> Result<JsValue, JsValue> {
    Ok(serde_wasm_bindgen::to_value(&CompletionList {
        suggestions: &FUNCTION_COMPLETION_ITEMS,
    })?)
}
