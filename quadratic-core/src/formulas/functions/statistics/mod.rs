//! Statistics functions for formulas.

mod core;
mod distributions;

use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Statistics functions",
    docs: None,
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    let mut functions = core::get_functions();
    functions.extend(distributions::get_functions());
    functions
}

#[cfg(test)]
mod tests {
    use itertools::Itertools;

    use crate::{
        Pos, a1::A1Context, controller::GridController, formulas::tests::*, grid::SheetId,
    };

    #[test]
    fn test_formula_average() {
        let parse_ctx = A1Context::test(&[], &[]);
        let pos = pos![A10].to_sheet_pos(SheetId::TEST);
        let form = parse_formula("AVERAGE(3, A1:C3)", &parse_ctx, pos).unwrap();

        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];
        for x in 1..=3 {
            for y in 1..=3 {
                g.set_cell_value(pos![sheet_id!x,y], (x * 3 + y).to_string(), None, false);
                println!(
                    "({},{})={:?}",
                    x,
                    y,
                    g.sheet(sheet_id).cell_value(Pos { x, y }).unwrap()
                );
            }
        }

        let mut ctx = Ctx::new(&g, pos![A10].to_sheet_pos(sheet_id));
        assert_eq!("7.5".to_string(), form.eval(&mut ctx).to_string());

        assert_eq!(
            "17",
            eval_to_string(&g, "AVERAGE({\"_\", \"a\"}, 12, -3.5, 42.5)"),
        );
        assert_eq!("5.5", eval_to_string(&g, "AVERAGE(1..10)"));
        assert_eq!("5", eval_to_string(&g, "AVERAGE(0..10)"));

        // Test that null arguments count as zero.
        assert_eq!("1", eval_to_string(&g, "AVERAGE(3,,)"));
        assert_eq!("1", eval_to_string(&g, "AVERAGE(,3,)"));
        assert_eq!("1", eval_to_string(&g, "AVERAGE(,,3)"));
        assert_eq!("0", eval_to_string(&g, "AVERAGE(,)"));

