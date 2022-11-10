use anyhow::{Context, Result};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, fmt};

mod cell;

pub use cell::Cell;

/// Sparse grid of cells.
#[derive(Serialize, Deserialize, Default, Clone)]
#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub struct Grid {
    /// Map from X to column.
    pub columns: rpds::RedBlackTreeMap<i64, Column>,
}
impl fmt::Debug for Grid {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_map().entries(&self.columns).finish()
    }
}
#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
impl Grid {
    /// Constructs a new empty grid.
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen(constructor))]
    pub fn new() -> Self {
        Grid::default()
    }

    /// Returns whether the grid is valid:
    /// - Every [Column] is valid
    pub fn is_valid(&self) -> bool {
        self.columns.iter().all(|(_, col)| col.is_valid())
    }

    /// Returns a cell in the grid.
    pub fn get_cell(&self, pos: Pos) -> &Cell {
        match self.columns.get(&pos.x) {
            Some(col) => col.get_cell(pos.y),
            None => &Cell::Empty,
        }
    }

    /// Sets a cell in the grid, returning its old contents.
    pub fn set_cell(&mut self, pos: Pos, contents: Cell) -> Result<Cell> {
        match self.columns.get_mut(&pos.x) {
            Some(col) => col.set_cell(pos.y, contents),
            None => {
                // Make a new column containing just this cell.
                let mut col = Column::default();
                col.set_cell(pos.y, contents)?;
                self.columns.insert_mut(pos.x, col);
                // The cell didn't exist before.
                Ok(Cell::Empty)
            }
        }
    }
}

/// Vertical column of the spreadsheet.
#[derive(Serialize, Deserialize, Default, Clone, PartialEq)]
pub struct Column {
    /// Map from Y to the block starting at that Y coordinate.
    pub blocks: BTreeMap<i64, Block>,
}
impl fmt::Debug for Column {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut ret = f.debug_struct("Column");
        for (top, block) in &self.blocks {
            ret.field(&format!("{:?}", *top..top + block.len() as i64), block);
        }
        ret.finish()
    }
}
impl Column {
    /// Returns a cell in the column.
    pub fn get_cell(&self, y: i64) -> &Cell {
        match self.blocks.range(..=y).next_back() {
            Some((top, block)) => block.get_cell(y - top).unwrap_or(&Cell::Empty),
            None => &Cell::Empty,
        }
    }
    /// Sets a cell in the column, returning its old contents.
    pub fn set_cell(&mut self, y: i64, contents: Cell) -> Result<Cell> {
        if contents.is_empty() {
            return self.clear_cell(y);
        }

        let mut iter = self.blocks.range_mut(..=(y + 1)).rev().peekable();
        let below = iter.next_if(|(&top, _)| top == y + 1);
        let at = iter.next_if(|(&top, block)| top + block.len() as i64 > y);
        let above = iter.next_if(|(&top, block)| top + block.len() as i64 == y);

        if let Some((top, block)) = at {
            // The cell already exists in a block. Set its value.
            let offset = y - top;
            block.set_cell(offset, contents)
        } else if let Some((_, above)) = above {
            // There is a block that ends directly above this cell, so append
            // the cell to that block.
            above.push_bottom(contents);
            if let Some((_, below)) = below {
                // There is a block that starts directly below this cell, so
                // merge it with the block we just appended to.
                above.merge(below);
                self.blocks.remove(&(y + 1));
            }
            // The cell didn't exist before.
            Ok(Cell::Empty)
        } else if let Some((_, below)) = below {
            // There is a block that starts directly below this cell, so insert
            // the cell at the top of it.
            below.insert_top(contents);
            let block = self.blocks.remove(&(y + 1)).expect("block vanished");
            self.blocks.insert(y, block);
            // The cell didn't exist before.
            Ok(Cell::Empty)
        } else {
            // There is no block nearby, so add a new one.
            let block = Block {
                contents: rpds::vector![contents],
            };
            self.blocks.insert(y, block);
            // The cell didn't exist before.
            Ok(Cell::Empty)
        }
    }
    /// Clears a cell in the column, returning its old contents.
    pub fn clear_cell(&mut self, y: i64) -> Result<Cell> {
        if let Some((&top, block)) = self.block_containing(y) {
            let ret = block.get_cell(y - top)?.clone();

            if block.len() == 1 {
                // The cell is the entire block. Just delete the block.
                self.blocks.remove(&y);
            } else if top == y {
                // The cell is at the top of the block. Create a new block
                // missing that cell.
                let new_block = Block {
                    contents: block.contents.iter().skip(1).cloned().collect(),
                };
                self.blocks.insert(top + 1, new_block);
            } else if top + block.len() as i64 - 1 == y {
                // The cell is at the bottom of the block. Simply remove it.
                block.contents.drop_last_mut();
            } else {
                // The cell is in the middle of the block. Split the block.
                let mut iter = block.contents.iter().cloned();
                let above = Block {
                    contents: (top..y).map_while(|_| iter.next()).collect(),
                };
                let below = Block {
                    contents: iter.collect(),
                };
                *block = above;
                self.blocks.insert(y + 1, below);
            }

            Ok(ret)
        } else {
            // The cell does not exist. There is nothing to do.
            Ok(Cell::Empty)
        }
    }

