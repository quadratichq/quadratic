//! Used to store formatting changes to apply to an entire sheet.

use serde::{Deserialize, Serialize};
use std::fmt::Debug;

use crate::{
    CopyFormats, Pos, Rect,
    a1::A1Selection,
    clear_option::ClearOption,
    grid::{
        CellAlign, CellVerticalAlign, CellWrap, Contiguous2D, GridBounds, NumericFormat,
        SheetFormatting, sheet_formatting::SheetFormattingType,
    },
};

use super::FormatUpdate;

pub type SheetFormatUpdatesType<T> = Option<Contiguous2D<Option<ClearOption<T>>>>;

#[derive(Deserialize, Serialize, Default, Debug, Clone, Eq, PartialEq)]
pub struct SheetFormatUpdates {
    pub align: SheetFormatUpdatesType<CellAlign>,
    pub vertical_align: SheetFormatUpdatesType<CellVerticalAlign>,
    pub wrap: SheetFormatUpdatesType<CellWrap>,
    pub numeric_format: SheetFormatUpdatesType<NumericFormat>,
    pub numeric_decimals: SheetFormatUpdatesType<i16>,
    pub numeric_commas: SheetFormatUpdatesType<bool>,
    pub bold: SheetFormatUpdatesType<bool>,
    pub italic: SheetFormatUpdatesType<bool>,
    pub text_color: SheetFormatUpdatesType<String>,
    pub fill_color: SheetFormatUpdatesType<String>,
    pub date_time: SheetFormatUpdatesType<String>,
    pub underline: SheetFormatUpdatesType<bool>,
    pub strike_through: SheetFormatUpdatesType<bool>,
    pub font_size: SheetFormatUpdatesType<i16>,
}

impl SheetFormatUpdates {
    fn apply_selection<T>(
        selection: &A1Selection,
        value: Option<Option<T>>,
    ) -> SheetFormatUpdatesType<T>
    where
        T: Clone + Debug + PartialEq,
    {
        Contiguous2D::new_from_opt_selection(selection, value)
            .map(|c| c.map_ref(|c| c.as_ref().map(Into::into)))
    }

    /// Constructs a format update that applies the same formatting to every
    /// affected cell.
    ///
    /// The mapping is used to turn Option<Option<T>> into
    /// Option<ClearOption<T>> so it properly serializes.
    pub fn from_selection(selection: &A1Selection, update: FormatUpdate) -> Self {
        Self {
            align: Self::apply_selection(selection, update.align),
            vertical_align: Self::apply_selection(selection, update.vertical_align),
            wrap: Self::apply_selection(selection, update.wrap),
            numeric_format: Self::apply_selection(selection, update.numeric_format),
            numeric_decimals: Self::apply_selection(selection, update.numeric_decimals),
            numeric_commas: Self::apply_selection(selection, update.numeric_commas),
            bold: Self::apply_selection(selection, update.bold),
            italic: Self::apply_selection(selection, update.italic),
            text_color: Self::apply_selection(selection, update.text_color),
            fill_color: Self::apply_selection(selection, update.fill_color),
            date_time: Self::apply_selection(selection, update.date_time),
            underline: Self::apply_selection(selection, update.underline),
            strike_through: Self::apply_selection(selection, update.strike_through),
            font_size: Self::apply_selection(selection, update.font_size),
        }
    }

    fn from_sheet_formatting_selection_item<T>(
        item: &SheetFormattingType<T>,
        selection: &A1Selection,
    ) -> SheetFormatUpdatesType<T>
    where
        T: Clone + Debug + PartialEq,
    {
        let update = item.get_update_for_selection(selection);
        if update.is_all_default() {
            None
        } else {
            Some(update)
        }
    }

