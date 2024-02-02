//! Language server implementation for Monaco editor

use lazy_static::lazy_static;
use serde::Serialize;

pub mod types;

pub use types::*;

use super::functions;

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CompletionList<'a> {
    suggestions: &'a [CompletionItem],
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Hover {
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
        })
        .collect();
}

pub fn provide_completion_items() -> CompletionList<'static> {
    CompletionList {
        suggestions: &FUNCTION_COMPLETION_ITEMS,
    }
}

pub fn provide_hover(partial_function_name: &str) -> Option<Hover> {
    let function = functions::lookup_function(partial_function_name)?;
    Some(Hover {
        contents: vec![MarkdownString {
            value: format!("`{}`\n", function.usages_string()) + &function.lsp_full_docs(),
        }],
    })
}
