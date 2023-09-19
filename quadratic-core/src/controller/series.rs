use anyhow::{anyhow, Result};
use smallvec::SmallVec;

use super::{
    formatting::CellFmtArray,
    transactions::{Operation, Transaction, TransactionSummary},
    GridController,
};
use crate::{
    grid::{RegionRef, Sheet, SheetId},
    Array, CellValue, Pos, Rect,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExpandDirection {
    Up,
    Down,
    Left,
    Right,
}

struct Series {
    series: Option<Vec<CellValue>>,
    spaces: i32,
    negative: bool,
}

impl GridController {
    pub fn copy_series(options: Series) {
        let Series { series, spaces } = options;

        if (options.negative) {
            let mut copy = series.len() - 1;

            return (0..spaces)
                .map(|space| {
                    let value = series[copy];
                    copy -= 1;
                    if copy == -1 {
                        copy = series.len() - 1;
                    }

                    value
                })
                .collect()
                .reverse();
        } else {
            let mut copy = 0;

            return (0..spaces)
                .map(|space| {
                    let value = series[copy];
                    copy = (copy + 1) % series.len();
                    value
                })
                .collect();
        }

        pub fn is_number_series(options: Series) {
            let Series {
                series,
                spaces,
                negative,
            } = options;

            // if only one number, copy it
            if (series.len() == 1) {
                return copySeries(options);
            }

            let numbers = series.map(|s| s.value);

            //   let addition: boolean | number = true;
            //   let multiplication: boolean | number = true;

            //   for (let i = 1; i < numbers.length; i++) {
            //     const difference = numbers[i] - numbers[i - 1];
            //     if (addition !== false) {
            //       if (addition === true) {
            //         addition = difference;
            //       } else if (difference !== addition) {
            //         addition = false;
            //       }
            //     }

            //     // no divide by zero
            //     if (numbers[i - 1] === 0) {
            //       multiplication = false;
            //     } else {
            //       const quotient = numbers[i] / numbers[i - 1];
            //       if (multiplication !== false) {
            //         if (multiplication === true) {
            //           multiplication = quotient;
            //         } else if (quotient !== multiplication) {
            //           multiplication = false;
            //         }
            //       }
            //     }
            //   }

            //   if (addition !== false) {
            //     const results: Cell[] = [];
            //     if (negative) {
            //       let current = numbers[0];
            //       for (let i = 0; i < spaces; i++) {
            //         current = current - (addition as number);
            //         results.push({ value: current.toString(), type: 'TEXT' } as Cell);
            //       }
            //       results.reverse();
            //     } else {
            //       let current = numbers[numbers.length - 1];
            //       for (let i = 0; i < spaces; i++) {
            //         current = current + (addition as number);
            //         results.push({ value: current.toString(), type: 'TEXT' } as Cell);
            //       }
            //     }
            //     return results;
            //   }

            //   if (multiplication !== false) {
            //     const results: Cell[] = [];
            //     if (negative) {
            //       let current = numbers[0];
            //       for (let i = 0; i < spaces; i++) {
            //         current = current / (multiplication as number);
            //         results.push({ value: current.toString(), type: 'TEXT' } as Cell);
            //       }
            //       results.reverse();
            //     } else {
            //       let current = numbers[numbers.length - 1];
            //       for (let i = 0; i < spaces; i++) {
            //         current = current * (multiplication as number);
            //         results.push({ value: current.toString(), type: 'TEXT' } as Cell);
            //       }
            //     }
            //     return results;
            //   }

            //   // no series found
            //   return copySeries(options);
        }
    }
}