    /// Checks whether the column is valid:
    /// - Every [Block] is valid
    /// - There must be no adjacent/overlapping blocks
    pub fn is_valid(&self) -> bool {
        self.blocks.iter().all(|(_, block)| block.is_valid())
            && self
                .blocks
                .iter()
                .tuple_windows()
                .all(|((y1, block1), (y2, _block2))| (y1 + block1.len() as i64) < *y2)
    }

    /// Returns a mutable reference to the block containing row `y`.
    fn block_containing(&mut self, y: i64) -> Option<(&i64, &mut Block)> {
        self.blocks
            .range_mut(..=y)
            .last()
            .filter(|(&top, block)| top + block.len() as i64 > y)
    }
}

/// Width-1 vertical block of cells.
#[derive(Serialize, Deserialize, Default, Clone, PartialEq)]
pub struct Block {
    /// Cells in the block.
    ///
    /// TOOD: Consider using Apache Arrow or some other homogenous list
    /// structure, perhaps in combination with a tree.
    pub contents: rpds::Vector<Cell>,
}
impl fmt::Debug for Block {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_list().entries(&self.contents).finish()
    }
}
impl Block {
    /// Returns whether the block is valid:
    /// - Contains at least one cell
    /// - All cells are nonempty
    pub fn is_valid(&self) -> bool {
        !self.contents.is_empty() && self.contents.iter().all(|cell| !cell.is_empty())
    }

    /// Returns the number of cells in the block.
    pub fn len(&self) -> usize {
        self.contents.len()
    }

    /// Returns a cell in the block, or an error if the offset is out of range.
    pub fn get_cell(&self, offset: i64) -> Result<&Cell> {
        let offset: usize = offset.try_into().context("cell offset outside block")?;
        self.contents
            .get(offset)
            .context("cell offset outside block")
    }
    /// Sets an existing cell in the block, returning its old contents, or an
    /// error if the offset is out of range.
    pub fn set_cell(&mut self, offset: i64, contents: Cell) -> Result<Cell> {
        let ret = self.get_cell(offset)?.clone();

        // Casting to `usize` here is fine because `get_cell()` already
        // confirmed it's in range.
        self.contents.set_mut(offset as usize, contents);

        Ok(ret)
    }
    /// Appends a cell to the bottom of the block in O(1) time.
    pub fn push_bottom(&mut self, contents: Cell) {
        self.contents.push_back_mut(contents);
    }
    /// Inserts a cell at the top of the block in O(n) time.
    pub fn insert_top(&mut self, contents: Cell) {
        let mut new = Block {
            contents: rpds::vector![contents],
        };
        new.merge(self);
        *self = new;
    }
    /// Merges the block with another directly below it.
    pub fn merge(&mut self, below: &Block) {
        self.contents.extend(below.contents.iter().cloned());
    }
}

/// Rectangular range of cells.
#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
pub struct Rect {
    /// Left edge (column)
    pub x: i64,
    /// Top edge (row)
    pub y: i64,
    /// Width (columns)
    pub w: u32,
    /// Height (rows)
    pub h: u32,
}
impl Rect {
    /// Returns whether the rectangle contains a position.
    pub fn contains(&self, pos: Pos) -> bool {
        let x_contains = self.x <= pos.x && pos.x < self.x + self.w as i64;
        let y_contains = self.y <= pos.y && pos.y < self.y + self.h as i64;
        x_contains && y_contains
    }
}

/// Cell position.
#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
pub struct Pos {
    /// Column
    pub x: i64,
    /// Row
    pub y: i64,
}
