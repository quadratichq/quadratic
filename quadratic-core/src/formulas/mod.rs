use std::ops::Range;

use serde::{Deserialize, Serialize};

use crate::{Cell, Grid, Pos};

/// Abstract syntax tree of a formula expression.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Formula {
    ast: AstNode,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct AstNode {
    /// Span of text in the original formula (for error messages)
    span: Range<usize>,
    contents: AstNodeContents,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
enum AstNodeContents {
    FunctionCall { f: String, args: Vec<AstNode> },
    CellRef { x: CellRefCoord, y: CellRefCoord },
    String(String),
    Number(f64),
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
enum CellRefCoord {
    Relative(i64),
    Absolute(i64),
}
impl Default for CellRefCoord {
    fn default() -> Self {
        Self::Relative(0)
    }
}
impl CellRefCoord {
    fn from(self, base: i64) -> i64 {
        match self {
            CellRefCoord::Relative(delta) => base + delta,
            CellRefCoord::Absolute(pos) => pos,
        }
    }
}

impl Formula {
    /// Returns a formula that sums some cells.
    ///
    /// TODO: remove this. it's just here for testing
    pub fn new_sum(cells: &[Pos]) -> Self {
        Self {
            ast: AstNode {
                span: 0..0,
                contents: AstNodeContents::FunctionCall {
                    f: "SUM".to_string(),
                    args: cells
                        .iter()
                        .map(|&Pos { x, y }| AstNode {
                            span: 0..0,
                            contents: AstNodeContents::CellRef {
                                x: CellRefCoord::Absolute(x),
                                y: CellRefCoord::Absolute(y),
                            },
                        })
                        .collect(),
                },
            },
        }
    }

    pub fn eval(&self, grid: &Grid, pos: Pos) -> Result<Cell, FormulaError> {
        self.ast.eval(grid, pos)
    }
}

impl AstNode {
    fn eval_number(&self, grid: &Grid, pos: Pos) -> Result<f64, FormulaError> {
        let out = self.eval(grid, pos)?;
        let s = out.string_value();
        s.parse().map_err(|_| {
            FormulaErrorMsg::ExpectedNumber { got: s.to_string() }.with_span(&self.span)
        })
    }
    fn eval(&self, grid: &Grid, pos: Pos) -> Result<Cell, FormulaError> {
        match &self.contents {
            AstNodeContents::FunctionCall { f, args } => match f.to_ascii_lowercase().as_str() {
                "sum" => args
                    .iter()
                    .map(|arg| arg.eval_number(grid, pos))
                    .try_fold(0.0, |sum, next| Ok(sum + next?))
                    .map(|sum| Cell::Text(sum.to_string())),
                _ => Err(FormulaErrorMsg::UnknownFormula { f: f.clone() }.with_span(&self.span)),
            },
            AstNodeContents::CellRef { x, y } => {
                let ref_pos = Pos {
                    x: x.from(pos.x),
                    y: y.from(pos.x),
                };
                if ref_pos == pos {
                    return Err(FormulaErrorMsg::SelfReference.with_span(&self.span));
                }
                Ok(grid.get_cell(ref_pos).clone())
            }
            AstNodeContents::String(s) => Ok(Cell::Text(s.clone())),
            AstNodeContents::Number(n) => Ok(Cell::Text(n.to_string())),
        }
    }
}

pub struct FormulaError {
    pub span: Range<usize>,
    pub msg: FormulaErrorMsg,
}

pub enum FormulaErrorMsg {
    SelfReference,
    UnknownFormula { f: String },
    ExpectedNumber { got: String },
}
impl FormulaErrorMsg {
    fn with_span(self, span: &Range<usize>) -> FormulaError {
        FormulaError {
            span: span.clone(),
            msg: self,
        }
    }
}
