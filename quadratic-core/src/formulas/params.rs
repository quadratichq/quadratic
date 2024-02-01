use itertools::Itertools;

/// Formula function parameter description.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub(super) struct Param {
    pub name: &'static str,
    pub kind: ParamKind,
    pub zip_mapped: bool,
}
impl Param {
    /// Returns whether the parameter is required.
    pub(super) fn is_required(&self) -> bool {
        match self.kind {
            ParamKind::Required => true,
            ParamKind::Optional => false,
            ParamKind::Repeating => false,
        }
    }
    /// Returns whether the parameter is optional (not required).
    fn is_optional(&self) -> bool {
        !self.is_required()
    }
    /// Returns a user-friendly string describing the parameter.
    fn usage_string(&self) -> String {
        match self.kind {
            ParamKind::Required => self.name.to_string(),
            ParamKind::Optional => format!("[{}]", self.name),
            ParamKind::Repeating => format!("[{}...]", self.name),
        }
    }
}

/// Kind of parameter: required, optional, or repeating.
#[derive(Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
#[allow(dead_code)] // TODO: remove this. at time of writing, `Optional` isn't used (but will be in the future)
pub(super) enum ParamKind {
    #[default]
    Required,
    Optional,
    Repeating,
}

/// Generates an argument completion snippet for a function, not including the
/// function name.
///
/// In order to return a `&'static str`, this function leaks memory. Only call
/// it at program startup.
pub(super) fn arg_completion_string(args: &[Param]) -> &'static str {
    let mut ret = String::new();
    let mut i = 0;
    let mut depth = 0;
    let mut is_first = true;
    // Assume that all required arguments come before any optional ones.
    for arg in args {
        i += 1;
        if is_first {
            is_first = false;
        } else if arg.is_optional() {
            ret.push_str(&format!("${{{i}:, "));
            i += 1;
            depth += 1;
        } else {
            ret.push_str(", ");
        }
        ret.push_str(&format!("${{{i}:{}}}", arg.usage_string()));
    }
    for _ in 0..depth {
        ret.push('}');
    }

    Box::leak(ret.into_boxed_str())
}

/// Generates a usage string for a function, not including the function name.
///
/// In order to return a `&'static str`, this function leaks memory. Only call
/// it at program startup.
pub(super) fn usage_string(args: &[Param]) -> &'static str {
    let ret = args.iter().map(|arg| arg.usage_string()).join(", ");
    Box::leak(ret.into_boxed_str())
}
