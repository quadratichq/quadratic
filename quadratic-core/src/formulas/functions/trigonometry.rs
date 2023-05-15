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
                $short_name:literal, $full_name:literal, $f:expr, $inv_f:expr $(, $inv_range:literal)?
            );+ $(;)?
        ) => {
            vec![
                $(
                    {
                        let f: fn(f64) -> f64 = $f;
                        FormulaFunction {
                            name: $short_name,
                            arg_completion: "${1:radians}",
                            usages: &["radians"],
                            examples: &[concat!($short_name, "(PI() * 2/3)")],
                            doc: concat!(
                                "Returns the [", $full_name, "](", $url, ") ",
                                "of an angle in radians.",
                            ),
                            eval: util::array_mapped(move |[radians]| Ok(Value::Number(f(radians.to_number()?)))),
                        }
                    },
                    {
                        let inv_f: fn(f64) -> f64 = $inv_f;
                        FormulaFunction {
                            name: concat!("A", $short_name),
                            arg_completion: "${1:number}",
                            usages: &["number"],
                            examples: &[concat!($short_name, "(A1)")],
                            doc: concat!(
                                "Returns the [inverse ", $full_name, "](", $inv_url, ") ",
                                "of a number, in radians", $(", ranging from ", $inv_range,)?
                                ".",
                            ),
                            eval: util::array_mapped(move |[number]| Ok(Value::Number(inv_f(number.to_number()?)))),
                        }
                    },
                )+
            ]
        };
    }

    let mut all_trig_functions = vec![
        FormulaFunction {
            name: "DEGREES",
            arg_completion: "${1:radians}",
            usages: &["radians"],
            examples: &["DEGREES(PI() / 2)"],
            doc: "Converts radians to degrees",
            eval: util::array_mapped(|[radians]| {
                Ok(Value::Number(radians.to_number()?.to_degrees()))
            }),
        },
        FormulaFunction {
            name: "RADIANS",
            arg_completion: "${1:degrees}",
            usages: &["degrees"],
            examples: &["RADIANS(90)"],
            doc: "Converts degrees to radians",
            eval: util::array_mapped(|[degrees]| {
                Ok(Value::Number(degrees.to_number()?.to_radians()))
            }),
        },
    ];

    all_trig_functions.extend(trig_functions_and_inverses![
        url: "https://en.wikipedia.org/wiki/Trigonometric_functions";
        inverse_url: "https://en.wikipedia.org/wiki/Inverse_trigonometric_functions";
        //                              function,             inverse function, range;
        "SIN",  "sine",                 |x| x.sin(),          |x| x.asin(), "-π/2 to π/2";
        "COS",  "cosine",               |x| x.cos(),          |x| x.acos(), "0 to π";
        "TAN",  "tangent",              |x| x.tan(),          |x| x.atan(), "-π/2 to π/2";
        "CSC",  "cosecant",             |x| x.sin().recip(),  |x| x.recip().asin(), "-π/2 to π/2";
        "SEC",  "secant",               |x| x.cos().recip(),  |x| x.recip().acos(), "0 to π";
        "COT",  "cotangent",            |x| x.tan().recip(),  |x| x.recip().atan(), "-π/2 to π/2";
    ]);

    all_trig_functions.extend(trig_functions_and_inverses![
        url: "https://en.wikipedia.org/wiki/Hyperbolic_functions";
        inverse_url: "https://en.wikipedia.org/wiki/Inverse_hyperbolic_functions";
        //                              function,             inverse function;
        "SINH", "hyperbolic sine",      |x| x.sinh(),         |x| x.asinh();
        "COSH", "hyperbolic cosine",    |x| x.cosh(),         |x| x.acosh();
        "TANH", "hyperbolic tangent",   |x| x.tanh(),         |x| x.atanh();
        "CSCH", "hyperbolic cosecant",  |x| x.sinh().recip(), |x| x.recip().asinh();
        "SECH", "hyperbolic secant",    |x| x.cosh().recip(), |x| x.recip().acosh();
        "COTH", "hyperbolic cotangent", |x| x.tanh().recip(), |x| x.recip().atanh();
    ]);

    let index_of_atan = 5;
    all_trig_functions.insert(
        index_of_atan + 1,
        FormulaFunction {
            name: "ATAN2",
            arg_completion: "{$1:x}, {$2:y}",
            usages: &["x, y"],
            examples: &["ATAN2(2, 1)"],
            doc: "Returns the counterclockwise angle, in radians, from the X axis to the \
                  point `(x, y)`. Note that the argument order is reversed compared to \
                  the [typical `atan2()` function](https://en.wikipedia.org/wiki/Atan2).",
            eval: util::array_mapped(|[x, y]| {
                Ok(Value::Number(f64::atan2(y.to_number()?, x.to_number()?)))
            }),
        },
    );

    all_trig_functions
}
