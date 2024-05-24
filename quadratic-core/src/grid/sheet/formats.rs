use crate::{
    grid::formats::{Format, Formats},
    selection::Selection,
    Rect,
};

use super::Sheet;

impl Sheet {
    /// Gets existing all format in Formats form.
    fn formats_all(&self) -> Formats {
        Formats::repeat(
            self.formats_all
                .as_ref()
                .map_or(Format::default(), |f| f.clone()),
            1,
        )
    }

    /// Gets existing Formats for columns.
    fn formats_columns(&self, columns: &Vec<i64>) -> Formats {
        let mut formats = Formats::default();
        columns.iter().for_each(|x| {
            formats.push(
                self.formats_columns
                    .get(x)
                    .map_or(Format::default(), |f| f.clone()),
            );
        });
        formats
    }

    /// Gets existing Formats for rows.
    fn formats_rows(&self, rows: &Vec<i64>) -> Formats {
        let mut formats = Formats::default();
        rows.iter().for_each(|y| {
            formats.push(
                self.formats_rows
                    .get(y)
                    .map_or(Format::default(), |f| f.clone()),
            );
        });
        formats
    }

    /// Gets the Formats for Vec<Rect>.
    fn formats_selection_rects(&self, rects: &Vec<Rect>) -> Formats {
        let mut formats = Formats::default();
        rects.iter().for_each(|rect| {
            for x in rect.min.x..=rect.max.x {
                if let Some(column) = self.get_column(x) {
                    for y in rect.min.y..=rect.max.y {
                        formats.push(Format {
                            align: column.align.get(y),
                            wrap: column.wrap.get(y),
                            numeric_format: column.numeric_format.get(y),
                            numeric_decimals: column.numeric_decimals.get(y),
                            numeric_commas: column.numeric_commas.get(y),
                            bold: column.bold.get(y),
                            italic: column.italic.get(y),
                            text_color: column.text_color.get(y),
                            fill_color: column.fill_color.get(y),
                            render_size: column.render_size.get(y),
                        });
                    }
                } else {
                    formats.push_n(Format::default(), rect.height() as usize);
                }
            }
        });
        formats
    }

    /// Returns the Formats for the given selection.
    pub fn formats_selection(&self, selection: Selection) -> Formats {
        if selection.all {
            self.formats_all()
        } else if let Some(columns) = selection.columns {
            self.formats_columns(&columns)
        } else if let Some(rows) = selection.rows {
            self.formats_rows(&rows)
        } else if let Some(rects) = selection.rects {
            self.formats_selection_rects(&rects)
        } else {
            Formats::default()
        }
    }

    /// Sets the Format for all cells and returns existing Formats for all.
    fn set_formats_all(&mut self, formats: Formats) -> Formats {
        let old_formats = self.formats_all();
        if let Some(format) = formats.get_at(0) {
            if format.is_default() {
                self.formats_all = None;
            } else {
                self.formats_all = Some(format.clone());
            }
        }
        old_formats

        // todo: need to trigger client changes
    }

    /// Sets the Formats for columns and returns existing Formats for columns.
    fn set_formats_columns(&mut self, columns: &Vec<i64>, formats: Formats) -> Formats {
        let mut old_formats = Formats::default();
        let mut formats_iter = formats.iter_values();
        columns.iter().for_each(|x| {
            old_formats.push(
                self.formats_columns
                    .get(x)
                    .map_or(Format::default(), |f| f.clone()),
            );
            let format = formats_iter.next().map_or(Format::default(), |f| f.clone());
            if format.is_default() {
                self.formats_columns.remove(x);
            } else {
                self.formats_columns.insert(*x, format);
            }

            // todo: need to trigger client changes
        });
        old_formats
    }

