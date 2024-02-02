use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Trigonometric functions",
    docs: "",
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    macro_rules! trig_functions_and_inverses {
        (
            url: $url:literal;
            inverse_url: $inv_url:literal;
            $(
                $full_name:literal($func_name:ident = $f:expr, $inv_func_name:ident = $inv_f:expr $(, $inv_range:literal)?)
            );+ $(;)?
        ) => {
            vec![
                $(
                    formula_fn!(
                        #[doc = concat!(
                            "Returns the [", $full_name, "](", $url, ") ",
                            "of an angle in radians.",
                        )]
                        #[examples(concat!(stringify!($func_name), "(PI() * 2/3)"))]
                        #[zip_map]
                        fn $func_name([radians]: f64) {
                            const F: fn(f64) -> f64 = $f;
                            F(radians)
                        }
                    ),
                    formula_fn!(
                        #[doc = concat!(
                            "Returns the [inverse ", $full_name, "](", $inv_url, ") ",
                            "of a number, in radians", $(", ranging from ", $inv_range,)?
                            ".",
                        )]
                        #[examples(concat!(stringify!($inv_func_name), "(A1)"))]
                        #[zip_map]
                        fn $inv_func_name([number]: f64) {
                            const F: fn(f64) -> f64 = $inv_f;
                            F(number)
                        }
                    ),
                )+
            ]
        };
    }

    let mut all_trig_functions = vec![
        formula_fn!(
            /// Converts radians to degrees.
            #[examples("DEGREES(PI() / 2)")]
            #[zip_map]
            fn DEGREES([radians]: f64) {
                radians.to_degrees()
            }
        ),
        formula_fn!(
            /// Converts degrees to radians.
            #[examples("RADIANS(90)")]
            #[zip_map]
            fn RADIANS([degrees]: f64) {
                degrees.to_radians()
            }
        ),
    ];

    all_trig_functions.extend(trig_functions_and_inverses![
        url: "https://en.wikipedia.org/wiki/Trigonometric_functions";
        inverse_url: "https://en.wikipedia.org/wiki/Inverse_trigonometric_functions";
        //                      function,                  inverse function,               inv_range;
        "sine"                 (SIN = |x| x.sin(),         ASIN = |x| x.asin(),            "0 to π");
        "cosine"               (COS = |x| x.cos(),         ACOS = |x| x.acos(),            "0 to π");
        "tangent"              (TAN = |x| x.tan(),         ATAN = |x| x.atan(),         "-π/2 to π/2");
        "cosecant"             (CSC = |x| x.sin().recip(), ACSC = |x| x.recip().asin(), "-π/2 to π/2");
        "secant"               (SEC = |x| x.cos().recip(), ASEC = |x| x.recip().acos(),    "0 to π");
        "cotangent"            (COT = |x| x.tan().recip(), ACOT = arc_cotangent,           "0 to π");
    ]);

    all_trig_functions.extend(trig_functions_and_inverses![
        url: "https://en.wikipedia.org/wiki/Hyperbolic_functions";
        inverse_url: "https://en.wikipedia.org/wiki/Inverse_hyperbolic_functions";
        //                      function,                    inverse function;
        "hyperbolic sine"      (SINH = |x| x.sinh(),         ASINH = |x| x.asinh());
        "hyperbolic cosine"    (COSH = |x| x.cosh(),         ACOSH = |x| x.acosh());
        "hyperbolic tangent"   (TANH = |x| x.tanh(),         ATANH = |x| x.atanh());
        "hyperbolic cosecant"  (CSCH = |x| x.sinh().recip(), ACSCH = |x| x.recip().asinh());
        "hyperbolic secant"    (SECH = |x| x.cosh().recip(), ASECH = |x| x.recip().acosh());
        "hyperbolic cotangent" (COTH = |x| x.tanh().recip(), ACOTH = |x| x.recip().atanh());
    ]);

    let index_of_atan = 5;
    all_trig_functions.insert(
        index_of_atan + 1,
        formula_fn!(
            /// Returns the counterclockwise angle, in radians, from the X axis
            /// to the point `(x, y)`. Note that the argument order is reversed
            /// compared to the [typical `atan2()`
            /// function](https://en.wikipedia.org/wiki/Atan2).
            ///
            /// If both arguments are zero, returns zero.
            #[examples("ATAN2(2, 1)")]
            #[zip_map]
            fn ATAN2(span: Span, [x]: f64, [y]: f64) {
                if x == 0.0 && y == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }
                f64::atan2(y, x)
            }
        ),
    );

    all_trig_functions
}

