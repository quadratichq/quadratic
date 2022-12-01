use anyhow::{ensure, Result};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fmt;
use std::ops::RangeInclusive;

mod cell;
mod command;
mod controller;
mod position;

pub use cell::*;
pub use command::*;
pub use controller::*;
pub use position::*;

/// Sparse grid of cells.
#[derive(Serialize, Deserialize, Default, Clone, PartialEq)]
pub struct Grid {
    /// Map from X to column.
    pub columns: BTreeMap<i64, Column>,
}
impl fmt::Debug for Grid {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_map().entries(&self.columns).finish()
    }
}
impl Grid {
    /// Constructs a new empty grid.
    pub fn new() -> Self {
        Grid::default()
    }

    /// Returns whether the grid is valid:
    /// - Every column is valid (see [`Column::is_valid()`])
    pub fn is_valid(&self) -> bool {
        self.columns.iter().all(|(_x, col)| col.is_valid())
    }

    /// Returns a cell in the grid.
    pub fn get_cell(&self, pos: Pos) -> &Cell {
        match self.columns.get(&pos.x) {
            Some(col) => col.get_cell(pos.y),
            None => &Cell::Empty,
        }
    }

    /// Sets a cell in the grid, returning its old contents.
    pub fn set_cell(&mut self, pos: Pos, contents: Cell) -> Cell {
        match self.columns.get_mut(&pos.x) {
            Some(col) => {
                let ret = col.set_cell(pos.y, contents);
                if col.blocks.is_empty() {
                    self.columns.remove(&pos.x);
                }
                ret
            }
            None => {
                if !contents.is_empty() {
                    // Make a new column containing just this cell.
                    let mut col = Column::default();
                    col.set_cell(pos.y, contents);
                    self.columns.insert(pos.x, col);
                }
                // The cell didn't exist before.
                Cell::Empty
            }
        }
    }

    /// Returns the bounds of the farthest cells in the grid or `None` if the
    /// grid is empty.
    pub fn bounds(&self) -> Option<Rect> {
        let min_x = *self.columns.keys().next()?;
        let max_x = *self.columns.keys().last()?;
        let min_y = self.columns.values().filter_map(Column::min_y).min()?;
        let max_y = self.columns.values().filter_map(Column::max_y).max()?;
        Some(Rect::from_span(
            Pos { x: min_x, y: min_y },
            Pos { x: max_x, y: max_y },
        ))
    }

    /// Returns the bounds of the farthest cells in the grid considering only
    /// the ones within `region`, or `None` if that region is empty.
    pub fn bounds_within(&self, region: Rect) -> Option<Rect> {
        let min_x = *self.columns.range(region.x_range()).next()?.0;
        let max_x = *self.columns.range(region.x_range()).last()?.0;
        let min_y = self
            .columns
            .values()
            .filter_map(|col| col.min_y_in_range(region.y_range()))
            .max()?;
        let max_y = self
            .columns
            .values()
            .filter_map(|col| col.max_y_in_range(region.y_range()))
            .min()?;

        Some(Rect::from_span(
            Pos { x: min_x, y: min_y },
            Pos { x: max_x, y: max_y },
        ))
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
            ret.field(&top.to_string(), block);
        }
        ret.finish()
    }
}
impl Column {
    /// Returns a cell in the column.
    pub fn get_cell(&self, y: i64) -> &Cell {
        match self.blocks.range(..=y).next_back() {
            Some((_, block)) => block.get_cell(y).unwrap_or(&Cell::Empty),
            None => &Cell::Empty,
        }
    }
    /// Sets a cell in the column, returning its old contents.
    pub fn set_cell(&mut self, y: i64, contents: Cell) -> Cell {
        if contents.is_empty() {
            return self.clear_cell(y);
        }

        let mut iter = self.blocks.range_mut(..=(y + 1)).rev().peekable();
        let below = iter.next_if(|(_, block)| block.top() == y + 1);
        let at = iter.next_if(|(_, block)| block.y_range().contains(&y));
        let above = iter.next_if(|(_, block)| block.bottom() == y - 1);

        if let Some((_, block)) = at {
            // The cell already exists in a block. Set its value.
            block.set_cell(y, contents).expect("wrong block")
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
            Cell::Empty
        } else if let Some((_, below)) = below {
            // There is a block that starts directly below this cell, so insert
            // the cell at the top of it.
            below.insert_top(contents);
            let block = self.blocks.remove(&(y + 1)).expect("block vanished");
            self.blocks.insert(y, block);
            // The cell didn't exist before.
            Cell::Empty
        } else {
            // There is no block nearby, so add a new one.
            let block = Block {
                top: y,
                cells: vec![contents],
            };
            self.blocks.insert(y, block);
            // The cell didn't exist before.
            Cell::Empty
        }
    }
    /// Clears a cell in the column, returning its old contents.
    pub fn clear_cell(&mut self, y: i64) -> Cell {
        if let Some((&top, block)) = self.block_containing_mut(y) {
            let ret = block.get_cell(y).expect("wrong block").clone();

            if block.len() == 1 {
                // The cell is the entire block. Just delete the block.
                self.blocks.remove(&y);
            } else if top == y {
                // The cell is at the top of the block. Delete the block
                // containing it and create a new block missing that cell.
                let new_block = Block {
                    top: y + 1,
                    cells: block.cells.iter().skip(1).cloned().collect(),
                };
                self.blocks.remove(&top);
                self.blocks.insert(top + 1, new_block);
            } else if block.bottom() == y {
                // The cell is at the bottom of the block. Simply remove it.
                block.cells.pop();
            } else {
                // The cell is in the middle of the block.
                let mut iter = block.cells.iter().cloned();

                // The block above gets everything up to the `y`th value, but
                // not including it.
                let above = Block {
                    top,
                    cells: (top..y).map_while(|_| iter.next()).collect(),
                };

                // Skip the `y`th value.
                iter.next();

                // The block below gets all the rest.
                let below = Block {
                    top: y + 1,
                    cells: iter.collect(),
                };

                *block = above;
                self.blocks.insert(y + 1, below);
            }

            ret
        } else {
            // The cell does not exist. There is nothing to do.
            Cell::Empty
        }
    }

