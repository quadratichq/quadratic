use std::fmt;

use itertools::Itertools;
use serde::{Deserialize, Serialize};
use smallvec::smallvec;

use super::*;
use crate::{
    Array, ArraySize, CellValue, CodeResult, CoerceInto, Pos, RunErrorMsg, Spanned, Value,
};

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
    Empty,
    FunctionCall {
        func: Spanned<String>,
        args: Vec<AstNode>,
    },
    Paren(Box<AstNode>),
    Array(Vec<Vec<AstNode>>),
    CellRef(CellRef),
    String(String),
    Number(f64),
    Bool(bool),
}
impl fmt::Display for AstNodeContents {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AstNodeContents::Empty => write!(f, ""),
            AstNodeContents::FunctionCall { func, args } => {
                write!(f, "{func}(")?;
                if let Some(first) = args.first() {
                    write!(f, "{first}")?;
                    for arg in args.iter().skip(1) {
                        write!(f, ", {arg}")?;
                    }
                }
                write!(f, ")")?;
                Ok(())
            }
            AstNodeContents::Paren(contents) => write!(f, "({contents})"),
            AstNodeContents::Array(a) => write!(
                f,
                "{{{}}}",
                a.iter().map(|row| row.iter().join(", ")).join("; "),
            ),
            AstNodeContents::CellRef(cellref) => write!(f, "{cellref}"),
            AstNodeContents::String(s) => write!(f, "{s:?}"),
            AstNodeContents::Number(n) => write!(f, "{n:?}"),
            AstNodeContents::Bool(false) => write!(f, "FALSE"),
            AstNodeContents::Bool(true) => write!(f, "TRUE"),
        }
    }
}
impl AstNodeContents {
    fn type_string(&self) -> &'static str {
        match self {
            AstNodeContents::Empty => "empty expression",
            AstNodeContents::FunctionCall { func, .. } => match func.inner.as_str() {
                "=" | "==" | "<>" | "!=" | "<" | ">" | "<=" | ">=" => "comparison",
                s if s.chars().all(|c| c.is_alphanumeric() || c == '_') => "function call",
                _ => "expression",
            },
            AstNodeContents::Paren(contents) => contents.inner.type_string(),
            AstNodeContents::Array(_) => "array literal",
            AstNodeContents::CellRef(_) => "cell reference",
            AstNodeContents::String(_) => "string literal",
            AstNodeContents::Number(_) => "numeric literal",
            AstNodeContents::Bool(_) => "boolean literal",
        }
    }
}
impl Spanned<AstNodeContents> {
    pub fn to_cell_ref(&self) -> CodeResult<CellRef> {
        match &self.inner {
            AstNodeContents::CellRef(cellref) => Ok(cellref.clone()),
            AstNodeContents::Paren(contents) => contents.to_cell_ref(),
            _ => Err(RunErrorMsg::Expected {
                expected: "cell reference".into(),
                got: Some(self.inner.type_string().into()),
            }
            .with_span(self.span)),
        }
    }
}

impl Formula {
    /// Evaluates a formula.
    pub fn eval(&self, ctx: &mut Ctx<'_>) -> CodeResult<Value> {
        self.ast.eval(ctx)?.into_non_error_value()
    }
}

impl AstNode {
    fn eval<'ctx: 'a, 'a>(&'a self, ctx: &'a mut Ctx<'ctx>) -> CodeResult {
        let value = match &self.inner {
            AstNodeContents::Empty => CellValue::Blank.into(),

            // Cell range
            AstNodeContents::FunctionCall { func, args } if func.inner == ":" => {
                if args.len() != 2 {
                    internal_error!("invalid arguments to cell range operator");
                }
                let ref1 = args[0].to_cell_ref()?;
                let ref2 = args[1].to_cell_ref()?;
                let sheet_name = ref1.sheet.clone();
                let corner1 = ref1.resolve_from(ctx.sheet_pos.into());
                let corner2 = ref2.resolve_from(ctx.sheet_pos.into());

                let x1 = std::cmp::min(corner1.x, corner2.x);
                let y1 = std::cmp::min(corner1.y, corner2.y);

                let x2 = std::cmp::max(corner1.x, corner2.x);
                let y2 = std::cmp::max(corner1.y, corner2.y);

                let width = x2
                    .saturating_sub(x1)
                    .saturating_add(1)
                    .try_into()
                    .unwrap_or(u32::MAX);
                let height = y2
                    .saturating_sub(y1)
                    .saturating_add(1)
                    .try_into()
                    .unwrap_or(u32::MAX);
                if std::cmp::max(width, height) > crate::limits::CELL_RANGE_LIMIT {
                    return Err(RunErrorMsg::ArrayTooBig.with_span(self.span));
                }

                // todo: this should call a new ctx.get_cells to push a full SheetRect to cells_accessed instead of an array of SheetPos
                let mut flat_array = smallvec![];
                // Reuse the same `CellRef` object so that we don't have to
                // clone `sheet_name.`
                let mut cell_ref = CellRef::absolute(sheet_name, Pos::ORIGIN); // We'll overwrite the position.
                for y in y1..=y2 {
                    cell_ref.y = CellRefCoord::Absolute(y);
                    for x in x1..=x2 {
                        cell_ref.x = CellRefCoord::Absolute(x);
                        flat_array.push(ctx.get_cell(&cell_ref, self.span)?.inner);
                    }
                }

                let size = ArraySize::new_or_err(width, height)?;
                Array::new_row_major(size, flat_array)?.into()
            }

            // Other operator/function
            AstNodeContents::FunctionCall { func, args } => {
                let mut arg_values = vec![];
                for arg in args {
                    arg_values.push(arg.eval(&mut *ctx)?);
                }

                let func_name = &func.inner;
                match functions::lookup_function(func_name) {
                    Some(f) => {
                        let args = FormulaFnArgs::new(arg_values, self.span, f.name);
                        (f.eval)(&mut *ctx, args)?
                    }
                    None => return Err(RunErrorMsg::BadFunctionName.with_span(func.span)),
                }
            }

            AstNodeContents::Paren(expr) => expr.eval(ctx)?.inner,

            AstNodeContents::Array(a) => {
                let is_empty = a.iter().flatten().next().is_none();
                if is_empty {
                    return Err(RunErrorMsg::EmptyArray.with_span(self.span));
                }
                let width = a[0].len();
                let height = a.len();

                let mut flat_array = smallvec![];
                for row in a {
                    if row.len() != width {
                        return Err(RunErrorMsg::NonRectangularArray.with_span(self.span));
                    }
                    for elem_expr in row {
                        flat_array.push(elem_expr.eval(ctx)?.into_cell_value()?.inner);
                    }
                }

                let size = ArraySize::new_or_err(width as u32, height as u32)?;
                Array::new_row_major(size, flat_array)?.into()
            }

            // Single cell references return 1x1 arrays for Excel compatibility.
            AstNodeContents::CellRef(cell_ref) => {
                Array::from(ctx.get_cell(cell_ref, self.span)?.inner).into()
            }

            AstNodeContents::String(s) => Value::from(s.to_string()),
            AstNodeContents::Number(n) => Value::from(*n),
            AstNodeContents::Bool(b) => Value::from(*b),
        };

        Ok(Spanned {
            span: self.span,
            inner: value,
        })
    }
}
