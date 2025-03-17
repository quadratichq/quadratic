/// Parses the first matching syntax rule using `try_parse()` or returns an
/// error listing all of them if none match.
macro_rules! parse_one_of {
    ( $p:expr_2021, [ $( @ $varname:ident, )* $first_rule:expr_2021 $(, $rule:expr_2021 )* $(,)? ] $(,)? ) => {
        {
            let this_var_is_unique = $first_rule;
            parse_one_of!(
                $p,
                [
                    $( @ $varname, )*
                    @ this_var_is_unique,
                    $( $rule, )*
                ],
            )
        }
    };
    ( $p:expr_2021, [ $( @ $varname:ident, )+ ], ) => {
        None
            $( .or_else(|| $p.try_parse(&$varname)) )+
            .unwrap_or_else(|| $p.expected(
                crate::util::join_with_conjunction("or", &[
                    $( $varname.to_string(), )+
                ])
            ))
    };
}
