//! Schema types for formula AST serialization.
//!
//! These types mirror the runtime `Formula`/`AstNode`/`AstNodeContents` types
//! but are decoupled from them to ensure file format stability. If the runtime
//! types change, we can update the conversion logic without breaking file compatibility.

use serde::{Deserialize, Serialize};

use super::{IdSchema, RefRangeBoundsSchema, RunErrorMsgSchema, SpanSchema};

/// Schema for a formula's abstract syntax tree.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FormulaSchema {
    pub ast: AstNodeSchema,
}

/// Schema for a spanned AST node (contains span + contents).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AstNodeSchema {
    pub span: SpanSchema,
    pub inner: AstNodeContentsSchema,
}

/// Schema for AST node contents.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum AstNodeContentsSchema {
    Empty,
    FunctionCall {
        func: SpannedStringSchema,
        args: Vec<AstNodeSchema>,
    },
    Paren(Vec<AstNodeSchema>),
    Array(Vec<Vec<AstNodeSchema>>),
    /// Cell reference with optional sheet ID and range bounds.
    CellRef(Option<IdSchema>, RefRangeBoundsSchema),
    /// Range reference with sheet ID, cells, and explicit sheet name flag.
    RangeRef(SheetCellRefRangeSchema),
    String(String),
    Number(f64),
    Bool(bool),
    Error(RunErrorMsgSchema),
}

/// Schema for a spanned string (used for function names).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SpannedStringSchema {
    pub span: SpanSchema,
    pub inner: String,
}

/// Schema for SheetCellRefRange (a range reference with sheet context).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SheetCellRefRangeSchema {
    pub sheet_id: IdSchema,
    pub cells: CellRefRangeForAstSchema,
    pub explicit_sheet_name: bool,
}

/// Schema for CellRefRange within AST (Sheet or Table reference).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CellRefRangeForAstSchema {
    Sheet { range: RefRangeBoundsSchema },
    Table { range: TableRefForAstSchema },
}

/// Schema for table references within AST.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TableRefForAstSchema {
    pub table_name: String,
    pub data: bool,
    pub headers: bool,
    pub totals: bool,
    pub col_range: ColRangeForAstSchema,
}

/// Schema for column range in table references.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ColRangeForAstSchema {
    All,
    Col(String),
    ColRange(String, String),
    ColToEnd(String),
}
