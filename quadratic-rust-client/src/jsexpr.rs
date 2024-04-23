/// Recursively evaluates an expression, mimicking JavaScript syntax. Assumes
/// that `?` can throw an error of type `JsValue`.
#[macro_export]
macro_rules! jsexpr {
    // Recursive base cases
    ($value:ident) => { $value };
    ($lit:literal) => { ::wasm_bindgen::JsValue::from($lit) };

    // Rust referencing and dereferencing
    (& $($rest:tt)*) => { &jsexpr!($($rest)*) };
    (* $($rest:tt)*) => { *jsexpr!($($rest)*) };

    // Parentheses
    (($($inner:tt)*) $($rest:tt)*) => {{
        let inner = jsexpr!($($inner)*)
        jsexpr!(inner $($rest)*)
    }};

    // Await
    ($recv:ident.await $($rest:tt)*) => {{
        let result = ::wasm_bindgen_futures::JsFuture::from(::js_sys::Promise::from($recv)).await?;
        jsexpr!(result $($rest)*)
    }};

    // Dot syntax
    ($recv:ident.$property_name:ident $($rest:tt)*) => {{
        let property_name = ::wasm_bindgen::JsValue::from(stringify!($property_name));
        jsexpr!($recv[property_name] $($rest)*)
    }};

    // Function call
    ($func:ident($($args_tok:tt)*) $($rest:tt)*) => {{
        let func = ::js_sys::Function::from($func);
        let result = jsexpr!(
            @ call_internal (::wasm_bindgen::JsValue::UNDEFINED)
            func($($args_tok)*)
        );
        jsexpr!(result $($rest)*)
    }};

    // Method call
    ($recv:ident[$($method_name_tok:tt)*]($($args_tok:tt)*) $($rest:tt)*) => {{
        let property = jsexpr!($recv[$($method_name_tok)*]);
        let method = js_sys::Function::from(property);
        let result = jsexpr!(
            @ call_internal ($recv)
            method($($args_tok)*)
        );
        jsexpr!(result $($rest)*)
    }};

    // Property access
    ($recv:ident[$($property_name_tok:tt)*] $($rest:tt)*) => {{
        let property_name = jsexpr!($($property_name_tok)*);
        let result = js_sys::Reflect::get(&$recv, &property_name)?;
        jsexpr!(result $($rest)*)
    }};

    // Function call with a specific number of arguments
    (@ call_internal ($recv:expr) $func:ident($arg1:tt $(, $($rest:tt)*)?)) => {{
        let bound_function = $func.bind1(&$recv, &jsexpr!($arg1));
        jsexpr!(@ call_internal ($recv) bound_function($($($rest)*)?))
    }};
    (@ call_internal ($recv:expr) $func:ident()) => {{
        $func.call0(&$recv)?
    }};
}
