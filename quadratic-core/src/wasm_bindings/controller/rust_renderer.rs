//! Functions for communicating with the Rust renderer.
//!
//! These functions handle bidirectional bincode communication between
//! the core worker and the rust renderer worker.

use std::str::FromStr;

use super::*;
use crate::Rect;
use crate::grid::SheetId;
use crate::wasm_bindings::js::log;
use quadratic_core_shared::{
    CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH, CoreToRenderer, HashCells, NumericFormatKind, RenderCell,
    RenderCellFormatSpan, RenderCellLinkSpan, RenderCellSpecial, RenderNumber, RendererToCore,
    SheetFill, SheetInfo, serialization,
};

use crate::grid::{
    formatting::{
        CellAlign, CellVerticalAlign, CellWrap, NumericFormatKind as CoreNumericFormatKind,
    },
    js_types::{JsNumber, JsRenderCellFormatSpan, JsRenderCellLinkSpan, JsRenderCellSpecial},
};

fn convert_align(align: CellAlign) -> quadratic_core_shared::CellAlign {
    match align {
        CellAlign::Left => quadratic_core_shared::CellAlign::Left,
        CellAlign::Center => quadratic_core_shared::CellAlign::Center,
        CellAlign::Right => quadratic_core_shared::CellAlign::Right,
    }
}

fn convert_vertical_align(align: CellVerticalAlign) -> quadratic_core_shared::CellVerticalAlign {
    match align {
        CellVerticalAlign::Top => quadratic_core_shared::CellVerticalAlign::Top,
        CellVerticalAlign::Middle => quadratic_core_shared::CellVerticalAlign::Middle,
        CellVerticalAlign::Bottom => quadratic_core_shared::CellVerticalAlign::Bottom,
    }
}

fn convert_wrap(wrap: CellWrap) -> quadratic_core_shared::CellWrap {
    match wrap {
        CellWrap::Wrap => quadratic_core_shared::CellWrap::Wrap,
        CellWrap::Clip => quadratic_core_shared::CellWrap::Clip,
        CellWrap::Overflow => quadratic_core_shared::CellWrap::Overflow,
    }
}

fn convert_special(special: JsRenderCellSpecial) -> RenderCellSpecial {
    match special {
        JsRenderCellSpecial::Chart => RenderCellSpecial::Chart,
        JsRenderCellSpecial::SpillError => RenderCellSpecial::SpillError,
        JsRenderCellSpecial::RunError => RenderCellSpecial::RunError,
        JsRenderCellSpecial::Logical => RenderCellSpecial::Logical,
        JsRenderCellSpecial::Checkbox => RenderCellSpecial::Checkbox,
        JsRenderCellSpecial::List => RenderCellSpecial::List,
    }
}

fn convert_number(num: JsNumber) -> RenderNumber {
    RenderNumber {
        decimals: num.decimals,
        commas: num.commas,
        format: num.format.map(|f| quadratic_core_shared::NumericFormat {
            kind: match f.kind {
                CoreNumericFormatKind::Number => NumericFormatKind::Number,
                CoreNumericFormatKind::Currency => NumericFormatKind::Currency,
                CoreNumericFormatKind::Percentage => NumericFormatKind::Percentage,
                CoreNumericFormatKind::Exponential => NumericFormatKind::Exponential,
            },
            symbol: f.symbol.clone(),
        }),
    }
}

fn convert_link_span(span: JsRenderCellLinkSpan) -> RenderCellLinkSpan {
    RenderCellLinkSpan {
        start: span.start,
        end: span.end,
        url: span.url,
    }
}

fn convert_format_span(span: JsRenderCellFormatSpan) -> RenderCellFormatSpan {
    RenderCellFormatSpan {
        start: span.start,
        end: span.end,
        bold: span.bold,
        italic: span.italic,
        underline: span.underline,
        strike_through: span.strike_through,
        text_color: span.text_color,
        link: span.link,
    }
}

