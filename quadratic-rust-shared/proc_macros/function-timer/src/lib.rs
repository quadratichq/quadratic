use proc_macro::TokenStream;
use quote::quote;
use syn::{ItemFn, parse_macro_input};

#[proc_macro_attribute]
pub fn function_timer(_attrs: TokenStream, item: TokenStream) -> TokenStream {
    if cfg!(not(feature = "enabled")) {
        return item;
    }

    let input_fn = parse_macro_input!(item as syn::ItemFn);
    let fn_name = &input_fn.sig.ident.to_string();

    let ItemFn {
        attrs,
        vis,
        sig,
        block,
        ..
    } = input_fn;

    let mut print_output = quote! {};
    let should_print = _attrs.to_string().contains("dbgjs");

    if should_print {
        print_output = quote! {
            dbgjs!(format!("Function {} took {} ms", #fn_name, duration.num_milliseconds()));
        };
    }

    let expanded = quote! {
            #(#attrs)*
            #vis #sig {
            let start = chrono::Utc::now();
            let out = #block;
            let end = chrono::Utc::now();
            let duration = end - start;

            // Use microseconds for better precision on fast functions
            crate::FUNCTIONS.lock().unwrap().push((#fn_name.to_string(), duration.num_microseconds().unwrap_or(0)));

            #print_output

            out
        }
    };

    TokenStream::from(expanded)
}

#[cfg(test)]
mod tests {

    #[test]
    fn test_function_timer() {
        let t = trybuild::TestCases::new();
        t.pass("tests/*.rs");
    }
}
