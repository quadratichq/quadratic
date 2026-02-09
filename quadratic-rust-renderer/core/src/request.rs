//! Render request types and builder for grid-to-image rendering.
//!
//! Shared by native (server-side) and future WASM renderers. The builder produces
//! a RenderRequest from quadratic_core grid/sheet data; backends then render it.

use quadratic_core::color::Rgba;
use quadratic_core::controller::GridController;
use quadratic_core::grid::Sheet;
use quadratic_core::CellValue;
use quadratic_core::Pos;

use crate::tables::{TableOutline, TableOutlines};
use crate::types::{BorderLineStyle, RenderCell, RenderFill, SheetBorders, SheetOffsets};
use crate::{from_rgba, parse_color_to_rgba};

/// A rectangular exclusion zone where grid lines should not be drawn (e.g., chart areas)
#[derive(Debug, Clone)]
pub struct GridExclusionZone {
    pub left: f32,
    pub top: f32,
    pub right: f32,
    pub bottom: f32,
}

/// A chart image to render (e.g., Python chart output). Decoding is backend-specific.
#[derive(Debug, Clone)]
pub struct ChartImage {
    pub x: i64,
    pub y: i64,
    pub width: u32,
    pub height: u32,
    pub image_data: String,
}

/// A table name with language icon info
#[derive(Debug, Clone)]
pub struct TableNameIcon {
    pub x: i64,
    pub y: i64,
    pub language: quadratic_core::grid::CodeCellLanguage,
}

impl TableNameIcon {
    pub fn icon_filename(&self) -> Option<&'static str> {
        use quadratic_core::grid::CodeCellLanguage;
        match &self.language {
            CodeCellLanguage::Python => Some("icon-python.png"),
            CodeCellLanguage::Formula => Some("icon-formula.png"),
            CodeCellLanguage::Javascript => Some("icon-javascript.png"),
            CodeCellLanguage::Connection { .. } => Some("icon-connection.png"),
            CodeCellLanguage::Import => None,
        }
    }

    pub fn language_key(&self) -> &'static str {
        use quadratic_core::grid::CodeCellLanguage;
        match &self.language {
            CodeCellLanguage::Python => "python",
            CodeCellLanguage::Formula => "formula",
            CodeCellLanguage::Javascript => "javascript",
            CodeCellLanguage::Connection { .. } => "connection",
            CodeCellLanguage::Import => "import",
        }
    }
}

/// A range of cells to render (1-indexed, inclusive)
#[derive(Debug, Clone, Copy)]
pub struct SelectionRange {
    pub start_col: i64,
    pub start_row: i64,
    pub end_col: i64,
    pub end_row: i64,
}

impl SelectionRange {
    pub fn new(start_col: i64, start_row: i64, end_col: i64, end_row: i64) -> Self {
        Self {
            start_col: start_col.min(end_col),
            start_row: start_row.min(end_row),
            end_col: start_col.max(end_col),
            end_row: start_row.max(end_row),
        }
    }

    pub fn single_cell(col: i64, row: i64) -> Self {
        Self::new(col, row, col, row)
    }

    pub fn width(&self) -> i64 {
        self.end_col - self.start_col + 1
    }

    pub fn height(&self) -> i64 {
        self.end_row - self.start_row + 1
    }

    pub fn world_bounds(&self, offsets: &SheetOffsets) -> (f32, f32, f32, f32) {
        let (x, _) = offsets.column_position_size(self.start_col);
        let (y, _) = offsets.row_position_size(self.start_row);
        let (end_x, end_w) = offsets.column_position_size(self.end_col);
        let (end_y, end_h) = offsets.row_position_size(self.end_row);
        (
            x as f32,
            y as f32,
            (end_x + end_w - x) as f32,
            (end_y + end_h - y) as f32,
        )
    }
}

impl Default for SelectionRange {
    fn default() -> Self {
        Self::new(1, 1, 10, 10)
    }
}

/// Request to render a portion of a sheet
#[derive(Debug, Clone)]
pub struct RenderRequest {
    pub selection: SelectionRange,
    pub width: u32,
    pub height: u32,
    pub scale: Option<f32>,
    pub offsets: SheetOffsets,
    pub fills: Vec<RenderFill>,
    pub cells: Vec<RenderCell>,
    pub borders: SheetBorders,
    pub table_outlines: TableOutlines,
    pub chart_images: Vec<ChartImage>,
    pub table_name_icons: Vec<TableNameIcon>,
    pub background_color: Option<[f32; 4]>,
    pub show_grid_lines: bool,
    pub grid_exclusion_zones: Vec<GridExclusionZone>,
}

