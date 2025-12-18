//! Statistical distribution functions.

use statrs::distribution::{
    Beta, Binomial, ChiSquared, ContinuousCDF, DiscreteCDF, Exp, FisherSnedecor, Gamma, Normal,
    Poisson, StudentsT, Weibull,
};
use statrs::function::erf;

use super::*;

pub fn get_functions() -> Vec<FormulaFunction> {
    vec![
        // ===== NORMAL DISTRIBUTION =====
        formula_fn!(
            /// Returns the normal distribution for the specified mean and standard deviation.
            ///
            /// If cumulative is TRUE, returns the cumulative distribution function;
            /// if FALSE, returns the probability density function.
            #[name = "NORM.DIST"]
            #[examples("NORM.DIST(1, 0, 1, TRUE)", "NORM.DIST(0, 0, 1, FALSE)")]
            #[zip_map]
            fn NORM_DIST(
                span: Span,
                [x]: f64,
                [mean]: f64,
                [standard_dev]: f64,
                [cumulative]: bool,
            ) {
                if standard_dev <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = Normal::new(mean, standard_dev)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                if cumulative {
                    dist.cdf(x)
                } else {
                    use statrs::distribution::Continuous;
                    dist.pdf(x)
                }
            }
        ),
        formula_fn!(
            /// Returns the inverse of the normal cumulative distribution.
            #[name = "NORM.INV"]
            #[examples("NORM.INV(0.5, 0, 1)", "NORM.INV(0.975, 100, 15)")]
            #[zip_map]
            fn NORM_INV(span: Span, [probability]: f64, [mean]: f64, [standard_dev]: f64) {
                if probability <= 0.0 || probability >= 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if standard_dev <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = Normal::new(mean, standard_dev)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                dist.inverse_cdf(probability)
            }
        ),
        formula_fn!(
            /// Returns the standard normal distribution (mean=0, standard_dev=1).
            #[name = "NORM.S.DIST"]
            #[examples("NORM.S.DIST(1, TRUE)", "NORM.S.DIST(0, FALSE)")]
            #[zip_map]
            fn NORM_S_DIST(span: Span, [z]: f64, [cumulative]: bool) {
                let dist = Normal::new(0.0, 1.0).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                if cumulative {
                    dist.cdf(z)
                } else {
                    use statrs::distribution::Continuous;
                    dist.pdf(z)
                }
            }
        ),
        formula_fn!(
            /// Returns the inverse of the standard normal cumulative distribution.
            #[name = "NORM.S.INV"]
            #[examples("NORM.S.INV(0.5)", "NORM.S.INV(0.975)")]
            #[zip_map]
            fn NORM_S_INV(span: Span, [probability]: f64) {
                if probability <= 0.0 || probability >= 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = Normal::new(0.0, 1.0).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                dist.inverse_cdf(probability)
            }
        ),
        // Compatibility aliases
        formula_fn!(
            /// Returns the normal distribution (compatibility function).
            /// Use NORM.DIST for new formulas.
            #[examples("NORMDIST(1, 0, 1, TRUE)")]
            #[zip_map]
            fn NORMDIST(
                span: Span,
                [x]: f64,
                [mean]: f64,
                [standard_dev]: f64,
                [cumulative]: bool,
            ) {
                if standard_dev <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = Normal::new(mean, standard_dev)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                if cumulative {
                    dist.cdf(x)
                } else {
                    use statrs::distribution::Continuous;
                    dist.pdf(x)
                }
            }
        ),
        formula_fn!(
            /// Returns the inverse of the normal cumulative distribution (compatibility function).
            #[examples("NORMINV(0.5, 0, 1)")]
            #[zip_map]
            fn NORMINV(span: Span, [probability]: f64, [mean]: f64, [standard_dev]: f64) {
                if probability <= 0.0 || probability >= 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if standard_dev <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = Normal::new(mean, standard_dev)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                dist.inverse_cdf(probability)
            }
        ),
        formula_fn!(
            /// Returns the standard normal cumulative distribution (compatibility function).
            #[examples("NORMSDIST(1)")]
            #[zip_map]
            fn NORMSDIST(span: Span, [z]: f64) {
                let dist = Normal::new(0.0, 1.0).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                dist.cdf(z)
            }
        ),
        formula_fn!(
            /// Returns the inverse of the standard normal cumulative distribution (compatibility function).
            #[examples("NORMSINV(0.5)")]
            #[zip_map]
            fn NORMSINV(span: Span, [probability]: f64) {
                if probability <= 0.0 || probability >= 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = Normal::new(0.0, 1.0).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                dist.inverse_cdf(probability)
            }
        ),
        // ===== STUDENT'S T DISTRIBUTION =====
        formula_fn!(
            /// Returns the Student's t-distribution.
            #[name = "T.DIST"]
            #[examples("T.DIST(1.5, 10, TRUE)", "T.DIST(0, 5, FALSE)")]
            #[zip_map]
            fn T_DIST(span: Span, [x]: f64, [degrees_freedom]: f64, [cumulative]: bool) {
                if degrees_freedom < 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = StudentsT::new(0.0, 1.0, degrees_freedom)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                if cumulative {
                    dist.cdf(x)
                } else {
                    use statrs::distribution::Continuous;
                    dist.pdf(x)
                }
            }
        ),
        formula_fn!(
            /// Returns the two-tailed Student's t-distribution.
            #[name = "T.DIST.2T"]
            #[examples("T.DIST.2T(2, 10)")]
            #[zip_map]
            fn T_DIST_2T(span: Span, [x]: f64, [degrees_freedom]: f64) {
                if x < 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if degrees_freedom < 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = StudentsT::new(0.0, 1.0, degrees_freedom)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                2.0 * (1.0 - dist.cdf(x.abs()))
            }
        ),
        formula_fn!(
            /// Returns the right-tailed Student's t-distribution.
            #[name = "T.DIST.RT"]
            #[examples("T.DIST.RT(1.5, 10)")]
            #[zip_map]
            fn T_DIST_RT(span: Span, [x]: f64, [degrees_freedom]: f64) {
                if degrees_freedom < 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = StudentsT::new(0.0, 1.0, degrees_freedom)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                1.0 - dist.cdf(x)
            }
        ),
        formula_fn!(
            /// Returns the inverse of the left-tailed Student's t-distribution.
            #[name = "T.INV"]
            #[examples("T.INV(0.9, 10)")]
            #[zip_map]
            fn T_INV(span: Span, [probability]: f64, [degrees_freedom]: f64) {
                if probability <= 0.0 || probability >= 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if degrees_freedom < 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = StudentsT::new(0.0, 1.0, degrees_freedom)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                dist.inverse_cdf(probability)
            }
        ),
        formula_fn!(
            /// Returns the inverse of the two-tailed Student's t-distribution.
            #[name = "T.INV.2T"]
            #[examples("T.INV.2T(0.05, 10)")]
            #[zip_map]
            fn T_INV_2T(span: Span, [probability]: f64, [degrees_freedom]: f64) {
                if probability <= 0.0 || probability >= 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if degrees_freedom < 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = StudentsT::new(0.0, 1.0, degrees_freedom)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                dist.inverse_cdf(1.0 - probability / 2.0)
            }
        ),
        formula_fn!(
            /// Returns the Student's t-distribution (compatibility function).
            #[examples("TDIST(2, 10, 2)")]
            #[zip_map]
            fn TDIST(span: Span, [x]: f64, [degrees_freedom]: f64, [tails]: f64) {
                if x < 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if degrees_freedom < 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let tails = tails as i64;
                if tails != 1 && tails != 2 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = StudentsT::new(0.0, 1.0, degrees_freedom)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                if tails == 1 {
                    1.0 - dist.cdf(x)
                } else {
                    2.0 * (1.0 - dist.cdf(x.abs()))
                }
            }
        ),
        formula_fn!(
            /// Returns the inverse of the Student's t-distribution (compatibility function).
            #[examples("TINV(0.05, 10)")]
            #[zip_map]
            fn TINV(span: Span, [probability]: f64, [degrees_freedom]: f64) {
                if probability <= 0.0 || probability >= 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if degrees_freedom < 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = StudentsT::new(0.0, 1.0, degrees_freedom)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                dist.inverse_cdf(1.0 - probability / 2.0)
            }
        ),
        // ===== CHI-SQUARED DISTRIBUTION =====
        formula_fn!(
            /// Returns the chi-squared distribution.
            #[name = "CHISQ.DIST"]
            #[examples("CHISQ.DIST(3, 5, TRUE)", "CHISQ.DIST(2, 4, FALSE)")]
            #[zip_map]
            fn CHISQ_DIST(span: Span, [x]: f64, [degrees_freedom]: f64, [cumulative]: bool) {
                if x < 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if degrees_freedom < 1.0 || degrees_freedom > 1e10 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = ChiSquared::new(degrees_freedom)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                if cumulative {
                    dist.cdf(x)
                } else {
                    use statrs::distribution::Continuous;
                    dist.pdf(x)
                }
            }
        ),
        formula_fn!(
            /// Returns the right-tailed probability of the chi-squared distribution.
            #[name = "CHISQ.DIST.RT"]
            #[examples("CHISQ.DIST.RT(3, 5)")]
            #[zip_map]
            fn CHISQ_DIST_RT(span: Span, [x]: f64, [degrees_freedom]: f64) {
                if x < 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if degrees_freedom < 1.0 || degrees_freedom > 1e10 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = ChiSquared::new(degrees_freedom)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                1.0 - dist.cdf(x)
            }
        ),
        formula_fn!(
            /// Returns the inverse of the left-tailed chi-squared distribution.
            #[name = "CHISQ.INV"]
            #[examples("CHISQ.INV(0.9, 5)")]
            #[zip_map]
            fn CHISQ_INV(span: Span, [probability]: f64, [degrees_freedom]: f64) {
                if probability < 0.0 || probability >= 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if degrees_freedom < 1.0 || degrees_freedom > 1e10 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = ChiSquared::new(degrees_freedom)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                dist.inverse_cdf(probability)
            }
        ),
        formula_fn!(
            /// Returns the inverse of the right-tailed chi-squared distribution.
            #[name = "CHISQ.INV.RT"]
            #[examples("CHISQ.INV.RT(0.1, 5)")]
            #[zip_map]
            fn CHISQ_INV_RT(span: Span, [probability]: f64, [degrees_freedom]: f64) {
                if probability <= 0.0 || probability > 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if degrees_freedom < 1.0 || degrees_freedom > 1e10 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = ChiSquared::new(degrees_freedom)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                dist.inverse_cdf(1.0 - probability)
            }
        ),
        formula_fn!(
            /// Returns the chi-squared distribution (compatibility function).
            #[examples("CHIDIST(3, 5)")]
            #[zip_map]
            fn CHIDIST(span: Span, [x]: f64, [degrees_freedom]: f64) {
                if x < 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if degrees_freedom < 1.0 || degrees_freedom > 1e10 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = ChiSquared::new(degrees_freedom)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                1.0 - dist.cdf(x)
            }
        ),
        formula_fn!(
            /// Returns the inverse of the chi-squared distribution (compatibility function).
            #[examples("CHIINV(0.1, 5)")]
            #[zip_map]
            fn CHIINV(span: Span, [probability]: f64, [degrees_freedom]: f64) {
                if probability <= 0.0 || probability > 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if degrees_freedom < 1.0 || degrees_freedom > 1e10 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = ChiSquared::new(degrees_freedom)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                dist.inverse_cdf(1.0 - probability)
            }
        ),
        // ===== F DISTRIBUTION =====
        formula_fn!(
            /// Returns the F probability distribution.
            #[name = "F.DIST"]
            #[examples("F.DIST(2, 5, 10, TRUE)", "F.DIST(1, 3, 6, FALSE)")]
            #[zip_map]
            fn F_DIST(
                span: Span,
                [x]: f64,
                [degrees_freedom1]: f64,
                [degrees_freedom2]: f64,
                [cumulative]: bool,
            ) {
                if x < 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if degrees_freedom1 < 1.0 || degrees_freedom2 < 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = FisherSnedecor::new(degrees_freedom1, degrees_freedom2)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                if cumulative {
                    dist.cdf(x)
                } else {
                    use statrs::distribution::Continuous;
                    dist.pdf(x)
                }
            }
        ),
        formula_fn!(
            /// Returns the right-tailed F probability distribution.
            #[name = "F.DIST.RT"]
            #[examples("F.DIST.RT(2, 5, 10)")]
            #[zip_map]
            fn F_DIST_RT(span: Span, [x]: f64, [degrees_freedom1]: f64, [degrees_freedom2]: f64) {
                if x < 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if degrees_freedom1 < 1.0 || degrees_freedom2 < 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = FisherSnedecor::new(degrees_freedom1, degrees_freedom2)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                1.0 - dist.cdf(x)
            }
        ),
        formula_fn!(
            /// Returns the inverse of the left-tailed F probability distribution.
            #[name = "F.INV"]
            #[examples("F.INV(0.9, 5, 10)")]
            #[zip_map]
            fn F_INV(
                span: Span,
                [probability]: f64,
                [degrees_freedom1]: f64,
                [degrees_freedom2]: f64,
            ) {
                if probability < 0.0 || probability >= 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if degrees_freedom1 < 1.0 || degrees_freedom2 < 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = FisherSnedecor::new(degrees_freedom1, degrees_freedom2)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                dist.inverse_cdf(probability)
            }
        ),
        formula_fn!(
            /// Returns the inverse of the right-tailed F probability distribution.
            #[name = "F.INV.RT"]
            #[examples("F.INV.RT(0.1, 5, 10)")]
            #[zip_map]
            fn F_INV_RT(
                span: Span,
                [probability]: f64,
                [degrees_freedom1]: f64,
                [degrees_freedom2]: f64,
            ) {
                if probability <= 0.0 || probability > 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if degrees_freedom1 < 1.0 || degrees_freedom2 < 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = FisherSnedecor::new(degrees_freedom1, degrees_freedom2)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                dist.inverse_cdf(1.0 - probability)
            }
        ),
        formula_fn!(
            /// Returns the F probability distribution (compatibility function).
            #[examples("FDIST(2, 5, 10)")]
            #[zip_map]
            fn FDIST(span: Span, [x]: f64, [degrees_freedom1]: f64, [degrees_freedom2]: f64) {
                if x < 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if degrees_freedom1 < 1.0 || degrees_freedom2 < 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = FisherSnedecor::new(degrees_freedom1, degrees_freedom2)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                1.0 - dist.cdf(x)
            }
        ),
        formula_fn!(
            /// Returns the inverse of the F probability distribution (compatibility function).
            #[examples("FINV(0.1, 5, 10)")]
            #[zip_map]
            fn FINV(
                span: Span,
                [probability]: f64,
                [degrees_freedom1]: f64,
                [degrees_freedom2]: f64,
            ) {
                if probability <= 0.0 || probability > 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if degrees_freedom1 < 1.0 || degrees_freedom2 < 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = FisherSnedecor::new(degrees_freedom1, degrees_freedom2)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                dist.inverse_cdf(1.0 - probability)
            }
        ),
        // ===== BINOMIAL DISTRIBUTION =====
        formula_fn!(
            /// Returns the individual term binomial distribution probability.
            #[name = "BINOM.DIST"]
            #[examples("BINOM.DIST(3, 10, 0.5, FALSE)", "BINOM.DIST(3, 10, 0.5, TRUE)")]
            #[zip_map]
            fn BINOM_DIST(
                span: Span,
                [number_s]: f64,
                [trials]: f64,
                [probability_s]: f64,
                [cumulative]: bool,
            ) {
                let number_s = number_s.floor() as i64;
                let trials = trials.floor() as u64;
                if number_s < 0 || (number_s as u64) > trials {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if probability_s < 0.0 || probability_s > 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = Binomial::new(probability_s, trials)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                if cumulative {
                    dist.cdf(number_s as u64)
                } else {
                    use statrs::distribution::Discrete;
                    dist.pmf(number_s as u64)
                }
            }
        ),
        formula_fn!(
            /// Returns the inverse of the binomial distribution.
            #[name = "BINOM.INV"]
            #[examples("BINOM.INV(10, 0.5, 0.5)")]
            #[zip_map]
            fn BINOM_INV(span: Span, [trials]: f64, [probability_s]: f64, [alpha]: f64) {
                let trials = trials.floor() as u64;
                if probability_s < 0.0 || probability_s > 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if alpha < 0.0 || alpha > 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = Binomial::new(probability_s, trials)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                dist.inverse_cdf(alpha) as f64
            }
        ),
        formula_fn!(
            /// Returns the binomial distribution probability (compatibility function).
            #[examples("BINOMDIST(3, 10, 0.5, FALSE)")]
            #[zip_map]
            fn BINOMDIST(
                span: Span,
                [number_s]: f64,
                [trials]: f64,
                [probability_s]: f64,
                [cumulative]: bool,
            ) {
                let number_s = number_s.floor() as i64;
                let trials = trials.floor() as u64;
                if number_s < 0 || (number_s as u64) > trials {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if probability_s < 0.0 || probability_s > 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = Binomial::new(probability_s, trials)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                if cumulative {
                    dist.cdf(number_s as u64)
                } else {
                    use statrs::distribution::Discrete;
                    dist.pmf(number_s as u64)
                }
            }
        ),
        formula_fn!(
            /// Returns the probability of a trial result using a binomial distribution.
            #[name = "BINOM.DIST.RANGE"]
            #[examples("BINOM.DIST.RANGE(10, 0.5, 3)", "BINOM.DIST.RANGE(10, 0.5, 3, 6)")]
            #[zip_map]
            fn BINOM_DIST_RANGE(
                span: Span,
                [trials]: f64,
                [probability_s]: f64,
                [number_s]: f64,
                [number_s2]: (Option<f64>),
            ) {
                let trials = trials.floor() as u64;
                let number_s = number_s.floor() as u64;
                let number_s2 = number_s2.map(|n| n.floor() as u64).unwrap_or(number_s);
                if number_s > trials || number_s2 > trials || number_s > number_s2 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if probability_s < 0.0 || probability_s > 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = Binomial::new(probability_s, trials)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                use statrs::distribution::Discrete;
                let mut sum = 0.0;
                for k in number_s..=number_s2 {
                    sum += dist.pmf(k);
                }
                sum
            }
        ),
        formula_fn!(
            /// Returns the smallest value for which the cumulative binomial distribution is >= criterion.
            #[examples("CRITBINOM(10, 0.5, 0.5)")]
            #[zip_map]
            fn CRITBINOM(span: Span, [trials]: f64, [probability_s]: f64, [alpha]: f64) {
                let trials = trials.floor() as u64;
                if probability_s < 0.0 || probability_s > 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if alpha < 0.0 || alpha > 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = Binomial::new(probability_s, trials)
                    .map_err(|_| RunErrorMsg::Num.with_span(span))?;
                dist.inverse_cdf(alpha) as f64
            }
        ),
        // ===== POISSON DISTRIBUTION =====
        formula_fn!(
            /// Returns the Poisson distribution.
            #[name = "POISSON.DIST"]
            #[examples("POISSON.DIST(3, 5, TRUE)", "POISSON.DIST(3, 5, FALSE)")]
            #[zip_map]
            fn POISSON_DIST(span: Span, [x]: f64, [mean]: f64, [cumulative]: bool) {
                let x = x.floor() as u64;
                if mean < 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = Poisson::new(mean).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                if cumulative {
                    dist.cdf(x)
                } else {
                    use statrs::distribution::Discrete;
                    dist.pmf(x)
                }
            }
        ),
        formula_fn!(
            /// Returns the Poisson distribution (compatibility function).
            #[examples("POISSON(3, 5, TRUE)")]
            #[zip_map]
            fn POISSON(span: Span, [x]: f64, [mean]: f64, [cumulative]: bool) {
                let x = x.floor() as u64;
                if mean < 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = Poisson::new(mean).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                if cumulative {
                    dist.cdf(x)
                } else {
                    use statrs::distribution::Discrete;
                    dist.pmf(x)
                }
            }
        ),
        // ===== EXPONENTIAL DISTRIBUTION =====
        formula_fn!(
            /// Returns the exponential distribution.
            #[name = "EXPON.DIST"]
            #[examples("EXPON.DIST(1, 2, TRUE)", "EXPON.DIST(0.5, 1, FALSE)")]
            #[zip_map]
            fn EXPON_DIST(span: Span, [x]: f64, [lambda]: f64, [cumulative]: bool) {
                if x < 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if lambda <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = Exp::new(lambda).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                if cumulative {
                    dist.cdf(x)
                } else {
                    use statrs::distribution::Continuous;
                    dist.pdf(x)
                }
            }
        ),
        formula_fn!(
            /// Returns the exponential distribution (compatibility function).
            #[examples("EXPONDIST(1, 2, TRUE)")]
            #[zip_map]
            fn EXPONDIST(span: Span, [x]: f64, [lambda]: f64, [cumulative]: bool) {
                if x < 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if lambda <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = Exp::new(lambda).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                if cumulative {
                    dist.cdf(x)
                } else {
                    use statrs::distribution::Continuous;
                    dist.pdf(x)
                }
            }
        ),
        // ===== GAMMA DISTRIBUTION =====
        formula_fn!(
            /// Returns the gamma distribution.
            #[name = "GAMMA.DIST"]
            #[examples("GAMMA.DIST(2, 3, 2, TRUE)", "GAMMA.DIST(1, 2, 1, FALSE)")]
            #[zip_map]
            fn GAMMA_DIST(span: Span, [x]: f64, [alpha]: f64, [beta]: f64, [cumulative]: bool) {
                if x < 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if alpha <= 0.0 || beta <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist =
                    Gamma::new(alpha, 1.0 / beta).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                if cumulative {
                    dist.cdf(x)
                } else {
                    use statrs::distribution::Continuous;
                    dist.pdf(x)
                }
            }
        ),
        formula_fn!(
            /// Returns the inverse of the gamma cumulative distribution.
            #[name = "GAMMA.INV"]
            #[examples("GAMMA.INV(0.5, 3, 2)")]
            #[zip_map]
            fn GAMMA_INV(span: Span, [probability]: f64, [alpha]: f64, [beta]: f64) {
                if probability < 0.0 || probability >= 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if alpha <= 0.0 || beta <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist =
                    Gamma::new(alpha, 1.0 / beta).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                dist.inverse_cdf(probability)
            }
        ),
        formula_fn!(
            /// Returns the gamma distribution (compatibility function).
            #[examples("GAMMADIST(2, 3, 2, TRUE)")]
            #[zip_map]
            fn GAMMADIST(span: Span, [x]: f64, [alpha]: f64, [beta]: f64, [cumulative]: bool) {
                if x < 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if alpha <= 0.0 || beta <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist =
                    Gamma::new(alpha, 1.0 / beta).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                if cumulative {
                    dist.cdf(x)
                } else {
                    use statrs::distribution::Continuous;
                    dist.pdf(x)
                }
            }
        ),
        formula_fn!(
            /// Returns the inverse of the gamma cumulative distribution (compatibility function).
            #[examples("GAMMAINV(0.5, 3, 2)")]
            #[zip_map]
            fn GAMMAINV(span: Span, [probability]: f64, [alpha]: f64, [beta]: f64) {
                if probability < 0.0 || probability >= 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if alpha <= 0.0 || beta <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist =
                    Gamma::new(alpha, 1.0 / beta).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                dist.inverse_cdf(probability)
            }
        ),
        formula_fn!(
            /// Returns the natural logarithm of the gamma function.
            #[examples("GAMMALN(5)", "GAMMALN(1.5)")]
            #[zip_map]
            fn GAMMALN(span: Span, [x]: f64) {
                if x <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                statrs::function::gamma::ln_gamma(x)
            }
        ),
        formula_fn!(
            /// Returns the natural logarithm of the gamma function.
            /// Equivalent to GAMMALN.
            #[name = "GAMMALN.PRECISE"]
            #[examples("GAMMALN.PRECISE(5)")]
            #[zip_map]
            fn GAMMALN_PRECISE(span: Span, [x]: f64) {
                if x <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                statrs::function::gamma::ln_gamma(x)
            }
        ),
        formula_fn!(
            /// Returns the gamma function value.
            #[examples("GAMMA(5)", "GAMMA(0.5)")]
            #[zip_map]
            fn GAMMA(span: Span, [x]: f64) {
                if x <= 0.0 && x == x.floor() {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                statrs::function::gamma::gamma(x)
            }
        ),
        // ===== BETA DISTRIBUTION =====
        formula_fn!(
            /// Returns the beta cumulative distribution function.
            #[name = "BETA.DIST"]
            #[examples(
                "BETA.DIST(0.5, 2, 3, TRUE)",
                "BETA.DIST(0.25, 2, 3, FALSE)",
                "BETA.DIST(2, 2, 3, TRUE, 0, 4)"
            )]
            #[zip_map]
            fn BETA_DIST(
                span: Span,
                [x]: f64,
                [alpha]: f64,
                [beta]: f64,
                [cumulative]: bool,
                [a]: (Option<f64>),
                [b]: (Option<f64>),
            ) {
                let a = a.unwrap_or(0.0);
                let b = b.unwrap_or(1.0);
                if alpha <= 0.0 || beta <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if x < a || x > b || a >= b {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                // Scale x to [0, 1]
                let scaled_x = (x - a) / (b - a);
                let dist = Beta::new(alpha, beta).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                if cumulative {
                    dist.cdf(scaled_x)
                } else {
                    use statrs::distribution::Continuous;
                    dist.pdf(scaled_x) / (b - a)
                }
            }
        ),
        formula_fn!(
            /// Returns the inverse of the beta cumulative distribution function.
            #[name = "BETA.INV"]
            #[examples("BETA.INV(0.5, 2, 3)", "BETA.INV(0.5, 2, 3, 0, 10)")]
            #[zip_map]
            fn BETA_INV(
                span: Span,
                [probability]: f64,
                [alpha]: f64,
                [beta]: f64,
                [a]: (Option<f64>),
                [b]: (Option<f64>),
            ) {
                let a = a.unwrap_or(0.0);
                let b = b.unwrap_or(1.0);
                if probability <= 0.0 || probability >= 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if alpha <= 0.0 || beta <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if a >= b {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = Beta::new(alpha, beta).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                let result = dist.inverse_cdf(probability);
                // Scale back to [a, b]
                a + result * (b - a)
            }
        ),
        formula_fn!(
            /// Returns the beta distribution (compatibility function).
            #[examples("BETADIST(0.5, 2, 3)")]
            #[zip_map]
            fn BETADIST(
                span: Span,
                [x]: f64,
                [alpha]: f64,
                [beta]: f64,
                [a]: (Option<f64>),
                [b]: (Option<f64>),
            ) {
                let a = a.unwrap_or(0.0);
                let b = b.unwrap_or(1.0);
                if alpha <= 0.0 || beta <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if x < a || x > b || a >= b {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let scaled_x = (x - a) / (b - a);
                let dist = Beta::new(alpha, beta).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                dist.cdf(scaled_x)
            }
        ),
        formula_fn!(
            /// Returns the inverse of the beta cumulative distribution (compatibility function).
            #[examples("BETAINV(0.5, 2, 3)")]
            #[zip_map]
            fn BETAINV(
                span: Span,
                [probability]: f64,
                [alpha]: f64,
                [beta]: f64,
                [a]: (Option<f64>),
                [b]: (Option<f64>),
            ) {
                let a = a.unwrap_or(0.0);
                let b = b.unwrap_or(1.0);
                if probability <= 0.0 || probability >= 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if alpha <= 0.0 || beta <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if a >= b {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist = Beta::new(alpha, beta).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                let result = dist.inverse_cdf(probability);
                a + result * (b - a)
            }
        ),
        // ===== WEIBULL DISTRIBUTION =====
        formula_fn!(
            /// Returns the Weibull distribution.
            #[name = "WEIBULL.DIST"]
            #[examples("WEIBULL.DIST(1, 2, 3, TRUE)", "WEIBULL.DIST(0.5, 1, 2, FALSE)")]
            #[zip_map]
            fn WEIBULL_DIST(span: Span, [x]: f64, [alpha]: f64, [beta]: f64, [cumulative]: bool) {
                if x < 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if alpha <= 0.0 || beta <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist =
                    Weibull::new(alpha, beta).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                if cumulative {
                    dist.cdf(x)
                } else {
                    use statrs::distribution::Continuous;
                    dist.pdf(x)
                }
            }
        ),
        formula_fn!(
            /// Returns the Weibull distribution (compatibility function).
            #[examples("WEIBULL(1, 2, 3, TRUE)")]
            #[zip_map]
            fn WEIBULL(span: Span, [x]: f64, [alpha]: f64, [beta]: f64, [cumulative]: bool) {
                if x < 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if alpha <= 0.0 || beta <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let dist =
                    Weibull::new(alpha, beta).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                if cumulative {
                    dist.cdf(x)
                } else {
                    use statrs::distribution::Continuous;
                    dist.pdf(x)
                }
            }
        ),
        // ===== LOGNORMAL DISTRIBUTION =====
        formula_fn!(
            /// Returns the lognormal distribution.
            #[name = "LOGNORM.DIST"]
            #[examples("LOGNORM.DIST(4, 3.5, 1.2, TRUE)", "LOGNORM.DIST(4, 3.5, 1.2, FALSE)")]
            #[zip_map]
            fn LOGNORM_DIST(
                span: Span,
                [x]: f64,
                [mean]: f64,
                [standard_dev]: f64,
                [cumulative]: bool,
            ) {
                if x <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if standard_dev <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                // Lognormal: if Y ~ N(mean, std), then X = e^Y ~ LogNormal
                let z = (x.ln() - mean) / standard_dev;
                let normal = Normal::new(0.0, 1.0).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                if cumulative {
                    normal.cdf(z)
                } else {
                    use statrs::distribution::Continuous;
                    normal.pdf(z) / (x * standard_dev)
                }
            }
        ),
        formula_fn!(
            /// Returns the inverse of the lognormal cumulative distribution.
            #[name = "LOGNORM.INV"]
            #[examples("LOGNORM.INV(0.5, 3.5, 1.2)")]
            #[zip_map]
            fn LOGNORM_INV(span: Span, [probability]: f64, [mean]: f64, [standard_dev]: f64) {
                if probability <= 0.0 || probability >= 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if standard_dev <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let normal = Normal::new(0.0, 1.0).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                let z = normal.inverse_cdf(probability);
                (mean + z * standard_dev).exp()
            }
        ),
        formula_fn!(
            /// Returns the lognormal distribution (compatibility function).
            #[examples("LOGNORMDIST(4, 3.5, 1.2)")]
            #[zip_map]
            fn LOGNORMDIST(span: Span, [x]: f64, [mean]: f64, [standard_dev]: f64) {
                if x <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if standard_dev <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let z = (x.ln() - mean) / standard_dev;
                let normal = Normal::new(0.0, 1.0).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                normal.cdf(z)
            }
        ),
        formula_fn!(
            /// Returns the inverse of the lognormal distribution (compatibility function).
            #[examples("LOGINV(0.5, 3.5, 1.2)")]
            #[zip_map]
            fn LOGINV(span: Span, [probability]: f64, [mean]: f64, [standard_dev]: f64) {
                if probability <= 0.0 || probability >= 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if standard_dev <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let normal = Normal::new(0.0, 1.0).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                let z = normal.inverse_cdf(probability);
                (mean + z * standard_dev).exp()
            }
        ),
        // ===== ERROR FUNCTION =====
        formula_fn!(
            /// Returns the error function.
            #[examples("ERF(0.5)", "ERF(0, 1)")]
            #[zip_map]
            fn ERF([lower_limit]: f64, [upper_limit]: (Option<f64>)) {
                match upper_limit {
                    Some(upper) => erf::erf(upper) - erf::erf(lower_limit),
                    None => erf::erf(lower_limit),
                }
            }
        ),
        formula_fn!(
            /// Returns the error function (precise version).
            #[name = "ERF.PRECISE"]
            #[examples("ERF.PRECISE(0.5)")]
            #[zip_map]
            fn ERF_PRECISE([x]: f64) {
                erf::erf(x)
            }
        ),
        formula_fn!(
            /// Returns the complementary error function.
            #[examples("ERFC(0.5)")]
            #[zip_map]
            fn ERFC([x]: f64) {
                erf::erfc(x)
            }
        ),
        formula_fn!(
            /// Returns the complementary error function (precise version).
            #[name = "ERFC.PRECISE"]
            #[examples("ERFC.PRECISE(0.5)")]
            #[zip_map]
            fn ERFC_PRECISE([x]: f64) {
                erf::erfc(x)
            }
        ),
        // ===== PHI FUNCTION =====
        formula_fn!(
            /// Returns the value of the density function for a standard normal distribution.
            #[examples("PHI(0.5)", "PHI(0)")]
            #[zip_map]
            fn PHI(span: Span, [x]: f64) {
                let normal = Normal::new(0.0, 1.0).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                use statrs::distribution::Continuous;
                normal.pdf(x)
            }
        ),
        // ===== GAUSS FUNCTION =====
        formula_fn!(
            /// Returns 0.5 less than the standard normal cumulative distribution.
            /// GAUSS(z) = NORM.S.DIST(z, TRUE) - 0.5
            #[examples("GAUSS(1)", "GAUSS(2)")]
            #[zip_map]
            fn GAUSS(span: Span, [z]: f64) {
                let normal = Normal::new(0.0, 1.0).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                normal.cdf(z) - 0.5
            }
        ),
        // ===== Z.TEST =====
        formula_fn!(
            /// Returns the one-tailed P-value of a z-test.
            #[name = "Z.TEST"]
            #[examples("Z.TEST({1,2,3,4,5}, 3)", "Z.TEST({1,2,3,4,5}, 3, 1)")]
            fn Z_TEST(span: Span, array: (Spanned<Array>), x: f64, sigma: (Option<Spanned<f64>>)) {
                let values: Vec<f64> = array
                    .inner
                    .into_cell_values_vec()
                    .into_iter()
                    .filter_map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64()
                        }
                        _ => None,
                    })
                    .collect();

                if values.is_empty() {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                let n = values.len() as f64;
                let mean: f64 = values.iter().sum::<f64>() / n;

                let std_dev = if let Some(s) = sigma {
                    if s.inner <= 0.0 {
                        return Err(RunErrorMsg::Num.with_span(s.span));
                    }
                    s.inner
                } else {
                    // Calculate sample standard deviation
                    let variance: f64 =
                        values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / (n - 1.0);
                    variance.sqrt()
                };

                let z = (mean - x) / (std_dev / n.sqrt());
                let normal = Normal::new(0.0, 1.0).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                1.0 - normal.cdf(z)
            }
        ),
        formula_fn!(
            /// Returns the one-tailed P-value of a z-test (compatibility function).
            #[examples("ZTEST({1,2,3,4,5}, 3)")]
            fn ZTEST(span: Span, array: (Spanned<Array>), x: f64, sigma: (Option<Spanned<f64>>)) {
                let values: Vec<f64> = array
                    .inner
                    .into_cell_values_vec()
                    .into_iter()
                    .filter_map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64()
                        }
                        _ => None,
                    })
                    .collect();

                if values.is_empty() {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                let n = values.len() as f64;
                let mean: f64 = values.iter().sum::<f64>() / n;

                let std_dev = if let Some(s) = sigma {
                    if s.inner <= 0.0 {
                        return Err(RunErrorMsg::Num.with_span(s.span));
                    }
                    s.inner
                } else {
                    let variance: f64 =
                        values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / (n - 1.0);
                    variance.sqrt()
                };

                let z = (mean - x) / (std_dev / n.sqrt());
                let normal = Normal::new(0.0, 1.0).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                1.0 - normal.cdf(z)
            }
        ),
        // ===== CONFIDENCE =====
        formula_fn!(
            /// Returns the confidence interval for a population mean.
            #[name = "CONFIDENCE.NORM"]
            #[examples("CONFIDENCE.NORM(0.05, 2.5, 50)")]
            #[zip_map]
            fn CONFIDENCE_NORM(span: Span, [alpha]: f64, [standard_dev]: f64, [size]: f64) {
                if alpha <= 0.0 || alpha >= 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if standard_dev <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if size < 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let normal = Normal::new(0.0, 1.0).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                let z = normal.inverse_cdf(1.0 - alpha / 2.0);
                z * standard_dev / size.sqrt()
            }
        ),
        formula_fn!(
            /// Returns the confidence interval for a population mean using t-distribution.
            #[name = "CONFIDENCE.T"]
            #[examples("CONFIDENCE.T(0.05, 2.5, 50)")]
            #[zip_map]
            fn CONFIDENCE_T(span: Span, [alpha]: f64, [standard_dev]: f64, [size]: f64) {
                if alpha <= 0.0 || alpha >= 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if standard_dev <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if size < 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let df = size - 1.0;
                let t_dist =
                    StudentsT::new(0.0, 1.0, df).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                let t = t_dist.inverse_cdf(1.0 - alpha / 2.0);
                t * standard_dev / size.sqrt()
            }
        ),
        formula_fn!(
            /// Returns the confidence interval for a population mean (compatibility function).
            #[examples("CONFIDENCE(0.05, 2.5, 50)")]
            #[zip_map]
            fn CONFIDENCE(span: Span, [alpha]: f64, [standard_dev]: f64, [size]: f64) {
                if alpha <= 0.0 || alpha >= 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if standard_dev <= 0.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if size < 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                let normal = Normal::new(0.0, 1.0).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                let z = normal.inverse_cdf(1.0 - alpha / 2.0);
                z * standard_dev / size.sqrt()
            }
        ),
        // ===== STATISTICAL TESTS =====
        formula_fn!(
            /// Returns the probability associated with a Student's t-Test.
            ///
            /// - array1: First data set
            /// - array2: Second data set
            /// - tails: 1 for one-tailed, 2 for two-tailed
            /// - type: 1=paired, 2=two-sample equal variance, 3=two-sample unequal variance
            #[name = "T.TEST"]
            #[examples("T.TEST(A1:A10, B1:B10, 2, 2)")]
            fn T_TEST(
                span: Span,
                array1: (Spanned<Array>),
                array2: (Spanned<Array>),
                tails: (Spanned<i64>),
                test_type: (Spanned<i64>),
            ) {
                let values1: Vec<f64> = array1
                    .inner
                    .into_cell_values_vec()
                    .into_iter()
                    .filter_map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64()
                        }
                        _ => None,
                    })
                    .collect();

                let values2: Vec<f64> = array2
                    .inner
                    .into_cell_values_vec()
                    .into_iter()
                    .filter_map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64()
                        }
                        _ => None,
                    })
                    .collect();

                if values1.is_empty() || values2.is_empty() {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                let tails_val = tails.inner;
                let type_val = test_type.inner;

                if tails_val != 1 && tails_val != 2 {
                    return Err(RunErrorMsg::Num.with_span(tails.span));
                }
                if type_val < 1 || type_val > 3 {
                    return Err(RunErrorMsg::Num.with_span(test_type.span));
                }

                let n1 = values1.len() as f64;
                let n2 = values2.len() as f64;
                let mean1: f64 = values1.iter().sum::<f64>() / n1;
                let mean2: f64 = values2.iter().sum::<f64>() / n2;

                let (t_stat, df) = match type_val {
                    1 => {
                        // Paired t-test
                        if values1.len() != values2.len() {
                            return Err(RunErrorMsg::Num.with_span(span));
                        }
                        let diffs: Vec<f64> = values1
                            .iter()
                            .zip(values2.iter())
                            .map(|(a, b)| a - b)
                            .collect();
                        let d_mean: f64 = diffs.iter().sum::<f64>() / n1;
                        let d_var: f64 =
                            diffs.iter().map(|d| (d - d_mean).powi(2)).sum::<f64>() / (n1 - 1.0);
                        let t = d_mean / (d_var / n1).sqrt();
                        (t, n1 - 1.0)
                    }
                    2 => {
                        // Two-sample equal variance
                        let var1: f64 =
                            values1.iter().map(|x| (x - mean1).powi(2)).sum::<f64>() / (n1 - 1.0);
                        let var2: f64 =
                            values2.iter().map(|x| (x - mean2).powi(2)).sum::<f64>() / (n2 - 1.0);
                        let pooled_var = ((n1 - 1.0) * var1 + (n2 - 1.0) * var2) / (n1 + n2 - 2.0);
                        let t = (mean1 - mean2) / (pooled_var * (1.0 / n1 + 1.0 / n2)).sqrt();
                        (t, n1 + n2 - 2.0)
                    }
                    3 => {
                        // Two-sample unequal variance (Welch's t-test)
                        let var1: f64 =
                            values1.iter().map(|x| (x - mean1).powi(2)).sum::<f64>() / (n1 - 1.0);
                        let var2: f64 =
                            values2.iter().map(|x| (x - mean2).powi(2)).sum::<f64>() / (n2 - 1.0);
                        let se = (var1 / n1 + var2 / n2).sqrt();
                        let t = (mean1 - mean2) / se;
                        // Welch-Satterthwaite degrees of freedom
                        let df_num = (var1 / n1 + var2 / n2).powi(2);
                        let df_denom =
                            (var1 / n1).powi(2) / (n1 - 1.0) + (var2 / n2).powi(2) / (n2 - 1.0);
                        let df = df_num / df_denom;
                        (t, df)
                    }
                    _ => return Err(RunErrorMsg::Num.with_span(test_type.span)),
                };

                let t_dist =
                    StudentsT::new(0.0, 1.0, df).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                let p = if tails_val == 1 {
                    1.0 - t_dist.cdf(t_stat.abs())
                } else {
                    2.0 * (1.0 - t_dist.cdf(t_stat.abs()))
                };
                p
            }
        ),
        formula_fn!(
            /// Returns the probability associated with a Student's t-Test (compatibility function).
            #[examples("TTEST(A1:A10, B1:B10, 2, 2)")]
            fn TTEST(
                span: Span,
                array1: (Spanned<Array>),
                array2: (Spanned<Array>),
                tails: (Spanned<i64>),
                test_type: (Spanned<i64>),
            ) {
                let values1: Vec<f64> = array1
                    .inner
                    .into_cell_values_vec()
                    .into_iter()
                    .filter_map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64()
                        }
                        _ => None,
                    })
                    .collect();

                let values2: Vec<f64> = array2
                    .inner
                    .into_cell_values_vec()
                    .into_iter()
                    .filter_map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64()
                        }
                        _ => None,
                    })
                    .collect();

                if values1.is_empty() || values2.is_empty() {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                let tails_val = tails.inner;
                let type_val = test_type.inner;

                if tails_val != 1 && tails_val != 2 {
                    return Err(RunErrorMsg::Num.with_span(tails.span));
                }
                if type_val < 1 || type_val > 3 {
                    return Err(RunErrorMsg::Num.with_span(test_type.span));
                }

                let n1 = values1.len() as f64;
                let n2 = values2.len() as f64;
                let mean1: f64 = values1.iter().sum::<f64>() / n1;
                let mean2: f64 = values2.iter().sum::<f64>() / n2;

                let (t_stat, df) = match type_val {
                    1 => {
                        if values1.len() != values2.len() {
                            return Err(RunErrorMsg::Num.with_span(span));
                        }
                        let diffs: Vec<f64> = values1
                            .iter()
                            .zip(values2.iter())
                            .map(|(a, b)| a - b)
                            .collect();
                        let d_mean: f64 = diffs.iter().sum::<f64>() / n1;
                        let d_var: f64 =
                            diffs.iter().map(|d| (d - d_mean).powi(2)).sum::<f64>() / (n1 - 1.0);
                        let t = d_mean / (d_var / n1).sqrt();
                        (t, n1 - 1.0)
                    }
                    2 => {
                        let var1: f64 =
                            values1.iter().map(|x| (x - mean1).powi(2)).sum::<f64>() / (n1 - 1.0);
                        let var2: f64 =
                            values2.iter().map(|x| (x - mean2).powi(2)).sum::<f64>() / (n2 - 1.0);
                        let pooled_var = ((n1 - 1.0) * var1 + (n2 - 1.0) * var2) / (n1 + n2 - 2.0);
                        let t = (mean1 - mean2) / (pooled_var * (1.0 / n1 + 1.0 / n2)).sqrt();
                        (t, n1 + n2 - 2.0)
                    }
                    3 => {
                        let var1: f64 =
                            values1.iter().map(|x| (x - mean1).powi(2)).sum::<f64>() / (n1 - 1.0);
                        let var2: f64 =
                            values2.iter().map(|x| (x - mean2).powi(2)).sum::<f64>() / (n2 - 1.0);
                        let se = (var1 / n1 + var2 / n2).sqrt();
                        let t = (mean1 - mean2) / se;
                        let df_num = (var1 / n1 + var2 / n2).powi(2);
                        let df_denom =
                            (var1 / n1).powi(2) / (n1 - 1.0) + (var2 / n2).powi(2) / (n2 - 1.0);
                        let df = df_num / df_denom;
                        (t, df)
                    }
                    _ => return Err(RunErrorMsg::Num.with_span(test_type.span)),
                };

                let t_dist =
                    StudentsT::new(0.0, 1.0, df).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                let p = if tails_val == 1 {
                    1.0 - t_dist.cdf(t_stat.abs())
                } else {
                    2.0 * (1.0 - t_dist.cdf(t_stat.abs()))
                };
                p
            }
        ),
        formula_fn!(
            /// Returns the result of an F-test (ratio of variances).
            #[name = "F.TEST"]
            #[examples("F.TEST(A1:A10, B1:B10)")]
            fn F_TEST(span: Span, array1: (Spanned<Array>), array2: (Spanned<Array>)) {
                let values1: Vec<f64> = array1
                    .inner
                    .into_cell_values_vec()
                    .into_iter()
                    .filter_map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64()
                        }
                        _ => None,
                    })
                    .collect();

                let values2: Vec<f64> = array2
                    .inner
                    .into_cell_values_vec()
                    .into_iter()
                    .filter_map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64()
                        }
                        _ => None,
                    })
                    .collect();

                if values1.len() < 2 || values2.len() < 2 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                let n1 = values1.len() as f64;
                let n2 = values2.len() as f64;
                let mean1: f64 = values1.iter().sum::<f64>() / n1;
                let mean2: f64 = values2.iter().sum::<f64>() / n2;
                let var1: f64 =
                    values1.iter().map(|x| (x - mean1).powi(2)).sum::<f64>() / (n1 - 1.0);
                let var2: f64 =
                    values2.iter().map(|x| (x - mean2).powi(2)).sum::<f64>() / (n2 - 1.0);

                if var1 == 0.0 || var2 == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }

                let f = var1 / var2;
                let df1 = n1 - 1.0;
                let df2 = n2 - 1.0;

                let f_dist =
                    FisherSnedecor::new(df1, df2).map_err(|_| RunErrorMsg::Num.with_span(span))?;

                // Two-tailed probability
                let p = if f > 1.0 {
                    2.0 * (1.0 - f_dist.cdf(f))
                } else {
                    2.0 * f_dist.cdf(f)
                };
                p.min(1.0)
            }
        ),
        formula_fn!(
            /// Returns the result of an F-test (compatibility function).
            #[examples("FTEST(A1:A10, B1:B10)")]
            fn FTEST(span: Span, array1: (Spanned<Array>), array2: (Spanned<Array>)) {
                let values1: Vec<f64> = array1
                    .inner
                    .into_cell_values_vec()
                    .into_iter()
                    .filter_map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64()
                        }
                        _ => None,
                    })
                    .collect();

                let values2: Vec<f64> = array2
                    .inner
                    .into_cell_values_vec()
                    .into_iter()
                    .filter_map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64()
                        }
                        _ => None,
                    })
                    .collect();

                if values1.len() < 2 || values2.len() < 2 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                let n1 = values1.len() as f64;
                let n2 = values2.len() as f64;
                let mean1: f64 = values1.iter().sum::<f64>() / n1;
                let mean2: f64 = values2.iter().sum::<f64>() / n2;
                let var1: f64 =
                    values1.iter().map(|x| (x - mean1).powi(2)).sum::<f64>() / (n1 - 1.0);
                let var2: f64 =
                    values2.iter().map(|x| (x - mean2).powi(2)).sum::<f64>() / (n2 - 1.0);

                if var1 == 0.0 || var2 == 0.0 {
                    return Err(RunErrorMsg::DivideByZero.with_span(span));
                }

                let f = var1 / var2;
                let df1 = n1 - 1.0;
                let df2 = n2 - 1.0;

                let f_dist =
                    FisherSnedecor::new(df1, df2).map_err(|_| RunErrorMsg::Num.with_span(span))?;

                let p = if f > 1.0 {
                    2.0 * (1.0 - f_dist.cdf(f))
                } else {
                    2.0 * f_dist.cdf(f)
                };
                p.min(1.0)
            }
        ),
        formula_fn!(
            /// Returns the chi-squared test for independence.
            #[name = "CHISQ.TEST"]
            #[examples("CHISQ.TEST(A1:B2, C1:D2)")]
            fn CHISQ_TEST(
                span: Span,
                actual_range: (Spanned<Array>),
                expected_range: (Spanned<Array>),
            ) {
                let actual = &actual_range.inner;
                let expected = &expected_range.inner;

                if actual.width() != expected.width() || actual.height() != expected.height() {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                let actual_values: Vec<f64> = actual
                    .clone()
                    .into_cell_values_vec()
                    .into_iter()
                    .filter_map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64()
                        }
                        _ => None,
                    })
                    .collect();

                let expected_values: Vec<f64> = expected
                    .clone()
                    .into_cell_values_vec()
                    .into_iter()
                    .filter_map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64()
                        }
                        _ => None,
                    })
                    .collect();

                if actual_values.len() != expected_values.len() || actual_values.is_empty() {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                // Check for non-positive expected values
                if expected_values.iter().any(|&e| e <= 0.0) {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                // Calculate chi-squared statistic
                let chi_sq: f64 = actual_values
                    .iter()
                    .zip(expected_values.iter())
                    .map(|(a, e)| (a - e).powi(2) / e)
                    .sum();

                // Degrees of freedom = (rows - 1) * (cols - 1) for contingency table
                // For general case, df = n - 1
                let rows = actual.height() as f64;
                let cols = actual.width() as f64;
                let df = if rows > 1.0 && cols > 1.0 {
                    (rows - 1.0) * (cols - 1.0)
                } else {
                    (actual_values.len() as f64) - 1.0
                };

                if df < 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                let chi_dist = ChiSquared::new(df).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                1.0 - chi_dist.cdf(chi_sq)
            }
        ),
        formula_fn!(
            /// Returns the chi-squared test for independence (compatibility function).
            #[examples("CHITEST(A1:B2, C1:D2)")]
            fn CHITEST(
                span: Span,
                actual_range: (Spanned<Array>),
                expected_range: (Spanned<Array>),
            ) {
                let actual = &actual_range.inner;
                let expected = &expected_range.inner;

                if actual.width() != expected.width() || actual.height() != expected.height() {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                let actual_values: Vec<f64> = actual
                    .clone()
                    .into_cell_values_vec()
                    .into_iter()
                    .filter_map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64()
                        }
                        _ => None,
                    })
                    .collect();

                let expected_values: Vec<f64> = expected
                    .clone()
                    .into_cell_values_vec()
                    .into_iter()
                    .filter_map(|cv| match cv {
                        CellValue::Number(n) => {
                            use rust_decimal::prelude::ToPrimitive;
                            n.to_f64()
                        }
                        _ => None,
                    })
                    .collect();

                if actual_values.len() != expected_values.len() || actual_values.is_empty() {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                if expected_values.iter().any(|&e| e <= 0.0) {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                let chi_sq: f64 = actual_values
                    .iter()
                    .zip(expected_values.iter())
                    .map(|(a, e)| (a - e).powi(2) / e)
                    .sum();

                let rows = actual.height() as f64;
                let cols = actual.width() as f64;
                let df = if rows > 1.0 && cols > 1.0 {
                    (rows - 1.0) * (cols - 1.0)
                } else {
                    (actual_values.len() as f64) - 1.0
                };

                if df < 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                let chi_dist = ChiSquared::new(df).map_err(|_| RunErrorMsg::Num.with_span(span))?;
                1.0 - chi_dist.cdf(chi_sq)
            }
        ),
        // ===== ADDITIONAL DISTRIBUTIONS =====
        formula_fn!(
            /// Returns the negative binomial distribution.
            #[name = "NEGBINOM.DIST"]
            #[examples("NEGBINOM.DIST(3, 5, 0.5, FALSE)")]
            #[zip_map]
            fn NEGBINOM_DIST(
                span: Span,
                [number_f]: f64,
                [number_s]: f64,
                [probability_s]: f64,
                [cumulative]: bool,
            ) {
                let f = number_f.floor() as u64;
                let s = number_s.floor() as u64;
                if probability_s <= 0.0 || probability_s >= 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if s < 1 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                // Negative binomial: probability of f failures before s successes
                if cumulative {
                    let mut sum = 0.0;
                    for k in 0..=f {
                        sum += neg_binom_pmf(k, s, probability_s);
                    }
                    sum
                } else {
                    neg_binom_pmf(f, s, probability_s)
                }
            }
        ),
        formula_fn!(
            /// Returns the negative binomial distribution (compatibility function).
            #[examples("NEGBINOMDIST(3, 5, 0.5)")]
            #[zip_map]
            fn NEGBINOMDIST(span: Span, [number_f]: f64, [number_s]: f64, [probability_s]: f64) {
                let f = number_f.floor() as u64;
                let s = number_s.floor() as u64;
                if probability_s <= 0.0 || probability_s >= 1.0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                if s < 1 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }
                neg_binom_pmf(f, s, probability_s)
            }
        ),
        formula_fn!(
            /// Returns the hypergeometric distribution.
            #[name = "HYPGEOM.DIST"]
            #[examples("HYPGEOM.DIST(1, 4, 8, 20, FALSE)")]
            #[zip_map]
            fn HYPGEOM_DIST(
                span: Span,
                [sample_s]: f64,
                [number_sample]: f64,
                [population_s]: f64,
                [number_pop]: f64,
                [cumulative]: bool,
            ) {
                let x = sample_s.floor() as i64;
                let n = number_sample.floor() as i64;
                let k = population_s.floor() as i64;
                let m = number_pop.floor() as i64;

                if n < 0 || k < 0 || m <= 0 || n > m || k > m || x < 0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                if cumulative {
                    let mut sum = 0.0;
                    for i in 0..=x {
                        if let Some(p) = hypergeom_pmf(i, n, k, m) {
                            sum += p;
                        }
                    }
                    sum
                } else {
                    hypergeom_pmf(x, n, k, m).unwrap_or(0.0)
                }
            }
        ),
        formula_fn!(
            /// Returns the hypergeometric distribution (compatibility function).
            #[examples("HYPGEOMDIST(1, 4, 8, 20)")]
            #[zip_map]
            fn HYPGEOMDIST(
                span: Span,
                [sample_s]: f64,
                [number_sample]: f64,
                [population_s]: f64,
                [number_pop]: f64,
            ) {
                let x = sample_s.floor() as i64;
                let n = number_sample.floor() as i64;
                let k = population_s.floor() as i64;
                let m = number_pop.floor() as i64;

                if n < 0 || k < 0 || m <= 0 || n > m || k > m || x < 0 {
                    return Err(RunErrorMsg::Num.with_span(span));
                }

                hypergeom_pmf(x, n, k, m).unwrap_or(0.0)
            }
        ),
    ]
}