/// Inverse cotangent function with the correct range.
///
/// If we just use `.recip().atan()`, then the range is discontinuous and we
/// lose `acot(0) = 0`. So this function does it properly.
fn arc_cotangent(x: f64) -> f64 {
    if x > 0.0 {
        x.recip().atan()
    } else if x < 0.0 {
        x.recip().atan() + std::f64::consts::PI
    } else {
        std::f64::consts::FRAC_PI_2
    }
}

#[cfg(test)]
mod tests {
    use crate::formulas::tests::*;

    fn test_trig_fn(name: &str, input_output_pairs: &[(f64, f64)]) {
        let g = Grid::new();
        for &(input, expected_output) in input_output_pairs {
            println!("Testing that {name}({input}) = {expected_output}");
            crate::util::assert_f64_approx_eq(
                expected_output,
                &eval_to_string(&g, &format!("{name}({input})")),
            );
        }
    }

    use std::f64::consts::{FRAC_1_SQRT_2, PI, SQRT_2};

    #[test]
    fn test_formula_radian_degree_conversion() {
        let g = Grid::new();

        assert_eq!("-4", eval_to_string(&g, "RADIANS(-720) / PI()"));
        assert_eq!("-720", eval_to_string(&g, "DEGREES(-PI() * 4)"));
    }

