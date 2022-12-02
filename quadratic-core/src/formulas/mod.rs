use serde::{Deserialize, Serialize};
use std::fmt;
use std::ops::Range;

use crate::{Cell, Grid, Pos};

/// Abstract syntax tree of a formula expression.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Formula {
    ast: AstNode,
}
impl fmt::Display for Formula {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt(&self.ast, f)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct AstNode {
    /// Span of text in the original formula (for error messages).
    span: Range<usize>,
    contents: AstNodeContents,
}
impl fmt::Display for AstNode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt(&self.contents, f)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
enum AstNodeContents {
    FunctionCall { func: String, args: Vec<AstNode> },
    CellRef { x: CellRefCoord, y: CellRefCoord },
    String(String),
    Number(f64),
}
impl fmt::Display for AstNodeContents {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AstNodeContents::FunctionCall { func, args } => {
                write!(f, "{}(", func)?;
                if let Some(first) = args.first() {
                    write!(f, "{}", first)?;
                    for arg in args.iter().skip(1) {
                        write!(f, ", {}", arg)?;
                    }
                }
                write!(f, ")")?;
                Ok(())
            }
            AstNodeContents::CellRef { x, y } => write!(f, "R{x}C{y}"),
            AstNodeContents::String(s) => write!(f, "{s:?}"),
            AstNodeContents::Number(n) => write!(f, "{n:?}"),
        }
    }
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
impl fmt::Display for CellRefCoord {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CellRefCoord::Relative(delta) => write!(f, "[{delta}]"),
            CellRefCoord::Absolute(coord) => write!(f, "{coord}"),
        }
    }
}
impl CellRefCoord {
    fn from(self, base: i64) -> i64 {
        match self {
            CellRefCoord::Relative(delta) => base + delta,
            CellRefCoord::Absolute(coord) => coord,
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
                    func: "SUM".to_string(),
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
        if s.trim().is_empty() {
            return Ok(0.0);
        }
        s.trim().parse().map_err(|_| {
            FormulaErrorMsg::ExpectedNumber { got: s.to_string() }.with_span(&self.span)
        })
    }
    fn eval(&self, grid: &Grid, pos: Pos) -> Result<Cell, FormulaError> {
        match &self.contents {
            AstNodeContents::FunctionCall { func, args } => {
                match func.to_ascii_lowercase().as_str() {
                    "sum" => args
                        .iter()
                        .map(|arg| arg.eval_number(grid, pos))
                        .try_fold(0.0, |sum, next| Ok(sum + next?))
                        .map(|sum| Cell::Text(sum.to_string())),
                    _ => Err(FormulaErrorMsg::UnknownFormula { func: func.clone() }
                        .with_span(&self.span)),
                }
            }
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

#[derive(Debug, Clone, PartialEq)]
pub struct FormulaError {
    /// Span of text in the original formula where the error occurred.
    pub span: Range<usize>,
    pub msg: FormulaErrorMsg,
}

#[derive(Debug, Clone, PartialEq)]
pub enum FormulaErrorMsg {
    SelfReference,
    UnknownFormula { func: String },
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

#[cfg(test)]
mod tests;
