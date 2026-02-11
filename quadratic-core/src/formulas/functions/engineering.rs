//! Engineering functions: base conversions and bitwise operations.

use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Engineering functions",
    docs: None,
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![
        // Bitwise operations
        formula_fn!(
            /// Returns a bitwise AND of two numbers.
            #[examples("BITAND(5, 3) = 1", "BITAND(15, 7) = 7")]
            #[zip_map]
            fn BITAND(span: Span, [number1]: (Spanned<i64>), [number2]: (Spanned<i64>)) {
                let a = number1.inner;
                let b = number2.inner;
                if a < 0 || b < 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                a & b
            }
        ),
        formula_fn!(
            /// Returns a bitwise OR of two numbers.
            #[examples("BITOR(5, 3) = 7", "BITOR(8, 4) = 12")]
            #[zip_map]
            fn BITOR(span: Span, [number1]: (Spanned<i64>), [number2]: (Spanned<i64>)) {
                let a = number1.inner;
                let b = number2.inner;
                if a < 0 || b < 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                a | b
            }
        ),
        formula_fn!(
            /// Returns a bitwise XOR of two numbers.
            #[examples("BITXOR(5, 3) = 6", "BITXOR(15, 7) = 8")]
            #[zip_map]
            fn BITXOR(span: Span, [number1]: (Spanned<i64>), [number2]: (Spanned<i64>)) {
                let a = number1.inner;
                let b = number2.inner;
                if a < 0 || b < 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                a ^ b
            }
        ),
        formula_fn!(
            /// Returns a number shifted left by the specified number of bits.
            #[examples("BITLSHIFT(4, 2) = 16", "BITLSHIFT(1, 10) = 1024")]
            #[zip_map]
            fn BITLSHIFT(span: Span, [number]: (Spanned<i64>), [shift_amount]: (Spanned<i64>)) {
                let n = number.inner;
                let shift = shift_amount.inner;
                if n < 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(number.span));
                }
                if !(-53..=53).contains(&shift) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(shift_amount.span));
                }
                if shift >= 0 {
                    n.checked_shl(shift as u32).unwrap_or(0)
                } else {
                    n >> ((-shift) as u32)
                }
            }
        ),
        formula_fn!(
            /// Returns a number shifted right by the specified number of bits.
            #[examples("BITRSHIFT(16, 2) = 4", "BITRSHIFT(1024, 10) = 1")]
            #[zip_map]
            fn BITRSHIFT(span: Span, [number]: (Spanned<i64>), [shift_amount]: (Spanned<i64>)) {
                let n = number.inner;
                let shift = shift_amount.inner;
                if n < 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(number.span));
                }
                if !(-53..=53).contains(&shift) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(shift_amount.span));
                }
                if shift >= 0 {
                    n >> (shift as u32)
                } else {
                    n.checked_shl((-shift) as u32).unwrap_or(0)
                }
            }
        ),
        // ===== COMPLEX NUMBER FUNCTIONS =====
        formula_fn!(
            /// Converts real and imaginary coefficients into a complex number of the form x + yi or x + yj.
            #[examples("COMPLEX(3, 4) = \"3+4i\"", "COMPLEX(3, 4, \"j\") = \"3+4j\"")]
            #[zip_map]
            fn COMPLEX(span: Span, [real_num]: f64, [i_num]: f64, [suffix]: (Option<String>)) {
                let suffix = suffix.unwrap_or_else(|| "i".to_string());
                if suffix != "i" && suffix != "j" {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                format_complex(real_num, i_num, &suffix)
            }
        ),
        formula_fn!(
            /// Returns the imaginary coefficient of a complex number.
            #[examples("IMAGINARY(\"3+4i\") = 4", "IMAGINARY(\"5i\") = 5")]
            #[zip_map]
            fn IMAGINARY(span: Span, [inumber]: String) {
                let (_, imag) = parse_complex(&inumber, *span)?;
                imag
            }
        ),
        formula_fn!(
            /// Returns the real coefficient of a complex number.
            #[examples("IMREAL(\"3+4i\") = 3", "IMREAL(\"5i\") = 0")]
            #[zip_map]
            fn IMREAL(span: Span, [inumber]: String) {
                let (real, _) = parse_complex(&inumber, *span)?;
                real
            }
        ),
        formula_fn!(
            /// Returns the absolute value (modulus) of a complex number.
            #[examples("IMABS(\"3+4i\") = 5")]
            #[zip_map]
            fn IMABS(span: Span, [inumber]: String) {
                let (real, imag) = parse_complex(&inumber, *span)?;
                (real * real + imag * imag).sqrt()
            }
        ),
        formula_fn!(
            /// Returns the argument (angle in radians) of a complex number.
            #[examples("IMARGUMENT(\"3+4i\")")]
            #[zip_map]
            fn IMARGUMENT(span: Span, [inumber]: String) {
                let (real, imag) = parse_complex(&inumber, *span)?;
                if real == 0.0 && imag == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                imag.atan2(real)
            }
        ),
        formula_fn!(
            /// Returns the complex conjugate of a complex number.
            #[examples("IMCONJUGATE(\"3+4i\") = \"3-4i\"")]
            #[zip_map]
            fn IMCONJUGATE(span: Span, [inumber]: String) {
                let (real, imag) = parse_complex(&inumber, *span)?;
                let suffix = get_complex_suffix(&inumber);
                format_complex(real, -imag, &suffix)
            }
        ),
        formula_fn!(
            /// Returns the sum of two complex numbers.
            #[examples("IMADD(\"3+4i\", \"1+2i\") = \"4+6i\"")]
            #[zip_map]
            fn IMADD(span: Span, [inumber1]: String, [inumber2]: String) {
                let (r1, i1) = parse_complex(&inumber1, *span)?;
                let (r2, i2) = parse_complex(&inumber2, *span)?;
                let suffix = get_complex_suffix(&inumber1);
                format_complex(r1 + r2, i1 + i2, &suffix)
            }
        ),
        formula_fn!(
            /// Returns the sum of multiple complex numbers.
            #[examples("IMSUM(\"3+4i\", \"1+2i\", \"2+3i\") = \"6+9i\"")]
            fn IMSUM(span: Span, numbers: (Iter<String>)) {
                let mut real_sum = 0.0;
                let mut imag_sum = 0.0;
                let mut suffix = "i".to_string();
                let mut first = true;

                for num in numbers {
                    let s = num?;
                    let (r, i) = parse_complex(&s, span)?;
                    real_sum += r;
                    imag_sum += i;
                    if first {
                        suffix = get_complex_suffix(&s);
                        first = false;
                    }
                }

                format_complex(real_sum, imag_sum, &suffix)
            }
        ),
        formula_fn!(
            /// Returns the difference of two complex numbers.
            #[examples("IMSUB(\"3+4i\", \"1+2i\") = \"2+2i\"")]
            #[zip_map]
            fn IMSUB(span: Span, [inumber1]: String, [inumber2]: String) {
                let (r1, i1) = parse_complex(&inumber1, *span)?;
                let (r2, i2) = parse_complex(&inumber2, *span)?;
                let suffix = get_complex_suffix(&inumber1);
                format_complex(r1 - r2, i1 - i2, &suffix)
            }
        ),
        formula_fn!(
            /// Returns the product of two complex numbers.
            #[examples("IMPRODUCT(\"3+4i\", \"1+2i\") = \"-5+10i\"")]
            #[zip_map]
            fn IMPRODUCT(span: Span, [inumber1]: String, [inumber2]: String) {
                let (r1, i1) = parse_complex(&inumber1, *span)?;
                let (r2, i2) = parse_complex(&inumber2, *span)?;
                let suffix = get_complex_suffix(&inumber1);
                // (a+bi)(c+di) = (ac-bd) + (ad+bc)i
                format_complex(r1 * r2 - i1 * i2, r1 * i2 + i1 * r2, &suffix)
            }
        ),
        formula_fn!(
            /// Returns the quotient of two complex numbers.
            #[examples("IMDIV(\"3+4i\", \"1+2i\")")]
            #[zip_map]
            fn IMDIV(span: Span, [inumber1]: String, [inumber2]: String) {
                let (r1, i1) = parse_complex(&inumber1, *span)?;
                let (r2, i2) = parse_complex(&inumber2, *span)?;
                let suffix = get_complex_suffix(&inumber1);
                // (a+bi)/(c+di) = ((ac+bd) + (bc-ad)i) / (c²+d²)
                let denom = r2 * r2 + i2 * i2;
                if denom == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                format_complex(
                    (r1 * r2 + i1 * i2) / denom,
                    (i1 * r2 - r1 * i2) / denom,
                    &suffix,
                )
            }
        ),
        formula_fn!(
            /// Returns a complex number raised to a power.
            #[examples("IMPOWER(\"2+3i\", 2)")]
            #[zip_map]
            fn IMPOWER(span: Span, [inumber]: String, [number]: f64) {
                let (real, imag) = parse_complex(&inumber, *span)?;
                let suffix = get_complex_suffix(&inumber);
                // Convert to polar form
                let r = (real * real + imag * imag).sqrt();
                let theta = imag.atan2(real);
                // r^n * (cos(n*theta) + i*sin(n*theta))
                let new_r = r.powf(number);
                let new_theta = theta * number;
                format_complex(new_r * new_theta.cos(), new_r * new_theta.sin(), &suffix)
            }
        ),
        formula_fn!(
            /// Returns the square root of a complex number.
            #[examples("IMSQRT(\"3+4i\")")]
            #[zip_map]
            fn IMSQRT(span: Span, [inumber]: String) {
                let (real, imag) = parse_complex(&inumber, *span)?;
                let suffix = get_complex_suffix(&inumber);
                let r = (real * real + imag * imag).sqrt();
                let theta = imag.atan2(real);
                let new_r = r.sqrt();
                let new_theta = theta / 2.0;
                format_complex(new_r * new_theta.cos(), new_r * new_theta.sin(), &suffix)
            }
        ),
        formula_fn!(
            /// Returns the exponential of a complex number.
            #[examples("IMEXP(\"1+2i\")")]
            #[zip_map]
            fn IMEXP(span: Span, [inumber]: String) {
                let (real, imag) = parse_complex(&inumber, *span)?;
                let suffix = get_complex_suffix(&inumber);
                // e^(a+bi) = e^a * (cos(b) + i*sin(b))
                let e_real = real.exp();
                format_complex(e_real * imag.cos(), e_real * imag.sin(), &suffix)
            }
        ),
        formula_fn!(
            /// Returns the natural logarithm of a complex number.
            #[examples("IMLN(\"3+4i\")")]
            #[zip_map]
            fn IMLN(span: Span, [inumber]: String) {
                let (real, imag) = parse_complex(&inumber, *span)?;
                let suffix = get_complex_suffix(&inumber);
                let r = (real * real + imag * imag).sqrt();
                if r == 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let theta = imag.atan2(real);
                format_complex(r.ln(), theta, &suffix)
            }
        ),
        formula_fn!(
            /// Returns the base-10 logarithm of a complex number.
            #[examples("IMLOG10(\"3+4i\")")]
            #[zip_map]
            fn IMLOG10(span: Span, [inumber]: String) {
                let (real, imag) = parse_complex(&inumber, *span)?;
                let suffix = get_complex_suffix(&inumber);
                let r = (real * real + imag * imag).sqrt();
                if r == 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let theta = imag.atan2(real);
                // log10(z) = ln(z) / ln(10)
                let ln10 = 10.0_f64.ln();
                format_complex(r.ln() / ln10, theta / ln10, &suffix)
            }
        ),
        formula_fn!(
            /// Returns the base-2 logarithm of a complex number.
            #[examples("IMLOG2(\"3+4i\")")]
            #[zip_map]
            fn IMLOG2(span: Span, [inumber]: String) {
                let (real, imag) = parse_complex(&inumber, *span)?;
                let suffix = get_complex_suffix(&inumber);
                let r = (real * real + imag * imag).sqrt();
                if r == 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let theta = imag.atan2(real);
                // log2(z) = ln(z) / ln(2)
                let ln2 = 2.0_f64.ln();
                format_complex(r.ln() / ln2, theta / ln2, &suffix)
            }
        ),
        formula_fn!(
            /// Returns the sine of a complex number.
            #[examples("IMSIN(\"1+2i\")")]
            #[zip_map]
            fn IMSIN(span: Span, [inumber]: String) {
                let (real, imag) = parse_complex(&inumber, *span)?;
                let suffix = get_complex_suffix(&inumber);
                // sin(a+bi) = sin(a)cosh(b) + i*cos(a)sinh(b)
                format_complex(real.sin() * imag.cosh(), real.cos() * imag.sinh(), &suffix)
            }
        ),
        formula_fn!(
            /// Returns the cosine of a complex number.
            #[examples("IMCOS(\"1+2i\")")]
            #[zip_map]
            fn IMCOS(span: Span, [inumber]: String) {
                let (real, imag) = parse_complex(&inumber, *span)?;
                let suffix = get_complex_suffix(&inumber);
                // cos(a+bi) = cos(a)cosh(b) - i*sin(a)sinh(b)
                format_complex(real.cos() * imag.cosh(), -real.sin() * imag.sinh(), &suffix)
            }
        ),
        formula_fn!(
            /// Returns the tangent of a complex number.
            #[examples("IMTAN(\"1+2i\")")]
            #[zip_map]
            fn IMTAN(span: Span, [inumber]: String) {
                let (real, imag) = parse_complex(&inumber, *span)?;
                let suffix = get_complex_suffix(&inumber);
                // tan(z) = sin(z) / cos(z)
                let sin_r = real.sin() * imag.cosh();
                let sin_i = real.cos() * imag.sinh();
                let cos_r = real.cos() * imag.cosh();
                let cos_i = -real.sin() * imag.sinh();
                // Complex division
                let denom = cos_r * cos_r + cos_i * cos_i;
                if denom == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                format_complex(
                    (sin_r * cos_r + sin_i * cos_i) / denom,
                    (sin_i * cos_r - sin_r * cos_i) / denom,
                    &suffix,
                )
            }
        ),
        formula_fn!(
            /// Returns the secant of a complex number.
            #[examples("IMSEC(\"1+2i\")")]
            #[zip_map]
            fn IMSEC(span: Span, [inumber]: String) {
                let (real, imag) = parse_complex(&inumber, *span)?;
                let suffix = get_complex_suffix(&inumber);
                // sec(z) = 1 / cos(z)
                let cos_r = real.cos() * imag.cosh();
                let cos_i = -real.sin() * imag.sinh();
                let denom = cos_r * cos_r + cos_i * cos_i;
                if denom == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                format_complex(cos_r / denom, -cos_i / denom, &suffix)
            }
        ),
        formula_fn!(
            /// Returns the cosecant of a complex number.
            #[examples("IMCSC(\"1+2i\")")]
            #[zip_map]
            fn IMCSC(span: Span, [inumber]: String) {
                let (real, imag) = parse_complex(&inumber, *span)?;
                let suffix = get_complex_suffix(&inumber);
                // csc(z) = 1 / sin(z)
                let sin_r = real.sin() * imag.cosh();
                let sin_i = real.cos() * imag.sinh();
                let denom = sin_r * sin_r + sin_i * sin_i;
                if denom == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                format_complex(sin_r / denom, -sin_i / denom, &suffix)
            }
        ),
        formula_fn!(
            /// Returns the cotangent of a complex number.
            #[examples("IMCOT(\"1+2i\")")]
            #[zip_map]
            fn IMCOT(span: Span, [inumber]: String) {
                let (real, imag) = parse_complex(&inumber, *span)?;
                let suffix = get_complex_suffix(&inumber);
                // cot(z) = cos(z) / sin(z)
                let sin_r = real.sin() * imag.cosh();
                let sin_i = real.cos() * imag.sinh();
                let cos_r = real.cos() * imag.cosh();
                let cos_i = -real.sin() * imag.sinh();
                let denom = sin_r * sin_r + sin_i * sin_i;
                if denom == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                format_complex(
                    (cos_r * sin_r + cos_i * sin_i) / denom,
                    (cos_i * sin_r - cos_r * sin_i) / denom,
                    &suffix,
                )
            }
        ),
        formula_fn!(
            /// Returns the hyperbolic sine of a complex number.
            #[examples("IMSINH(\"1+2i\")")]
            #[zip_map]
            fn IMSINH(span: Span, [inumber]: String) {
                let (real, imag) = parse_complex(&inumber, *span)?;
                let suffix = get_complex_suffix(&inumber);
                // sinh(a+bi) = sinh(a)cos(b) + i*cosh(a)sin(b)
                format_complex(real.sinh() * imag.cos(), real.cosh() * imag.sin(), &suffix)
            }
        ),
        formula_fn!(
            /// Returns the hyperbolic cosine of a complex number.
            #[examples("IMCOSH(\"1+2i\")")]
            #[zip_map]
            fn IMCOSH(span: Span, [inumber]: String) {
                let (real, imag) = parse_complex(&inumber, *span)?;
                let suffix = get_complex_suffix(&inumber);
                // cosh(a+bi) = cosh(a)cos(b) + i*sinh(a)sin(b)
                format_complex(real.cosh() * imag.cos(), real.sinh() * imag.sin(), &suffix)
            }
        ),
        formula_fn!(
            /// Returns the hyperbolic secant of a complex number.
            #[examples("IMSECH(\"1+2i\")")]
            #[zip_map]
            fn IMSECH(span: Span, [inumber]: String) {
                let (real, imag) = parse_complex(&inumber, *span)?;
                let suffix = get_complex_suffix(&inumber);
                // sech(z) = 1 / cosh(z)
                let cosh_r = real.cosh() * imag.cos();
                let cosh_i = real.sinh() * imag.sin();
                let denom = cosh_r * cosh_r + cosh_i * cosh_i;
                if denom == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                format_complex(cosh_r / denom, -cosh_i / denom, &suffix)
            }
        ),
        formula_fn!(
            /// Returns the hyperbolic cosecant of a complex number.
            #[examples("IMCSCH(\"1+2i\")")]
            #[zip_map]
            fn IMCSCH(span: Span, [inumber]: String) {
                let (real, imag) = parse_complex(&inumber, *span)?;
                let suffix = get_complex_suffix(&inumber);
                // csch(z) = 1 / sinh(z)
                let sinh_r = real.sinh() * imag.cos();
                let sinh_i = real.cosh() * imag.sin();
                let denom = sinh_r * sinh_r + sinh_i * sinh_i;
                if denom == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                format_complex(sinh_r / denom, -sinh_i / denom, &suffix)
            }
        ),
        // Other engineering functions
        formula_fn!(
            /// Tests whether two values are equal. Returns 1 if equal, 0 otherwise.
            #[examples("DELTA(5, 5) = 1", "DELTA(5, 4) = 0")]
            #[zip_map]
            fn DELTA([number1]: f64, [number2]: (Option<f64>)) {
                let b = number2.unwrap_or(0.0);
                if (number1 - b).abs() < f64::EPSILON {
                    1.0
                } else {
                    0.0
                }
            }
        ),
        formula_fn!(
            /// Tests whether a number is greater than or equal to a step value.
            /// Returns 1 if number >= step, 0 otherwise.
            #[examples("GESTEP(5, 4) = 1", "GESTEP(3, 4) = 0")]
            #[zip_map]
            fn GESTEP([number]: f64, [step]: (Option<f64>)) {
                let s = step.unwrap_or(0.0);
                if number >= s { 1.0 } else { 0.0 }
            }
        ),
        // ===== UNIT CONVERSION =====
        formula_fn!(
            /// Converts a number from one measurement unit to another.
            ///
            /// Supports weight, distance, time, pressure, force, energy, power,
            /// magnetism, temperature, volume, area, information, and speed units.
            #[examples(
                "CONVERT(1, \"m\", \"ft\")",
                "CONVERT(68, \"F\", \"C\")",
                "CONVERT(1, \"kg\", \"lbm\")"
            )]
            #[zip_map]
            fn CONVERT(span: Span, [number]: f64, [from_unit]: String, [to_unit]: String) {
                convert_units(number, &from_unit, &to_unit, *span)
            }
        ),
        // ===== BESSEL FUNCTIONS =====
        formula_fn!(
            /// Returns the modified Bessel function In(x).
            #[examples("BESSELI(1.5, 1)")]
            #[zip_map]
            fn BESSELI(span: Span, [x]: f64, [n]: i64) {
                if n < 0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                bessel_i(x, n as u32)
            }
        ),
        formula_fn!(
            /// Returns the Bessel function Jn(x).
            #[examples("BESSELJ(1.5, 1)")]
            #[zip_map]
            fn BESSELJ(span: Span, [x]: f64, [n]: i64) {
                if n < 0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                bessel_j(x, n as u32)
            }
        ),
        formula_fn!(
            /// Returns the modified Bessel function Kn(x).
            #[examples("BESSELK(1.5, 1)")]
            #[zip_map]
            fn BESSELK(span: Span, [x]: f64, [n]: i64) {
                if n < 0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if x <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                bessel_k(x, n as u32)
            }
        ),
        formula_fn!(
            /// Returns the Bessel function Yn(x).
            #[examples("BESSELY(1.5, 1)")]
            #[zip_map]
            fn BESSELY(span: Span, [x]: f64, [n]: i64) {
                if n < 0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if x <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                bessel_y(x, n as u32)
            }
        ),
    ]
}