    #[test]
    fn test_formula_trigonometry() {
        let g = Grid::new();

        let test_cases = &[
            (-2.0 * PI, 0.0),
            (-1.5 * PI, 1.0),
            (-1.0 * PI, 0.0),
            (-0.75 * PI, -FRAC_1_SQRT_2),
            (-0.5 * PI, -1.0),
            (-0.25 * PI, -FRAC_1_SQRT_2),
            (0.0 * PI, 0.0),
            (0.25 * PI, FRAC_1_SQRT_2),
            (0.5 * PI, 1.0),
            (0.75 * PI, FRAC_1_SQRT_2),
            (1.0 * PI, 0.0),
            (1.5 * PI, -1.0),
            (2.0 * PI, 0.0),
        ];
        test_trig_fn("SIN", test_cases);

        let test_cases = &[
            (-2.0 * PI, 1.0),
            (-1.5 * PI, 0.0),
            (-1.0 * PI, -1.0),
            (-0.75 * PI, -FRAC_1_SQRT_2),
            (-0.5 * PI, 0.0),
            (-0.25 * PI, FRAC_1_SQRT_2),
            (0.0 * PI, 1.0),
            (0.25 * PI, FRAC_1_SQRT_2),
            (0.5 * PI, 0.0),
            (0.75 * PI, -FRAC_1_SQRT_2),
            (1.0 * PI, -1.0),
            (1.5 * PI, 0.0),
            (2.0 * PI, 1.0),
        ];
        test_trig_fn("COS", test_cases);

        let test_cases = &[
            (-2.0 * PI, 0.0),
            (-1.0 * PI, 0.0),
            (-0.75 * PI, 1.0),
            (-0.25 * PI, -1.0),
            (0.0 * PI, 0.0),
            (0.25 * PI, 1.0),
            (0.75 * PI, -1.0),
            (1.0 * PI, 0.0),
            (2.0 * PI, 0.0),
        ];
        test_trig_fn("TAN", test_cases);

        let test_cases = &[
            (-1.5 * PI, 1.0),
            (-0.75 * PI, -SQRT_2),
            (-0.5 * PI, -1.0),
            (-0.25 * PI, -SQRT_2),
            (0.25 * PI, SQRT_2),
            (0.5 * PI, 1.0),
            (0.75 * PI, SQRT_2),
            (1.5 * PI, -1.0),
        ];
        test_trig_fn("CSC", test_cases);

        let test_cases = &[
            (-2.0 * PI, 1.0),
            (-1.0 * PI, -1.0),
            (-0.75 * PI, -SQRT_2),
            (-0.25 * PI, SQRT_2),
            (0.0 * PI, 1.0),
            (0.25 * PI, SQRT_2),
            (0.75 * PI, -SQRT_2),
            (1.0 * PI, -1.0),
            (2.0 * PI, 1.0),
        ];
        test_trig_fn("SEC", test_cases);

        let test_cases = &[
            (-1.5 * PI, 0.0),
            (-0.9 * PI, 3.07768),
            (-0.75 * PI, 1.0),
            (-0.5 * PI, 0.0),
            (-0.25 * PI, -1.0),
            (0.25 * PI, 1.0),
            (0.5 * PI, 0.0),
            (0.75 * PI, -1.0),
            (0.9 * PI, -3.07768),
            (1.5 * PI, 0.0),
        ];
        test_trig_fn("COT", test_cases);

        let test_cases = &[
            (-2.0 * PI, -267.74489),
            (-1.5 * PI, -55.6544),
            (-1.0 * PI, -11.54874),
            (-0.75 * PI, -5.22797),
            (-0.5 * PI, -2.3013),
            (-0.25 * PI, -0.86867),
            (0.0 * PI, 0.0),
            (0.25 * PI, 0.86867),
            (0.5 * PI, 2.3013),
            (0.75 * PI, 5.22797),
            (1.0 * PI, 11.54874),
            (1.5 * PI, 55.6544),
            (2.0 * PI, 267.74489),
        ];
        test_trig_fn("SINH", test_cases);

        let test_cases = &[
            (-2.0 * PI, 267.74676),
            (-1.5 * PI, 55.66338),
            (-1.0 * PI, 11.59195),
            (-0.75 * PI, 5.32275),
            (-0.5 * PI, 2.50918),
            (-0.25 * PI, 1.32461),
            (0.0 * PI, 1.0),
            (0.25 * PI, 1.32461),
            (0.5 * PI, 2.50918),
            (0.75 * PI, 5.32275),
            (1.0 * PI, 11.59195),
            (1.5 * PI, 55.66338),
            (2.0 * PI, 267.74676),
        ];
        test_trig_fn("COSH", test_cases);

        let test_cases = &[
            (-2.0 * PI, -0.99999),
            (-1.5 * PI, -0.99984),
            (-1.0 * PI, -0.99627),
            (-0.75 * PI, -0.98219),
            (-0.5 * PI, -0.91715),
            (-0.25 * PI, -0.65579),
            (0.0 * PI, 0.0),
            (0.25 * PI, 0.65579),
            (0.5 * PI, 0.91715),
            (0.75 * PI, 0.98219),
            (1.0 * PI, 0.99627),
            (1.5 * PI, 0.99984),
            (2.0 * PI, 0.99999),
        ];
        test_trig_fn("TANH", test_cases);

        let test_cases = &[
            (-2.0 * PI, -0.00373),
            (-1.5 * PI, -0.01797),
            (-1.0 * PI, -0.08659),
            (-0.75 * PI, -0.19128),
            (-0.5 * PI, -0.43454),
            (-0.25 * PI, -1.15118),
            (0.25 * PI, 1.15118),
            (0.5 * PI, 0.43454),
            (0.75 * PI, 0.19128),
            (1.0 * PI, 0.08659),
            (1.5 * PI, 0.01797),
            (2.0 * PI, 0.00373),
        ];
        test_trig_fn("CSCH", test_cases);

        let test_cases = &[
            (-2.0 * PI, 0.00373),
            (-1.5 * PI, 0.01797),
            (-1.0 * PI, 0.08627),
            (-0.75 * PI, 0.18787),
            (-0.5 * PI, 0.39854),
            (-0.25 * PI, 0.75494),
            (0.0 * PI, 1.0),
            (0.25 * PI, 0.75494),
            (0.5 * PI, 0.39854),
            (0.75 * PI, 0.18787),
            (1.0 * PI, 0.08627),
            (1.5 * PI, 0.01797),
            (2.0 * PI, 0.00373),
        ];
        test_trig_fn("SECH", test_cases);

        let test_cases = &[
            (-2.0 * PI, -1.00001),
            (-1.5 * PI, -1.00016),
            (-1.0 * PI, -1.00374),
            (-0.75 * PI, -1.01813),
            (-0.5 * PI, -1.09033),
            (-0.25 * PI, -1.52487),
            (0.25 * PI, 1.52487),
            (0.5 * PI, 1.09033),
            (0.75 * PI, 1.01813),
            (1.0 * PI, 1.00374),
            (1.5 * PI, 1.00016),
            (2.0 * PI, 1.00001),
        ];
        test_trig_fn("COTH", test_cases);

        assert!(eval_to_string(&g, "ATAN2(2, 1)").starts_with("0.4636"));
    }

