//! Main render pass

use std::collections::HashMap;

use wgpu::{
    Color, CommandEncoderDescriptor, LoadOp, Operations, RenderPassColorAttachment,
    RenderPassDescriptor, StoreOp, TextureViewDescriptor,
};

use quadratic_renderer_core::SheetBordersRender;

use super::NativeRenderer;
use crate::request::RenderRequest;

impl NativeRenderer {
    /// Render a request and return raw RGBA pixels
    pub fn render(&mut self, request: &RenderRequest) -> anyhow::Result<Vec<u8>> {
        // Resize if needed
        self.resize(request.width, request.height);

        // Calculate viewport
        let (viewport_x, viewport_y, scale) = request.calculate_viewport();

        // Create view-projection matrix
        let matrix = self.create_matrix(viewport_x, viewport_y, scale);

        // Create render data from request
        let background = self.create_background(request);
        let fills = self.create_fills(request);
        let grid_lines = if request.show_grid_lines {
            Some(self.create_grid_lines(request, viewport_x, viewport_y, scale))
        } else {
            None
        };

        // Pre-compute text meshes, emojis, and horizontal lines (before render pass)
        // This allows us to lazy-load emoji textures before rendering
        let (text_meshes, atlas_font_size, distance_range, emojis_to_render, horizontal_lines) =
            if !request.cells.is_empty() && !self.fonts.is_empty() {
                self.create_text_meshes(request)
            } else {
                (
                    Vec::new(),
                    14.0,
                    4.0,
                    Vec::new(),
                    quadratic_renderer_core::FillBuffer::new(),
                )
            };

        // Lazy-load emoji textures that are needed
        if !emojis_to_render.is_empty() {
            if let Some(ref spritesheet) = self.emoji_spritesheet {
                // Collect unique texture UIDs needed
                let mut needed_pages: std::collections::HashSet<u32> =
                    std::collections::HashSet::new();
                for emoji in &emojis_to_render {
                    if let Some(uv) = spritesheet.get_emoji_uv(&emoji.emoji) {
                        needed_pages.insert(uv.texture_uid);
                    }
                }

                // Upload any missing pages
                for texture_uid in needed_pages {
                    if let Err(e) = self.ensure_emoji_page_uploaded(texture_uid) {
                        log::warn!("Failed to load emoji page {}: {}", texture_uid, e);
                    }
                }
            }
        }

        // Render
        let view = self
            .render_texture
            .create_view(&TextureViewDescriptor::default());

        let mut encoder = self
            .wgpu
            .device()
            .create_command_encoder(&CommandEncoderDescriptor {
                label: Some("Render Encoder"),
            });

        {
            let bg = request.background();
            let mut pass = encoder.begin_render_pass(&RenderPassDescriptor {
                label: Some("Main Pass"),
                color_attachments: &[Some(RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: Operations {
                        load: LoadOp::Clear(Color {
                            r: bg[0] as f64,
                            g: bg[1] as f64,
                            b: bg[2] as f64,
                            a: bg[3] as f64,
                        }),
                        store: StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });

            // Draw background (in-bounds area)
            if !background.vertices.is_empty() {
                self.wgpu
                    .draw_triangles(&mut pass, &background.vertices, &matrix);
            }

            // Draw fills
            if !fills.vertices.is_empty() {
                self.wgpu
                    .draw_triangles(&mut pass, &fills.vertices, &matrix);
            }

            // Draw grid lines
            if let Some(ref lines) = grid_lines {
                if !lines.vertices.is_empty() {
                    self.wgpu.draw_lines(&mut pass, &lines.vertices, &matrix);
                }
            }

            // Draw borders (on top of grid lines) as filled quads with thickness
            if !request.borders.is_empty() {
                let border_quads = request.borders.to_fill_buffer(
                    &request.offsets,
                    request.selection.start_col,
                    request.selection.start_row,
                    request.selection.end_col,
                    request.selection.end_row,
                );
                if !border_quads.vertices.is_empty() {
                    log::debug!("Drawing {} border quads", border_quads.vertices.len() / 36);
                    self.wgpu
                        .draw_triangles(&mut pass, &border_quads.vertices, &matrix);
                }
            }

            // Draw chart images (under table outlines so outlines appear on top)
            for chart_info in &self.chart_infos {
                if self.wgpu.has_texture(chart_info.texture_uid) {
                    let (vertices, indices) =
                        self.create_chart_sprite_from_info(chart_info, request);
                    log::debug!(
                        "Drawing chart image at ({}, {}): spans {}x{} cells, texture {}x{} pixels",
                        chart_info.x,
                        chart_info.y,
                        chart_info.cell_width,
                        chart_info.cell_height,
                        chart_info.texture_width,
                        chart_info.texture_height
                    );
                    self.wgpu.draw_sprites(
                        &mut pass,
                        chart_info.texture_uid,
                        &vertices,
                        &indices,
                        &matrix,
                    );
                }
            }

            // Draw table outlines (on top of chart images)
            if !request.table_outlines.is_empty() {
                let (outline_lines, name_bgs, col_bgs) =
                    request.table_outlines.to_render_buffers(&request.offsets);

                // Draw name backgrounds first (under text)
                if !name_bgs.vertices.is_empty() {
                    log::debug!("Drawing table name backgrounds");
                    self.wgpu
                        .draw_triangles(&mut pass, &name_bgs.vertices, &matrix);
                }

                // Draw column header backgrounds
                if !col_bgs.vertices.is_empty() {
                    log::debug!("Drawing table column header backgrounds");
                    self.wgpu
                        .draw_triangles(&mut pass, &col_bgs.vertices, &matrix);
                }

                // Draw outline lines
                if !outline_lines.vertices.is_empty() {
                    log::debug!(
                        "Drawing {} table outline lines",
                        outline_lines.vertices.len() / 12
                    );
                    self.wgpu
                        .draw_lines(&mut pass, &outline_lines.vertices, &matrix);
                }
            }

            // Draw text (meshes were pre-computed above)
            if !text_meshes.is_empty() {
                log::debug!(
                    "Text geometry: {} meshes, {} emojis, atlas_font_size={}, distance_range={}, viewport_scale={}",
                    text_meshes.len(),
                    emojis_to_render.len(),
                    atlas_font_size,
                    distance_range,
                    scale
                );
                for mesh in &text_meshes {
                    if !mesh.is_empty() {
                        let vertices = mesh.get_vertex_data();
                        let font_scale = mesh.font_size / atlas_font_size;
                        log::debug!(
                            "Drawing text mesh: texture_uid={}, font_scale={}, vertices={}, indices={}",
                            mesh.texture_uid,
                            font_scale,
                            vertices.len(),
                            mesh.indices.len()
                        );
                        self.wgpu.draw_text(
                            &mut pass,
                            &vertices,
                            &mesh.indices,
                            mesh.texture_uid,
                            &matrix,
                            scale,
                            font_scale,
                            distance_range,
                        );
                    }
                }
            }

            // Draw horizontal lines (underlines/strikethroughs)
            if !horizontal_lines.is_empty() {
                log::debug!(
                    "Drawing {} horizontal line vertices",
                    horizontal_lines.vertices.len()
                );
                self.wgpu
                    .draw_triangles(&mut pass, &horizontal_lines.vertices, &matrix);
            }

            // Draw emoji sprites
            if !emojis_to_render.is_empty() {
                if let Some(ref spritesheet) = self.emoji_spritesheet {
                    // Group emojis by texture page
                    let mut emoji_sprites_by_texture: HashMap<u32, (Vec<f32>, Vec<u32>)> =
                        HashMap::new();

                    for emoji in &emojis_to_render {
                        if let Some(uv) = spritesheet.get_emoji_uv(&emoji.emoji) {
                            let entry = emoji_sprites_by_texture
                                .entry(uv.texture_uid)
                                .or_insert_with(|| (Vec::new(), Vec::new()));

                            let vertex_offset = (entry.0.len() / 8) as u32;

                            // Create quad vertices
                            // Position: centered on (emoji.x, emoji.y)
                            let half_w = emoji.width / 2.0;
                            let half_h = emoji.height / 2.0;
                            let x1 = emoji.x - half_w;
                            let y1 = emoji.y - half_h;
                            let x2 = emoji.x + half_w;
                            let y2 = emoji.y + half_h;

                            let [u0, v0, u1, v1] = uv.uvs;

                            // White color (show emoji as-is)
                            let r = 1.0f32;
                            let g = 1.0f32;
                            let b = 1.0f32;
                            let a = 1.0f32;

                            // Top-left
                            entry.0.extend_from_slice(&[x1, y1, u0, v0, r, g, b, a]);
                            // Top-right
                            entry.0.extend_from_slice(&[x2, y1, u1, v0, r, g, b, a]);
                            // Bottom-right
                            entry.0.extend_from_slice(&[x2, y2, u1, v1, r, g, b, a]);
                            // Bottom-left
                            entry.0.extend_from_slice(&[x1, y2, u0, v1, r, g, b, a]);

                            // Indices for two triangles
                            entry.1.push(vertex_offset);
                            entry.1.push(vertex_offset + 1);
                            entry.1.push(vertex_offset + 2);
                            entry.1.push(vertex_offset);
                            entry.1.push(vertex_offset + 2);
                            entry.1.push(vertex_offset + 3);
                        }
                    }

                    // Draw emoji sprites by texture
                    for (texture_uid, (vertices, indices)) in &emoji_sprites_by_texture {
                        if self.wgpu.has_texture(*texture_uid) {
                            log::debug!(
                                "Drawing {} emojis with texture {}",
                                indices.len() / 6,
                                texture_uid
                            );
                            self.wgpu.draw_sprites(
                                &mut pass,
                                *texture_uid,
                                vertices,
                                indices,
                                &matrix,
                            );
                        }
                    }
                }
            }

            // Draw language icons (on table name backgrounds)
            for icon_info in &self.language_icons {
                if self.wgpu.has_texture(icon_info.texture_uid) {
                    let (vertices, indices) = self.create_icon_sprite(icon_info, request);
                    self.wgpu.draw_sprites(
                        &mut pass,
                        icon_info.texture_uid,
                        &vertices,
                        &indices,
                        &matrix,
                    );
                }
            }
        }

        self.wgpu.queue().submit(std::iter::once(encoder.finish()));

        // Read pixels back
        self.read_pixels()
    }
}