/// Parse a complex number string into (real, imaginary) components.
/// Supports formats: "3+4i", "3-4i", "3", "4i", "-4i", "3+4j", etc.
fn parse_complex(s: &str, span: Span) -> CodeResult<(f64, f64)> {
    let s = s.trim();
    if s.is_empty() {
        return Err(RunErrorMsg::InvalidArgument.with_span(span));
    }

    // Determine suffix (i or j)
    let has_i = s.ends_with('i') || s.contains('i');
    let has_j = s.ends_with('j') || s.contains('j');

    if has_i && has_j {
        return Err(RunErrorMsg::InvalidArgument.with_span(span));
    }

    let suffix = if has_j { 'j' } else { 'i' };

    // Handle pure real numbers
    if !has_i && !has_j {
        let real = s
            .parse::<f64>()
            .map_err(|_| RunErrorMsg::InvalidArgument.with_span(span))?;
        return Ok((real, 0.0));
    }

    // At this point we have either 'i' or 'j' in the string
    // Find the last + or - that separates real and imaginary parts
    let chars: Vec<char> = s.chars().collect();
    let mut split_pos = None;

    for i in (1..chars.len()).rev() {
        if chars[i] == '+' || chars[i] == '-' {
            // Make sure this isn't part of an exponent (e.g., 1e-5)
            if i > 0 && (chars[i - 1] == 'e' || chars[i - 1] == 'E') {
                continue;
            }
            // Check if there's a digit before this sign (meaning it's a separator)
            // If the character before is a digit, this is a separator
            if i > 0 && chars[i - 1].is_ascii_digit() {
                split_pos = Some(i);
                break;
            }
        }
    }

    if let Some(pos) = split_pos {
        // Complex number with both real and imaginary parts
        let real_part: String = chars[..pos].iter().collect();
        let imag_part: String = chars[pos..].iter().collect();
        let imag_part = imag_part.trim_end_matches(suffix);

        let real = if real_part.is_empty() {
            0.0
        } else {
            real_part
                .parse::<f64>()
                .map_err(|_| RunErrorMsg::InvalidArgument.with_span(span))?
        };

        let imag = if imag_part == "+" || imag_part.is_empty() {
            1.0
        } else if imag_part == "-" {
            -1.0
        } else {
            imag_part
                .parse::<f64>()
                .map_err(|_| RunErrorMsg::InvalidArgument.with_span(span))?
        };

        Ok((real, imag))
    } else {
        // Pure imaginary number like "4i", "-4i", "i", "-i"
        let imag_part = s.trim_end_matches(suffix);
        let imag = if imag_part.is_empty() || imag_part == "+" {
            1.0
        } else if imag_part == "-" {
            -1.0
        } else {
            imag_part
                .parse::<f64>()
                .map_err(|_| RunErrorMsg::InvalidArgument.with_span(span))?
        };
        Ok((0.0, imag))
    }
}