    /// Constructs a format update that uses formats from every cell in the selection.
    pub fn from_sheet_formatting_selection(
        selection: &A1Selection,
        formats: &SheetFormatting,
    ) -> Self {
        SheetFormatUpdates {
            align: Self::from_sheet_formatting_selection_item(&formats.align, selection),
            vertical_align: Self::from_sheet_formatting_selection_item(
                &formats.vertical_align,
                selection,
            ),
            wrap: Self::from_sheet_formatting_selection_item(&formats.wrap, selection),
            numeric_format: Self::from_sheet_formatting_selection_item(
                &formats.numeric_format,
                selection,
            ),
            numeric_decimals: Self::from_sheet_formatting_selection_item(
                &formats.numeric_decimals,
                selection,
            ),
            numeric_commas: Self::from_sheet_formatting_selection_item(
                &formats.numeric_commas,
                selection,
            ),
            bold: Self::from_sheet_formatting_selection_item(&formats.bold, selection),
            italic: Self::from_sheet_formatting_selection_item(&formats.italic, selection),
            text_color: Self::from_sheet_formatting_selection_item(&formats.text_color, selection),
            fill_color: Self::from_sheet_formatting_selection_item(&formats.fill_color, selection),
            date_time: Self::from_sheet_formatting_selection_item(&formats.date_time, selection),
            underline: Self::from_sheet_formatting_selection_item(&formats.underline, selection),
            strike_through: Self::from_sheet_formatting_selection_item(
                &formats.strike_through,
                selection,
            ),
            font_size: Self::from_sheet_formatting_selection_item(&formats.font_size, selection),
        }
    }

    fn from_sheet_formatting_rect_item<T>(
        item: &SheetFormattingType<T>,
        rect: Rect,
        clear_on_none: bool,
    ) -> SheetFormatUpdatesType<T>
    where
        T: Clone + Debug + PartialEq,
    {
        let update = item.get_update_for_rect(rect, clear_on_none);
        if update.is_all_default() {
            None
        } else {
            Some(update)
        }
    }

    /// Constructs a format update that uses formats from every cell in the rect.
    pub fn from_sheet_formatting_rect(
        rect: Rect,
        formats: &SheetFormatting,
        clear_on_none: bool,
    ) -> Self {
        SheetFormatUpdates {
            align: Self::from_sheet_formatting_rect_item(&formats.align, rect, clear_on_none),
            vertical_align: Self::from_sheet_formatting_rect_item(
                &formats.vertical_align,
                rect,
                clear_on_none,
            ),
            wrap: Self::from_sheet_formatting_rect_item(&formats.wrap, rect, clear_on_none),
            numeric_format: Self::from_sheet_formatting_rect_item(
                &formats.numeric_format,
                rect,
                clear_on_none,
            ),
            numeric_decimals: Self::from_sheet_formatting_rect_item(
                &formats.numeric_decimals,
                rect,
                clear_on_none,
            ),
            numeric_commas: Self::from_sheet_formatting_rect_item(
                &formats.numeric_commas,
                rect,
                clear_on_none,
            ),
            bold: Self::from_sheet_formatting_rect_item(&formats.bold, rect, clear_on_none),
            italic: Self::from_sheet_formatting_rect_item(&formats.italic, rect, clear_on_none),
            text_color: Self::from_sheet_formatting_rect_item(
                &formats.text_color,
                rect,
                clear_on_none,
            ),
            fill_color: Self::from_sheet_formatting_rect_item(
                &formats.fill_color,
                rect,
                clear_on_none,
            ),
            date_time: Self::from_sheet_formatting_rect_item(
                &formats.date_time,
                rect,
                clear_on_none,
            ),
            underline: Self::from_sheet_formatting_rect_item(
                &formats.underline,
                rect,
                clear_on_none,
            ),
            strike_through: Self::from_sheet_formatting_rect_item(
                &formats.strike_through,
                rect,
                clear_on_none,
            ),
            font_size: Self::from_sheet_formatting_rect_item(
                &formats.font_size,
                rect,
                clear_on_none,
            ),
        }
    }

    /// Returns whether the format update intersects with the given rect.
    fn item_intersects<T>(item: &SheetFormatUpdatesType<T>, rect: Rect) -> bool
    where
        T: Clone + Debug + PartialEq,
    {
        item.as_ref().is_some_and(|item| item.intersects(rect))
    }