    /// Checks whether the column is valid:
    /// - Contains at least one block
    /// - Every block is valid (see [`Block::is_valid()`])
    /// - There must be no adjacent/overlapping blocks
    pub fn is_valid(&self) -> bool {
        !self.blocks.is_empty()
            && self
                .blocks
                .iter()
                .all(|(&y, block)| y == block.top && block.is_valid())
            && self
                .blocks
                .iter()
                .tuple_windows()
                .all(|((_, block1), (_, block2))| block1.bottom() + 1 < block2.top())
    }

    /// Returns a mutable reference to the block containing row `y`, or `None`
    /// if no such block exists.
    fn block_containing_mut(&mut self, y: i64) -> Option<(&i64, &mut Block)> {
        self.blocks
            .range_mut(..=y)
            .last()
            .filter(|(_, block)| block.y_range().contains(&y))
    }
    /// Returns the block containing row `y`, or `None` if no such block exists.
    fn block_containing(&self, y: i64) -> Option<(&i64, &Block)> {
        self.blocks
            .range(..=y)
            .last()
            .filter(|(_, block)| block.y_range().contains(&y))
    }
    /// Returns an iterator over the blocks overlapping `y_range`.
    fn blocks_overlapping_range(
        &self,
        y_range: RangeInclusive<i64>,
    ) -> std::collections::btree_map::Range<'_, i64, Block> {
        // If there is a block containing the start of the range, start with
        // that block. Otherwise, start at the top of the range.
        let start_key = match self.block_containing(*y_range.start()) {
            Some((top, _)) => *top,
            None => *y_range.start(),
        };
        let end_key = *y_range.end();
        self.blocks.range(start_key..=end_key)
    }

    /// Returns an iterator over the cells within `y_range`.
    pub fn cells_in_range(
        &self,
        y_range: RangeInclusive<i64>,
    ) -> impl Iterator<Item = (i64, &Cell)> {
        self.blocks_overlapping_range(y_range.clone())
            .flat_map(move |(_, block)| block.cells_in_range(y_range.clone()))
    }

    /// Returns the minimum Y value of a non-empty cell, or `None` if the column
    /// is empty.
    pub fn min_y(&self) -> Option<i64> {
        self.blocks.values().map(Block::top).min()
    }
    /// Returns the maximum Y value of a non-empty cell, or `None` if the column
    /// is empty.
    pub fn max_y(&self) -> Option<i64> {
        self.blocks.values().map(Block::bottom).max()
    }

    /// Returns the minimum Y value of a non-empty cell within `range`, or `None`
    /// if the column is empty in that range.
    pub fn min_y_in_range(&self, y_range: RangeInclusive<i64>) -> Option<i64> {
        self.blocks_overlapping_range(y_range.clone())
            .next()
            .map(|(&top, _block)| std::cmp::max(top, *y_range.start()))
    }
    /// Returns the maximum Y value of a non-empty cell within `range`, or
    /// `None` if the column is empty in that range.
    pub fn max_y_in_range(&self, y_range: RangeInclusive<i64>) -> Option<i64> {
        self.blocks_overlapping_range(y_range.clone())
            .last()
            .map(|(_, block)| std::cmp::min(block.bottom(), *y_range.end()))
    }
}

/// Width-1 vertical block of cells.
#[derive(Serialize, Deserialize, Default, Clone, PartialEq)]
pub struct Block {
    /// Y coordinates of the topmost cell in the column.
    top: i64,