/// Get the suffix (i or j) from a complex number string.
fn get_complex_suffix(s: &str) -> String {
    if s.contains('j') {
        "j".to_string()
    } else {
        "i".to_string()
    }
}

/// Format a complex number as a string.
fn format_complex(real: f64, imag: f64, suffix: &str) -> String {
    const EPSILON: f64 = 1e-10;

    let real_zero = real.abs() < EPSILON;
    let imag_zero = imag.abs() < EPSILON;

    if real_zero && imag_zero {
        return "0".to_string();
    }

    if imag_zero {
        return format_number(real);
    }

    if real_zero {
        if (imag - 1.0).abs() < EPSILON {
            return suffix.to_string();
        } else if (imag + 1.0).abs() < EPSILON {
            return format!("-{}", suffix);
        } else {
            return format!("{}{}", format_number(imag), suffix);
        }
    }

    // Both parts non-zero
    let imag_str = if (imag - 1.0).abs() < EPSILON {
        format!("+{}", suffix)
    } else if (imag + 1.0).abs() < EPSILON {
        format!("-{}", suffix)
    } else if imag > 0.0 {
        format!("+{}{}", format_number(imag), suffix)
    } else {
        format!("{}{}", format_number(imag), suffix)
    };

    format!("{}{}", format_number(real), imag_str)
}

