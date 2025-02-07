use std::str::FromStr;

use wasm_bindgen::prelude::*;

use quadratic_core::{
    a1::A1Context,
    formulas::{parse_and_check_formula, parse_formula::parse_formula_results},
    grid::SheetId,
    Pos,
};

#[wasm_bindgen(js_name = "parseFormula")]
pub fn parse_formula(
    formula_string: &str,
    ctx: &str,
    sheet_id: &str,
    x: i32,
    y: i32,
) -> Result<String, String> {
    let ctx = serde_json::from_str::<A1Context>(ctx).expect("invalid A1Context");
    let sheet_id = SheetId::from_str(sheet_id).map_err(|e| e.to_string())?;

    let results = parse_formula_results(formula_string, ctx, sheet_id, x, y);
    serde_json::to_string(&results).map_err(|e| e.to_string())
}

#[wasm_bindgen(js_name = "checkFormula")]
pub fn check_formula(
    formula_string: &str,
    ctx: &str,
    sheet_id: &str,
    x: i32,
    y: i32,
) -> Result<bool, String> {
    let ctx = serde_json::from_str::<A1Context>(ctx).map_err(|e| e.to_string())?;
    let sheet_id = SheetId::from_str(sheet_id).map_err(|e| e.to_string())?;
    let pos = Pos {
        x: x as i64,
        y: y as i64,
    }
    .to_sheet_pos(sheet_id);

    Ok(parse_and_check_formula(formula_string, &ctx, pos))
}
