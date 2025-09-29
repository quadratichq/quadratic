use serde::{Deserialize, Serialize};

use crate::{Span, Spanned, a1::SheetCellRefRange};

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
pub struct FormulaParseResult {
    pub parse_error_msg: Option<String>,
    pub parse_error_span: Option<Span>,

    pub cell_refs: Vec<CellRefSpan>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct CellRefSpan {
    pub span: Span,
    pub cell_ref: SheetCellRefRange,
}
impl From<Spanned<SheetCellRefRange>> for CellRefSpan {
    fn from(value: Spanned<SheetCellRefRange>) -> Self {
        CellRefSpan {
            span: value.span,
            cell_ref: value.inner,
        }
    }
}
