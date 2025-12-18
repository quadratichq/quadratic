//! Array generation, filter, sort, and functional operations.

use super::*;

pub fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Transposes an array (swaps rows and columns).
            #[examples("TRANSPOSE(A1:C2)")]
            fn TRANSPOSE(array: Array) {
                array.transpose()
            }
        ),
        formula_fn!(
            /// Generates a sequence of numbers.
            #[examples("SEQUENCE(5)")]
            fn SEQUENCE(
                span: Span,
                rows: (Spanned<i64>),
                columns: (Option<Spanned<i64>>),
                start: (Option<i64>),
                step: (Option<i64>),
            ) {
                let r = rows.inner;
                let c = columns.map(|c| c.inner).unwrap_or(1);
                let start_val = start.unwrap_or(1);
                let step_val = step.unwrap_or(1);

                if r <= 0 || c <= 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let size = ArraySize::new(c as u32, r as u32)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                let values: SmallVec<[CellValue; 1]> = (0..(r * c))
                    .map(|i| CellValue::Number((start_val + step_val * i).into()))
                    .collect();

                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Filters an array of values by a list of booleans.
            #[examples("FILTER(A1:C5, D1:D5)")]
            fn FILTER(
                span: Span,
                array: (Spanned<Array>),
                include: (Spanned<Array>),
                if_empty: (Option<Value>),
            ) {
                let empty_result = if_empty.ok_or_else(|| RunErrorMsg::EmptyArray.with_span(span));
                let include_span = include.span;
                let axis = include.array_linear_axis()?;
                let include: Vec<bool> = include
                    .try_as_linear_array()?
                    .iter()
                    .map(|v| bool::try_from(v.clone()).map_err(|e| e.with_span(include_span)))
                    .try_collect()?;

                match axis {
                    None => {
                        if *include.first().unwrap_or(&false) {
                            Value::from(array.inner)
                        } else {
                            empty_result?
                        }
                    }
                    Some(axis) => {
                        array.check_array_size_on(axis, include.len() as u32)?;
                        let new_slices = array
                            .inner
                            .slices(axis)
                            .zip(include)
                            .filter(|(_, include)| *include)
                            .map(|(slice, _)| slice);
                        match Array::from_slices(span, axis, new_slices) {
                            Ok(a) => Value::from(a),
                            Err(_) => empty_result?,
                        }
                    }
                }
            }
        ),
        formula_fn!(
            /// Sorts an array of values.
            #[examples("SORT(A1:A100)")]
            fn SORT(
                span: Span,
                array: Array,
                sort_index: (Option<Spanned<i64>>),
                sort_order: (Option<Spanned<i64>>),
                by_column: (Option<bool>),
            ) {
                let axis = by_column_to_axis(by_column);
                let index = match sort_index {
                    None => 0,
                    Some(value) => {
                        let max_index = array.size()[axis.other_axis()].get() as i64;
                        if (1..=max_index).contains(&value.inner) {
                            value.inner as usize - 1
                        } else {
                            return Err(RunErrorMsg::InvalidArgument.with_span(value.span));
                        }
                    }
                };

                #[allow(clippy::redundant_closure)]
                let compare_fn = match sort_order {
                    None => |a, b| CellValue::total_cmp(a, b),
                    Some(value) => match value.inner {
                        1 => |a, b| CellValue::total_cmp(a, b),
                        -1 => |a, b| CellValue::total_cmp(b, a),
                        _ => return Err(RunErrorMsg::InvalidArgument.with_span(value.span)),
                    },
                };

                Array::from_slices(
                    span,
                    axis,
                    array.slices(axis).sorted_by(|slice1, slice2| {
                        compare_fn(
                            slice1.get(index).expect("already checked bounds"),
                            slice2.get(index).expect("already checked bounds"),
                        )
                    }),
                )?
            }
        ),
        formula_fn!(
            /// Removes duplicate rows or columns from an array.
            #[examples("UNIQUE(A1:A100)")]
            fn UNIQUE(
                span: Span,
                array: Array,
                by_column: (Option<bool>),
                exactly_once: (Option<bool>),
            ) {
                let axis = by_column_to_axis(by_column);
                let mut slice_counts: Vec<(Vec<&CellValue>, usize)> = vec![];
                let mut indices = HashMap::<Vec<CellValueHash>, SmallVec<[usize; 1]>>::new();

                for slice in array.slices(axis) {
                    let possible_indices = indices
                        .entry(slice.iter().map(|v| v.hash()).collect_vec())
                        .or_default();
                    if let Some(&i) = possible_indices.iter().find(|&&i| {
                        let past_slice = &slice_counts[i].0;
                        std::iter::zip(past_slice, &slice)
                            .all(|(l, r)| l.total_cmp(r) == std::cmp::Ordering::Equal)
                    }) {
                        slice_counts[i].1 += 1;
                    } else {
                        let index = slice_counts.len();
                        possible_indices.push(index);
                        slice_counts.push((slice, 1));
                    }
                }
                let new_slices = slice_counts
                    .into_iter()
                    .filter(|(_, count)| match exactly_once {
                        Some(true) => *count == 1,
                        None | Some(false) => true,
                    })
                    .map(|(slice, _)| slice);
                Array::from_slices(span, axis, new_slices)?
            }
        ),
        formula_fn!(
            /// Sorts an array based on the values in one or more corresponding ranges.
            ///
            /// - `array`: The array to sort.
            /// - `by_array1`: The first range of values to sort by.
            /// - `sort_order1`: Optional. 1 for ascending (default), -1 for descending.
            /// - Additional by_array/sort_order pairs can be provided for tie-breaking.
            #[examples("SORTBY(A1:A10, B1:B10)", "SORTBY(A1:C10, B1:B10, 1, C1:C10, -1)")]
            fn SORTBY(span: Span, args: FormulaFnArgs) {
                let mut args = args;

                // Get the main array to sort
                let array_value = args.take_next_required("array")?;
                let array: Array = array_value.try_coerce()?.inner;

                // Collect sort criteria pairs
                let mut sort_criteria: Vec<(Vec<CellValue>, i64)> = Vec::new();

                while args.has_next() {
                    let by_array_value = args.take_next_required("by_array")?;
                    let by_array: Spanned<Array> = by_array_value.try_coerce()?;

                    // Validate that by_array has same number of rows as array
                    if by_array.inner.height() != array.height() {
                        return Err(RunErrorMsg::ArrayAxisMismatch {
                            axis: Axis::Y,
                            expected: array.height(),
                            got: by_array.inner.height(),
                        }
                        .with_span(by_array.span));
                    }

                    let by_values: Vec<CellValue> = by_array
                        .inner
                        .cell_values_slice()
                        .iter()
                        .take(array.height() as usize)
                        .cloned()
                        .collect();

                    // Get optional sort order (default ascending = 1)
                    let sort_order = if args.has_next() {
                        let order_value = args.take_next_optional();
                        match order_value {
                            Some(v) => {
                                let order_span = v.span;
                                let order: i64 = v.try_coerce()?.inner;
                                if order != 1 && order != -1 {
                                    return Err(RunErrorMsg::InvalidArgument.with_span(order_span));
                                }
                                order
                            }
                            None => 1,
                        }
                    } else {
                        1
                    };

                    sort_criteria.push((by_values, sort_order));
                }

                if sort_criteria.is_empty() {
                    return Err(RunErrorMsg::MissingRequiredArgument {
                        func_name: "SORTBY".into(),
                        arg_name: "by_array".into(),
                    }
                    .with_span(span));
                }

                // Create indices and sort them
                let mut indices: Vec<usize> = (0..array.height() as usize).collect();
                indices.sort_by(|&a, &b| {
                    for (by_values, order) in &sort_criteria {
                        let val_a = by_values.get(a).unwrap_or(&CellValue::Blank);
                        let val_b = by_values.get(b).unwrap_or(&CellValue::Blank);
                        let cmp = if *order == 1 {
                            CellValue::total_cmp(val_a, val_b)
                        } else {
                            CellValue::total_cmp(val_b, val_a)
                        };
                        if cmp != std::cmp::Ordering::Equal {
                            return cmp;
                        }
                    }
                    std::cmp::Ordering::Equal
                });

                // Build result array with sorted rows
                let width = array.width();
                let height = array.height();
                let mut result_values: SmallVec<[CellValue; 1]> = SmallVec::new();

                for &idx in &indices {
                    for x in 0..width {
                        result_values.push(array.get(x, idx as u32)?.clone());
                    }
                }

                let size = ArraySize::new(width, height)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                Array::new_row_major(size, result_values)?
            }
        ),
        formula_fn!(
            /// Multiplies arrays componentwise, then returns the sum.
            #[examples("SUMPRODUCT(C2:C5, D2:D5)")]
            fn SUMPRODUCT(arrays: (Iter<Spanned<Array>>)) {
                let Some(first) = arrays.next() else {
                    return Ok(0.into());
                };
                let mut results = first?;
                for array in arrays {
                    let new_array = array?;
                    new_array.check_array_size_exact(results.inner.size())?;
                    let new_span = new_array.span;
                    for (product, new_value) in std::iter::zip(
                        results.inner.cell_values_slice_mut(),
                        new_array.inner.cell_values_slice(),
                    ) {
                        *product = CellValue::mul(
                            results.span,
                            Spanned {
                                span: results.span,
                                inner: product,
                            },
                            Spanned {
                                span: new_span,
                                inner: new_value,
                            },
                        )?
                        .inner;
                    }
                    results.span = Span::merge(results.span, new_span);
                }

                let span = results.span;
                match results
                    .inner
                    .into_cell_values_vec()
                    .into_iter()
                    .map(|inner| Ok(Spanned { span, inner }))
                    .reduce(|a, b| CellValue::add(results.span, a?.as_ref(), b?.as_ref()))
                {
                    Some(result) => result?.inner,
                    None => 0.into(),
                }
            }
        ),
        formula_fn!(
            /// Returns the matrix determinant.
            #[examples("MDETERM({1, 2; 3, 4})")]
            fn MDETERM(span: Span, array: (Spanned<Array>)) {
                let size = array.inner.size();
                if size.w != size.h {
                    return Err(RunErrorMsg::NonRectangularArray.with_span(array.span));
                }
                let n = size.w.get() as usize;
                let mut matrix: Vec<f64> = Vec::with_capacity(n * n);
                for cv in array.inner.cell_values_slice().iter() {
                    let val: f64 = cv.coerce_nonblank().ok_or_else(|| {
                        RunErrorMsg::Expected {
                            expected: "number".into(),
                            got: Some(cv.type_name().into()),
                        }
                        .with_span(span)
                    })?;
                    matrix.push(val);
                }
                matrix_determinant(&matrix, n)
            }
        ),
        formula_fn!(
            /// Returns the inverse matrix.
            #[examples("MINVERSE({1, 2; 3, 4})")]
            fn MINVERSE(span: Span, array: (Spanned<Array>)) {
                let size = array.inner.size();
                if size.w != size.h {
                    return Err(RunErrorMsg::NonRectangularArray.with_span(array.span));
                }
                let n = size.w.get() as usize;
                let mut matrix: Vec<f64> = Vec::with_capacity(n * n);
                for cv in array.inner.cell_values_slice().iter() {
                    let val: f64 = cv.coerce_nonblank().ok_or_else(|| {
                        RunErrorMsg::Expected {
                            expected: "number".into(),
                            got: Some(cv.type_name().into()),
                        }
                        .with_span(span)
                    })?;
                    matrix.push(val);
                }
                let inverse = matrix_inverse(&matrix, n)
                    .ok_or_else(|| RunErrorMsg::DivideByZero.with_span(span))?;
                let values: SmallVec<[CellValue; 1]> = inverse
                    .into_iter()
                    .map(|v| {
                        CellValue::Number(
                            rust_decimal::Decimal::from_f64_retain(v).unwrap_or_default(),
                        )
                    })
                    .collect();
                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Returns the matrix product of two arrays.
            #[examples("MMULT({1, 2; 3, 4}, {5, 6; 7, 8})")]
            fn MMULT(span: Span, array1: (Spanned<Array>), array2: (Spanned<Array>)) {
                let size1 = array1.inner.size();
                let size2 = array2.inner.size();
                if size1.w != size2.h {
                    return Err(RunErrorMsg::ArrayAxisMismatch {
                        axis: Axis::X,
                        expected: size1.w.get(),
                        got: size2.h.get(),
                    }
                    .with_span(array2.span));
                }

                let rows = size1.h.get() as usize;
                let cols = size2.w.get() as usize;
                let inner = size1.w.get() as usize;

                let mut m1: Vec<f64> = Vec::with_capacity(rows * inner);
                for cv in array1.inner.cell_values_slice().iter() {
                    let val: f64 = cv.coerce_nonblank().ok_or_else(|| {
                        RunErrorMsg::Expected {
                            expected: "number".into(),
                            got: Some(cv.type_name().into()),
                        }
                        .with_span(span)
                    })?;
                    m1.push(val);
                }

                let mut m2: Vec<f64> = Vec::with_capacity(inner * cols);
                for cv in array2.inner.cell_values_slice().iter() {
                    let val: f64 = cv.coerce_nonblank().ok_or_else(|| {
                        RunErrorMsg::Expected {
                            expected: "number".into(),
                            got: Some(cv.type_name().into()),
                        }
                        .with_span(span)
                    })?;
                    m2.push(val);
                }

                let mut result: Vec<CellValue> = Vec::with_capacity(rows * cols);
                for i in 0..rows {
                    for j in 0..cols {
                        let mut sum = 0.0;
                        for k in 0..inner {
                            sum += m1[i * inner + k] * m2[k * cols + j];
                        }
                        result.push(CellValue::Number(
                            rust_decimal::Decimal::from_f64_retain(sum).unwrap_or_default(),
                        ));
                    }
                }

                let result_size = ArraySize::new(cols as u32, rows as u32)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                Array::new_row_major(result_size, result.into())?
            }
        ),
        formula_fn!(
            /// Returns an array of random numbers.
            #[examples("RANDARRAY(3, 2)")]
            fn RANDARRAY(
                span: Span,
                rows: (Option<Spanned<i64>>),
                columns: (Option<Spanned<i64>>),
                min: (Option<f64>),
                max: (Option<f64>),
                whole_number: (Option<bool>),
            ) {
                use rand::Rng;
                let r = rows.map(|r| r.inner).unwrap_or(1);
                let c = columns.map(|c| c.inner).unwrap_or(1);
                let min_val = min.unwrap_or(0.0);
                let max_val = max.unwrap_or(1.0);
                let whole = whole_number.unwrap_or(false);

                if r <= 0 || c <= 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if min_val > max_val {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let size = ArraySize::new(c as u32, r as u32)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                let mut rng = rand::rng();
                let values: SmallVec<[CellValue; 1]> = (0..(r * c))
                    .map(|_| {
                        let val = if whole {
                            let min_i = min_val.ceil() as i64;
                            let max_i = max_val.floor() as i64;
                            if min_i > max_i {
                                min_val
                            } else {
                                rng.random_range(min_i..=max_i) as f64
                            }
                        } else {
                            rng.random_range(min_val..=max_val)
                        };
                        CellValue::Number(
                            rust_decimal::Decimal::from_f64_retain(val).unwrap_or_default(),
                        )
                    })
                    .collect();
                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Applies a lambda function to each row of an array.
            #[examples("BYROW({1, 2; 3, 4}, LAMBDA(row, SUM(row)))")]
            fn BYROW(ctx: Ctx, span: Span, args: FormulaFnArgs) {
                eval_by_slice(ctx, span, args, Axis::Y, "BYROW")?
            }
        ),
        formula_fn!(
            /// Applies a lambda function to each column of an array.
            #[examples("BYCOL({1, 2; 3, 4}, LAMBDA(col, SUM(col)))")]
            fn BYCOL(ctx: Ctx, span: Span, args: FormulaFnArgs) {
                eval_by_slice(ctx, span, args, Axis::X, "BYCOL")?
            }
        ),
        formula_fn!(
            /// Creates an array by applying a lambda function to indices.
            #[examples("MAKEARRAY(3, 3, LAMBDA(r, c, r * c))")]
            fn MAKEARRAY(ctx: Ctx, span: Span, args: FormulaFnArgs) {
                let mut args = args;
                let rows_value = args.take_next_required("rows")?;
                let rows: i64 = rows_value.try_coerce()?.inner;
                let columns_value = args.take_next_required("columns")?;
                let columns: i64 = columns_value.try_coerce()?.inner;
                let lambda_value = args.take_next_required("lambda")?;
                let lambda = extract_lambda(&lambda_value, "MAKEARRAY")?;
                args.error_if_more_args()?;

                if ctx.skip_computation {
                    return Ok(Value::Single(CellValue::Blank));
                }
                if rows <= 0 || columns <= 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if lambda.param_count() != 2 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let size = ArraySize::new(columns as u32, rows as u32)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                let mut values: SmallVec<[CellValue; 1]> =
                    SmallVec::with_capacity((rows * columns) as usize);

                for r in 1..=rows {
                    for c in 1..=columns {
                        let bindings = vec![
                            (lambda.params[0].clone(), Value::from(r as f64)),
                            (lambda.params[1].clone(), Value::from(c as f64)),
                        ];
                        let mut child_ctx = ctx.with_bindings(&bindings);
                        let result = lambda.body.eval(&mut child_ctx);
                        let cell_value = match result.inner {
                            Value::Single(cv) => cv,
                            Value::Array(a) => a
                                .cell_values_slice()
                                .first()
                                .cloned()
                                .unwrap_or(CellValue::Blank),
                            _ => CellValue::Blank,
                        };
                        values.push(cell_value);
                    }
                }
                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Applies a lambda function to each element of arrays.
            #[examples("MAP({1, 2; 3, 4}, LAMBDA(x, x * 2))")]
            fn MAP(ctx: Ctx, span: Span, args: FormulaFnArgs) {
                let mut args = args;
                let mut arrays: Vec<Array> = vec![];
                let mut lambda: Option<LambdaValue> = None;

                // Collect all array arguments (all but last which should be lambda)
                while args.has_next() {
                    let value = args.take_next_required("value")?;
                    if let Value::Lambda(_) = &value.inner {
                        lambda = Some(extract_lambda(&value, "MAP")?);
                        args.error_if_more_args()?;
                        break;
                    }
                    let arr: Array = value.try_coerce()?.inner;
                    arrays.push(arr);
                }

                let lambda = lambda.ok_or_else(|| {
                    RunErrorMsg::MissingRequiredArgument {
                        func_name: "MAP".into(),
                        arg_name: "lambda".into(),
                    }
                    .with_span(span)
                })?;

                if ctx.skip_computation {
                    return Ok(Value::Single(CellValue::Blank));
                }
                if arrays.is_empty() {
                    return Err(RunErrorMsg::MissingRequiredArgument {
                        func_name: "MAP".into(),
                        arg_name: "array".into(),
                    }
                    .with_span(span));
                }
                if lambda.param_count() != arrays.len() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let size = arrays[0].size();
                for arr in &arrays[1..] {
                    if arr.size() != size {
                        return Err(RunErrorMsg::ArrayAxisMismatch {
                            axis: Axis::X,
                            expected: size.w.get(),
                            got: arr.size().w.get(),
                        }
                        .with_span(span));
                    }
                }

                let mut values: SmallVec<[CellValue; 1]> = SmallVec::with_capacity(size.len());
                for i in 0..size.len() {
                    let bindings: Vec<_> = lambda
                        .params
                        .iter()
                        .enumerate()
                        .map(|(j, param)| {
                            let y = (i / size.w.get() as usize) as u32;
                            let x = (i % size.w.get() as usize) as u32;
                            (
                                param.clone(),
                                Value::Single(arrays[j].get(x, y).unwrap().clone()),
                            )
                        })
                        .collect();
                    let mut child_ctx = ctx.with_bindings(&bindings);
                    let result = lambda.body.eval(&mut child_ctx);
                    let cell_value = match result.inner {
                        Value::Single(cv) => cv,
                        Value::Array(a) => a
                            .cell_values_slice()
                            .first()
                            .cloned()
                            .unwrap_or(CellValue::Blank),
                        _ => CellValue::Blank,
                    };
                    values.push(cell_value);
                }
                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Reduces an array to a single value using a lambda function.
            #[examples("REDUCE(0, {1, 2, 3}, LAMBDA(acc, val, acc + val))")]
            fn REDUCE(ctx: Ctx, span: Span, args: FormulaFnArgs) {
                let mut args = args;
                let initial_value = args.take_next_required("initial_value")?;
                let array_value = args.take_next_required("array")?;
                let array: Array = array_value.try_coerce()?.inner;
                let lambda_value = args.take_next_required("lambda")?;
                let lambda = extract_lambda(&lambda_value, "REDUCE")?;
                args.error_if_more_args()?;

                if ctx.skip_computation {
                    return Ok(Value::Single(CellValue::Blank));
                }
                if lambda.param_count() != 2 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let mut accumulator = initial_value.inner;
                for cell_value in array.cell_values_slice().iter() {
                    let bindings = vec![
                        (lambda.params[0].clone(), accumulator),
                        (lambda.params[1].clone(), Value::Single(cell_value.clone())),
                    ];
                    let mut child_ctx = ctx.with_bindings(&bindings);
                    let result = lambda.body.eval(&mut child_ctx);
                    accumulator = result.inner;
                }
                accumulator
            }
        ),
        formula_fn!(
            /// Returns the unit matrix (identity matrix) of the specified dimension.
            /// Returns a square matrix with 1s on the diagonal and 0s elsewhere.
            #[examples("MUNIT(3)")]
            fn MUNIT(span: Span, dimension: (Spanned<i64>)) {
                let n = dimension.inner;
                if n <= 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(dimension.span));
                }
                let n = n as u32;

                let size =
                    ArraySize::new(n, n).ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;

                let mut values: SmallVec<[CellValue; 1]> =
                    SmallVec::with_capacity((n * n) as usize);
                for row in 0..n {
                    for col in 0..n {
                        if row == col {
                            values.push(CellValue::Number(1.into()));
                        } else {
                            values.push(CellValue::Number(0.into()));
                        }
                    }
                }

                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Scans an array by applying a lambda function to each element,
            /// returning an array of intermediate values.
            #[examples("SCAN(0, {1, 2, 3}, LAMBDA(acc, val, acc + val))")]
            fn SCAN(ctx: Ctx, span: Span, args: FormulaFnArgs) {
                let mut args = args;
                let initial_value = args.take_next_required("initial_value")?;
                let array_value = args.take_next_required("array")?;
                let array: Spanned<Array> = array_value.try_coerce()?;
                let lambda_value = args.take_next_required("lambda")?;
                let lambda = extract_lambda(&lambda_value, "SCAN")?;
                args.error_if_more_args()?;

                if ctx.skip_computation {
                    return Ok(Value::Single(CellValue::Blank));
                }
                if lambda.param_count() != 2 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let width = array.inner.width();
                let height = array.inner.height();
                let size = ArraySize::new(width, height)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;

                let mut results: SmallVec<[CellValue; 1]> = SmallVec::with_capacity(size.len());
                let mut accumulator = initial_value.inner;

                for cell_value in array.inner.cell_values_slice().iter() {
                    let bindings = vec![
                        (lambda.params[0].clone(), accumulator),
                        (lambda.params[1].clone(), Value::Single(cell_value.clone())),
                    ];
                    let mut child_ctx = ctx.with_bindings(&bindings);
                    let result = lambda.body.eval(&mut child_ctx);
                    accumulator = result.inner.clone();

                    // Extract the single cell value from the result
                    match result.inner {
                        Value::Single(cv) => results.push(cv),
                        Value::Array(arr) => {
                            results.push(arr.get(0, 0).cloned().unwrap_or(CellValue::Blank));
                        }
                        Value::Tuple(arrays) => {
                            if let Some(first) = arrays.first() {
                                results.push(first.get(0, 0).cloned().unwrap_or(CellValue::Blank));
                            } else {
                                results.push(CellValue::Blank);
                            }
                        }
                        Value::Lambda(_) => {
                            results.push(CellValue::Blank);
                        }
                    }
                }

                Array::new_row_major(size, results)?
            }
        ),
    ]
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, formulas::tests::*};

    #[test]
    fn test_formula_transpose() {
        let g = GridController::new();
        assert_eq!(
            "{1, 3; 2, 4}",
            eval_to_string(&g, "TRANSPOSE({1, 2; 3, 4})")
        );
    }

    #[test]
    fn test_formula_sequence() {
        let g = GridController::new();
        assert_eq!("{1; 2; 3}", eval_to_string(&g, "SEQUENCE(3)"));
    }

    #[test]
    fn test_formula_filter() {
        let g = GridController::new();
        assert_eq!(
            "{2; 4}",
            eval_to_string(&g, "FILTER({1; 2; 3; 4}, {FALSE; TRUE; FALSE; TRUE})")
        );
    }

    #[test]
    fn test_formula_sort() {
        let g = GridController::new();
        assert_eq!("{1; 2; 3}", eval_to_string(&g, "SORT({3; 1; 2})"));
    }

    #[test]
    fn test_formula_unique() {
        let g = GridController::new();
        assert_eq!("{1; 2; 3}", eval_to_string(&g, "UNIQUE({1; 2; 1; 3; 2})"));
    }

    #[test]
    fn test_formula_sortby() {
        let g = GridController::new();

        // Basic SORTBY - sort array by another array
        // Sort by {2; 3; 1} ascending means: value 1 first, then 2, then 3
        // So row 3 ("c") with value 1 first, row 1 ("a") with value 2 second, row 2 ("b") with value 3 third
        assert_eq!(
            "{c; a; b}",
            eval_to_string(&g, "SORTBY({\"a\"; \"b\"; \"c\"}, {2; 3; 1})")
        );

        // SORTBY descending - value 3 first, then 2, then 1
        // Row 2 ("b") with value 3 first, row 1 ("a") with value 2 second, row 3 ("c") with value 1 third
        assert_eq!(
            "{b; a; c}",
            eval_to_string(&g, "SORTBY({\"a\"; \"b\"; \"c\"}, {2; 3; 1}, -1)")
        );

        // SORTBY with multiple columns - sort by {3; 1; 2}
        // Row 2 (2, b) has value 1, comes first
        // Row 3 (3, c) has value 2, comes second
        // Row 1 (1, a) has value 3, comes third
        assert_eq!(
            "{2, b; 3, c; 1, a}",
            eval_to_string(&g, "SORTBY({1, \"a\"; 2, \"b\"; 3, \"c\"}, {3; 1; 2})")
        );
    }
}