impl GridController {
    /// Internal: Send complete sheet info (metadata + offsets) to the rust renderer.
    pub fn send_sheet_info_to_rust_renderer(&self, sheet_id: SheetId) -> Result<(), String> {
        let sheet = self
            .try_sheet(sheet_id)
            .ok_or_else(|| "Sheet not found".to_string())?;

        // Convert to shared SheetId for the message
        let shared_sheet_id = quadratic_core_shared::SheetId::from_str(&sheet_id.to_string())
            .map_err(|e| format!("Invalid sheet_id: {e}"))?;

        // Serialize the SheetOffsets to bincode bytes
        let offsets_bytes = serialization::serialize(&sheet.offsets)
            .map_err(|e| format!("Failed to serialize offsets: {e}"))?;

        // Create SheetInfo with all metadata and offsets
        let sheet_info = SheetInfo {
            sheet_id: shared_sheet_id,
            name: sheet.name.clone(),
            order: sheet.order.clone(),
            color: sheet
                .color
                .as_ref()
                .and_then(|c| quadratic_core_shared::Rgba::from_hex(c)),
            offsets_bytes,
        };

        // Create the message
        let message = CoreToRenderer::SheetInfo(sheet_info);

        // Serialize the message to bincode
        let bytes = serialization::serialize(&message)
            .map_err(|e| format!("Failed to serialize message: {e}"))?;

        log(&format!(
            "[rust_renderer] Sending SheetInfo '{}' ({} bytes) to renderer",
            sheet.name,
            bytes.len()
        ));

        // Send to rust renderer via JS callback
        crate::wasm_bindings::js::jsSendToRustRenderer(bytes);

        Ok(())
    }

    /// Internal: Send sheet info for all sheets to the rust renderer.
    /// This is called automatically when a file is loaded.
    pub fn send_all_sheet_info_to_rust_renderer(&self) -> Result<(), String> {
        let sheet_ids = self.sheet_ids();
        log(&format!(
            "[rust_renderer] Sending all sheet info to renderer ({} sheets)",
            sheet_ids.len()
        ));
        for sheet_id in sheet_ids {
            self.send_sheet_info_to_rust_renderer(sheet_id)?;
        }
        log("[rust_renderer] All sheet info sent to renderer");
        Ok(())
    }

    // =========================================================================
    // Receiving messages from Rust Renderer
    // =========================================================================

    /// Handle a bincode-encoded message from the rust renderer.
    pub fn handle_rust_renderer_message(&self, data: &[u8]) -> Result<(), String> {
        let message: RendererToCore = serialization::deserialize(data)
            .map_err(|e| format!("Failed to deserialize renderer message: {e}"))?;

        log(&format!(
            "[rust_renderer] Received message: {:?}",
            std::mem::discriminant(&message)
        ));

        match message {
            RendererToCore::Ready => {
                log("[rust_renderer] Renderer ready, sending initial data");

                // Send all sheet info
                let _ = self.send_all_sheet_info_to_rust_renderer();

                // Send meta fills and initial hashes for the first sheet
                if let Some(first_sheet_id) = self.sheet_ids().first().copied() {
                    // Send meta fills
                    if let Err(e) = self.send_meta_fills_to_rust_renderer_by_id(first_sheet_id) {
                        log(&format!("[rust_renderer] Error sending meta fills: {}", e));
                    }

                    // Send initial hashes for a reasonable viewport (e.g., first 10x10 hashes)
                    let initial_hashes: Vec<quadratic_core_shared::Pos> = (0..10_i64)
                        .flat_map(|x| {
                            (0..10_i64).map(move |y| quadratic_core_shared::Pos::new(x, y))
                        })
                        .collect();

                    if let Err(e) =
                        self.send_hashes_to_rust_renderer(first_sheet_id, &initial_hashes)
                    {
                        log(&format!(
                            "[rust_renderer] Error sending initial hashes: {}",
                            e
                        ));
                    }
                }
            }

            RendererToCore::RequestMetaFills { sheet_id } => {
                let local_sheet_id = SheetId::from_str(&sheet_id.to_string())
                    .map_err(|e| format!("Invalid sheet_id: {e}"))?;

                log(&format!(
                    "[rust_renderer] Sending meta fills for sheet {}",
                    sheet_id
                ));

                self.send_meta_fills_to_rust_renderer_by_id(local_sheet_id)?;
            }

            RendererToCore::RequestHashes { sheet_id, hashes } => {
                let local_sheet_id = SheetId::from_str(&sheet_id.to_string())
                    .map_err(|e| format!("Invalid sheet_id: {e}"))?;

                log(&format!(
                    "[rust_renderer] Sending {} hashes for sheet {}",
                    hashes.len(),
                    sheet_id
                ));

                self.send_hashes_to_rust_renderer(local_sheet_id, &hashes)?;
            }

            RendererToCore::ViewportChanged {
                sheet_id,
                visible_rect: _,
                hash_bounds,
            } => {
                // Convert hash bounds to list of hash positions
                let mut hashes = Vec::new();
                for x in hash_bounds.min.x..=hash_bounds.max.x {
                    for y in hash_bounds.min.y..=hash_bounds.max.y {
                        hashes.push(quadratic_core_shared::Pos::new(x, y));
                    }
                }

                let local_sheet_id = SheetId::from_str(&sheet_id.to_string())
                    .map_err(|e| format!("Invalid sheet_id: {e}"))?;

                self.send_hashes_to_rust_renderer(local_sheet_id, &hashes)?;
            }

            // These are user interaction messages - forward to appropriate handlers
            RendererToCore::CellClick { .. }
            | RendererToCore::CellHover { .. }
            | RendererToCore::SelectionStart { .. }
            | RendererToCore::SelectionDrag { .. }
            | RendererToCore::SelectionEnd
            | RendererToCore::CellEdit { .. }
            | RendererToCore::ColumnResize { .. }
            | RendererToCore::RowResize { .. } => {
                // TODO: Forward to appropriate handlers when implemented
                log(&format!(
                    "[rust_renderer] Ignoring user interaction message: {:?}",
                    std::mem::discriminant(&message)
                ));
            }
        }

        Ok(())
    }

