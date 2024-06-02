use crate::{controller::operations::operation::Operation, grid::{formats::{format::Format, format_update::FormatUpdate, formats::Formats}, Sheet}, selection::Selection, Rect};

impl Sheet {
    /// Gets the format_all for the sheet (or returns default if not set)
    pub fn format_all(&self) -> Format {
        self.format_all
            .as_ref()
            .unwrap_or(&Format::default())
            .clone()
    }

    /// Finds any format_columns that overlap with the update and return a list of column indices.
    pub(crate) fn find_overlapping_format_columns(&self, update: &FormatUpdate) -> Vec<i64> {
      self.formats_columns.iter().filter_map(|(column, column_format)| {
        if Sheet::undo_format_update(update, column_format).is_some() {
          Some(*column)
        } else {
          None
        }
      }).collect()
    }

    /// Finds any format_rows that overlap with the update and return a list of row indices.
    pub(crate) fn find_overlapping_format_rows(&self, update: &FormatUpdate) -> Vec<i64> {
      self.formats_rows.iter().filter_map(|(row, row_format)| {
        if Sheet::undo_format_update(update, row_format).is_some() {
          Some(*row)
        } else {
          None
        }
      }).collect()
    }

    /// Sets the Format for all cells and returns a Vec<Operation> to undo the
    /// operation.
    ///
    /// Changing the sheet's format also removes any set formatting for columns,
    /// rows, and cells. For example, if you set everything to bold, all cells
    /// that have bold set unset bold. The undo has the reverse for these
    /// operations as well.
    ///
    /// Note: format.renderSize is not supported for format_all so we don't need
    /// to watch for changes to html cells.
    ///
    /// Returns a Vec<Operation> to undo this operation.
    pub(crate) fn set_format_all(&mut self, update: &Formats) -> Vec<Operation> {
        let mut old = Formats::default();
        let mut format_all = self.format_all();

        // tracks whether we need to rerender all cells
        let mut render_cells = false;

        // tracks whether we need to change the fills
        let mut change_fills = false;
        // let mut change_fill_cells = vec![];

        if let Some(format_update) = update.iter_values().next() {

            // if there are no changes to the format_all, then we don't need to
            // do anything
            if format_update.is_default() {
              return vec![];
            }

            // watch for changes that need to be sent to the client
            if format_update.needs_render_cells() {
                render_cells = true;
            }
            if format_update.needs_fill_update() {
                change_fills = true;
            }

            // change the format_all and save the old format
            old.push(format_all.merge_update_into(format_update));

            // remove the format_all if it's no longer needed
            if format_all.is_default() {
                self.format_all = None;
            } else {
                self.format_all = Some(format_all);
            }

            let mut ops = vec![];
            let selection_all = Selection { all: true, ..Default::default() };
            ops.push(Operation::SetCellFormatsSelection { selection: selection_all.clone(), formats: old });

            // force a rerender of all impacted cells
            if render_cells {
                self.send_all_render_cells();
            }

            if change_fills {
              self.send_sheet_fills();
            }

            // removes all individual cell formatting that conflicts with the all formatting
            let mut old = Formats::default();
            let rects: Vec<Rect> = self.format_selection(&selection_all).iter().filter_map(|(pos, format)| {
                if let Some(undo) = Self::undo_format_update(format_update, format) {
                    old.push(undo);
                    Some(Rect::single_pos(*pos))
                } else {
                    None
                }
            }).collect();
            ops.push(Operation::SetCellFormatsSelection { selection: Selection { rects: Some(rects), ..Default::default() }, formats: old });

            // removes all related column formatting so the all format can be applied
            let columns = self.find_overlapping_format_columns(format_update);
            let format_clear = format_update.clear_update();
            if !columns.is_empty() {
              ops.push(Operation::SetCellFormatsSelection { formats: Formats::repeat(format_clear.clone(), columns.len() as usize), selection: Selection { columns: Some(columns), ..Default::default() } });
            }

            // remove all related row formatting so the all format can be applied
            let rows = self.find_overlapping_format_rows(format_update);
            if !rows.is_empty() {
              ops.push(Operation::SetCellFormatsSelection { formats: Formats::repeat(format_clear, rows.len() as usize), selection: Selection { rows: Some(rows), ..Default::default() } });
            }

            ops
        } else {
            // there are no updates, so nothing more to do
            vec![]
        }
    }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn format_all() {
      let mut sheet = Sheet::test();
      assert_eq!(sheet.format_all(), Format::default());
      sheet.format_all = Some(Format {
          bold: Some(true),
          ..Default::default()
      });
      assert_eq!(
          sheet.format_all(),
          Format {
              bold: Some(true),
              ..Default::default()
          }
      );
  }

  #[test]
  fn find_overlapping_format_columns() {
    let mut sheet = Sheet::test();
    sheet.formats_columns.insert(0, Format { bold: Some(false), ..Default::default() });
    sheet.formats_columns.insert(-2, Format { bold: Some(true), ..Default::default() });

    let update = FormatUpdate { bold: Some(Some(true)), ..Default::default() };
    let columns = sheet.find_overlapping_format_columns(&update);
    assert_eq!(columns.len(), 2);
  }

  #[test]
  fn find_overlapping_format_rows() {
    let mut sheet = Sheet::test();
    sheet.formats_rows.insert(0, Format { bold: Some(false), ..Default::default() });
    sheet.formats_rows.insert(-2, Format { bold: Some(true), ..Default::default() });

    let update = FormatUpdate { bold: Some(Some(true)), ..Default::default() };
    let rows = sheet.find_overlapping_format_rows(&update);
    assert_eq!(rows.len(), 2);
  }

    #[test]
    fn set_format_selection_all() {
        let mut sheet = Sheet::test();
        let formats = Formats::repeat(
            FormatUpdate {
                bold: Some(Some(true)),
                ..FormatUpdate::default()
            },
            1,
        );
        let selection = Selection {
            all: true,
            ..Default::default()
        };
        let reverse = sheet.set_formats_selection(&selection, &formats);
        assert_eq!(reverse.len(), 2);
        assert_eq!(
            sheet.format_all,
            Some(Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(
            sheet.format_all,
            Some(Format {
                bold: Some(true),
                ..Default::default()
            })
        );

    todo!();
    //     let old_formats = sheet.set_formats_selection(
    //         &Selection {
    //             all: true,
    //             ..Default::default()
    //         },
    //         &old_formats,
    //     );
    //     assert!(sheet.format_all.is_none());
    //     assert_eq!(old_formats, formats);
    }

    #[test]
    fn set_format_all() {
        // let mut sheet = Sheet::test();
        // assert!(sheet.format_all.is_none());
        // let formats = Formats::repeat(
        //     FormatUpdate {
        //         bold: Some(Some(true)),
        //         ..FormatUpdate::default()
        //     },
        //     1,
        // );

        todo!();
        // let old_formats = sheet.set_format_all(&formats);
        // assert_eq!(
        //     sheet.format_all,
        //     Some(Format {
        //         bold: Some(true),
        //         ..Format::default()
        //     })
        // );
        // assert_eq!(
        //     sheet.format_all,
        //     Some(Format {
        //         bold: Some(true),
        //         ..Default::default()
        //     })
        // );

        // // let reverse = sheet.set_format_all(&old_formats);
        // assert!(sheet.format_all.is_none());

        // todo!();
        // // assert_eq!(old_formats, formats);
    }
}