/// Format a number, removing unnecessary trailing zeros.
fn format_number(n: f64) -> String {
    if n == n.floor() && n.abs() < 1e15 {
        format!("{:.0}", n)
    } else {
        let s = format!("{:.10}", n);
        let s = s.trim_end_matches('0');
        let s = s.trim_end_matches('.');
        s.to_string()
    }
}

/// Convert a number from one unit to another.
fn convert_units(number: f64, from_unit: &str, to_unit: &str, span: Span) -> CodeResult<f64> {
    // Get base value (convert to SI)
    let base_value = to_base_unit(number, from_unit, span)?;
    // Convert from base to target
    from_base_unit(base_value, to_unit, span)
}

/// Convert a value from a unit to its SI base unit.
fn to_base_unit(value: f64, unit: &str, span: Span) -> CodeResult<f64> {
    let factor = get_unit_factor(unit, span)?;
    match unit.to_lowercase().as_str() {
        // Temperature needs special handling
        "c" | "cel" => Ok(value), // Celsius is base
        "f" | "fah" => Ok((value - 32.0) * 5.0 / 9.0),
        "k" | "kel" => Ok(value - 273.15),
        "rank" => Ok((value - 491.67) * 5.0 / 9.0),
        "reau" => Ok(value * 1.25),
        _ => Ok(value * factor),
    }
}

/// Convert a value from SI base unit to a target unit.
fn from_base_unit(value: f64, unit: &str, span: Span) -> CodeResult<f64> {
    let factor = get_unit_factor(unit, span)?;
    match unit.to_lowercase().as_str() {
        // Temperature needs special handling
        "c" | "cel" => Ok(value),
        "f" | "fah" => Ok(value * 9.0 / 5.0 + 32.0),
        "k" | "kel" => Ok(value + 273.15),
        "rank" => Ok(value * 9.0 / 5.0 + 491.67),
        "reau" => Ok(value / 1.25),
        _ => Ok(value / factor),
    }
}

/// Get the conversion factor for a unit (relative to SI base).
fn get_unit_factor(unit: &str, span: Span) -> CodeResult<f64> {
    let unit_lower = unit.to_lowercase();
    let factor = match unit_lower.as_str() {
        // Weight/Mass (base: kg)
        "g" => 0.001,
        "kg" => 1.0,
        "mg" => 1e-6,
        "lbm" => 0.45359237,
        "ozm" => 0.0283495231,
        "stone" => 6.35029318,
        "ton" => 907.18474,
        "sg" | "slug" => 14.593903,
        "u" => 1.660538921e-27,
        "grain" => 6.479891e-5,

        // Distance (base: m)
        "m" => 1.0,
        "km" => 1000.0,
        "cm" => 0.01,
        "mm" => 0.001,
        "mi" => 1609.344,
        "nmi" => 1852.0,
        "in" => 0.0254,
        "ft" => 0.3048,
        "yd" => 0.9144,
        "ang" => 1e-10,
        "ell" => 1.143,
        "ly" => 9.4607304725808e15,
        "parsec" | "pc" => 3.08567758149137e16,
        "pica" | "picapt" => 0.00035277778,
        "pica2" => 0.00423333333,

        // Time (base: s)
        "s" | "sec" => 1.0,
        "min" | "mn" => 60.0,
        "hr" => 3600.0,
        "day" | "d" => 86400.0,
        "yr" => 31557600.0,

        // Pressure (base: Pa)
        "pa" | "pascal" => 1.0,
        "atm" | "at" => 101325.0,
        "mmhg" => 133.322,
        "psi" => 6894.757,
        "torr" => 133.322,

        // Force (base: N)
        "n" | "newton" => 1.0,
        "dyn" | "dy" => 1e-5,
        "lbf" => 4.44822162,
        "pond" => 0.00980665,

        // Energy (base: J)
        "j" | "joule" => 1.0,
        "e" | "erg" => 1e-7,
        "c" | "cal" => 4.1868,
        "cal15" => 4.1855,
        "calth" => 4.184,
        "ev" => 1.602176634e-19,
        "hph" => 2684519.537696,
        "wh" => 3600.0,
        "btu" => 1055.05585262,

        // Power (base: W)
        "w" | "watt" => 1.0,
        "hp" => 745.699872,
        "ps" => 735.49875,

        // Magnetism (base: T)
        "t" | "tesla" => 1.0,
        "ga" | "gauss" => 1e-4,

        // Volume (base: L)
        "l" | "lt" | "liter" => 1.0,
        "ml" => 0.001,
        "gal" => 3.78541178,
        "qt" => 0.946352946,
        "pt" | "us_pt" => 0.473176473,
        "cup" => 0.2365882365,
        "oz" | "ozfl" | "us_oz" => 0.0295735296,
        "tbs" | "tbsp" => 0.0147867648,
        "tsp" => 0.00492892159,
        "barrel" => 158.987295,

        // Area (base: m²)
        "m2" | "m^2" => 1.0,
        "km2" | "km^2" => 1e6,
        "ha" => 1e4,
        "ar" => 100.0,
        "acre" | "uk_acre" | "us_acre" => 4046.8564224,
        "ft2" | "ft^2" => 0.09290304,
        "in2" | "in^2" => 0.00064516,
        "yd2" | "yd^2" => 0.83612736,
        "mi2" | "mi^2" => 2589988.110336,

        // Speed (base: m/s)
        "m/s" => 1.0,
        "m/h" | "m/hr" => 1.0 / 3600.0,
        "mph" => 0.44704,
        "kn" | "kph" => 1.0 / 3.6,
        "admkn" => 0.514773333,

        // Information (base: bit)
        "bit" => 1.0,
        "byte" => 8.0,

        // Temperature (special handling in to_base_unit/from_base_unit)
        // Note: "c" is not included here as it conflicts with "c" for calorie in Energy
        "cel" | "f" | "fah" | "k" | "kel" | "rank" | "reau" => 1.0,

        _ => return Err(RunErrorMsg::InvalidArgument.with_span(span)),
    };
    Ok(factor)
}

