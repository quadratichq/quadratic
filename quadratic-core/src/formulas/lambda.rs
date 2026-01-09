//! Lambda function support for formulas.
//!
//! This module provides the `LambdaValue` type which represents a user-defined
//! function created with the LAMBDA formula function.

use serde::{Deserialize, Serialize};

use super::ast::AstNode;

/// A lambda function value that can be called with arguments.
///
/// Lambda functions are created using the LAMBDA formula function:
/// `=LAMBDA(param1, param2, ..., body)`
///
/// They can be called immediately: `=LAMBDA(x, x+1)(5)` → 6
/// Or passed to higher-order functions like MAP, REDUCE, etc.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LambdaValue {
    /// Parameter names for the lambda function.
    pub params: Vec<String>,
    /// The body expression (unevaluated AST).
    pub body: Box<AstNode>,
}

impl LambdaValue {
    /// Creates a new lambda value.
    pub fn new(params: Vec<String>, body: AstNode) -> Self {
        Self {
            params,
            body: Box::new(body),
        }
    }

    /// Returns the number of parameters this lambda accepts.
    pub fn param_count(&self) -> usize {
        self.params.len()
    }
}

impl PartialEq for LambdaValue {
    fn eq(&self, _other: &Self) -> bool {
        // Two lambdas are never considered equal, even if they have the same
        // parameters and body. This is consistent with how most languages
        // treat function equality.
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Span;

    #[test]
    fn test_lambda_value_creation() {
        use crate::formulas::ast::AstNodeContents;

        let body = AstNode {
            span: Span { start: 0, end: 1 },
            inner: AstNodeContents::Number(42.0),
        };

        let lambda = LambdaValue::new(vec!["x".to_string(), "y".to_string()], body);

        assert_eq!(lambda.param_count(), 2);
        assert_eq!(lambda.params, vec!["x", "y"]);
    }

    #[test]
    fn test_lambda_equality() {
        use crate::formulas::ast::AstNodeContents;

        let body = AstNode {
            span: Span { start: 0, end: 1 },
            inner: AstNodeContents::Number(42.0),
        };

        let lambda1 = LambdaValue::new(vec!["x".to_string()], body.clone());
        let lambda2 = LambdaValue::new(vec!["x".to_string()], body);

        // Lambdas are never equal
        assert_ne!(lambda1, lambda2);
    }
}