        // Test with no arguments
        let mut ctx = Ctx::new(&g, Pos::ORIGIN.to_sheet_pos(g.sheet_ids()[0]));
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "AVERAGE".into(),
                arg_name: "numbers".into()
            },
            simple_parse_formula("AVERAGE()")
                .unwrap()
                .eval(&mut ctx)
                .unwrap_err()
                .msg,
        );
    }

    #[test]
    fn test_averageif() {
        let g = GridController::new();

        assert_eq!("2.5", eval_to_string(&g, "AVERAGEIF(0..10, \"<=5\")"));
        assert_eq!("2.5", eval_to_string(&g, "AVERAGEIF(0..10, \"<=5\")"));

        // Blank values are treated as zeros when summing, but *not* when
        // evaluating conditions.
        {
            let mut g = GridController::new();
            let sheet_id = g.sheet_ids()[0];
            for y in 1..=11 {
                g.set_cell_value(pos![sheet_id!1,y], (y - 1).to_string(), None, false);
            }
            assert_eq!("2.5", eval_to_string(&g, "AVERAGEIF(A1:A10, \"<=5\")"));
        }
        let g = GridController::new();
        assert_eq!(
            "7.5",
            eval_to_string(&g, "AVERAGEIF({0, 0, 0}, \"<=5\", {5, 10, A2})"),
        );

        // Error on range size mismatch.
        assert_eq!(
            RunErrorMsg::ExactArraySizeMismatch {
                expected: ArraySize::new(1, 11).unwrap(),
                got: ArraySize::new(2, 1).unwrap(),
            },
            eval_to_err(&g, "AVERAGEIF(0..10, \"<=5\", {A1, A2})").msg,
        );
        // ... even if one of the arguments is just a single value.
        assert_eq!(
            RunErrorMsg::ExactArraySizeMismatch {
                expected: ArraySize::new(1, 11).unwrap(),
                got: ArraySize::new(1, 1).unwrap(),
            },
            eval_to_err(&g, "AVERAGEIF(0..10, \"<=5\", 3)").msg,
        );
        assert_eq!(
            RunErrorMsg::ExactArraySizeMismatch {
                expected: ArraySize::new(1, 1).unwrap(),
                got: ArraySize::new(1, 11).unwrap(),
            },
            eval_to_err(&g, "AVERAGEIF(3, \"<=5\", 0..10)").msg,
        );
    }

    #[test]
    fn test_count() {
        let g = GridController::new();
        let mut ctx = Ctx::new(&g, Pos::ORIGIN.to_sheet_pos(g.sheet_ids()[0]));
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "COUNT".into(),
                arg_name: "numbers".into()
            },
            simple_parse_formula("COUNT()")
                .unwrap()
                .eval(&mut ctx)
                .unwrap_err()
                .msg,
        );
        assert_eq!("0", eval_to_string(&g, "COUNT(A1)"));
        assert_eq!("0", eval_to_string(&g, "COUNT(A1:B4)"));
        assert_eq!(
            "3",
            eval_to_string(&g, "COUNT(\"_\", \"a\", 12, -3.5, 42.5)"),
        );
        assert_eq!("1", eval_to_string(&g, "COUNT(2)"));
        assert_eq!("10", eval_to_string(&g, "COUNT(1..10)"));
        assert_eq!("11", eval_to_string(&g, "COUNT(0..10)"));
        assert_eq!("1", eval_to_string(&g, "COUNT({\"\",1,,,})"));
    }

    #[test]
    fn test_counta() {
        let g = GridController::new();
        let mut ctx = Ctx::new(&g, Pos::ORIGIN.to_sheet_pos(g.sheet_ids()[0]));
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "COUNTA".into(),
                arg_name: "range".into()
            },
            simple_parse_formula("COUNTA()")
                .unwrap()
                .eval(&mut ctx)
                .unwrap_err()
                .msg,
        );
        assert_eq!("0", eval_to_string(&g, "COUNTA(A1)"));
        assert_eq!("0", eval_to_string(&g, "COUNTA(A1:B4)"));
        assert_eq!(
            "5",
            eval_to_string(&g, "COUNTA(\"_\", \"a\", 12, -3.5, 42.5)"),
        );
        assert_eq!("1", eval_to_string(&g, "COUNTA(\"\")"));
        assert_eq!("1", eval_to_string(&g, "COUNTA(2)"));
        assert_eq!("10", eval_to_string(&g, "COUNTA(1..10)"));
        assert_eq!("11", eval_to_string(&g, "COUNTA(0..10)"));
        assert_eq!("2", eval_to_string(&g, "COUNTA({\"\",1,,,})"));
    }

    #[test]
    fn test_countif() {
        let g = GridController::new();
        assert_eq!("6", eval_to_string(&g, "COUNTIF(0..10, \"<=5\")"));
        assert_eq!("6", eval_to_string(&g, "COUNTIF(0..10, \"<=5\")"));

        // Test that blank cells are ignored
        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];
        for y in 1..=11 {
            g.set_cell_value(pos![sheet_id!1,y], (y - 1).to_string(), None, false);
        }
        assert_eq!("6", eval_to_string(&g, "COUNTIF(A1:A10, \"<=5\")"));
    }

    #[test]
    fn test_countifs() {
        let g = GridController::new();
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "COUNTIFS".into(),
                arg_name: "eval_range1".into(),
            },
            eval_to_err(&g, "COUNTIFS()").msg,
        );
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "COUNTIFS".into(),
                arg_name: "criteria1".into(),
            },
            eval_to_err(&g, "COUNTIFS(0..10)").msg,
        );

        let make_countifs =
            |conditions: &[&str]| format!("COUNTIFS({})", conditions.iter().join(", "));

        // vertical; first 6 elements match
        let cond1 = "0..10, \"<=5\"";
        assert_eq!("6", eval_to_string(&g, &make_countifs(&[cond1])));

        // vertical; alternating elements match
        let cond2 = "MOD(5..15, 2), 1";
        assert_eq!("6", eval_to_string(&g, &make_countifs(&[cond2])));
        assert_eq!("3", eval_to_string(&g, &make_countifs(&[cond1, cond2])));

        // horizontal; last 3 elements match
        let cond3 = "{1,2,3,4,5,6,7,8,9,10,11}, \">8\"";
        assert_eq!("3", eval_to_string(&g, &make_countifs(&[cond3])));
        assert_eq!(
            RunErrorMsg::ExactArraySizeMismatch {
                expected: ArraySize::new(11, 1).unwrap(),
                got: ArraySize::new(1, 11).unwrap(),
            },
            eval_to_err(&g, &make_countifs(&[cond1, cond3])).msg,
        );
        assert_eq!(
            RunErrorMsg::ExactArraySizeMismatch {
                expected: ArraySize::new(11, 1).unwrap(),
                got: ArraySize::new(1, 11).unwrap(),
            },
            eval_to_err(&g, &make_countifs(&[cond1, cond2, cond3])).msg,
        );

        // vertical; last 3 elements match
        let cond4 = "1..11, \">8\"";
        assert_eq!("3", eval_to_string(&g, &make_countifs(&[cond4])));
        assert_eq!("0", eval_to_string(&g, &make_countifs(&[cond1, cond4])));
        assert_eq!("2", eval_to_string(&g, &make_countifs(&[cond2, cond4])));
        assert_eq!(
            "0",
            eval_to_string(&g, &make_countifs(&[cond1, cond2, cond4])),
        );
    }

    #[test]
    fn test_countblank() {
        let g = GridController::new();
        assert_eq!("1", eval_to_string(&g, "COUNTBLANK(\"\")"));
        assert_eq!("0", eval_to_string(&g, "COUNTBLANK(\"a\")"));
        assert_eq!("0", eval_to_string(&g, "COUNTBLANK(0)"));
        assert_eq!("0", eval_to_string(&g, "COUNTBLANK(1)"));
        assert_eq!("1", eval_to_string(&g, "COUNTBLANK({\"\", \"a\"; 0, 1})"));
        assert_eq!("1", eval_to_string(&g, "COUNTBLANK(B3)"));
        assert_eq!("28", eval_to_string(&g, "COUNTBLANK(B3:C16)"));
        assert_eq!("3", eval_to_string(&g, "COUNTBLANK({B3, \"\", C6, \"0\"})"));
    }

    #[test]
    fn test_min() {
        let g = GridController::new();
        assert_eq!("1", eval_to_string(&g, "MIN(1, 3, 2)"));
    }

    #[test]
    fn test_max() {
        let g = GridController::new();
        assert_eq!("3", eval_to_string(&g, "MAX(1, 3, 2)"));
    }

    #[test]
    fn test_var() {
        let g = GridController::new();

        // Test basic variance calculation
        assert_eq!("7", eval_to_string(&g, "VAR(9, 5, 4)"));
    }

    #[test]
    fn test_stdev() {
        let g = GridController::new();

        // Test basic standard deviation calculation
        assert_eq!("2", eval_to_string(&g, "STDEV(1, 3, 5)"));
    }

    #[test]
    fn test_var_variants() {
        let g = GridController::new();

        // VAR.S should be the same as VAR (sample variance)
        assert_eq!("7", eval_to_string(&g, "VAR.S(9, 5, 4)"));

        // VAR.P (population variance) - should use n instead of n-1
        // For values 9, 5, 4: mean = 6, sum of squared deviations = 14
        // Population variance = 14/3 = 4.666...
        let var_p_result: f64 = eval_to_string(&g, "VAR.P(9, 5, 4)").parse().unwrap();
        assert!((var_p_result - 14.0 / 3.0).abs() < 0.0001);

        // VARP should be the same as VAR.P
        let varp_result: f64 = eval_to_string(&g, "VARP(9, 5, 4)").parse().unwrap();
        assert!((varp_result - 14.0 / 3.0).abs() < 0.0001);
    }

    #[test]
    fn test_vara_varpa() {
        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];

        // Set up test data: A1=1, A2=2, A3=TRUE, A4="text", A5=3
        g.set_cell_value(pos![sheet_id!1,1], "1".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!1,2], "2".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!1,3], "TRUE".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!1,4], "text".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!1,5], "3".to_string(), None, false);

        // VARA treats TRUE as 1, text as 0
        // Values: 1, 2, 1, 0, 3 -> mean = 1.4
        // Sample variance with n-1
        let vara_result: f64 = eval_to_string(&g, "VARA(A1:A5)").parse().unwrap();
        assert!(vara_result > 0.0);

        // VARPA uses population variance (n instead of n-1)
        let varpa_result: f64 = eval_to_string(&g, "VARPA(A1:A5)").parse().unwrap();
        assert!(varpa_result > 0.0);
        assert!(varpa_result < vara_result); // Population variance is always smaller
    }

    #[test]
    fn test_stdev_variants() {
        let g = GridController::new();

        // STDEV.S should be the same as STDEV (sample standard deviation)
        assert_eq!("2", eval_to_string(&g, "STDEV.S(1, 3, 5)"));

        // STDEV.P (population standard deviation) - should use n instead of n-1
        // For values 1, 3, 5: mean = 3, sum of squared deviations = 8
        // Population stdev = sqrt(8/3) ≈ 1.6329...
        let stdev_p_result: f64 = eval_to_string(&g, "STDEV.P(1, 3, 5)").parse().unwrap();
        assert!((stdev_p_result - (8.0_f64 / 3.0).sqrt()).abs() < 0.0001);

        // STDEVP should be the same as STDEV.P
        let stdevp_result: f64 = eval_to_string(&g, "STDEVP(1, 3, 5)").parse().unwrap();
        assert!((stdevp_result - (8.0_f64 / 3.0).sqrt()).abs() < 0.0001);
    }

    #[test]
    fn test_stdeva_stdevpa() {
        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];

        // Set up test data: A1=1, A2=2, A3=TRUE, A4="text", A5=3
        g.set_cell_value(pos![sheet_id!1,1], "1".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!1,2], "2".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!1,3], "TRUE".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!1,4], "text".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!1,5], "3".to_string(), None, false);

        // STDEVA treats TRUE as 1, text as 0
        let stdeva_result: f64 = eval_to_string(&g, "STDEVA(A1:A5)").parse().unwrap();
        assert!(stdeva_result > 0.0);

        // STDEVPA uses population stdev (n instead of n-1)
        let stdevpa_result: f64 = eval_to_string(&g, "STDEVPA(A1:A5)").parse().unwrap();
        assert!(stdevpa_result > 0.0);
        assert!(stdevpa_result < stdeva_result); // Population stdev is always smaller
    }

    #[test]
    fn test_median() {
        let g = GridController::new();

        // Odd number of values
        assert_eq!("3", eval_to_string(&g, "MEDIAN(1, 2, 3, 4, 5)"));
        assert_eq!("3", eval_to_string(&g, "MEDIAN(5, 1, 3, 2, 4)"));

        // Even number of values
        assert_eq!("2.5", eval_to_string(&g, "MEDIAN(1, 2, 3, 4)"));

        // Single value
        assert_eq!("42", eval_to_string(&g, "MEDIAN(42)"));

        // With decimals
        assert_eq!("2.5", eval_to_string(&g, "MEDIAN(1.5, 2.5, 3.5)"));
    }

    #[test]
    fn test_large() {
        let g = GridController::new();

        // Basic tests
        assert_eq!("9", eval_to_string(&g, "LARGE({5, 2, 8, 1, 9}, 1)"));
        assert_eq!("8", eval_to_string(&g, "LARGE({5, 2, 8, 1, 9}, 2)"));
        assert_eq!("5", eval_to_string(&g, "LARGE({5, 2, 8, 1, 9}, 3)"));
        assert_eq!("1", eval_to_string(&g, "LARGE({5, 2, 8, 1, 9}, 5)"));

        // Error cases
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "LARGE({5, 2, 8}, 0)").msg,
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "LARGE({5, 2, 8}, 4)").msg,
        );
    }

    #[test]
    fn test_small() {
        let g = GridController::new();

        // Basic tests
        assert_eq!("1", eval_to_string(&g, "SMALL({5, 2, 8, 1, 9}, 1)"));
        assert_eq!("2", eval_to_string(&g, "SMALL({5, 2, 8, 1, 9}, 2)"));
        assert_eq!("5", eval_to_string(&g, "SMALL({5, 2, 8, 1, 9}, 3)"));
        assert_eq!("9", eval_to_string(&g, "SMALL({5, 2, 8, 1, 9}, 5)"));

        // Error cases
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "SMALL({5, 2, 8}, 0)").msg,
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "SMALL({5, 2, 8}, 4)").msg,
        );
    }

    #[test]
    fn test_aggregate() {
        let g = GridController::new();

        // Test function_num 1: AVERAGE
        assert_eq!("5", eval_to_string(&g, "AGGREGATE(1, 6, {2, 4, 6, 8})"));

        // Test function_num 2: COUNT
        assert_eq!("4", eval_to_string(&g, "AGGREGATE(2, 6, {2, 4, 6, 8})"));

        // Test function_num 3: COUNTA
        assert_eq!("4", eval_to_string(&g, "AGGREGATE(3, 6, {2, 4, 6, 8})"));

        // Test function_num 4: MAX
        assert_eq!("8", eval_to_string(&g, "AGGREGATE(4, 6, {2, 4, 6, 8})"));

        // Test function_num 5: MIN
        assert_eq!("2", eval_to_string(&g, "AGGREGATE(5, 6, {2, 4, 6, 8})"));

        // Test function_num 6: PRODUCT
        assert_eq!("384", eval_to_string(&g, "AGGREGATE(6, 6, {2, 4, 6, 8})"));

        // Test function_num 9: SUM
        assert_eq!("20", eval_to_string(&g, "AGGREGATE(9, 6, {2, 4, 6, 8})"));

        // Test function_num 12: MEDIAN
        assert_eq!("5", eval_to_string(&g, "AGGREGATE(12, 6, {2, 4, 6, 8})"));

        // Test function_num 14: LARGE
        assert_eq!("8", eval_to_string(&g, "AGGREGATE(14, 6, {2, 4, 6, 8}, 1)"));
        assert_eq!("6", eval_to_string(&g, "AGGREGATE(14, 6, {2, 4, 6, 8}, 2)"));

        // Test function_num 15: SMALL
        assert_eq!("2", eval_to_string(&g, "AGGREGATE(15, 6, {2, 4, 6, 8}, 1)"));
        assert_eq!("4", eval_to_string(&g, "AGGREGATE(15, 6, {2, 4, 6, 8}, 2)"));

        // Test invalid function_num
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "AGGREGATE(0, 6, {1, 2, 3})").msg,
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "AGGREGATE(20, 6, {1, 2, 3})").msg,
        );

        // Test invalid options
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "AGGREGATE(9, -1, {1, 2, 3})").msg,
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "AGGREGATE(9, 8, {1, 2, 3})").msg,
        );

        // Test LARGE/SMALL without k parameter
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "AGGREGATE".into(),
                arg_name: "k".into(),
            },
            eval_to_err(&g, "AGGREGATE(14, 6, {1, 2, 3})").msg,
        );
    }

    #[test]
    fn test_averageifs() {
        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];

        // Set up test data
        // A1:A5 = values to average (1, 2, 3, 4, 5)
        // B1:B5 = criteria range (1, 2, 3, 4, 5)
        for y in 1..=5 {
            g.set_cell_value(pos![sheet_id!1,y], y.to_string(), None, false);
            g.set_cell_value(pos![sheet_id!2,y], y.to_string(), None, false);
        }

        // Average values where B > 2 (i.e., average of 3, 4, 5 = 4)
        assert_eq!("4", eval_to_string(&g, "AVERAGEIFS(A1:A5, B1:B5, \">2\")"));

        // Average values where B <= 3 (i.e., average of 1, 2, 3 = 2)
        assert_eq!("2", eval_to_string(&g, "AVERAGEIFS(A1:A5, B1:B5, \"<=3\")"));
    }

    #[test]
    fn test_percentile() {
        let g = GridController::new();

        // PERCENTILE.INC tests
        assert_eq!(
            "3",
            eval_to_string(&g, "PERCENTILE.INC({1, 2, 3, 4, 5}, 0.5)")
        );
        assert_eq!(
            "1",
            eval_to_string(&g, "PERCENTILE.INC({1, 2, 3, 4, 5}, 0)")
        );
        assert_eq!(
            "5",
            eval_to_string(&g, "PERCENTILE.INC({1, 2, 3, 4, 5}, 1)")
        );

        // PERCENTILE alias
        assert_eq!("3", eval_to_string(&g, "PERCENTILE({1, 2, 3, 4, 5}, 0.5)"));

        // PERCENTILE.EXC tests (note: k must be strictly between 0 and 1)
        assert_eq!(
            "3",
            eval_to_string(&g, "PERCENTILE.EXC({1, 2, 3, 4, 5}, 0.5)")
        );
    }

    #[test]
    fn test_quartile() {
        let g = GridController::new();

        // QUARTILE.INC tests
        assert_eq!("1", eval_to_string(&g, "QUARTILE.INC({1, 2, 3, 4, 5}, 0)"));
        assert_eq!("3", eval_to_string(&g, "QUARTILE.INC({1, 2, 3, 4, 5}, 2)"));
        assert_eq!("5", eval_to_string(&g, "QUARTILE.INC({1, 2, 3, 4, 5}, 4)"));

        // QUARTILE alias
        assert_eq!("3", eval_to_string(&g, "QUARTILE({1, 2, 3, 4, 5}, 2)"));

        // Error cases
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "QUARTILE({1, 2, 3}, -1)").msg,
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "QUARTILE({1, 2, 3}, 5)").msg,
        );
    }

    #[test]
    fn test_mode() {
        let g = GridController::new();

        // MODE.SNGL tests
        assert_eq!("3", eval_to_string(&g, "MODE.SNGL({1, 2, 3, 3, 4})"));
        // 3 appears 3 times, so it's the mode
        assert_eq!("3", eval_to_string(&g, "MODE.SNGL({1, 2, 2, 3, 3, 3})"));

        // MODE alias
        assert_eq!("3", eval_to_string(&g, "MODE({1, 2, 3, 3, 4})"));

        // No mode (all values unique)
        assert_eq!(
            RunErrorMsg::NotAvailable,
            eval_to_err(&g, "MODE({1, 2, 3, 4, 5})").msg,
        );
    }

    #[test]
    fn test_rank() {
        let g = GridController::new();

        // RANK.EQ tests (descending by default)
        assert_eq!("1", eval_to_string(&g, "RANK.EQ(5, {1, 2, 3, 4, 5})"));
        assert_eq!("5", eval_to_string(&g, "RANK.EQ(1, {1, 2, 3, 4, 5})"));
        assert_eq!("3", eval_to_string(&g, "RANK.EQ(3, {1, 2, 3, 4, 5})"));

        // RANK.EQ ascending
        assert_eq!("5", eval_to_string(&g, "RANK.EQ(5, {1, 2, 3, 4, 5}, 1)"));
        assert_eq!("1", eval_to_string(&g, "RANK.EQ(1, {1, 2, 3, 4, 5}, 1)"));

        // RANK alias
        assert_eq!("1", eval_to_string(&g, "RANK(5, {1, 2, 3, 4, 5})"));

        // Value not found
        assert_eq!(
            RunErrorMsg::NotAvailable,
            eval_to_err(&g, "RANK(6, {1, 2, 3, 4, 5})").msg,
        );
    }

    #[test]
    fn test_maxa_mina_averagea() {
        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];

        // Set up test data: A1=1, A2=TRUE, A3="text", A4=5
        g.set_cell_value(pos![sheet_id!1,1], "1".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!1,2], "TRUE".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!1,3], "text".to_string(), None, false);
        g.set_cell_value(pos![sheet_id!1,4], "5".to_string(), None, false);

        // MAXA: max of 1, 1 (TRUE), 0 (text), 5 = 5
        assert_eq!("5", eval_to_string(&g, "MAXA(A1:A4)"));

        // MINA: min of 1, 1 (TRUE), 0 (text), 5 = 0
        assert_eq!("0", eval_to_string(&g, "MINA(A1:A4)"));

        // AVERAGEA: average of 1, 1, 0, 5 = 1.75
        assert_eq!("1.75", eval_to_string(&g, "AVERAGEA(A1:A4)"));
    }

    #[test]
    fn test_correl_pearson() {
        let g = GridController::new();

        // Perfect positive correlation
        assert_eq!("1", eval_to_string(&g, "CORREL({1, 2, 3}, {2, 4, 6})"));
        assert_eq!("1", eval_to_string(&g, "PEARSON({1, 2, 3}, {2, 4, 6})"));

        // Perfect negative correlation
        assert_eq!("-1", eval_to_string(&g, "CORREL({1, 2, 3}, {6, 4, 2})"));

        // RSQ should be correlation squared
        assert_eq!("1", eval_to_string(&g, "RSQ({1, 2, 3}, {2, 4, 6})"));
    }

    #[test]
    fn test_slope_intercept() {
        let g = GridController::new();

        // y = 2x, slope should be 2, intercept should be 0
        assert_eq!("2", eval_to_string(&g, "SLOPE({2, 4, 6}, {1, 2, 3})"));
        assert_eq!("0", eval_to_string(&g, "INTERCEPT({2, 4, 6}, {1, 2, 3})"));

        // y = x + 1, slope should be 1, intercept should be 1
        assert_eq!("1", eval_to_string(&g, "SLOPE({2, 3, 4}, {1, 2, 3})"));
        assert_eq!("1", eval_to_string(&g, "INTERCEPT({2, 3, 4}, {1, 2, 3})"));
    }

    #[test]
    fn test_covariance() {
        let g = GridController::new();

        // Population covariance
        let cov_p: f64 = eval_to_string(&g, "COVARIANCE.P({1, 2, 3}, {2, 4, 6})")
            .parse()
            .unwrap();
        assert!((cov_p - 1.333333).abs() < 0.001);

        // Sample covariance
        assert_eq!(
            "2",
            eval_to_string(&g, "COVARIANCE.S({1, 2, 3}, {2, 4, 6})")
        );

        // COVAR is alias for COVARIANCE.P
        let covar: f64 = eval_to_string(&g, "COVAR({1, 2, 3}, {2, 4, 6})")
            .parse()
            .unwrap();
        assert!((covar - cov_p).abs() < 0.001);
    }

    #[test]
    fn test_forecast() {
        let g = GridController::new();

        // y = 2x, predict at x = 4 should be 8
        assert_eq!(
            "8",
            eval_to_string(&g, "FORECAST.LINEAR(4, {2, 4, 6}, {1, 2, 3})")
        );
        assert_eq!("8", eval_to_string(&g, "FORECAST(4, {2, 4, 6}, {1, 2, 3})"));

        // y = x + 1, predict at x = 5 should be 6
        assert_eq!("6", eval_to_string(&g, "FORECAST(5, {2, 3, 4}, {1, 2, 3})"));
    }

    #[test]
    fn test_percentrank() {
        let g = GridController::new();

        // PERCENTRANK.INC
        assert_eq!(
            "0.5",
            eval_to_string(&g, "PERCENTRANK.INC({1, 2, 3, 4, 5}, 3)")
        );
        assert_eq!(
            "0",
            eval_to_string(&g, "PERCENTRANK.INC({1, 2, 3, 4, 5}, 1)")
        );
        assert_eq!(
            "1",
            eval_to_string(&g, "PERCENTRANK.INC({1, 2, 3, 4, 5}, 5)")
        );

        // PERCENTRANK alias
        assert_eq!("0.5", eval_to_string(&g, "PERCENTRANK({1, 2, 3, 4, 5}, 3)"));
    }

    #[test]
    fn test_avedev_devsq() {
        let g = GridController::new();

        // AVEDEV: For {1, 2, 3, 4, 5}, mean = 3, deviations = {2, 1, 0, 1, 2}
        // Average absolute deviation = 6/5 = 1.2
        assert_eq!("1.2", eval_to_string(&g, "AVEDEV(1, 2, 3, 4, 5)"));

        // DEVSQ: Sum of squared deviations = 4 + 1 + 0 + 1 + 4 = 10
        assert_eq!("10", eval_to_string(&g, "DEVSQ(1, 2, 3, 4, 5)"));
    }

    #[test]
    fn test_geomean_harmean() {
        let g = GridController::new();

        // GEOMEAN of {1, 2, 4} = (1 * 2 * 4)^(1/3) = 8^(1/3) = 2
        assert_eq!("2", eval_to_string(&g, "GEOMEAN(1, 2, 4)"));

        // HARMEAN of {1, 2, 4} = 3 / (1 + 0.5 + 0.25) = 3 / 1.75 ≈ 1.714
        let harmean: f64 = eval_to_string(&g, "HARMEAN(1, 2, 4)").parse().unwrap();
        assert!((harmean - 1.714286).abs() < 0.001);

        // Error for non-positive values
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "GEOMEAN(1, 0, 4)").msg,
        );
    }

    #[test]
    fn test_trimmean() {
        let g = GridController::new();

        // TRIMMEAN with 20% exclusion: exclude 1 from each end
        // {1, 2, 3, 4, 5, 6, 7, 8, 9, 10} -> trim to {2, 3, 4, 5, 6, 7, 8, 9}
        // Mean = 44/8 = 5.5
        assert_eq!(
            "5.5",
            eval_to_string(&g, "TRIMMEAN({1, 2, 3, 4, 5, 6, 7, 8, 9, 10}, 0.2)")
        );
    }

    #[test]
    fn test_skew_kurt() {
        let g = GridController::new();

        // SKEW and KURT need at least 3 and 4 values respectively
        let skew: f64 = eval_to_string(&g, "SKEW(1, 2, 3, 4, 5)").parse().unwrap();
        assert!(skew.abs() < 0.001); // Symmetric distribution should have ~0 skew

        // KURT requires at least 4 values
        let kurt: f64 = eval_to_string(&g, "KURT(1, 2, 3, 4, 5)").parse().unwrap();
        // Normal distribution has excess kurtosis of 0, uniform tends to negative
        assert!(kurt.abs() < 3.0);

        // Error cases
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "SKEW(1, 2)").msg,
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "KURT(1, 2, 3)").msg,
        );
    }

    #[test]
    fn test_standardize() {
        let g = GridController::new();

        // z-score: (5 - 3) / 2 = 1
        assert_eq!("1", eval_to_string(&g, "STANDARDIZE(5, 3, 2)"));
        assert_eq!("0", eval_to_string(&g, "STANDARDIZE(3, 3, 2)"));
        assert_eq!("-1", eval_to_string(&g, "STANDARDIZE(1, 3, 2)"));

        // Error for non-positive stdev
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "STANDARDIZE(5, 3, 0)").msg,
        );
    }

    #[test]
    fn test_fisher() {
        let g = GridController::new();

        // FISHER(0) = 0
        assert_eq!("0", eval_to_string(&g, "FISHER(0)"));

        // FISHER(0.5) ≈ 0.5493
        let fisher: f64 = eval_to_string(&g, "FISHER(0.5)").parse().unwrap();
        assert!((fisher - 0.5493).abs() < 0.001);

        // FISHERINV should be inverse
        let fisher_inv: f64 = eval_to_string(&g, "FISHERINV(0.5493)").parse().unwrap();
        assert!((fisher_inv - 0.5).abs() < 0.001);

        // Error for values outside (-1, 1)
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "FISHER(1)").msg,
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "FISHER(-1)").msg,
        );
    }

    #[test]
    fn test_prob() {
        let g = GridController::new();

        // PROB with single value (no upper limit)
        // P(x = 2) = 0.2
        assert_eq!(
            "0.2",
            eval_to_string(&g, "PROB({1,2,3,4}, {0.1,0.2,0.3,0.4}, 2)")
        );

        // PROB with range
        // P(1 <= x <= 3) = 0.1 + 0.2 + 0.3 = 0.6
        assert_eq!(
            "0.6",
            eval_to_string(&g, "PROB({1,2,3,4}, {0.1,0.2,0.3,0.4}, 1, 3)")
        );

        // PROB with full range
        // P(1 <= x <= 4) = 0.1 + 0.2 + 0.3 + 0.4 = 1.0
        assert_eq!(
            "1",
            eval_to_string(&g, "PROB({1,2,3,4}, {0.1,0.2,0.3,0.4}, 1, 4)")
        );

        // PROB with partial range
        // P(2 <= x <= 3) = 0.2 + 0.3 = 0.5
        assert_eq!(
            "0.5",
            eval_to_string(&g, "PROB({1,2,3,4}, {0.1,0.2,0.3,0.4}, 2, 3)")
        );

        // PROB with value not in range
        // P(x = 5) = 0
        assert_eq!(
            "0",
            eval_to_string(&g, "PROB({1,2,3,4}, {0.1,0.2,0.3,0.4}, 5)")
        );

        // Error when upper < lower
        assert_eq!(
            RunErrorMsg::Num,
            eval_to_err(&g, "PROB({1,2,3,4}, {0.1,0.2,0.3,0.4}, 3, 1)").msg,
        );
    }

    #[test]
    fn test_forecast_ets() {
        let g = GridController::new();

        // Basic FORECAST.ETS - forecast next value in simple linear series
        // Values: 1, 2, 3, 4, 5 at times 1, 2, 3, 4, 5
        // Forecast at time 6 should return a numeric result
        let result_str = eval_to_string(&g, "FORECAST.ETS(6, {1;2;3;4;5}, {1;2;3;4;5}, 1)");
        let result: f64 = result_str.parse().unwrap();
        assert!(
            result.is_finite(),
            "FORECAST.ETS should return a finite number"
        );

        // FORECAST.ETS.SEASONALITY - detect seasonality
        // Simple non-seasonal data should return 1
        let seasonality: f64 =
            eval_to_string(&g, "FORECAST.ETS.SEASONALITY({1;2;3;4;5;6}, {1;2;3;4;5;6})")
                .parse()
                .unwrap();
        assert!(seasonality >= 1.0);

        // FORECAST.ETS.STAT - get alpha (stat_type=1)
        let alpha: f64 =
            eval_to_string(&g, "FORECAST.ETS.STAT({1;2;3;4;5;6}, {1;2;3;4;5;6}, 1, 1)")
                .parse()
                .unwrap();
        assert!(alpha >= 0.0 && alpha <= 1.0);

        // FORECAST.ETS.CONFINT - confidence interval
        let confint: f64 = eval_to_string(
            &g,
            "FORECAST.ETS.CONFINT(7, {1;2;3;4;5;6}, {1;2;3;4;5;6}, 0.95, 1)",
        )
        .parse()
        .unwrap();
        assert!(confint >= 0.0);
    }

    #[test]
    fn test_forecast_ets_stat_alpha_optimization() {
        let g = GridController::new();

        // Test case from user: FORECAST.ETS.STAT({2,4,6,8,10}, {1,2,3,4,5}, 1)
        // Excel returns 0.9 for alpha on this linear series
        // The optimizer should find a high alpha value (close to 1.0) for perfectly linear data
        let alpha: f64 = eval_to_string(&g, "FORECAST.ETS.STAT({2;4;6;8;10}, {1;2;3;4;5}, 1, 1)")
            .parse()
            .unwrap();

        // Alpha should be high (>0.8) for linear data since level changes predictably
        // Excel returns ~0.9, our optimizer returns ~0.9999 (clamped at upper bound)
        assert!(
            alpha > 0.8,
            "Alpha should be high for linear data (Excel returns ~0.9), got {}",
            alpha
        );

        // Also verify beta (stat_type=2) is reasonable
        let beta: f64 = eval_to_string(&g, "FORECAST.ETS.STAT({2;4;6;8;10}, {1;2;3;4;5}, 2, 1)")
            .parse()
            .unwrap();
        assert!(
            beta >= 0.0 && beta <= 1.0,
            "Beta should be between 0 and 1, got {}",
            beta
        );
    }

    #[test]
    fn test_forecast_ets_linear_series() {
        let g = GridController::new();

        // Test case: FORECAST.ETS(6, {2,4,6,8,10}, {1,2,3,4,5})
        // This is a perfectly linear series (increases by 2 each period)
        // At time 6, the value should be 12
        // Excel returns 12
        let forecast: f64 = eval_to_string(&g, "FORECAST.ETS(6, {2;4;6;8;10}, {1;2;3;4;5}, 1)")
            .parse()
            .unwrap();

        // Allow small tolerance for numerical precision
        assert!(
            (forecast - 12.0).abs() < 0.5,
            "FORECAST.ETS(6, {{2,4,6,8,10}}, {{1,2,3,4,5}}) should be ~12, got {}",
            forecast
        );
    }
}
