//! Types for Monaco editor LSP API.
//!
//! Monaco seems to use a *slightly different* protocol than standard LSP, and
//! the only place I could find it documented was [the Monaco
//! docs](https://microsoft.github.io/monaco-editor/docs.html).
//!
//! When adding to more types to this file or when adding more options for
//! existing types, use that documentation and recreate the types in Rust, being
//! careful to make sure they serialize the same way. See [the Serde
//! docs](https://serde.rs/) for help with that.
//!
//! In particular, use `Serialize_repr` and `Deserialize_repr` for enums that
//! should be serialized as integers.
#![allow(non_camel_case_types)] // at time of writing, this is needed by `serde_repr`

use serde::{Deserialize, Serialize};
use serde_repr::{Deserialize_repr, Serialize_repr};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(untagged, rename_all = "camelCase")]
pub enum Documentation {
    String(String),
    Markdown(MarkdownString),
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownString {
    pub value: String,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CompletionItem {
    pub detail: Option<String>,
    pub documentation: Option<Documentation>,
    pub insert_text: Option<String>,
    pub insert_text_rules: Option<CompletionItemInsertTextRule>,
    pub kind: CompletionItemKind,
    pub label: String, // TODO: can be CompletionItemLabel
}

#[derive(Serialize_repr, Deserialize_repr, Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
#[repr(u8)]
pub enum CompletionItemKind {
    Method = 0,
    Function = 1,
    Constructor = 2,
    Field = 3,
    Variable = 4,
    Class = 5,
    Struct = 6,
    Interface = 7,
    Module = 8,
    Property = 9,
    Event = 10,
    Operator = 11,
    Unit = 12,
    Value = 13,
    Constant = 14,
    Enum = 15,
    EnumMember = 16,
    Keyword = 17,
    #[default]
    Text = 18,
    Color = 19,
    File = 20,
    Reference = 21,
    Customcolor = 22,
    Folder = 23,
    TypeParameter = 24,
    User = 25,
    Issue = 26,
    Snippet = 27,
}

#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
#[serde(transparent)]
pub struct CompletionItemInsertTextRule(u32);
impl CompletionItemInsertTextRule {
    pub const NONE: Self = Self(0);
    pub const KEEP_WHITESPACE: Self = Self(1);
    pub const INSERT_AS_SNIPPET: Self = Self(4);
}