    /// Returns whether the format update intersects with the given rect.
    pub fn intersects(&self, rect: Rect) -> bool {
        Self::item_intersects(&self.align, rect)
            || Self::item_intersects(&self.vertical_align, rect)
            || Self::item_intersects(&self.wrap, rect)
            || Self::item_intersects(&self.numeric_format, rect)
            || Self::item_intersects(&self.numeric_decimals, rect)
            || Self::item_intersects(&self.numeric_commas, rect)
            || Self::item_intersects(&self.bold, rect)
            || Self::item_intersects(&self.italic, rect)
            || Self::item_intersects(&self.text_color, rect)
            || Self::item_intersects(&self.fill_color, rect)
            || Self::item_intersects(&self.date_time, rect)
            || Self::item_intersects(&self.underline, rect)
            || Self::item_intersects(&self.strike_through, rect)
    }

    /// Returns whether the format update is empty.
    pub fn is_default(&self) -> bool {
        self.align.as_ref().is_none_or(|a| a.is_all_default())
            && self
                .vertical_align
                .as_ref()
                .is_none_or(|a| a.is_all_default())
            && self.wrap.as_ref().is_none_or(|a| a.is_all_default())
            && self
                .numeric_format
                .as_ref()
                .is_none_or(|a| a.is_all_default())
            && self
                .numeric_decimals
                .as_ref()
                .is_none_or(|a| a.is_all_default())
            && self
                .numeric_commas
                .as_ref()
                .is_none_or(|a| a.is_all_default())
            && self.bold.as_ref().is_none_or(|a| a.is_all_default())
            && self.italic.as_ref().is_none_or(|a| a.is_all_default())
            && self.text_color.as_ref().is_none_or(|a| a.is_all_default())
            && self.fill_color.as_ref().is_none_or(|a| a.is_all_default())
            && self.date_time.as_ref().is_none_or(|a| a.is_all_default())
            && self.underline.as_ref().is_none_or(|a| a.is_all_default())
            && self
                .strike_through
                .as_ref()
                .is_none_or(|a| a.is_all_default())
            && self.font_size.as_ref().is_none_or(|a| a.is_all_default())
    }

    /// Sets a single format for a cell
    fn set_format_cell_item<T>(
        pos: Pos,
        item: &mut SheetFormatUpdatesType<T>,
        value: Option<Option<T>>,
    ) where
        T: Clone + Debug + PartialEq,
    {
        value.map(|value| {
            item.get_or_insert_with(Default::default)
                .set(pos, Some(value.into()))
        });
    }

    /// Sets all formats for a cell
    pub fn set_format_cell(&mut self, pos: Pos, update: FormatUpdate) {
        Self::set_format_cell_item(pos, &mut self.align, update.align);
        Self::set_format_cell_item(pos, &mut self.vertical_align, update.vertical_align);
        Self::set_format_cell_item(pos, &mut self.wrap, update.wrap);
        Self::set_format_cell_item(pos, &mut self.numeric_format, update.numeric_format);
        Self::set_format_cell_item(pos, &mut self.numeric_decimals, update.numeric_decimals);
        Self::set_format_cell_item(pos, &mut self.numeric_commas, update.numeric_commas);
        Self::set_format_cell_item(pos, &mut self.bold, update.bold);
        Self::set_format_cell_item(pos, &mut self.italic, update.italic);
        Self::set_format_cell_item(pos, &mut self.text_color, update.text_color);
        Self::set_format_cell_item(pos, &mut self.fill_color, update.fill_color);
        Self::set_format_cell_item(pos, &mut self.date_time, update.date_time);
        Self::set_format_cell_item(pos, &mut self.underline, update.underline);
        Self::set_format_cell_item(pos, &mut self.strike_through, update.strike_through);
        Self::set_format_cell_item(pos, &mut self.font_size, update.font_size);
    }

    /// Returns the format for a cell within the SheetFormatUpdates.
    fn format_update_item<T>(item: &SheetFormatUpdatesType<T>, pos: Pos) -> Option<Option<T>>
    where
        T: Clone + Debug + PartialEq,
    {
        item.as_ref()
            .and_then(|item| item.get(pos).map(|c| c.into()))
    }

