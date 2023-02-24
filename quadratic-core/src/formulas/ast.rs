use futures::future::{FutureExt, LocalBoxFuture};
use serde::{Deserialize, Serialize};
use smallvec::smallvec;
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
impl AstNodeContents {
    fn type_string(&self) -> &'static str {
        match self {
            AstNodeContents::FunctionCall { func, .. } => match func.inner.as_str() {
                "=" | "==" | "<>" | "!=" | "<" | ">" | "<=" | ">=" => "comparison",
                s if s.chars().all(|c| c.is_alphanumeric() || c == '_') => "function call",
                _ => "expression",
            },
            AstNodeContents::Paren(contents) => contents.inner.type_string(),
            AstNodeContents::CellRef(_) => "cell reference",
            AstNodeContents::String(_) => "string literal",
            AstNodeContents::Number(_) => "numeric literal",
        }
    }
}
impl Spanned<AstNodeContents> {
    pub fn to_cell_ref(&self) -> FormulaResult<CellRef> {
        match &self.inner {
            AstNodeContents::CellRef(cellref) => Ok(*cellref),
            AstNodeContents::Paren(contents) => contents.to_cell_ref(),
            _ => Err(FormulaErrorMsg::Expected {
                expected: "cell reference".into(),
                got: Some(self.inner.type_string().into()),
            }
            .with_span(self.span)),
        }
    }
}

impl Formula {
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
            // Cell range
            AstNodeContents::FunctionCall { func, args } if func.inner == ":" => {
                if args.len() != 2 {
                    internal_error!("invalid arguments to cell range operator");
                }
                let corner1 = args[0].to_cell_ref()?.resolve_from(pos);
                let corner2 = args[1].to_cell_ref()?.resolve_from(pos);

                let x1 = std::cmp::min(corner1.x, corner2.x);
                let y1 = std::cmp::min(corner1.y, corner2.y);

                let x2 = std::cmp::max(corner1.x, corner2.x);
                let y2 = std::cmp::max(corner1.y, corner2.y);

                let mut array = vec![];
                for y in y1..=y2 {
                    let mut row = smallvec![];
                    for x in x1..=x2 {
                        let cell_ref = CellRef::absolute(Pos { x, y });
                        row.push(self.get_cell(grid, pos, cell_ref).await?);
                    }
                    array.push(row);
                }

                Value::Array(array)
            }

            // Other operator/function
            AstNodeContents::FunctionCall { func, args } => {
                let mut arg_values = vec![];
                for arg in args {
                    arg_values.push(arg.eval(grid, pos).await?);
                }
                let spanned_arg_values = Spanned {
                    span: self.span,
                    inner: arg_values,
                };

                match func.inner.to_ascii_lowercase().as_str() {
                    "cell" | "c" => self.array_mapped_get_cell(grid, pos, spanned_arg_values)?,
                    _ => match functions::pure_function_from_name(&func.inner) {
                        Some(f) => f(spanned_arg_values)?,
                        None => return Err(FormulaErrorMsg::BadFunctionName.with_span(func.span)),
                    },
                }
            }

            AstNodeContents::Paren(expr) => expr.eval(grid, pos).await?.inner,

            AstNodeContents::CellRef(cell_ref) => self.get_cell(grid, pos, *cell_ref).await?,

            AstNodeContents::String(s) => Value::String(s.clone()),

            AstNodeContents::Number(n) => Value::Number(*n),
        };

        Ok(Spanned {
            span: self.span,
            inner: value,
        })
    }

    /// Fetches the contents of the cell at `ref_pos` evaluated at `base_pos`,
    /// or returns an error in the case of a circular reference.
    async fn get_cell(
        &self,
        grid: &mut impl GridProxy,
        base_pos: Pos,
        ref_pos: CellRef,
    ) -> FormulaResult<Value> {
        let ref_pos = ref_pos.resolve_from(base_pos);
        if ref_pos == base_pos {
            return Err(FormulaErrorMsg::CircularReference.with_span(self.span));
        }
        Ok(Value::String(grid.get(ref_pos).await.unwrap_or_default()))
    }

    /// Fetches the contents of the cell at `(x, y)`, but fetches an array of cells
    /// if either `x` or `y` is an array.
    fn array_mapped_get_cell(
        &self,
        grid: &mut impl GridProxy,
        base_pos: Pos,
        args: Spanned<Vec<Spanned<Value>>>,
    ) -> FormulaResult<Value> {
        functions::array_map(args, move |[x, y]| {
            let pos = Pos {
                x: x.to_integer()?,
                y: y.to_integer()?,
            };
            // Can't have this be async because it needs to mutate `grid` and
            // Rust isn't happy about moving a mutable reference to `grid` into
            // the closure.
            pollster::block_on(self.get_cell(grid, base_pos, CellRef::absolute(pos)))
        })
    }
}