    /// Sets the Formats for rows and returns existing Formats for rows.
    fn set_formats_rows(&mut self, rows: &Vec<i64>, formats: Formats) -> Formats {
        let mut old_formats = Formats::default();
        let mut formats_iter = formats.iter_values();
        rows.iter().for_each(|y| {
            old_formats.push(
                self.formats_rows
                    .get(y)
                    .map_or(Format::default(), |f| f.clone()),
            );
            let format = formats_iter.next().map_or(Format::default(), |f| f.clone());
            if format.is_default() {
                self.formats_rows.remove(y);
            } else {
                self.formats_rows.insert(*y, format);
            }

            // todo: need to trigger client changes
        });
        old_formats
    }

    /// Sets the Formats for Vec<Rect> and returns existing Formats for the Vec<Rect>.
    fn set_formats_rects(&mut self, rects: &Vec<Rect>, formats: Formats) -> Formats {
        let old_formats = self.formats_selection_rects(rects);
        let mut formats_iter = formats.iter_values();
        rects.iter().for_each(|rect| {
            for x in rect.min.x..=rect.max.x {
                let column = self.get_or_create_column(x);
                for y in rect.min.y..=rect.max.y {
                    let format = formats_iter.next().map_or(Format::default(), |f| f.clone());
                    column.wrap.set(y, format.wrap);
                    column.numeric_format.set(y, format.numeric_format);
                    column.numeric_decimals.set(y, format.numeric_decimals);
                    column.numeric_commas.set(y, format.numeric_commas);
                    column.bold.set(y, format.bold);
                    column.italic.set(y, format.italic);
                    column.text_color.set(y, format.text_color);
                    column.fill_color.set(y, format.fill_color);
                    column.render_size.set(y, format.render_size);
                }
            }
        });

        // todo: need to trigger client changes

        old_formats
    }

