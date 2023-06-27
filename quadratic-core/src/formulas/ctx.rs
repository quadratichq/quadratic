use futures::future::LocalBoxFuture;

use super::*;

macro_rules! zip_map_impl {
    ($arrays:ident.zip_map(|$args_buffer:ident| $eval_f:expr)) => {{
        let ArraySize { w, h } = Value::common_array_size($arrays)?;

        let mut $args_buffer = Vec::with_capacity($arrays.into_iter().len());

        // If the result is a single value, return that value instead of a 1x1
        // array. This isn't just an optimization; it's important for Excel
        // compatibility.
        if w == 1 && h == 1 {
            for array in $arrays {
                $args_buffer.push(array.basic_value()?);
            }
            return Ok(Value::Single($eval_f));
        }

        let mut values = smallvec::SmallVec::with_capacity(w as usize * h as usize);
        for (x, y) in Array::indices(w, h) {
            $args_buffer.clear();
            for array in $arrays {
                $args_buffer.push(array.get(x, y)?);
            }

            values.push($eval_f);
        }

        let result = Array::new_row_major(w, h, values)?;
        Ok(Value::Array(result))
    }};
}

/// Formula execution context.
pub struct Ctx<'ctx> {
    pub grid: &'ctx mut dyn GridProxy,
    pub pos: Pos,
}
impl Ctx<'_> {
    /// Fetches the contents of the cell at `ref_pos` evaluated at `base_pos`,
    /// or returns an error in the case of a circular reference.
    pub async fn get_cell(
        &mut self,
        ref_pos: CellRef,
        span: Span,
    ) -> FormulaResult<Spanned<BasicValue>> {
        let ref_pos = ref_pos.resolve_from(self.pos);
        if ref_pos == self.pos {
            return Err(FormulaErrorMsg::CircularReference.with_span(span));
        }
        let value = self.grid.get(ref_pos).await;
        Ok(Spanned { inner: value, span })
    }

    /// Same as `zip_map()`, but the provided closure returns a
    /// `LocalBoxFuture`.
    pub async fn zip_map_async(
        &mut self,
        arrays: &[Spanned<Value>],
        f: impl for<'a> Fn(
            &'a mut Ctx<'_>,
            &'a [Spanned<&'a BasicValue>],
        ) -> LocalBoxFuture<'a, FormulaResult<BasicValue>>,
    ) -> FormulaResult<Value> {
        zip_map_impl!(arrays.zip_map(|args_buffer| f(self, &args_buffer).await?))
    }

    /// Evaluates a function once for each corresponding set of values from
    /// `arrays`.
    ///
    /// Many functions, including basic operators such as `+`, work on arrays by
    /// zipping the arrays and then mapping the function across corresponding
    /// sets of inputs. For example `{1,2,3} + {10,20,30}` results in
    /// `{11,22,33}`. If any argument is not an array, it is expanded into an
    /// array with the same size as other arguments. This also works
    /// 2-dimensionally: if one argument is a 1x3 array and the other argument
    /// is a 3x1 array, then both arguments are first expanded to 3x3 arrays. If
    /// arrays cannot be expanded like this, then an error is returned.
    pub fn zip_map<'a, I: Copy + IntoIterator<Item = &'a Spanned<Value>>>(
        &mut self,
        arrays: I,
        f: impl for<'b> Fn(&'b mut Ctx<'_>, &[Spanned<&BasicValue>]) -> FormulaResult<BasicValue>,
    ) -> FormulaResult<Value>
    where
        I::IntoIter: ExactSizeIterator,
    {
        zip_map_impl!(arrays.zip_map(|args_buffer| f(self, &args_buffer)?))
    }
}
