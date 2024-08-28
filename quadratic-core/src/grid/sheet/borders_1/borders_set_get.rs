use crate::{selection::Selection, Rect};

use super::{
    borders_style::{BorderSelection, BorderStyle, BorderStyleCell},
    Borders,
};

impl Borders {
    /// Updates the sheet style (all, column entry, or row entry)
    fn sheet_style(
        border_style: &mut BorderStyleCell,
        border_selection: BorderSelection,
        style: Option<BorderStyle>,
    ) {
        match border_selection {
            BorderSelection::All | BorderSelection::Inner | BorderSelection::Outer => {
                border_style.top = style;
                border_style.bottom = style;
                border_style.left = style;
                border_style.right = style;
            }
            BorderSelection::Horizontal => {
                border_style.top = style;
                border_style.bottom = style;
            }
            BorderSelection::Vertical => {
                border_style.left = style;
                border_style.right = style;
            }
            BorderSelection::Left => {
                border_style.left = style;
            }
            BorderSelection::Top => {
                border_style.top = style;
            }
            BorderSelection::Right => {
                border_style.right = style;
            }
            BorderSelection::Bottom => {
                border_style.bottom = style;
            }
            BorderSelection::Clear => {
                border_style.top = None;
                border_style.bottom = None;
                border_style.left = None;
                border_style.right = None;
            }
        }
    }

    /// Sets the borders for a rect.
    fn set_border_rect(
        &mut self,
        rect: &Rect,
        border_selection: BorderSelection,
        style: Option<BorderStyle>,
    ) {
        match border_selection {
            BorderSelection::All => {
                for y in rect.min.y..=rect.max.y {
                    if let Some(top) = self.top.get_mut(&y) {
                        for x in rect.min.x..=rect.max.x {
                            top.set(x, style);
                        }
                    } else {
                    }
                }
            }
            BorderSelection::Inner => {}
            BorderSelection::Outer => {}
            BorderSelection::Horizontal => {}
            BorderSelection::Vertical => {}
            BorderSelection::Left => {}
            BorderSelection::Top => {}
            BorderSelection::Right => {}
            BorderSelection::Bottom => {}
            BorderSelection::Clear => {}
        }
    }

    /// Sets the borders for a selection.
    pub fn set_border(
        &mut self,
        selection: Selection,
        border_selection: BorderSelection,
        style: Option<BorderStyle>,
    ) {
        if selection.all {
            Self::sheet_style(&mut self.all, border_selection, style);
            return;
        }

        if let Some(columns) = selection.columns {
            for column in columns {
                let border_style = self.columns.entry(column).or_default();
                Self::sheet_style(border_style, border_selection, style);
            }
        }
        if let Some(rows) = selection.rows {
            for row in rows {
                let border_style = self.rows.entry(row).or_default();
                Self::sheet_style(border_style, border_selection, style);
            }
        }

        if let Some(rects) = selection.rects {
            rects
                .iter()
                .for_each(|rect| self.set_border_rect(rect, border_selection, style));
        }
    }
}