    #[test]
    fn test_formula_inverse_trigonometry() {
        let test_cases = &[
            (-1.0, -0.5 * PI),
            (-FRAC_1_SQRT_2, -0.25 * PI),
            (0.0, 0.0 * PI),
            (FRAC_1_SQRT_2, 0.25 * PI),
            (1.0, 0.5 * PI),
        ];
        test_trig_fn("ASIN", test_cases);

        let test_cases = &[
            (1.0, 0.0 * PI),
            (FRAC_1_SQRT_2, 0.25 * PI),
            (0.0, 0.5 * PI),
            (-FRAC_1_SQRT_2, 0.75 * PI),
            (-1.0, 1.0 * PI),
        ];
        test_trig_fn("ACOS", test_cases);

        let test_cases = &[(-1.0, -0.25 * PI), (0.0, 0.0 * PI), (1.0, 0.25 * PI)];
        test_trig_fn("ATAN", test_cases);

        let test_cases = &[
            (-1.0, -0.5 * PI),
            (-SQRT_2, -0.25 * PI),
            (SQRT_2, 0.25 * PI),
            (1.0, 0.5 * PI),
        ];
        test_trig_fn("ACSC", test_cases);

        let test_cases = &[
            (1.0, 0.0 * PI),
            (SQRT_2, 0.25 * PI),
            (-SQRT_2, 0.75 * PI),
            (-1.0, 1.0 * PI),
        ];
        test_trig_fn("ASEC", test_cases);

        let test_cases = &[
            (1.0, 0.25 * PI),
            (0.0, 0.5 * PI),
            (-1.0, 0.75 * PI),
            (-3.07768, 0.9 * PI),
        ];
        test_trig_fn("ACOT", test_cases);

        let test_cases = &[
            (-267.74489, -2.0 * PI),
            (-55.6544, -1.5 * PI),
            (-11.54874, -1.0 * PI),
            (-5.22797, -0.75 * PI),
            (-2.3013, -0.5 * PI),
            (-0.86867, -0.25 * PI),
            (0.0, 0.0 * PI),
            (0.86867, 0.25 * PI),
            (2.3013, 0.5 * PI),
            (5.22797, 0.75 * PI),
            (11.54874, 1.0 * PI),
            (55.6544, 1.5 * PI),
            (267.74489, 2.0 * PI),
        ];
        test_trig_fn("ASINH", test_cases);

        let test_cases = &[
            (1.0, 0.0 * PI),
            (1.32461, 0.25 * PI),
            (2.50918, 0.5 * PI),
            (5.32275, 0.75 * PI),
            (11.59195, 1.0 * PI),
            (55.66338, 1.5 * PI),
            (267.74676, 2.0 * PI),
        ];
        test_trig_fn("ACOSH", test_cases);

        let test_cases = &[
            (-0.99627208, -1.0 * PI),
            (-0.98219338, -0.75 * PI),
            (-0.91715234, -0.5 * PI),
            (-0.6557942, -0.25 * PI),
            (0.0, 0.0 * PI),
            (0.6557942, 0.25 * PI),
            (0.91715234, 0.5 * PI),
            (0.98219338, 0.75 * PI),
            (0.99627208, 1.0 * PI),
        ];
        test_trig_fn("ATANH", test_cases);

        let test_cases = &[
            (-0.0037349, -2.0 * PI),
            (-0.01796803, -1.5 * PI),
            (-0.08658954, -1.0 * PI),
            (-0.19127876, -0.75 * PI),
            (-0.43453721, -0.5 * PI),
            (-1.15118387, -0.25 * PI),
            (1.15118387, 0.25 * PI),
            (0.43453721, 0.5 * PI),
            (0.19127876, 0.75 * PI),
            (0.08658954, 1.0 * PI),
            (0.01796803, 1.5 * PI),
            (0.0037349, 2.0 * PI),
        ];
        test_trig_fn("ACSCH", test_cases);

        let test_cases = &[
            (1.0, 0.0 * PI),
            (0.754939709, 0.25 * PI),
            (0.398536815, 0.5 * PI),
            (0.187872734, 0.75 * PI),
            (0.086266738, 1.0 * PI),
            (0.017965132, 1.5 * PI),
            (0.003734872, 2.0 * PI),
        ];
        test_trig_fn("ASECH", test_cases);

        let test_cases = &[
            (-1.000161412, -1.5 * PI),
            (-1.00374187, -1.0 * PI),
            (-1.01812944, -0.75 * PI),
            (-1.09033141, -0.5 * PI),
            (-1.52486862, -0.25 * PI),
            (1.52486862, 0.25 * PI),
            (1.09033141, 0.5 * PI),
            (1.01812944, 0.75 * PI),
            (1.00374187, 1.0 * PI),
            (1.000161412, 1.5 * PI),
        ];
        test_trig_fn("ACOTH", test_cases);
    }

    #[test]
    fn test_atan2() {
        let g = Grid::new();

        assert_eq!("0", eval_to_string(&g, "ATAN2(1, 0)"));
        assert!(eval_to_string(&g, "ATAN2(0, 1)").starts_with("1.57"));
        assert!(eval_to_string(&g, "ATAN2(1, 2)").starts_with("1.107"));
        assert_eq!(
            RunErrorMsg::DivideByZero,
            eval_to_err(&g, "ATAN2(0, 0)").msg,
        );
    }
}