    /// Send meta fills for a sheet to the rust renderer.
    fn send_meta_fills_to_rust_renderer_by_id(&self, sheet_id: SheetId) -> Result<(), String> {
        let sheet = self
            .try_sheet(sheet_id)
            .ok_or_else(|| "Sheet not found".to_string())?;

        let shared_sheet_id = quadratic_core_shared::SheetId::from_str(&sheet_id.to_string())
            .map_err(|e| format!("Invalid sheet_id: {e}"))?;

        let fills = sheet.get_all_sheet_fills();

        // Convert to shared types
        let shared_fills: Vec<SheetFill> = fills
            .iter()
            .map(|f| SheetFill {
                x: f.x,
                y: f.y,
                w: f.w,
                h: f.h,
                color: f.color.clone(),
            })
            .collect();

        let fills_bytes = serialization::serialize(&shared_fills)
            .map_err(|e| format!("Failed to serialize fills: {e}"))?;

        let message = CoreToRenderer::SheetMetaFills {
            sheet_id: shared_sheet_id,
            fills_bytes,
        };

        let bytes = serialization::serialize(&message)
            .map_err(|e| format!("Failed to serialize message: {e}"))?;

        log(&format!(
            "[rust_renderer] Sending {} meta fills ({} bytes)",
            shared_fills.len(),
            bytes.len()
        ));

        crate::wasm_bindings::js::jsSendToRustRenderer(bytes);

        Ok(())
    }

    /// Send hash cells for specific hashes to the rust renderer.
    fn send_hashes_to_rust_renderer(
        &self,
        sheet_id: SheetId,
        hashes: &[quadratic_core_shared::Pos],
    ) -> Result<(), String> {
        let sheet = self
            .try_sheet(sheet_id)
            .ok_or_else(|| "Sheet not found".to_string())?;

        let shared_sheet_id = quadratic_core_shared::SheetId::from_str(&sheet_id.to_string())
            .map_err(|e| format!("Invalid sheet_id: {e}"))?;

        let mut hash_cells_vec = Vec::new();

        for hash in hashes {
            let rect = Rect::from_numbers(
                hash.x * CELL_SHEET_WIDTH as i64,
                hash.y * CELL_SHEET_HEIGHT as i64,
                CELL_SHEET_WIDTH as i64,
                CELL_SHEET_HEIGHT as i64,
            );

            // Get fills for this hash
            let fills = sheet.get_render_fills_in_rect(rect);
            let shared_fills: Vec<quadratic_core_shared::RenderFill> = fills
                .iter()
                .map(|f| quadratic_core_shared::RenderFill {
                    x: f.x,
                    y: f.y,
                    w: f.w,
                    h: f.h,
                    color: f.color.clone(),
                })
                .collect();

            // Get cells and convert to RenderCell format
            let a1_context = self.a1_context();
            let js_render_cells = sheet.get_render_cells(rect, &a1_context);
            let cells: Vec<RenderCell> = js_render_cells
                .into_iter()
                .map(|cell| RenderCell {
                    x: cell.x,
                    y: cell.y,
                    value: cell.value,
                    language: cell.language,
                    align: cell.align.map(convert_align),
                    vertical_align: cell.vertical_align.map(convert_vertical_align),
                    wrap: cell.wrap.map(convert_wrap),
                    bold: cell.bold,
                    italic: cell.italic,
                    underline: cell.underline,
                    strike_through: cell.strike_through,
                    text_color: cell.text_color,
                    font_size: cell.font_size,
                    special: cell.special.map(convert_special),
                    number: cell.number.map(convert_number),
                    table_name: cell.table_name,
                    column_header: cell.column_header,
                    link_spans: cell.link_spans.into_iter().map(convert_link_span).collect(),
                    format_spans: cell
                        .format_spans
                        .into_iter()
                        .map(convert_format_span)
                        .collect(),
                })
                .collect();

            hash_cells_vec.push(HashCells {
                sheet_id: shared_sheet_id.clone(),
                hash_pos: *hash,
                cells,
                fills: shared_fills,
            });
        }

        if !hash_cells_vec.is_empty() {
            let message = CoreToRenderer::HashCells(hash_cells_vec);
            let bytes = serialization::serialize(&message)
                .map_err(|e| format!("Failed to serialize message: {e}"))?;

            log(&format!(
                "[rust_renderer] Sending {} hash cells ({} bytes)",
                hashes.len(),
                bytes.len()
            ));

            crate::wasm_bindings::js::jsSendToRustRenderer(bytes);
        }

        Ok(())
    }

