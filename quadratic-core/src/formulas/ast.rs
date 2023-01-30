use futures::future::{FutureExt, LocalBoxFuture};
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

    /// Evaluates a formula, blocking on async calls.
    ///
    /// Use this when the grid proxy isn't actually doing anything async.
    pub fn eval_blocking(&self, grid: &mut impl GridProxy, pos: Pos) -> FormulaResult {
        pollster::block_on(self.eval(grid, pos))
    }

    /// Evaluates a formula.
    pub async fn eval(&self, grid: &mut impl GridProxy, pos: Pos) -> FormulaResult {
        self.ast.eval(grid, pos).await
    }
}

impl AstNode {
    fn eval<'a>(
        &'a self,
        grid: &'a mut impl GridProxy,
        pos: Pos,
    ) -> LocalBoxFuture<'a, FormulaResult<Spanned<Value>>> {
        // See this link for why we need to box here:
        // https://rust-lang.github.io/async-book/07_workarounds/04_recursion.html
        async move { self.eval_inner(grid, pos).await }.boxed_local()
    }

    async fn eval_inner(
        &self,
        grid: &mut impl GridProxy,
        pos: Pos,
    ) -> FormulaResult<Spanned<Value>> {
        let value = match &self.inner {
            AstNodeContents::FunctionCall { func, args } => {
                let mut arg_values = vec![];
                for arg in args {
                    arg_values.push(arg.eval(grid, pos).await?);
                }
                match functions::function_from_name(&func.inner) {
                    Some(f) => f(arg_values)?,
                    None => return Err(FormulaErrorMsg::BadFunctionName.with_span(func.span)),
                }
            }

            AstNodeContents::Paren(expr) => expr.eval(grid, pos).await?.inner,

            AstNodeContents::CellRef(CellRef { x, y }) => {
                let ref_pos = Pos {
                    x: x.resolve_from(pos.x),
                    y: y.resolve_from(pos.y),
                };
                if ref_pos == pos {
                    return Err(FormulaErrorMsg::CircularReference.with_span(self.span));
                }
                Value::String(grid.get(ref_pos).await.unwrap_or_default())
            }

            AstNodeContents::String(s) => Value::String(s.clone()),

            AstNodeContents::Number(n) => Value::Number(*n),
        };

        Ok(Spanned {
            span: self.span,
            inner: value,
        })
    }
}