    /// Returns the format for a cell within the SheetFormatUpdates.
    pub fn format_update(&self, pos: Pos) -> FormatUpdate {
        FormatUpdate {
            align: Self::format_update_item(&self.align, pos),
            vertical_align: Self::format_update_item(&self.vertical_align, pos),
            wrap: Self::format_update_item(&self.wrap, pos),
            numeric_format: Self::format_update_item(&self.numeric_format, pos),
            numeric_decimals: Self::format_update_item(&self.numeric_decimals, pos),
            numeric_commas: Self::format_update_item(&self.numeric_commas, pos),
            bold: Self::format_update_item(&self.bold, pos),
            italic: Self::format_update_item(&self.italic, pos),
            text_color: Self::format_update_item(&self.text_color, pos),
            fill_color: Self::format_update_item(&self.fill_color, pos),
            date_time: Self::format_update_item(&self.date_time, pos),
            underline: Self::format_update_item(&self.underline, pos),
            strike_through: Self::format_update_item(&self.strike_through, pos),
            font_size: Self::format_update_item(&self.font_size, pos),
            render_size: None,
        }
    }

    /// Sets a single format for a rect within the SheetFormatUpdates to a single value.
    fn set_format_rect_item<T>(
        item: &mut SheetFormatUpdatesType<T>,
        rect: Rect,
        value: Option<Option<T>>,
    ) where
        T: Clone + Debug + PartialEq,
    {
        item.get_or_insert_with(Default::default).set_rect(
            rect.min.x,
            rect.min.y,
            if rect.max.x == i64::MAX {
                None
            } else {
                Some(rect.max.x)
            },
            if rect.max.y == i64::MAX {
                None
            } else {
                Some(rect.max.y)
            },
            value.map(|value| value.into()),
        );
    }

    /// Sets all formats for a rect within the SheetFormatUpdates
    pub fn set_format_rect(&mut self, rect: Rect, update: FormatUpdate) {
        Self::set_format_rect_item(&mut self.align, rect, update.align);
        Self::set_format_rect_item(&mut self.vertical_align, rect, update.vertical_align);
        Self::set_format_rect_item(&mut self.wrap, rect, update.wrap);
        Self::set_format_rect_item(&mut self.numeric_format, rect, update.numeric_format);
        Self::set_format_rect_item(&mut self.numeric_decimals, rect, update.numeric_decimals);
        Self::set_format_rect_item(&mut self.numeric_commas, rect, update.numeric_commas);
        Self::set_format_rect_item(&mut self.bold, rect, update.bold);
        Self::set_format_rect_item(&mut self.italic, rect, update.italic);
        Self::set_format_rect_item(&mut self.text_color, rect, update.text_color);
        Self::set_format_rect_item(&mut self.fill_color, rect, update.fill_color);
        Self::set_format_rect_item(&mut self.date_time, rect, update.date_time);
        Self::set_format_rect_item(&mut self.underline, rect, update.underline);
        Self::set_format_rect_item(&mut self.strike_through, rect, update.strike_through);
        Self::set_format_rect_item(&mut self.font_size, rect, update.font_size);
    }

    fn transfer_format_rect_item<T>(
        item: &mut SheetFormatUpdatesType<T>,
        rect: Rect,
        other_item: &mut SheetFormatUpdatesType<T>,
    ) where
        T: Clone + Debug + PartialEq,
    {
        item.get_or_insert_with(Default::default).set_from(
            &other_item.get_or_insert_with(Default::default).set_rect(
                rect.min.x,
                rect.min.y,
                Some(rect.max.x),
                Some(rect.max.y),
                None,
            ),
        );
    }

