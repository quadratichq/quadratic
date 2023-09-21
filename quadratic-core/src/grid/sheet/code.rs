use std::{collections::HashSet, time::SystemTime};

use super::Sheet;
use crate::{
    grid::{CellRef, CodeCellLanguage, CodeCellValue},
    wasm_bindings::{js::runPython, JsCodeResult},
    CellValue, Pos, Rect,
};

impl Sheet {
    pub fn get_cell_value_strings(&self, rect: Rect) -> Vec<String> {
        let columns_iter = rect
            .x_range()
            .filter_map(|x| Some((x, self.get_column(x)?)));

        // Fetch ordinary value cells.
        let ordinary_cells = columns_iter.clone().flat_map(|(x, column)| {
            column
                .values
                .values_in_range(rect.y_range())
                .map(move |(y, value)| (x, y, column, value, None))
        });

        // todo: filter out spills from code_output_cells

        // Fetch values from code cells.
        let code_output_cells = columns_iter.flat_map(move |(x, column)| {
            column
                .spills
                .blocks_of_range(rect.y_range())
                .filter_map(move |block| {
                    let code_cell_pos = self.cell_ref_to_pos(block.content.value)?;
                    let code_cell = self.code_cells.get(&block.content.value)?;
                    let dx = (x - code_cell_pos.x) as u32;
                    let dy = (block.y - code_cell_pos.y) as u32;

                    Some((0..block.len()).filter_map(move |y_within_block| {
                        let y = block.y + y_within_block as i64;
                        let dy = dy + y_within_block as u32;
                        Some((
                            x,
                            y,
                            column,
                            code_cell.get_output_value(dx, dy)?,
                            ((dx, dy) == (0, 0)).then_some(code_cell.language),
                        ))
                    }))
                })
                .flatten()
        });

        itertools::chain(ordinary_cells, code_output_cells)
            .map(|(x, y, column, value, language)| value.to_string())
            .collect()
    }

    /// sets the code cell
    pub async fn set_cell_code(
        &mut self,
        cell_ref: CellRef,
        language: CodeCellLanguage,
        code_string: String,
    ) -> Result<(), ()> {
        match language {
            CodeCellLanguage::Python => {
                let promise = js_sys::Promise::resolve(&runPython(code_string));
                let results = wasm_bindgen_futures::JsFuture::from::<JsCodeResult>(promise).await?;
                self.code_cells.insert(
                    cell_ref,
                    CodeCellValue {
                        language: results.language,
                        code_string,
                        formatted_code_string: results.formatted_code,
                        last_modified: SystemTime::now().to_string(),
                        output: results.array_output,
                    },
                );
            }
            _ => {
                panic!("Language {} is not supported yet", language.to_string())
            }
        }
    }

    /// Sets or deletes a code cell value.
    pub fn set_code_cell_value(&mut self, pos: Pos, code_cell: Option<CodeCellValue>) {
        let cell_ref = self.get_or_create_cell_ref(pos);
        // TODO: unspill!
        self.code_cells.remove(&cell_ref);
        if let Some(code_cell) = code_cell {
            self.code_cells.insert(cell_ref, code_cell);
        }
        // TODO: spill (or have some other way to handle new code results)
    }

    /// Returns a code cell value.
    pub fn get_code_cell(&self, pos: Pos) -> Option<&CodeCellValue> {
        self.code_cells.get(&self.try_get_cell_ref(pos)?)
    }

    /// Returns a code cell value.
    pub fn get_code_cell_from_ref(&self, cell_ref: CellRef) -> Option<&CodeCellValue> {
        self.code_cells.get(&cell_ref)
    }

    pub fn get_code_cell_value(&self, pos: Pos) -> Option<CellValue> {
        let column = self.get_column(pos.x)?;
        let block = column.spills.get(pos.y)?;
        let code_cell_pos = self.cell_ref_to_pos(block)?;
        let code_cell = self.code_cells.get(&block)?;
        code_cell.get_output_value(
            (pos.x - code_cell_pos.x) as u32,
            (pos.y - code_cell_pos.y) as u32,
        )
    }

    /// Returns an iterator over all locations containing code cells that may
    /// spill into `region`.
    pub fn iter_code_cells_locations_in_region(
        &self,
        region: Rect,
    ) -> impl Iterator<Item = CellRef> {
        // Scan spilled cells to find code cells. TODO: this won't work for
        // unspilled code cells
        let code_cell_refs: HashSet<CellRef> = self
            .columns
            .range(region.x_range())
            .flat_map(|(_x, column)| {
                column
                    .spills
                    .blocks_covering_range(region.y_range())
                    .map(|block| block.content().value)
            })
            .collect();

        code_cell_refs.into_iter()
    }

    pub fn iter_code_cells_locations(&self) -> impl '_ + Iterator<Item = CellRef> {
        self.code_cells.keys().copied()
    }

    // fn unspill(&mut self, source: CellRef) {
    //     todo!("unspill cells from {source:?}");
    // }
}