/// Negative binomial PMF: probability of f failures before s successes
fn neg_binom_pmf(f: u64, s: u64, p: f64) -> f64 {
    // C(f+s-1, f) * p^s * (1-p)^f
    let coeff = binomial_coeff(f + s - 1, f);
    coeff * p.powi(s as i32) * (1.0 - p).powi(f as i32)
}

/// Binomial coefficient C(n, k)
fn binomial_coeff(n: u64, k: u64) -> f64 {
    if k > n {
        return 0.0;
    }
    let k = k.min(n - k);
    let mut result = 1.0;
    for i in 0..k {
        result *= (n - i) as f64 / (i + 1) as f64;
    }
    result
}

/// Hypergeometric PMF
fn hypergeom_pmf(x: i64, n: i64, k: i64, m: i64) -> Option<f64> {
    // C(k,x) * C(m-k, n-x) / C(m, n)
    if x < 0 || x > k || x > n || (n - x) > (m - k) {
        return Some(0.0);
    }

    let log_num = ln_binomial(k as u64, x as u64) + ln_binomial((m - k) as u64, (n - x) as u64);
    let log_denom = ln_binomial(m as u64, n as u64);

    Some((log_num - log_denom).exp())
}

/// Natural log of binomial coefficient
fn ln_binomial(n: u64, k: u64) -> f64 {
    if k > n {
        return f64::NEG_INFINITY;
    }
    statrs::function::gamma::ln_gamma((n + 1) as f64)
        - statrs::function::gamma::ln_gamma((k + 1) as f64)
        - statrs::function::gamma::ln_gamma((n - k + 1) as f64)
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, formulas::tests::*};

    fn approx_eq(a: f64, b: f64, epsilon: f64) -> bool {
        (a - b).abs() < epsilon
    }

    #[test]
    fn test_norm_dist() {
        let g = GridController::new();

        // Standard normal CDF at 0 should be 0.5
        let result: f64 = eval_to_string(&g, "NORM.S.DIST(0, TRUE)").parse().unwrap();
        assert!(approx_eq(result, 0.5, 1e-6));

        // Standard normal CDF at 1 should be ~0.8413
        let result: f64 = eval_to_string(&g, "NORM.S.DIST(1, TRUE)").parse().unwrap();
        assert!(approx_eq(result, 0.8413447, 1e-5));

        // Standard normal inverse at 0.5 should be 0
        let result: f64 = eval_to_string(&g, "NORM.S.INV(0.5)").parse().unwrap();
        assert!(approx_eq(result, 0.0, 1e-6));

        // NORM.DIST with mean=100, std=15
        let result: f64 = eval_to_string(&g, "NORM.DIST(100, 100, 15, TRUE)")
            .parse()
            .unwrap();
        assert!(approx_eq(result, 0.5, 1e-6));
    }

    #[test]
    fn test_t_dist() {
        let g = GridController::new();

        // T.DIST at 0 with any df should be 0.5
        let result: f64 = eval_to_string(&g, "T.DIST(0, 10, TRUE)").parse().unwrap();
        assert!(approx_eq(result, 0.5, 1e-6));

        // T.DIST.2T at 2 with df=10
        let result: f64 = eval_to_string(&g, "T.DIST.2T(2, 10)").parse().unwrap();
        assert!(approx_eq(result, 0.0734, 1e-3));
    }

    #[test]
    fn test_chisq_dist() {
        let g = GridController::new();

        // CHISQ.DIST.RT
        let result: f64 = eval_to_string(&g, "CHISQ.DIST.RT(3, 5)").parse().unwrap();
        assert!(approx_eq(result, 0.6999, 1e-3));
    }

    #[test]
    fn test_binom_dist() {
        let g = GridController::new();

        // Binomial: P(X=3) with n=10, p=0.5
        let result: f64 = eval_to_string(&g, "BINOM.DIST(3, 10, 0.5, FALSE)")
            .parse()
            .unwrap();
        assert!(approx_eq(result, 0.1172, 1e-3));

        // Binomial CDF: P(X<=3) with n=10, p=0.5
        let result: f64 = eval_to_string(&g, "BINOM.DIST(3, 10, 0.5, TRUE)")
            .parse()
            .unwrap();
        assert!(approx_eq(result, 0.1719, 1e-3));
    }

    #[test]
    fn test_poisson_dist() {
        let g = GridController::new();

        // Poisson: P(X=3) with mean=5
        let result: f64 = eval_to_string(&g, "POISSON.DIST(3, 5, FALSE)")
            .parse()
            .unwrap();
        assert!(approx_eq(result, 0.1404, 1e-3));
    }

    #[test]
    fn test_expon_dist() {
        let g = GridController::new();

        // Exponential CDF
        let result: f64 = eval_to_string(&g, "EXPON.DIST(1, 2, TRUE)")
            .parse()
            .unwrap();
        assert!(approx_eq(result, 0.8647, 1e-3));
    }

    #[test]
    fn test_gamma_functions() {
        let g = GridController::new();

        // GAMMA(5) = 4! = 24
        let result: f64 = eval_to_string(&g, "GAMMA(5)").parse().unwrap();
        assert!(approx_eq(result, 24.0, 1e-6));

        // GAMMALN(5) = ln(24)
        let result: f64 = eval_to_string(&g, "GAMMALN(5)").parse().unwrap();
        assert!(approx_eq(result, 24.0_f64.ln(), 1e-6));
    }

    #[test]
    fn test_beta_dist() {
        let g = GridController::new();

        // BETA.DIST CDF
        let result: f64 = eval_to_string(&g, "BETA.DIST(0.5, 2, 3, TRUE)")
            .parse()
            .unwrap();
        assert!(approx_eq(result, 0.6875, 1e-3));
    }

    #[test]
    fn test_erf() {
        let g = GridController::new();

        // ERF(1) ~= 0.8427
        let result: f64 = eval_to_string(&g, "ERF(1)").parse().unwrap();
        assert!(approx_eq(result, 0.8427, 1e-3));

        // ERFC(1) ~= 0.1573
        let result: f64 = eval_to_string(&g, "ERFC(1)").parse().unwrap();
        assert!(approx_eq(result, 0.1573, 1e-3));
    }

    #[test]
    fn test_phi() {
        let g = GridController::new();

        // PHI(0) = 1 / sqrt(2*PI) ~= 0.3989
        let result: f64 = eval_to_string(&g, "PHI(0)").parse().unwrap();
        assert!(approx_eq(result, 0.3989, 1e-3));
    }

    #[test]
    fn test_confidence() {
        let g = GridController::new();

        // CONFIDENCE.NORM with alpha=0.05, std=2.5, n=50
        let result: f64 = eval_to_string(&g, "CONFIDENCE.NORM(0.05, 2.5, 50)")
            .parse()
            .unwrap();
        assert!(approx_eq(result, 0.6929, 1e-3));
    }
}