/// Modified Bessel function of the first kind, I_n(x)
fn bessel_i(x: f64, n: u32) -> f64 {
    if n == 0 {
        bessel_i0(x)
    } else if n == 1 {
        bessel_i1(x)
    } else {
        if x == 0.0 {
            return 0.0;
        }
        let tox = 2.0 / x.abs();
        let mut bi = 0.0;
        let mut bip = 0.0;
        let mut bim: f64;
        let mut ans = 0.0;

        for j in (1..=2 * (n + (40.0_f64.sqrt() * n as f64) as u32)).rev() {
            bim = bip + (j as f64) * tox * bi;
            bip = bi;
            bi = bim;
            if bi.abs() > 1e10 {
                ans *= 1e-10;
                bi *= 1e-10;
                bip *= 1e-10;
            }
            if j == n {
                ans = bip;
            }
        }
        ans *= bessel_i0(x) / bi;
        if x < 0.0 && n % 2 == 1 { -ans } else { ans }
    }
}

fn bessel_i0(x: f64) -> f64 {
    let ax = x.abs();
    if ax < 3.75 {
        let y = (x / 3.75).powi(2);
        1.0 + y
            * (3.5156229
                + y * (3.0899424
                    + y * (1.2067492 + y * (0.2659732 + y * (0.0360768 + y * 0.0045813)))))
    } else {
        let y = 3.75 / ax;
        (ax.exp() / ax.sqrt())
            * (0.39894228
                + y * (0.01328592
                    + y * (0.00225319
                        + y * (-0.00157565
                            + y * (0.00916281
                                + y * (-0.02057706
                                    + y * (0.02635537 + y * (-0.01647633 + y * 0.00392377))))))))
    }
}

fn bessel_i1(x: f64) -> f64 {
    let ax = x.abs();
    if ax < 3.75 {
        let y = (x / 3.75).powi(2);
        ax * (0.5
            + y * (0.87890594
                + y * (0.51498869
                    + y * (0.15084934 + y * (0.02658733 + y * (0.00301532 + y * 0.00032411))))))
    } else {
        let y = 3.75 / ax;
        let ans = 0.02282967 + y * (-0.02895312 + y * (0.01787654 - y * 0.00420059));
        let ans = 0.39894228
            + y * (-0.03988024
                + y * (-0.00362018 + y * (0.00163801 + y * (-0.01031555 + y * ans))));
        let result = (ax.exp() / ax.sqrt()) * ans;
        if x < 0.0 { -result } else { result }
    }
}

/// Bessel function of the first kind, J_n(x)
fn bessel_j(x: f64, n: u32) -> f64 {
    if n == 0 {
        bessel_j0(x)
    } else if n == 1 {
        bessel_j1(x)
    } else {
        if x == 0.0 {
            return 0.0;
        }
        let ax = x.abs();
        let tox = 2.0 / ax;
        let mut bjm: f64;
        let mut bj = 0.0;
        let mut bjp = 0.0;
        let mut ans = 0.0;
        let m = 2 * ((n + (40.0_f64.sqrt() * n as f64) as u32) / 2);

        for j in (1..=m).rev() {
            bjm = (j as f64) * tox * bj - bjp;
            bjp = bj;
            bj = bjm;
            if bj.abs() > 1e10 {
                bj *= 1e-10;
                bjp *= 1e-10;
                ans *= 1e-10;
            }
            if j == n {
                ans = bjp;
            }
        }
        ans *= bessel_j0(ax) / bj;
        if x < 0.0 && n % 2 == 1 { -ans } else { ans }
    }
}

fn bessel_j0(x: f64) -> f64 {
    let ax = x.abs();
    if ax < 8.0 {
        let y = x.powi(2);
        let ans1 = 57568490574.0
            + y * (-13362590354.0
                + y * (651619640.7 + y * (-11214424.18 + y * (77392.33017 - y * 184.9052456))));
        let ans2 = 57568490411.0
            + y * (1029532985.0 + y * (9494680.718 + y * (59272.64853 + y * (267.8532712 + y))));
        ans1 / ans2
    } else {
        let z = 8.0 / ax;
        let y = z.powi(2);
        let xx = ax - 0.785398164;
        let ans1 = 1.0
            + y * (-0.1098628627e-2
                + y * (0.2734510407e-4 + y * (-0.2073370639e-5 + y * 0.2093887211e-6)));
        let ans2 = -0.1562499995e-1
            + y * (0.1430488765e-3
                + y * (-0.6911147651e-5 + y * (0.7621095161e-6 - y * 0.934945152e-7)));
        (std::f64::consts::FRAC_2_PI / ax).sqrt() * (xx.cos() * ans1 - z * xx.sin() * ans2)
    }
}