    pub fn set_formats_selection(&mut self, selection: Selection, formats: Formats) -> Formats {
        if selection.all {
            self.set_formats_all(formats)
        } else if let Some(columns) = selection.columns {
            self.set_formats_columns(&columns, formats)
        } else if let Some(rows) = selection.rows {
            self.set_formats_rows(&rows, formats)
        } else if let Some(rects) = selection.rects {
            self.set_formats_rects(&rects, formats)
        } else {
            Formats::default()
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        grid::{
            formats::{Format, Formats},
            Bold, Italic, Sheet,
        },
        Pos, Rect,
    };

    #[test]
    fn set_formats_selection_rect() {
        let mut sheet = Sheet::test();
        let formats = Formats::repeat(
            Format {
                bold: Some(true),
                ..Format::default()
            },
            4,
        );
        let rect = Rect::from_numbers(0, 0, 2, 2);
        let old_formats = sheet.set_formats_rects(&vec![rect], formats);
        assert_eq!(
            sheet.get_formatting_value::<Bold>(Pos { x: 0, y: 0 }),
            Some(true)
        );
        assert_eq!(
            sheet.get_formatting_value::<Bold>(Pos { x: 1, y: 1 }),
            Some(true)
        );
        assert_eq!(sheet.get_formatting_value::<Bold>(Pos { x: 2, y: 2 }), None);
        assert_eq!(old_formats, Formats::repeat(Format::default(), 4));

        let formats = Formats::repeat(
            Format {
                italic: Some(true),
                ..Default::default()
            },
            1,
        );
        let rect = Rect::from_numbers(2, 2, 1, 1);
        let old_formats = sheet.set_formats_rects(&vec![rect], formats);
        assert_eq!(
            sheet.get_formatting_value::<Italic>(Pos { x: 2, y: 2 }),
            Some(true)
        );
        assert_eq!(
            sheet.get_formatting_value::<Italic>(Pos { x: 3, y: 3 }),
            None
        );
        assert_eq!(old_formats, Formats::repeat(Format::default(), 1));

        let old_formats =
            sheet.set_formats_rects(&vec![rect], Formats::repeat(Format::default(), 1));
        assert_eq!(sheet.get_formatting_value::<Italic>((2, 2).into()), None);
        assert_eq!(
            old_formats,
            Formats::repeat(
                Format {
                    italic: Some(true),
                    ..Default::default()
                },
                1
            )
        );
    }

    #[test]
    fn set_formats_selection_rects() {
        let mut sheet = Sheet::test();
        let mut formats = Formats::repeat(
            Format {
                bold: Some(true),
                ..Format::default()
            },
            4,
        );
        let rect1 = Rect::from_numbers(0, 0, 2, 2);
        formats.push(Format {
            italic: Some(true),
            ..Default::default()
        });
        let rect2 = Rect::from_numbers(2, 2, 1, 1);
        let old_formats = sheet.set_formats_rects(&vec![rect1, rect2], formats);
        assert_eq!(
            sheet.get_formatting_value::<Italic>(Pos { x: 2, y: 2 }),
            Some(true)
        );
        assert_eq!(
            sheet.get_formatting_value::<Italic>(Pos { x: 3, y: 3 }),
            None
        );
        assert_eq!(
            sheet.get_formatting_value::<Bold>(Pos { x: 0, y: 0 }),
            Some(true)
        );
        assert_eq!(
            sheet.get_formatting_value::<Bold>(Pos { x: 1, y: 1 }),
            Some(true)
        );
        assert_eq!(sheet.get_formatting_value::<Bold>(Pos { x: 2, y: 2 }), None);
        assert_eq!(old_formats, Formats::repeat(Format::default(), 5));
    }

    #[test]
    fn set_format_all() {
        let mut sheet = Sheet::test();
        let formats = Formats::repeat(
            Format {
                bold: Some(true),
                ..Format::default()
            },
            1,
        );
        let old_formats = sheet.set_formats_all(formats);
        assert_eq!(
            sheet.formats_all,
            Some(Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(old_formats, Formats::repeat(Format::default(), 1));

        let old_formats = sheet.set_formats_all(Formats::repeat(Format::default(), 1));
        assert_eq!(sheet.formats_all, None);
        assert_eq!(
            old_formats,
            Formats::repeat(
                Format {
                    bold: Some(true),
                    ..Format::default()
                },
                1
            )
        );
    }

    #[test]
    fn set_format_columns() {
        let mut sheet = Sheet::test();
        let formats = Formats::repeat(
            Format {
                bold: Some(true),
                ..Format::default()
            },
            3,
        );
        let old_formats = sheet.set_formats_columns(&vec![0, 1, 2], formats);
        assert_eq!(
            sheet.formats_columns.get(&0),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(
            sheet.formats_columns.get(&1),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(
            sheet.formats_columns.get(&2),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(sheet.formats_columns.get(&3), None);
        assert_eq!(old_formats, Formats::repeat(Format::default(), 3));

        let old_formats =
            sheet.set_formats_columns(&vec![0, 1, 2], Formats::repeat(Format::default(), 3));
        assert_eq!(sheet.formats_columns.get(&0), None);
        assert_eq!(sheet.formats_columns.get(&1), None);
        assert_eq!(sheet.formats_columns.get(&2), None);
        assert_eq!(
            old_formats,
            Formats::repeat(
                Format {
                    bold: Some(true),
                    ..Format::default()
                },
                3
            )
        );
    }

    #[test]
    fn set_formats_rows() {
        let mut sheet = Sheet::test();
        let formats = Formats::repeat(
            Format {
                bold: Some(true),
                ..Format::default()
            },
            3,
        );
        let old_formats = sheet.set_formats_rows(&vec![0, 1, 2], formats);
        assert_eq!(
            sheet.formats_rows.get(&0),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(
            sheet.formats_rows.get(&1),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(
            sheet.formats_rows.get(&2),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(sheet.formats_rows.get(&3), None);
        assert_eq!(old_formats, Formats::repeat(Format::default(), 3));

        let old_formats =
            sheet.set_formats_rows(&vec![0, 1, 2], Formats::repeat(Format::default(), 3));
        assert_eq!(sheet.formats_rows.get(&0), None);
        assert_eq!(sheet.formats_rows.get(&1), None);
        assert_eq!(sheet.formats_rows.get(&2), None);
        assert_eq!(
            old_formats,
            Formats::repeat(
                Format {
                    bold: Some(true),
                    ..Format::default()
                },
                3
            )
        );
    }
}