    /// Transfers a rect from another SheetFormatUpdates into this one, clearing the other.
    pub fn transfer_format_rect_from_other(&mut self, rect: Rect, other: &mut SheetFormatUpdates) {
        Self::transfer_format_rect_item(&mut self.align, rect, &mut other.align);
        Self::transfer_format_rect_item(&mut self.vertical_align, rect, &mut other.vertical_align);
        Self::transfer_format_rect_item(&mut self.wrap, rect, &mut other.wrap);
        Self::transfer_format_rect_item(&mut self.numeric_format, rect, &mut other.numeric_format);
        Self::transfer_format_rect_item(
            &mut self.numeric_decimals,
            rect,
            &mut other.numeric_decimals,
        );
        Self::transfer_format_rect_item(&mut self.numeric_commas, rect, &mut other.numeric_commas);
        Self::transfer_format_rect_item(&mut self.bold, rect, &mut other.bold);
        Self::transfer_format_rect_item(&mut self.italic, rect, &mut other.italic);
        Self::transfer_format_rect_item(&mut self.text_color, rect, &mut other.text_color);
        Self::transfer_format_rect_item(&mut self.fill_color, rect, &mut other.fill_color);
        Self::transfer_format_rect_item(&mut self.date_time, rect, &mut other.date_time);
        Self::transfer_format_rect_item(&mut self.underline, rect, &mut other.underline);
        Self::transfer_format_rect_item(&mut self.strike_through, rect, &mut other.strike_through);
        Self::transfer_format_rect_item(&mut self.font_size, rect, &mut other.font_size);
    }

    fn translate_rect_item<T>(item: &mut SheetFormatUpdatesType<T>, x: i64, y: i64)
    where
        T: Clone + Debug + PartialEq,
    {
        item.get_or_insert_with(Default::default)
            .translate_in_place(x, y);
    }

    pub fn translate_in_place(&mut self, x: i64, y: i64) {
        Self::translate_rect_item(&mut self.align, x, y);
        Self::translate_rect_item(&mut self.vertical_align, x, y);
        Self::translate_rect_item(&mut self.wrap, x, y);
        Self::translate_rect_item(&mut self.numeric_format, x, y);
        Self::translate_rect_item(&mut self.numeric_decimals, x, y);
        Self::translate_rect_item(&mut self.numeric_commas, x, y);
        Self::translate_rect_item(&mut self.bold, x, y);
        Self::translate_rect_item(&mut self.italic, x, y);
        Self::translate_rect_item(&mut self.text_color, x, y);
        Self::translate_rect_item(&mut self.fill_color, x, y);
        Self::translate_rect_item(&mut self.date_time, x, y);
        Self::translate_rect_item(&mut self.underline, x, y);
        Self::translate_rect_item(&mut self.strike_through, x, y);
        Self::translate_rect_item(&mut self.font_size, x, y);
    }

    /// Merges another SheetFormatUpdates into this one.
    fn merge_item<T>(item: &mut SheetFormatUpdatesType<T>, other: &SheetFormatUpdatesType<T>)
    where
        T: Clone + Debug + PartialEq,
    {
        match (item.as_mut(), other.as_ref()) {
            (Some(item), Some(other)) => {
                item.update_from(other, |value, new_value| value.replace(new_value.clone()));
            }
            (None, Some(other)) => {
                *item = Some(other.clone());
            }
            _ => {}
        }
    }

    /// Merges another SheetFormatUpdates into this one.
    pub fn merge(&mut self, other: &SheetFormatUpdates) {
        Self::merge_item(&mut self.align, &other.align);
        Self::merge_item(&mut self.vertical_align, &other.vertical_align);
        Self::merge_item(&mut self.wrap, &other.wrap);
        Self::merge_item(&mut self.numeric_format, &other.numeric_format);
        Self::merge_item(&mut self.numeric_decimals, &other.numeric_decimals);
        Self::merge_item(&mut self.numeric_commas, &other.numeric_commas);
        Self::merge_item(&mut self.bold, &other.bold);
        Self::merge_item(&mut self.italic, &other.italic);
        Self::merge_item(&mut self.text_color, &other.text_color);
        Self::merge_item(&mut self.fill_color, &other.fill_color);
        Self::merge_item(&mut self.date_time, &other.date_time);
        Self::merge_item(&mut self.underline, &other.underline);
        Self::merge_item(&mut self.strike_through, &other.strike_through);
        Self::merge_item(&mut self.font_size, &other.font_size);
    }