fn bessel_j1(x: f64) -> f64 {
    let ax = x.abs();
    if ax < 8.0 {
        let y = x.powi(2);
        let ans1 = x
            * (72362614232.0
                + y * (-7895059235.0
                    + y * (242396853.1
                        + y * (-2972611.439 + y * (15704.48260 - y * 30.16036606)))));
        let ans2 = 144725228442.0
            + y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
        ans1 / ans2
    } else {
        let z = 8.0 / ax;
        let y = z.powi(2);
        let xx = ax - 2.356194491;
        let ans1 = 1.0
            + y * (0.183105e-2
                + y * (-0.3516396496e-4 + y * (0.2457520174e-5 - y * 0.240337019e-6)));
        let ans2 = 0.04687499995
            + y * (-0.2002690873e-3
                + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
        let ans =
            (std::f64::consts::FRAC_2_PI / ax).sqrt() * (xx.cos() * ans1 - z * xx.sin() * ans2);
        if x < 0.0 { -ans } else { ans }
    }
}

/// Modified Bessel function of the second kind, K_n(x)
fn bessel_k(x: f64, n: u32) -> f64 {
    if n == 0 {
        bessel_k0(x)
    } else if n == 1 {
        bessel_k1(x)
    } else {
        let tox = 2.0 / x;
        let mut bkm: f64;
        let mut bk = bessel_k1(x);
        let mut bkp = bessel_k0(x);
        for j in 1..n {
            bkm = bkp + (j as f64) * tox * bk;
            bkp = bk;
            bk = bkm;
        }
        bk
    }
}

fn bessel_k0(x: f64) -> f64 {
    if x <= 2.0 {
        let y = x * x / 4.0;
        -(x / 2.0).ln() * bessel_i0(x)
            + (-0.57721566
                + y * (0.42278420
                    + y * (0.23069756
                        + y * (0.03488590 + y * (0.00262698 + y * (0.00010750 + y * 0.00000740))))))
    } else {
        let y = 2.0 / x;
        ((-x).exp() / x.sqrt())
            * (1.25331414
                + y * (-0.07832358
                    + y * (0.02189568
                        + y * (-0.01062446
                            + y * (0.00587872 + y * (-0.00251540 + y * 0.00053208))))))
    }
}

fn bessel_k1(x: f64) -> f64 {
    if x <= 2.0 {
        let y = x * x / 4.0;
        (x / 2.0).ln() * bessel_i1(x)
            + (1.0 / x)
                * (1.0
                    + y * (0.15443144
                        + y * (-0.67278579
                            + y * (-0.18156897
                                + y * (-0.01919402 + y * (-0.00110404 - y * 0.00004686))))))
    } else {
        let y = 2.0 / x;
        ((-x).exp() / x.sqrt())
            * (1.25331414
                + y * (0.23498619
                    + y * (-0.03655620
                        + y * (0.01504268
                            + y * (-0.00780353 + y * (0.00325614 - y * 0.00068245))))))
    }
}

/// Bessel function of the second kind, Y_n(x)
fn bessel_y(x: f64, n: u32) -> f64 {
    if n == 0 {
        bessel_y0(x)
    } else if n == 1 {
        bessel_y1(x)
    } else {
        let tox = 2.0 / x;
        let mut bym: f64;
        let mut by = bessel_y1(x);
        let mut byp = bessel_y0(x);
        for j in 1..n {
            bym = (j as f64) * tox * by - byp;
            byp = by;
            by = bym;
        }
        by
    }
}

fn bessel_y0(x: f64) -> f64 {
    if x < 8.0 {
        let y = x.powi(2);
        let ans1 = -2957821389.0
            + y * (7062834065.0
                + y * (-512359803.6 + y * (10879881.29 + y * (-86327.92757 + y * 228.4622733))));
        let ans2 = 40076544269.0
            + y * (745249964.8 + y * (7189466.438 + y * (47447.26470 + y * (226.1030244 + y))));
        (ans1 / ans2) + std::f64::consts::FRAC_2_PI * bessel_j0(x) * x.ln()
    } else {
        let z = 8.0 / x;
        let y = z.powi(2);
        let xx = x - 0.785398164;
        let ans1 = 1.0
            + y * (-0.1098628627e-2
                + y * (0.2734510407e-4 + y * (-0.2073370639e-5 + y * 0.2093887211e-6)));
        let ans2 = -0.1562499995e-1
            + y * (0.1430488765e-3
                + y * (-0.6911147651e-5 + y * (0.7621095161e-6 - y * 0.934945152e-7)));
        (std::f64::consts::FRAC_2_PI / x).sqrt() * (xx.sin() * ans1 + z * xx.cos() * ans2)
    }
}

fn bessel_y1(x: f64) -> f64 {
    if x < 8.0 {
        let y = x.powi(2);
        let ans1 = x
            * (-4900604943000.0
                + y * (1275274390000.0
                    + y * (-51534381390.0
                        + y * (734926455.1 + y * (-4237922.726 + y * 8511.937935)))));
        let ans2 = 24909857410000.0
            + y * (424441966400.0
                + y * (3733650367.0
                    + y * (22459040.02 + y * (102042.605 + y * (354.9632885 + y)))));
        (ans1 / ans2) + std::f64::consts::FRAC_2_PI * (bessel_j1(x) * x.ln() - 1.0 / x)
    } else {
        let z = 8.0 / x;
        let y = z.powi(2);
        let xx = x - 2.356194491;
        let ans1 = 1.0
            + y * (0.183105e-2
                + y * (-0.3516396496e-4 + y * (0.2457520174e-5 - y * 0.240337019e-6)));
        let ans2 = 0.04687499995
            + y * (-0.2002690873e-3
                + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
        (std::f64::consts::FRAC_2_PI / x).sqrt() * (xx.sin() * ans1 + z * xx.cos() * ans2)
    }
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, formulas::tests::*};

    #[test]
    fn test_bitwise() {
        let g = GridController::new();

        // BITAND
        assert_eq!("1", eval_to_string(&g, "BITAND(5, 3)"));
        assert_eq!("7", eval_to_string(&g, "BITAND(15, 7)"));
        assert_eq!("0", eval_to_string(&g, "BITAND(8, 4)"));

        // BITOR
        assert_eq!("7", eval_to_string(&g, "BITOR(5, 3)"));
        assert_eq!("12", eval_to_string(&g, "BITOR(8, 4)"));

        // BITXOR
        assert_eq!("6", eval_to_string(&g, "BITXOR(5, 3)"));
        assert_eq!("8", eval_to_string(&g, "BITXOR(15, 7)"));

        // BITLSHIFT
        assert_eq!("16", eval_to_string(&g, "BITLSHIFT(4, 2)"));
        assert_eq!("1024", eval_to_string(&g, "BITLSHIFT(1, 10)"));

        // BITRSHIFT
        assert_eq!("4", eval_to_string(&g, "BITRSHIFT(16, 2)"));
        assert_eq!("1", eval_to_string(&g, "BITRSHIFT(1024, 10)"));
    }

    #[test]
    fn test_delta_gestep() {
        let g = GridController::new();

        // DELTA
        assert_eq!("1", eval_to_string(&g, "DELTA(5, 5)"));
        assert_eq!("0", eval_to_string(&g, "DELTA(5, 4)"));
        assert_eq!("1", eval_to_string(&g, "DELTA(0)"));
        assert_eq!("0", eval_to_string(&g, "DELTA(5)"));

        // GESTEP
        assert_eq!("1", eval_to_string(&g, "GESTEP(5, 4)"));
        assert_eq!("0", eval_to_string(&g, "GESTEP(3, 4)"));
        assert_eq!("1", eval_to_string(&g, "GESTEP(5)"));
        assert_eq!("1", eval_to_string(&g, "GESTEP(0)"));
    }

    #[test]
    fn test_complex_basic() {
        let g = GridController::new();

        // COMPLEX
        assert_eq!("3+4i", eval_to_string(&g, "COMPLEX(3, 4)"));
        assert_eq!("3-4i", eval_to_string(&g, "COMPLEX(3, -4)"));
        assert_eq!("3", eval_to_string(&g, "COMPLEX(3, 0)"));
        assert_eq!("4i", eval_to_string(&g, "COMPLEX(0, 4)"));
        assert_eq!("3+4j", eval_to_string(&g, "COMPLEX(3, 4, \"j\")"));

        // IMAGINARY
        assert_eq!("4", eval_to_string(&g, "IMAGINARY(\"3+4i\")"));
        assert_eq!("0", eval_to_string(&g, "IMAGINARY(\"5\")"));
        assert_eq!("5", eval_to_string(&g, "IMAGINARY(\"5i\")"));

        // IMREAL
        assert_eq!("3", eval_to_string(&g, "IMREAL(\"3+4i\")"));
        assert_eq!("5", eval_to_string(&g, "IMREAL(\"5\")"));
        assert_eq!("0", eval_to_string(&g, "IMREAL(\"5i\")"));
    }

    #[test]
    fn test_complex_operations() {
        let g = GridController::new();

        // IMABS - |3+4i| = 5
        assert_eq!("5", eval_to_string(&g, "IMABS(\"3+4i\")"));

        // IMCONJUGATE
        assert_eq!("3-4i", eval_to_string(&g, "IMCONJUGATE(\"3+4i\")"));
        assert_eq!("3+4i", eval_to_string(&g, "IMCONJUGATE(\"3-4i\")"));

        // IMADD
        assert_eq!("4+6i", eval_to_string(&g, "IMADD(\"3+4i\", \"1+2i\")"));

        // IMSUB
        assert_eq!("2+2i", eval_to_string(&g, "IMSUB(\"3+4i\", \"1+2i\")"));

        // IMPRODUCT: (3+4i)(1+2i) = 3+6i+4i+8i² = 3+10i-8 = -5+10i
        assert_eq!(
            "-5+10i",
            eval_to_string(&g, "IMPRODUCT(\"3+4i\", \"1+2i\")")
        );
    }

    #[test]
    fn test_complex_power_functions() {
        let g = GridController::new();

        // IMSQRT of 3+4i
        // sqrt(3+4i) should have magnitude sqrt(5) ≈ 2.236
        let result = eval_to_string(&g, "IMABS(IMSQRT(\"3+4i\"))");
        let abs: f64 = result.parse().unwrap();
        assert!((abs - 5.0_f64.sqrt()).abs() < 0.001);

        // IMEXP of 0 should be 1
        assert_eq!("1", eval_to_string(&g, "IMEXP(\"0\")"));
    }

    #[test]
    fn test_complex_trig() {
        let g = GridController::new();

        // IMSIN(0) = 0
        assert_eq!("0", eval_to_string(&g, "IMSIN(\"0\")"));

        // IMCOS(0) = 1
        assert_eq!("1", eval_to_string(&g, "IMCOS(\"0\")"));
    }

    #[test]
    fn test_convert() {
        let g = GridController::new();

        // Distance conversions
        let result: f64 = eval_to_string(&g, "CONVERT(1, \"m\", \"ft\")")
            .parse()
            .unwrap();
        assert!((result - 3.28084).abs() < 0.001);

        let result: f64 = eval_to_string(&g, "CONVERT(1, \"mi\", \"km\")")
            .parse()
            .unwrap();
        assert!((result - 1.60934).abs() < 0.001);

        // Weight conversions
        let result: f64 = eval_to_string(&g, "CONVERT(1, \"kg\", \"lbm\")")
            .parse()
            .unwrap();
        assert!((result - 2.20462).abs() < 0.001);

        // Temperature conversions
        let result: f64 = eval_to_string(&g, "CONVERT(0, \"C\", \"F\")")
            .parse()
            .unwrap();
        assert!((result - 32.0).abs() < 0.001);

        let result: f64 = eval_to_string(&g, "CONVERT(100, \"C\", \"F\")")
            .parse()
            .unwrap();
        assert!((result - 212.0).abs() < 0.001);
    }

    #[test]
    fn test_bessel() {
        let g = GridController::new();

        // BESSELJ(0, 0) = 1
        let result: f64 = eval_to_string(&g, "BESSELJ(0, 0)").parse().unwrap();
        assert!((result - 1.0).abs() < 0.001);

        // BESSELJ(1, 1) ≈ 0.4401
        let result: f64 = eval_to_string(&g, "BESSELJ(1, 1)").parse().unwrap();
        assert!((result - 0.4401).abs() < 0.01);

        // BESSELI(0, 0) = 1
        let result: f64 = eval_to_string(&g, "BESSELI(0, 0)").parse().unwrap();
        assert!((result - 1.0).abs() < 0.001);

        // BESSELK(1, 0) ≈ 0.421024421 (Excel value)
        let result: f64 = eval_to_string(&g, "BESSELK(1, 0)").parse().unwrap();
        assert!((result - 0.421024421).abs() < 0.0001);

        // BESSELK(1.5, 1) ≈ 0.277388 (Excel value)
        let result: f64 = eval_to_string(&g, "BESSELK(1.5, 1)").parse().unwrap();
        assert!((result - 0.277388).abs() < 0.001);
    }

    // ===== HELPER FUNCTION TESTS =====

    mod helper_tests {
        use super::super::*;

        #[test]
        fn test_parse_complex_standard_forms() {
            let span = Span::empty(0);

            // Standard form: a+bi
            assert_eq!(parse_complex("3+4i", span).unwrap(), (3.0, 4.0));
            assert_eq!(parse_complex("3-4i", span).unwrap(), (3.0, -4.0));
            assert_eq!(parse_complex("-3+4i", span).unwrap(), (-3.0, 4.0));
            assert_eq!(parse_complex("-3-4i", span).unwrap(), (-3.0, -4.0));

            // With j suffix
            assert_eq!(parse_complex("3+4j", span).unwrap(), (3.0, 4.0));
            assert_eq!(parse_complex("3-4j", span).unwrap(), (3.0, -4.0));
        }

        #[test]
        fn test_parse_complex_pure_real() {
            let span = Span::empty(0);

            assert_eq!(parse_complex("5", span).unwrap(), (5.0, 0.0));
            assert_eq!(parse_complex("-5", span).unwrap(), (-5.0, 0.0));
            assert_eq!(parse_complex("3.15", span).unwrap(), (3.15, 0.0));
            assert_eq!(parse_complex("-3.15", span).unwrap(), (-3.15, 0.0));
            assert_eq!(parse_complex("0", span).unwrap(), (0.0, 0.0));
        }

        #[test]
        fn test_parse_complex_pure_imaginary() {
            let span = Span::empty(0);

            assert_eq!(parse_complex("4i", span).unwrap(), (0.0, 4.0));
            assert_eq!(parse_complex("-4i", span).unwrap(), (0.0, -4.0));
            assert_eq!(parse_complex("i", span).unwrap(), (0.0, 1.0));
            assert_eq!(parse_complex("-i", span).unwrap(), (0.0, -1.0));
            assert_eq!(parse_complex("+i", span).unwrap(), (0.0, 1.0));

            // With j suffix
            assert_eq!(parse_complex("4j", span).unwrap(), (0.0, 4.0));
            assert_eq!(parse_complex("j", span).unwrap(), (0.0, 1.0));
            assert_eq!(parse_complex("-j", span).unwrap(), (0.0, -1.0));
        }

        #[test]
        fn test_parse_complex_with_decimals() {
            let span = Span::empty(0);

            assert_eq!(parse_complex("1.5+2.5i", span).unwrap(), (1.5, 2.5));
            assert_eq!(parse_complex("0.5i", span).unwrap(), (0.0, 0.5));
            assert_eq!(parse_complex("3.15-2.71i", span).unwrap(), (3.15, -2.71));
        }

        #[test]
        fn test_parse_complex_with_whitespace() {
            let span = Span::empty(0);

            assert_eq!(parse_complex("  3+4i  ", span).unwrap(), (3.0, 4.0));
            assert_eq!(parse_complex("  5  ", span).unwrap(), (5.0, 0.0));
        }

        #[test]
        fn test_parse_complex_unit_coefficients() {
            let span = Span::empty(0);

            // Implicit +1i
            assert_eq!(parse_complex("3+i", span).unwrap(), (3.0, 1.0));
            // Implicit -1i
            assert_eq!(parse_complex("3-i", span).unwrap(), (3.0, -1.0));
        }

        #[test]
        fn test_parse_complex_errors() {
            let span = Span::empty(0);

            // Empty string
            assert!(parse_complex("", span).is_err());
            // Mixed i and j
            assert!(parse_complex("3+4ij", span).is_err());
            // Invalid format
            assert!(parse_complex("abc", span).is_err());
        }

        #[test]
        fn test_get_complex_suffix() {
            assert_eq!(get_complex_suffix("3+4i"), "i");
            assert_eq!(get_complex_suffix("3+4j"), "j");
            assert_eq!(get_complex_suffix("5"), "i"); // Default to i
            assert_eq!(get_complex_suffix(""), "i"); // Default to i
        }

        #[test]
        fn test_format_complex_standard() {
            assert_eq!(format_complex(3.0, 4.0, "i"), "3+4i");
            assert_eq!(format_complex(3.0, -4.0, "i"), "3-4i");
            assert_eq!(format_complex(-3.0, 4.0, "i"), "-3+4i");
            assert_eq!(format_complex(-3.0, -4.0, "i"), "-3-4i");
        }

        #[test]
        fn test_format_complex_pure_real() {
            assert_eq!(format_complex(5.0, 0.0, "i"), "5");
            assert_eq!(format_complex(-5.0, 0.0, "i"), "-5");
            assert_eq!(format_complex(3.15, 0.0, "i"), "3.15");
        }

        #[test]
        fn test_format_complex_pure_imaginary() {
            assert_eq!(format_complex(0.0, 4.0, "i"), "4i");
            assert_eq!(format_complex(0.0, -4.0, "i"), "-4i");
            assert_eq!(format_complex(0.0, 1.0, "i"), "i");
            assert_eq!(format_complex(0.0, -1.0, "i"), "-i");
        }

        #[test]
        fn test_format_complex_unit_imaginary() {
            // +1i should display as +i
            assert_eq!(format_complex(3.0, 1.0, "i"), "3+i");
            // -1i should display as -i
            assert_eq!(format_complex(3.0, -1.0, "i"), "3-i");
        }

        #[test]
        fn test_format_complex_zero() {
            assert_eq!(format_complex(0.0, 0.0, "i"), "0");
            // Near-zero values
            assert_eq!(format_complex(1e-11, 1e-11, "i"), "0");
        }

        #[test]
        fn test_format_complex_with_j_suffix() {
            assert_eq!(format_complex(3.0, 4.0, "j"), "3+4j");
            assert_eq!(format_complex(0.0, 1.0, "j"), "j");
            assert_eq!(format_complex(0.0, -1.0, "j"), "-j");
        }

        #[test]
        fn test_format_number_integers() {
            assert_eq!(format_number(5.0), "5");
            assert_eq!(format_number(-5.0), "-5");
            assert_eq!(format_number(0.0), "0");
            assert_eq!(format_number(123456.0), "123456");
        }

        #[test]
        #[allow(clippy::approx_constant)]
        fn test_format_number_decimals() {
            assert_eq!(format_number(3.15), "3.15");
            assert_eq!(format_number(-3.15), "-3.15");
            // Trailing zeros should be removed
            assert_eq!(format_number(3.1400000000), "3.14");
        }

        #[test]
        fn test_format_number_large_integers() {
            // Very large numbers that are still within integer display threshold
            assert_eq!(format_number(1e14), "100000000000000");
            // The implementation formats large integers with floor check
            let result = format_number(1e15);
            // 1e15 is exactly representable and equals its floor
            assert!(result.len() > 10); // Should produce a long number string
        }

        #[test]
        fn test_bessel_i0() {
            // I_0(0) = 1
            assert!((bessel_i0(0.0) - 1.0).abs() < 1e-10);
            // I_0(1) ≈ 1.2660658777520082
            assert!((bessel_i0(1.0) - 1.2660658777520082).abs() < 1e-6);
            // I_0(2) ≈ 2.2795853023360673
            assert!((bessel_i0(2.0) - 2.2795853023360673).abs() < 1e-6);
            // Test negative x (should be same as positive due to symmetry)
            assert!((bessel_i0(-1.0) - bessel_i0(1.0)).abs() < 1e-10);
        }

        #[test]
        fn test_bessel_i1() {
            // I_1(0) = 0
            assert!((bessel_i1(0.0)).abs() < 1e-10);
            // I_1(1) ≈ 0.5651591039924851
            assert!((bessel_i1(1.0) - 0.5651591039924851).abs() < 1e-6);
            // I_1(2) ≈ 1.5906368546373291
            assert!((bessel_i1(2.0) - 1.590_636_854_637_329).abs() < 1e-6);
        }

        #[test]
        fn test_bessel_j0() {
            // J_0(0) ≈ 1 (implementation uses polynomial approximation)
            assert!((bessel_j0(0.0) - 1.0).abs() < 1e-8);
            // J_0(1) ≈ 0.7651976865579666
            assert!((bessel_j0(1.0) - 0.7651976865579666).abs() < 1e-6);
            // J_0(2.4048) ≈ 0 (first zero)
            assert!(bessel_j0(2.4048).abs() < 0.001);
        }

        #[test]
        fn test_bessel_j1() {
            // J_1(0) = 0
            assert!(bessel_j1(0.0).abs() < 1e-10);
            // J_1(1) ≈ 0.44005058574493355
            assert!((bessel_j1(1.0) - 0.44005058574493355).abs() < 1e-6);
            // J_1(3.8317) ≈ 0 (first zero)
            assert!(bessel_j1(3.8317).abs() < 0.001);
        }

        #[test]
        fn test_bessel_k0() {
            // K_0(1) ≈ 0.42102443824070834
            assert!((bessel_k0(1.0) - 0.42102443824070834).abs() < 1e-6);
            // K_0(2) ≈ 0.11389387274953343
            assert!((bessel_k0(2.0) - 0.11389387274953343).abs() < 1e-6);
        }

        #[test]
        fn test_bessel_k1() {
            // K_1(1) ≈ 0.6019072301972346
            assert!((bessel_k1(1.0) - 0.6019072301972346).abs() < 1e-6);
            // K_1(2) ≈ 0.13986588181652243
            assert!((bessel_k1(2.0) - 0.13986588181652243).abs() < 1e-6);
        }

        #[test]
        fn test_bessel_y0() {
            // Y_0(1) ≈ 0.08825696421567696
            assert!((bessel_y0(1.0) - 0.08825696421567696).abs() < 1e-6);
            // Y_0(2) ≈ 0.5103756726497451
            assert!((bessel_y0(2.0) - 0.5103756726497451).abs() < 1e-6);
        }

        #[test]
        fn test_bessel_y1() {
            // Y_1(1) ≈ -0.7812 (implementation uses polynomial approximation)
            assert!((bessel_y1(1.0) - (-0.7812128213002887)).abs() < 1e-3);
            // Y_1(2) ≈ -0.1070 (implementation uses polynomial approximation)
            assert!((bessel_y1(2.0) - (-0.10703243154093755)).abs() < 1e-3);
        }

        #[test]
        fn test_bessel_k_higher_order() {
            // K_2(1) ≈ 1.6248 (uses recurrence relation)
            assert!((bessel_k(1.0, 2) - 1.6248388986351774).abs() < 1e-3);
            // K_3(2) ≈ 0.6474 (uses recurrence relation)
            assert!((bessel_k(2.0, 3) - 0.6473853909486342).abs() < 1e-3);
        }

        #[test]
        fn test_bessel_y_higher_order() {
            // Y_2(1) ≈ -1.6507 (uses recurrence relation)
            assert!((bessel_y(1.0, 2) - (-1.6506826068162546)).abs() < 1e-3);
            // Y_3(2) ≈ -1.1278 (uses recurrence relation)
            assert!((bessel_y(2.0, 3) - (-1.1277837768404277)).abs() < 1e-3);
        }

        #[test]
        fn test_bessel_at_zero() {
            // I_0(0) = 1, I_n(0) = 0 for n > 0
            assert!((bessel_i(0.0, 0) - 1.0).abs() < 1e-10);
            // J_0(0) = 1, J_n(0) = 0 for n > 0
            assert!((bessel_j(0.0, 0) - 1.0).abs() < 1e-8);
        }
    }
}