    /// Cells in the block.
    ///
    /// TODO: Consider using Apache Arrow or some other homogenous list
    /// structure, perhaps in combination with a tree.
    cells: Vec<Cell>,
}
impl fmt::Debug for Block {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Block")
            .field("y_range", &self.y_range())
            .field("cells", &self.cells)
            .finish()
    }
}
impl Block {
    /// Returns whether the block is valid:
    /// - Contains at least one cell
    /// - All cells are nonempty
    pub fn is_valid(&self) -> bool {
        !self.cells.is_empty() && self.cells.iter().all(|cell| !cell.is_empty())
    }

    /// Returns the number of cells in the block.
    pub fn len(&self) -> usize {
        self.cells.len()
    }
    /// Returns the top (min Y coord) of the block.
    pub fn top(&self) -> i64 {
        self.top
    }
    /// Returns the bottom (max Y coord) of the block.
    pub fn bottom(&self) -> i64 {
        self.top + self.len() as i64 - 1
    }
    /// Returns the range of Y values spanned by the block.
    pub fn y_range(&self) -> RangeInclusive<i64> {
        self.top()..=self.bottom()
    }

    /// Returns a slice of the cells in the block that are within `y_range`.
    pub fn cells_in_range(
        &self,
        y_range: RangeInclusive<i64>,
    ) -> impl Iterator<Item = (i64, &Cell)> {
        let start = std::cmp::max(self.top(), *y_range.start());
        let end = std::cmp::min(self.bottom(), *y_range.end());
        let slice = if start <= end {
            let i = (start - self.top) as usize;
            let j = (end - self.top) as usize;
            &self.cells[i..=j]
        } else {
            &[]
        };
        (start..=end).zip(slice)
    }

    /// Returns the cell at the given Y coordinate, or an error if the Y
    /// coordinate is not covered by the block.
    pub fn get_cell(&self, y: i64) -> Result<&Cell> {
        ensure!(self.y_range().contains(&y), "Y coordinate outside block");
        let offset = y - self.top();
        Ok(&self.cells[offset as usize])
    }
    /// Set an existing cell at the given Y coordinate, or an error if the Y
    /// coordinate is not covered by the block.
    pub fn set_cell(&mut self, y: i64, contents: Cell) -> Result<Cell> {
        ensure!(self.y_range().contains(&y), "Y coordinate outside block");
        let offset = y - self.top();
        Ok(std::mem::replace(
            &mut self.cells[offset as usize],
            contents,
        ))
    }
    /// Appends a cell to the bottom of the block in O(1) time.
    pub fn push_bottom(&mut self, contents: Cell) {
        self.cells.push(contents);
    }
    /// Inserts a cell at the top of the block in O(n) time.
    pub fn insert_top(&mut self, contents: Cell) {
        self.top -= 1;
        self.cells.insert(0, contents);
    }
    /// Merges the block with another directly below it.
    pub fn merge(&mut self, below: &Block) {
        self.cells.extend_from_slice(&below.cells);
    }
}

/// Rectangular range of cells.
#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
pub struct Rect {
    /// Left edge (column)
    x: i64,
    /// Top edge (row)
    y: i64,
    /// Width (columns)
    w: u32,
    /// Height (rows)
    h: u32,
}
impl Rect {
    pub fn new(x: i64, y: i64, w: u32, h: u32) -> Self {
        Self { x, y, w, h }
    }

    /// Constructs a rectangle spanning two positions.
    pub fn from_span(a: Pos, b: Pos) -> Self {
        Self {
            x: std::cmp::min(a.x, b.x),
            y: std::cmp::min(a.y, b.y),
            w: a.x.abs_diff(b.x) as u32 + 1,
            h: a.y.abs_diff(b.y) as u32 + 1,
        }
    }

    /// Returns the left (min X coord) of the rectangle.
    pub fn left(&self) -> i64 {
        self.x
    }
    /// Returns the top (min Y coord) of the rectangle.
    pub fn top(&self) -> i64 {
        self.y
    }
    /// Returns the right (max X coord) of the rectangle.
    pub fn right(&self) -> i64 {
        self.x + self.w as i64 - 1
    }
    /// Returns the bottom (max Y coord) of the rectangle.
    pub fn bottom(&self) -> i64 {
        self.y + self.h as i64 - 1
    }

    /// Returns whether the rectangle contains a position.
    pub fn contains(&self, pos: Pos) -> bool {
        let x_contains = self.x <= pos.x && pos.x < self.x + self.w as i64;
        let y_contains = self.y <= pos.y && pos.y < self.y + self.h as i64;
        x_contains && y_contains
    }
}
impl Rect {
    /// Returns the range of X values of the rectangle.
    pub fn x_range(&self) -> RangeInclusive<i64> {
        self.left()..=self.right()
    }
    /// Returns the range of Y values of the rectangle.
    pub fn y_range(&self) -> RangeInclusive<i64> {
        self.top()..=self.bottom()
    }
}
