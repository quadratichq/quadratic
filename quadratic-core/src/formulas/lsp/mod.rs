//! Language server implementation for Monaco editor

use lazy_static::lazy_static;
use serde::Serialize;
use wasm_bindgen::prelude::*;

pub mod types;

pub use types::*;

use super::functions;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = JSON)]
    fn stringify(value: &JsValue) -> String;
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct CompletionList<'a> {
    suggestions: &'a [CompletionItem],
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct Hover {
    contents: Vec<MarkdownString>,
}

lazy_static! {
    static ref FUNCTION_COMPLETION_ITEMS: Vec<CompletionItem> = functions::CATEGORIES
        .iter()
        .filter(|category| category.include_in_completions)
        .flat_map(|category| (category.get_functions)())
        .map(|f| CompletionItem {
            detail: Some(f.usages_string()),
            documentation: Some(Documentation::Markdown(MarkdownString {
                value: f.lsp_full_docs(),
            })),
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

#[wasm_bindgen(js_name = "provideHover")]
pub async fn provide_hover(
    text_model: JsValue,
    position: JsValue,
    _token: JsValue,
) -> Result<JsValue, JsValue> {
    let function = jsexpr!(text_model.getWordAtPosition(position).word)
        .as_string()
        .and_then(|name| functions::lookup_function(&name));

    match function {
        Some(function) => Ok(serde_wasm_bindgen::to_value(&Hover {
            contents: vec![MarkdownString {
                value: format!("`{}`\n", function.usages_string()) + &function.lsp_full_docs(),
            }],
        })?),
        None => Ok(JsValue::NULL),
    }
}