impl RenderRequest {
    pub fn new(selection: SelectionRange, width: u32, height: u32) -> Self {
        Self {
            selection,
            width,
            height,
            scale: None,
            offsets: SheetOffsets::default(),
            fills: Vec::new(),
            cells: Vec::new(),
            borders: SheetBorders::new(),
            table_outlines: TableOutlines::new(),
            chart_images: Vec::new(),
            table_name_icons: Vec::new(),
            background_color: None,
            show_grid_lines: true,
            grid_exclusion_zones: Vec::new(),
        }
    }

    pub fn calculate_viewport(&self) -> (f32, f32, f32) {
        let (world_x, world_y, world_w, world_h) =
            self.selection.world_bounds(&self.offsets);
        let buffer = 1.0;
        let total_buffer = buffer * 2.0;
        let scale_x = (self.width as f32 - total_buffer) / world_w;
        let scale_y = (self.height as f32 - total_buffer) / world_h;
        let scale = self.scale.unwrap_or_else(|| scale_x.min(scale_y));
        let viewport_x = world_x - buffer / scale;
        let viewport_y = world_y - buffer / scale;
        (viewport_x, viewport_y, scale)
    }

    pub fn background(&self) -> [f32; 4] {
        self.background_color.unwrap_or([1.0, 1.0, 1.0, 1.0])
    }
}

fn cell_border_line_to_style(
    line: &quadratic_core::grid::sheet::borders::CellBorderLine,
) -> BorderLineStyle {
    use quadratic_core::grid::sheet::borders::CellBorderLine;
    match line {
        CellBorderLine::Line1 => BorderLineStyle::Line1,
        CellBorderLine::Line2 => BorderLineStyle::Line2,
        CellBorderLine::Line3 => BorderLineStyle::Line3,
        CellBorderLine::Dotted => BorderLineStyle::Dotted,
        CellBorderLine::Dashed => BorderLineStyle::Dashed,
        CellBorderLine::Double => BorderLineStyle::Double,
        CellBorderLine::Clear => BorderLineStyle::Line1,
    }
}