    // =========================================================================
    // Sending messages to Rust Renderer
    // =========================================================================

    /// Internal: Send sheet offsets to the rust renderer.
    pub fn send_sheet_offsets_to_rust_renderer(&self, sheet_id: SheetId) -> Result<(), String> {
        let sheet = self
            .try_sheet(sheet_id)
            .ok_or_else(|| "Sheet not found".to_string())?;

        // Convert to shared SheetId for the message
        let shared_sheet_id = quadratic_core_shared::SheetId::from_str(&sheet_id.to_string())
            .map_err(|e| format!("Invalid sheet_id: {e}"))?;

        // Serialize the SheetOffsets to bincode bytes
        let offsets_bytes = serialization::serialize(&sheet.offsets)
            .map_err(|e| format!("Failed to serialize offsets: {e}"))?;

        // Create the message with the serialized offsets
        let message = CoreToRenderer::SheetOffsets {
            sheet_id: shared_sheet_id,
            offsets_bytes,
        };

        // Serialize the message to bincode
        let bytes = serialization::serialize(&message)
            .map_err(|e| format!("Failed to serialize message: {e}"))?;

        // Send to rust renderer via JS callback
        crate::wasm_bindings::js::jsSendToRustRenderer(bytes);

        Ok(())
    }
}

#[wasm_bindgen]
impl GridController {
    /// Handle a bincode-encoded message from the rust renderer.
    /// This is called from TypeScript when a message arrives via MessagePort.
    #[wasm_bindgen(js_name = "handleRustRendererMessage")]
    pub fn js_handle_rust_renderer_message(&self, data: &[u8]) -> Result<(), JsValue> {
        self.handle_rust_renderer_message(data)
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Send complete sheet info (metadata + offsets) to the rust renderer.
    /// This should be called when:
    /// - A file is loaded with the rust renderer enabled
    /// - Switching to a different sheet
    /// - Sheet metadata changes (name, color, order)
    #[wasm_bindgen(js_name = "sendSheetInfoToRustRenderer")]
    pub fn js_send_sheet_info_to_rust_renderer(&self, sheet_id: String) -> Result<(), JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id)
            .map_err(|e| JsValue::from_str(&format!("Invalid sheet_id: {e}")))?;
        self.send_sheet_info_to_rust_renderer(sheet_id)
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Send sheet info for all sheets to the rust renderer.
    /// This should be called when a file is loaded with the rust renderer enabled.
    #[wasm_bindgen(js_name = "sendAllSheetInfoToRustRenderer")]
    pub fn js_send_all_sheet_info_to_rust_renderer(&self) -> Result<(), JsValue> {
        self.send_all_sheet_info_to_rust_renderer()
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Send sheet offsets to the rust renderer.
    /// This should be called when column/row sizes change.
    #[wasm_bindgen(js_name = "sendSheetOffsetsToRustRenderer")]
    pub fn js_send_sheet_offsets_to_rust_renderer(&self, sheet_id: String) -> Result<(), JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id)
            .map_err(|e| JsValue::from_str(&format!("Invalid sheet_id: {e}")))?;
        self.send_sheet_offsets_to_rust_renderer(sheet_id)
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Send all sheet offsets to the rust renderer (for all sheets).
    /// This should be called when a file is loaded with the rust renderer enabled.
    #[wasm_bindgen(js_name = "sendAllSheetOffsetsToRustRenderer")]
    pub fn js_send_all_sheet_offsets_to_rust_renderer(&self) -> Result<(), JsValue> {
        for sheet_id in self.sheet_ids() {
            self.send_sheet_offsets_to_rust_renderer(sheet_id)
                .map_err(|e| JsValue::from_str(&e))?;
        }
        Ok(())
    }
}