    /// Whether the update includes any fill color changes
    pub fn has_fills(&self) -> bool {
        self.fill_color
            .as_ref()
            .is_some_and(|fills| !fills.is_all_default())
    }

    /// Returns the bounding rect of the format updates.
    pub fn to_bounding_rect(&self) -> Option<Rect> {
        let mut bounds = GridBounds::default();
        self.align
            .as_ref()
            .and_then(|align| align.bounding_rect().map(|rect| bounds.add_rect(rect)));
        self.vertical_align.as_ref().and_then(|vertical_align| {
            vertical_align
                .bounding_rect()
                .map(|rect| bounds.add_rect(rect))
        });
        self.wrap
            .as_ref()
            .and_then(|wrap| wrap.bounding_rect().map(|rect| bounds.add_rect(rect)));
        self.numeric_format.as_ref().and_then(|numeric_format| {
            numeric_format
                .bounding_rect()
                .map(|rect| bounds.add_rect(rect))
        });
        self.numeric_decimals.as_ref().and_then(|numeric_decimals| {
            numeric_decimals
                .bounding_rect()
                .map(|rect| bounds.add_rect(rect))
        });
        self.numeric_commas.as_ref().and_then(|numeric_commas| {
            numeric_commas
                .bounding_rect()
                .map(|rect| bounds.add_rect(rect))
        });
        self.bold
            .as_ref()
            .and_then(|bold| bold.bounding_rect().map(|rect| bounds.add_rect(rect)));
        self.italic
            .as_ref()
            .and_then(|italic| italic.bounding_rect().map(|rect| bounds.add_rect(rect)));
        self.text_color
            .as_ref()
            .and_then(|text_color| text_color.bounding_rect().map(|rect| bounds.add_rect(rect)));
        self.fill_color
            .as_ref()
            .and_then(|fill_color| fill_color.bounding_rect().map(|rect| bounds.add_rect(rect)));
        self.date_time
            .as_ref()
            .and_then(|date_time| date_time.bounding_rect().map(|rect| bounds.add_rect(rect)));
        self.underline
            .as_ref()
            .and_then(|underline| underline.bounding_rect().map(|rect| bounds.add_rect(rect)));
        self.strike_through.as_ref().and_then(|strike_through| {
            strike_through
                .bounding_rect()
                .map(|rect| bounds.add_rect(rect))
        });
        self.font_size
            .as_ref()
            .and_then(|font_size| font_size.bounding_rect().map(|rect| bounds.add_rect(rect)));

        bounds.into()
    }

    /// Inserts a column into the SheetFormatUpdates
    fn insert_column_item<T>(
        item: &mut SheetFormatUpdatesType<T>,
        column: i64,
        copy_formats: CopyFormats,
    ) where
        T: Clone + Debug + PartialEq,
    {
        if let Some(item) = item.as_mut() {
            item.insert_column(column, copy_formats);
        }
    }

    pub fn insert_column(&mut self, column: i64, copy_formats: CopyFormats) {
        Self::insert_column_item(&mut self.align, column, copy_formats);
        Self::insert_column_item(&mut self.vertical_align, column, copy_formats);
        Self::insert_column_item(&mut self.wrap, column, copy_formats);
        Self::insert_column_item(&mut self.numeric_format, column, copy_formats);
        Self::insert_column_item(&mut self.numeric_decimals, column, copy_formats);
        Self::insert_column_item(&mut self.numeric_commas, column, copy_formats);
        Self::insert_column_item(&mut self.bold, column, copy_formats);
        Self::insert_column_item(&mut self.italic, column, copy_formats);
        Self::insert_column_item(&mut self.text_color, column, copy_formats);
        Self::insert_column_item(&mut self.fill_color, column, copy_formats);
        Self::insert_column_item(&mut self.date_time, column, copy_formats);
        Self::insert_column_item(&mut self.underline, column, copy_formats);
        Self::insert_column_item(&mut self.strike_through, column, copy_formats);
    }