/// Build a RenderRequest from grid controller and sheet for the given selection.
/// Used by both native (thumbnail/screenshot) and future WASM renderers.
pub fn build_render_request(
    gc: &GridController,
    sheet_id: quadratic_core::grid::SheetId,
    sheet: &Sheet,
    selection: SelectionRange,
    render_width: u32,
    render_height: u32,
    show_grid_lines: bool,
) -> RenderRequest {
    let offsets = sheet.offsets().clone();
    let mut request = RenderRequest::new(selection, render_width, render_height);
    request.show_grid_lines = show_grid_lines;
    request.offsets = offsets.clone();

    let render_rect = quadratic_core::Rect::new_span(
        Pos {
            x: selection.start_col,
            y: selection.start_row,
        },
        Pos {
            x: selection.end_col,
            y: selection.end_row,
        },
    );

    let js_fills = sheet.get_render_fills_in_rect(render_rect);
    let mut fills: Vec<RenderFill> = js_fills.into_iter().map(RenderFill::from).collect();
    let a1_context = gc.a1_context();
    let cf_fills = gc.get_conditional_format_fills(sheet_id, render_rect, a1_context);
    for (rect, color) in cf_fills {
        fills.push(RenderFill::new(
            rect.min.x,
            rect.min.y,
            (rect.max.x - rect.min.x + 1) as u32,
            (rect.max.y - rect.min.y + 1) as u32,
            parse_color_to_rgba(&color),
        ));
    }
    request.fills = fills;

    let mut js_cells = sheet.get_render_cells(render_rect, a1_context);
    gc.apply_conditional_formatting_to_cells(sheet_id, render_rect, &mut js_cells);
    let mut cells: Vec<RenderCell> = js_cells.into_iter().map(RenderCell::from).collect();
    let table_name_text_color = Rgba::rgb(255, 255, 255);
    let column_header_text_color = Rgba::rgb(2, 8, 23);
    for cell in &mut cells {
        if cell.table_name == Some(true) {
            cell.text_color = Some(table_name_text_color);
        } else if cell.column_header == Some(true) {
            cell.text_color = Some(column_header_text_color);
        }
    }
    request.cells = cells;

    let js_borders = sheet.borders_in_sheet();
    let mut borders = SheetBorders::new();
    if let Some(h_borders) = js_borders.horizontal {
        for border in h_borders {
            let color = from_rgba(&border.color);
            let line_style = cell_border_line_to_style(&border.line);
            borders.add_horizontal(border.x, border.y, border.width, color, line_style);
        }
    }
    if let Some(v_borders) = js_borders.vertical {
        for border in v_borders {
            let color = from_rgba(&border.color);
            let line_style = cell_border_line_to_style(&border.line);
            borders.add_vertical(border.x, border.y, border.height, color, line_style);
        }
    }
    request.borders = borders;

    let mut table_outlines = TableOutlines::new();
    let mut table_name_cells: Vec<RenderCell> = Vec::new();
    let mut table_name_icons: Vec<TableNameIcon> = Vec::new();

    for code_cell in sheet.get_all_render_code_cells() {
        let table_x = code_cell.x as i64;
        let table_y = code_cell.y as i64;
        let table_right = table_x + code_cell.w as i64;
        let table_bottom = table_y + code_cell.h as i64;

        if table_right <= selection.start_col
            || table_x > selection.end_col
            || table_bottom <= selection.start_row
            || table_y > selection.end_row
        {
            continue;
        }

        let clipped_x = table_x.max(selection.start_col);
        let clipped_y = table_y.max(selection.start_row);
        let clipped_right = table_right.min(selection.end_col + 1);
        let clipped_bottom = table_bottom.min(selection.end_row + 1);
        let clipped_w = (clipped_right - clipped_x) as u32;
        let clipped_h = (clipped_bottom - clipped_y) as u32;

        let is_clipped_top = table_y < selection.start_row;
        let is_clipped_bottom = table_bottom > selection.end_row + 1;
        let is_clipped_left = table_x < selection.start_col;
        let is_clipped_right = table_right > selection.end_col + 1;

        let show_name = code_cell.show_name && table_y >= selection.start_row;
        let show_columns = code_cell.show_columns
            && (table_y + if show_name { 1 } else { 0 }) >= selection.start_row;

        let mut table = TableOutline::new(clipped_x, clipped_y, clipped_w, clipped_h)
            .with_show_columns(show_columns)
            .with_active(false)
            .with_clipped_top(is_clipped_top)
            .with_clipped_bottom(is_clipped_bottom)
            .with_clipped_left(is_clipped_left)
            .with_clipped_right(is_clipped_right);

        if show_name {
            table = table.with_name(&code_cell.name);
            table_name_icons.push(TableNameIcon {
                x: table_x,
                y: table_y,
                language: code_cell.language.clone(),
            });
            table_name_cells.push(RenderCell {
                x: table_x,
                y: table_y,
                value: code_cell.name.clone(),
                bold: Some(true),
                text_color: Some(Rgba::rgb(255, 255, 255)),
                table_name: Some(true),
                language: Some(code_cell.language.clone()),
                table_columns: Some(code_cell.w),
                ..Default::default()
            });
        }
        table_outlines.add(table);
    }

    for pos in sheet.iter_code_cells_positions() {
        if pos.x < selection.start_col
            || pos.x > selection.end_col
            || pos.y < selection.start_row
            || pos.y > selection.end_row
        {
            continue;
        }
        if let Some(CellValue::Code(_)) = sheet.cell_value_ref(pos) {
            let table = TableOutline::new(pos.x, pos.y, 1, 1)
                .with_show_columns(false)
                .with_active(false);
            table_outlines.add(table);
        }
    }

    request.table_outlines = table_outlines;
    request.table_name_icons = table_name_icons;

    if !table_name_cells.is_empty() {
        let table_name_positions: std::collections::HashSet<(i64, i64)> = table_name_cells
            .iter()
            .map(|cell| (cell.x, cell.y))
            .collect();
        request
            .cells
            .retain(|cell| !table_name_positions.contains(&(cell.x, cell.y)));
    }
    request.cells.extend(table_name_cells);

    let mut chart_images = Vec::new();
    let mut grid_exclusion_zones = Vec::new();

    for html_output in sheet.get_html_output() {
        let chart_x = html_output.x as i64;
        let chart_y = html_output.y as i64 + if html_output.show_name { 1 } else { 0 };
        let chart_w = html_output.w as i64;
        let chart_h = html_output.h as i64;

        if chart_x + chart_w <= selection.start_col
            || chart_x > selection.end_col
            || chart_y + chart_h <= selection.start_row
            || chart_y > selection.end_row
        {
            continue;
        }

        let (left, _) = request.offsets.column_position_size(chart_x);
        let (top, _) = request.offsets.row_position_size(chart_y);
        let (right_pos, right_size) =
            request.offsets.column_position_size(chart_x + chart_w - 1);
        let (bottom_pos, bottom_size) =
            request.offsets.row_position_size(chart_y + chart_h - 1);

        grid_exclusion_zones.push(GridExclusionZone {
            left: left as f32,
            top: top as f32,
            right: (right_pos + right_size) as f32,
            bottom: (bottom_pos + bottom_size) as f32,
        });

        if let Some(chart_image_data) = html_output.chart_image {
            chart_images.push(ChartImage {
                x: chart_x,
                y: chart_y,
                width: html_output.w as u32,
                height: html_output.h as u32,
                image_data: chart_image_data,
            });
        }
    }
    request.chart_images = chart_images;
    request.grid_exclusion_zones = grid_exclusion_zones;

    request
}
