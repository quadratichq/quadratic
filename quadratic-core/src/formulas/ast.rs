use serde::{Deserialize, Serialize};
use std::fmt;

use super::*;

/// Abstract syntax tree of a formula expression.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Formula {
    pub ast: AstNode,
}
impl fmt::Display for Formula {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt(&self.ast, f)
    }
}

pub type AstNode = Spanned<AstNodeContents>;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum AstNodeContents {
    FunctionCall {
        func: Spanned<String>,
        args: Vec<AstNode>,
    },
    Paren(Box<AstNode>),
    CellRef(CellRef),
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
            AstNodeContents::Paren(contents) => write!(f, "({contents})"),
            AstNodeContents::CellRef(cellref) => write!(f, "{cellref}"),
            AstNodeContents::String(s) => write!(f, "{s:?}"),
            AstNodeContents::Number(n) => write!(f, "{n:?}"),
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
                span: Span::empty(0),
                inner: AstNodeContents::FunctionCall {
                    func: Spanned {
                        span: Span::empty(0),
                        inner: "SUM".to_string(),
                    },
                    args: cells
                        .iter()
                        .map(|&Pos { x, y }| AstNode {
                            span: Span::empty(0),
                            inner: AstNodeContents::CellRef(CellRef {
                                x: CellRefCoord::Absolute(x),
                                y: CellRefCoord::Absolute(y),
                            }),
                        })
                        .collect(),
                },
            },
        }
    }

    pub fn eval(&self, grid: &impl GridProxy, pos: Pos) -> FormulaResult {
        self.ast.eval(grid, pos)
    }
}

impl AstNode {
    fn eval(&self, grid: &impl GridProxy, pos: Pos) -> FormulaResult {
        let value = match &self.inner {
            AstNodeContents::FunctionCall { func, args } => {
                match func.inner.to_ascii_lowercase().as_str() {
                    "sum" => {
                        let sum = args
                            .iter()
                            .map(|arg| arg.eval(grid, pos)?.to_number())
                            .try_fold(0.0, |sum, next| FormulaResult::Ok(sum + next?))?;
                        Value::String(sum.to_string())
                    }
                    _ => return Err(FormulaErrorMsg::BadFunctionName.with_span(func.span)),
                }
            }

            AstNodeContents::Paren(expr) => expr.eval(grid, pos)?.inner,

            AstNodeContents::CellRef(CellRef { x, y }) => {
                let ref_pos = Pos {
                    x: x.resolve_from(pos.x),
                    y: y.resolve_from(pos.y),
                };
                if ref_pos == pos {
                    return Err(FormulaErrorMsg::CircularReference.with_span(self.span));
                }
                Value::String(grid.get(ref_pos).clone().unwrap_or_default())
            }

            AstNodeContents::String(s) => Value::String(s.clone()),

            AstNodeContents::Number(n) => Value::String(n.to_string()),
        };

        Ok(Spanned {
            span: self.span,
            inner: value,
        })
    }
}