    fn remove_column_item<T>(item: &mut SheetFormatUpdatesType<T>, column: i64)
    where
        T: Clone + Debug + PartialEq,
    {
        if let Some(item) = item.as_mut() {
            item.remove_column(column);
        }
    }

    pub fn remove_column(&mut self, column: i64) {
        Self::remove_column_item(&mut self.align, column);
        Self::remove_column_item(&mut self.vertical_align, column);
        Self::remove_column_item(&mut self.wrap, column);
        Self::remove_column_item(&mut self.numeric_format, column);
        Self::remove_column_item(&mut self.numeric_decimals, column);
        Self::remove_column_item(&mut self.numeric_commas, column);
        Self::remove_column_item(&mut self.bold, column);
        Self::remove_column_item(&mut self.italic, column);
        Self::remove_column_item(&mut self.text_color, column);
        Self::remove_column_item(&mut self.fill_color, column);
        Self::remove_column_item(&mut self.date_time, column);
        Self::remove_column_item(&mut self.underline, column);
        Self::remove_column_item(&mut self.strike_through, column);
    }

    fn copy_row_item<T>(item: &SheetFormatUpdatesType<T>, row: i64) -> SheetFormatUpdatesType<T>
    where
        T: Clone + Debug + PartialEq,
    {
        item.as_ref()
            .and_then(|item| item.copy_row(row))
            .map(|c| c.map_ref(|opt| opt.clone().and_then(|x| x)))
    }

    pub fn copy_row(&self, row: i64) -> Option<SheetFormatUpdates> {
        let updates = SheetFormatUpdates {
            align: Self::copy_row_item(&self.align, row),
            vertical_align: Self::copy_row_item(&self.vertical_align, row),
            wrap: Self::copy_row_item(&self.wrap, row),
            numeric_format: Self::copy_row_item(&self.numeric_format, row),
            numeric_decimals: Self::copy_row_item(&self.numeric_decimals, row),
            numeric_commas: Self::copy_row_item(&self.numeric_commas, row),
            bold: Self::copy_row_item(&self.bold, row),
            italic: Self::copy_row_item(&self.italic, row),
            text_color: Self::copy_row_item(&self.text_color, row),
            fill_color: Self::copy_row_item(&self.fill_color, row),
            date_time: Self::copy_row_item(&self.date_time, row),
            underline: Self::copy_row_item(&self.underline, row),
            strike_through: Self::copy_row_item(&self.strike_through, row),
            font_size: Self::copy_row_item(&self.font_size, row),
        };

        if updates.is_default() {
            None
        } else {
            Some(updates)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_default() {
        let mut s = SheetFormatUpdates::default();
        assert!(s.is_default());

        s.align = Contiguous2D::new_from_opt_selection(
            &A1Selection::test_a1("A1:B2"),
            Some(ClearOption::Some(CellAlign::Center)),
        );
        assert!(!s.is_default());
    }

    #[test]
    fn test_set_format_cell() {
        let mut updates = SheetFormatUpdates::default();
        let pos = pos![B3];

        let format_update = FormatUpdate {
            align: Some(Some(CellAlign::Center)),
            bold: Some(Some(true)),
            text_color: Some(Some("red".to_string())),
            ..Default::default()
        };

        updates.set_format_cell(pos, format_update);

        // Verify the updated fields
        let format = updates.format_update(pos);
        assert_eq!(format.bold, Some(Some(true)));
        assert_eq!(format.align, Some(Some(CellAlign::Center)));
        assert_eq!(format.text_color, Some(Some("red".to_string())));

        // Verify other fields remained None
        assert!(updates.vertical_align.is_none());
        assert!(updates.wrap.is_none());
        assert!(updates.numeric_format.is_none());
    }

    #[test]
    fn test_has_fills() {
        let updates = SheetFormatUpdates::default();
        assert!(!updates.has_fills());

        let updates = SheetFormatUpdates::from_selection(
            &A1Selection::test_a1("A1:B2"),
            FormatUpdate {
                fill_color: Some(Some("red".to_string())),
                ..Default::default()
            },
        );
        assert!(updates.has_fills());
    }
}
