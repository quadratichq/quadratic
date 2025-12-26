//! RenderContext implementation for WebGPU
//!
//! Uses a buffered command model where draw calls are recorded
//! and executed at end_frame() in a single render pass.

use wgpu::util::DeviceExt;

use crate::primitives::TextureId;
use crate::render_context::{DrawCommand, RenderContext, RenderError};

use super::WebGPUContext;

impl RenderContext for WebGPUContext {
    fn begin_frame(&mut self) {
        self.command_buffer.clear();
    }

    fn end_frame(&mut self) {
        // Get surface texture
        let surface_texture = match self.surface.get_current_texture() {
            Ok(tex) => tex,
            Err(e) => {
                log::warn!("Failed to get surface texture: {:?}", e);
                return;
            }
        };

        let view = surface_texture
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());

        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("Frame Encoder"),
            });

        // Execute all buffered commands in a single render pass
        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Main Render Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        // We'll handle clear via command if present, otherwise load
                        load: wgpu::LoadOp::Load,
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });

            for command in self.command_buffer.commands() {
                self.execute_command(&mut pass, command);
            }
        }

        self.queue.submit(std::iter::once(encoder.finish()));
        surface_texture.present();
    }

    fn resize(&mut self, width: u32, height: u32) {
        if width > 0 && height > 0 {
            self.width = width;
            self.height = height;
            self.surface_config.width = width;
            self.surface_config.height = height;
            self.surface.configure(&self.device, &self.surface_config);
        }
    }

    fn width(&self) -> u32 {
        self.width
    }

    fn height(&self) -> u32 {
        self.height
    }

    fn backend_name(&self) -> &'static str {
        "WebGPU"
    }

    fn clear(&mut self, r: f32, g: f32, b: f32, a: f32) {
        self.command_buffer.push(DrawCommand::Clear { r, g, b, a });
    }

    fn set_viewport(&mut self, x: i32, y: i32, width: i32, height: i32) {
        self.command_buffer
            .push(DrawCommand::SetViewport { x, y, width, height });
    }

    fn reset_viewport(&mut self) {
        self.command_buffer.push(DrawCommand::ResetViewport);
    }

    fn set_scissor(&mut self, x: i32, y: i32, width: i32, height: i32) {
        self.command_buffer
            .push(DrawCommand::SetScissor { x, y, width, height });
    }

    fn disable_scissor(&mut self) {
        self.command_buffer.push(DrawCommand::DisableScissor);
    }

    fn draw_triangles(&mut self, vertices: &[f32], matrix: &[f32; 16]) {
        if vertices.is_empty() {
            return;
        }
        self.command_buffer.push(DrawCommand::Triangles {
            vertices: vertices.to_vec(),
            matrix: *matrix,
        });
    }

    fn draw_lines(&mut self, vertices: &[f32], matrix: &[f32; 16]) {
        if vertices.is_empty() {
            return;
        }
        self.command_buffer.push(DrawCommand::Lines {
            vertices: vertices.to_vec(),
            matrix: *matrix,
        });
    }

    fn draw_text(
        &mut self,
        vertices: &[f32],
        indices: &[u32],
        texture_uid: u32,
        matrix: &[f32; 16],
        viewport_scale: f32,
        font_scale: f32,
        distance_range: f32,
    ) {
        if vertices.is_empty() || indices.is_empty() {
            return;
        }
        self.command_buffer.push(DrawCommand::Text {
            vertices: vertices.to_vec(),
            indices: indices.to_vec(),
            texture_uid,
            matrix: *matrix,
            viewport_scale,
            font_scale,
            distance_range,
        });
    }

    fn draw_sprites(
        &mut self,
        texture_id: TextureId,
        vertices: &[f32],
        indices: &[u32],
        matrix: &[f32; 16],
    ) {
        if vertices.is_empty() || indices.is_empty() {
            return;
        }
        self.command_buffer.push(DrawCommand::Sprites {
            texture_id,
            vertices: vertices.to_vec(),
            indices: indices.to_vec(),
            matrix: *matrix,
        });
    }

    fn has_font_texture(&self, texture_uid: u32) -> bool {
        self.font_textures.contains_key(&texture_uid)
    }

    fn upload_font_texture(
        &mut self,
        texture_uid: u32,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), RenderError> {
        let texture = self.device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Font Texture"),
            size: wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });

        self.queue.write_texture(
            wgpu::ImageCopyTexture {
                texture: &texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            data,
            wgpu::ImageDataLayout {
                offset: 0,
                bytes_per_row: Some(width * 4),
                rows_per_image: Some(height),
            },
            wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
        );

        let texture_view = texture.create_view(&wgpu::TextureViewDescriptor::default());

        let bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Font Bind Group"),
            layout: &self.text_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: self.text_uniform_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(&texture_view),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(&self.linear_sampler),
                },
            ],
        });

        self.font_textures.insert(texture_uid, texture);
        self.font_texture_views.insert(texture_uid, texture_view);
        self.font_bind_groups.insert(texture_uid, bind_group);

        log::info!(
            "Uploaded font texture UID {} ({}x{})",
            texture_uid,
            width,
            height
        );
        Ok(())
    }

    fn has_sprite_texture(&self, texture_id: TextureId) -> bool {
        self.sprite_textures.contains_key(&texture_id)
    }

    fn upload_sprite_texture(
        &mut self,
        texture_id: TextureId,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), RenderError> {
        let texture = self.device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Sprite Texture"),
            size: wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });

        self.queue.write_texture(
            wgpu::ImageCopyTexture {
                texture: &texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            data,
            wgpu::ImageDataLayout {
                offset: 0,
                bytes_per_row: Some(width * 4),
                rows_per_image: Some(height),
            },
            wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
        );

        let texture_view = texture.create_view(&wgpu::TextureViewDescriptor::default());

        let bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Sprite Bind Group"),
            layout: &self.sprite_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: self.uniform_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(&texture_view),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(&self.linear_sampler),
                },
            ],
        });

        self.sprite_textures.insert(texture_id, texture);
        self.sprite_texture_views.insert(texture_id, texture_view);
        self.sprite_bind_groups.insert(texture_id, bind_group);

        log::info!(
            "Uploaded sprite texture {} ({}x{})",
            texture_id,
            width,
            height
        );
        Ok(())
    }

    fn remove_sprite_texture(&mut self, texture_id: TextureId) {
        self.sprite_textures.remove(&texture_id);
        self.sprite_texture_views.remove(&texture_id);
        self.sprite_bind_groups.remove(&texture_id);
    }
}

impl WebGPUContext {
    /// Execute a single draw command within the render pass
    fn execute_command<'a>(&'a self, pass: &mut wgpu::RenderPass<'a>, command: &DrawCommand) {
        match command {
            DrawCommand::Clear { r, g, b, a } => {
                // Clear is handled at the start of the render pass via LoadOp
                // For mid-frame clears, we'd need a separate pass or draw a fullscreen quad
                // For now, we set this as the first command's color if it's a clear
                // This is a limitation - in practice, clear is always first
                pass.set_blend_constant(wgpu::Color {
                    r: *r as f64,
                    g: *g as f64,
                    b: *b as f64,
                    a: *a as f64,
                });
                // Note: Actual clear happens via LoadOp::Clear - we need to handle this better
                // For now, draw a fullscreen quad
                self.execute_clear(pass, *r, *g, *b, *a);
            }

            DrawCommand::SetViewport { x, y, width, height } => {
                pass.set_viewport(
                    *x as f32,
                    *y as f32,
                    *width as f32,
                    *height as f32,
                    0.0,
                    1.0,
                );
            }

            DrawCommand::ResetViewport => {
                pass.set_viewport(0.0, 0.0, self.width as f32, self.height as f32, 0.0, 1.0);
            }

            DrawCommand::SetScissor { x, y, width, height } => {
                pass.set_scissor_rect(*x as u32, *y as u32, *width as u32, *height as u32);
            }

            DrawCommand::DisableScissor => {
                pass.set_scissor_rect(0, 0, self.width, self.height);
            }

            DrawCommand::Triangles { vertices, matrix } => {
                self.execute_draw_triangles(pass, vertices, matrix);
            }

            DrawCommand::Lines { vertices, matrix } => {
                self.execute_draw_lines(pass, vertices, matrix);
            }

            DrawCommand::Text {
                vertices,
                indices,
                texture_uid,
                matrix,
                viewport_scale,
                font_scale,
                distance_range,
            } => {
                self.execute_draw_text(
                    pass,
                    vertices,
                    indices,
                    *texture_uid,
                    matrix,
                    *viewport_scale,
                    *font_scale,
                    *distance_range,
                );
            }

            DrawCommand::Sprites {
                texture_id,
                vertices,
                indices,
                matrix,
            } => {
                self.execute_draw_sprites(pass, *texture_id, vertices, indices, matrix);
            }
        }
    }

    fn execute_clear<'a>(&'a self, pass: &mut wgpu::RenderPass<'a>, r: f32, g: f32, b: f32, a: f32) {
        // Draw a fullscreen quad with the clear color
        // This is a simple approach - in production, you'd use LoadOp::Clear
        let vertices: [f32; 36] = [
            // Triangle 1
            -1.0, -1.0, r, g, b, a,
            1.0, -1.0, r, g, b, a,
            -1.0, 1.0, r, g, b, a,
            // Triangle 2
            1.0, -1.0, r, g, b, a,
            1.0, 1.0, r, g, b, a,
            -1.0, 1.0, r, g, b, a,
        ];

        // Identity matrix (NDC passthrough)
        let matrix: [f32; 16] = [
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0,
        ];

        self.execute_draw_triangles(pass, &vertices, &matrix);
    }

    fn execute_draw_triangles<'a>(
        &'a self,
        pass: &mut wgpu::RenderPass<'a>,
        vertices: &[f32],
        matrix: &[f32; 16],
    ) {
        if vertices.is_empty() {
            return;
        }

        let vertex_bytes: &[u8] = bytemuck::cast_slice(vertices);
        let vertex_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Temp Vertex Buffer"),
                contents: vertex_bytes,
                usage: wgpu::BufferUsages::VERTEX,
            });

        let uniform_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Temp Uniform Buffer"),
                contents: bytemuck::cast_slice(matrix),
                usage: wgpu::BufferUsages::UNIFORM,
            });

        let bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Temp Bind Group"),
            layout: &self.basic_bind_group_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: uniform_buffer.as_entire_binding(),
            }],
        });

        pass.set_pipeline(&self.basic_pipeline);
        pass.set_bind_group(0, &bind_group, &[]);
        pass.set_vertex_buffer(0, vertex_buffer.slice(..));

        let vertex_count = (vertices.len() / 6) as u32;
        pass.draw(0..vertex_count, 0..1);
    }

    fn execute_draw_lines<'a>(
        &'a self,
        pass: &mut wgpu::RenderPass<'a>,
        vertices: &[f32],
        matrix: &[f32; 16],
    ) {
        if vertices.is_empty() {
            return;
        }

        let vertex_bytes: &[u8] = bytemuck::cast_slice(vertices);
        let vertex_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Line Vertex Buffer"),
                contents: vertex_bytes,
                usage: wgpu::BufferUsages::VERTEX,
            });

        let uniform_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Line Uniform Buffer"),
                contents: bytemuck::cast_slice(matrix),
                usage: wgpu::BufferUsages::UNIFORM,
            });

        let bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Line Bind Group"),
            layout: &self.basic_bind_group_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: uniform_buffer.as_entire_binding(),
            }],
        });

        pass.set_pipeline(&self.line_pipeline);
        pass.set_bind_group(0, &bind_group, &[]);
        pass.set_vertex_buffer(0, vertex_buffer.slice(..));

        let vertex_count = (vertices.len() / 6) as u32;
        pass.draw(0..vertex_count, 0..1);
    }

    fn execute_draw_text<'a>(
        &'a self,
        pass: &mut wgpu::RenderPass<'a>,
        vertices: &[f32],
        indices: &[u32],
        texture_uid: u32,
        matrix: &[f32; 16],
        viewport_scale: f32,
        font_scale: f32,
        distance_range: f32,
    ) {
        if !self.font_bind_groups.contains_key(&texture_uid) {
            log::warn!("Font texture {} not found", texture_uid);
            return;
        }

        let vertex_bytes: &[u8] = bytemuck::cast_slice(vertices);
        let vertex_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Text Vertex Buffer"),
                contents: vertex_bytes,
                usage: wgpu::BufferUsages::VERTEX,
            });

        let index_bytes: &[u8] = bytemuck::cast_slice(indices);
        let index_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Text Index Buffer"),
                contents: index_bytes,
                usage: wgpu::BufferUsages::INDEX,
            });

        let fwidth = distance_range * font_scale * viewport_scale;
        let mut uniform_data = [0f32; 24];
        uniform_data[..16].copy_from_slice(matrix);
        uniform_data[16] = fwidth;

        let uniform_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Text Uniform Buffer"),
                contents: bytemuck::cast_slice(&uniform_data),
                usage: wgpu::BufferUsages::UNIFORM,
            });

        let font_texture_view = self.font_texture_views.get(&texture_uid).unwrap();
        let bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Text Bind Group"),
            layout: &self.text_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: uniform_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(font_texture_view),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(&self.linear_sampler),
                },
            ],
        });

        pass.set_pipeline(&self.text_pipeline);
        pass.set_bind_group(0, &bind_group, &[]);
        pass.set_vertex_buffer(0, vertex_buffer.slice(..));
        pass.set_index_buffer(index_buffer.slice(..), wgpu::IndexFormat::Uint32);
        pass.draw_indexed(0..indices.len() as u32, 0, 0..1);
    }

    fn execute_draw_sprites<'a>(
        &'a self,
        pass: &mut wgpu::RenderPass<'a>,
        texture_id: TextureId,
        vertices: &[f32],
        indices: &[u32],
        matrix: &[f32; 16],
    ) {
        if !self.sprite_bind_groups.contains_key(&texture_id) {
            log::warn!("Sprite texture {} not found", texture_id);
            return;
        }

        let vertex_bytes: &[u8] = bytemuck::cast_slice(vertices);
        let vertex_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Sprite Vertex Buffer"),
                contents: vertex_bytes,
                usage: wgpu::BufferUsages::VERTEX,
            });

        let index_bytes: &[u8] = bytemuck::cast_slice(indices);
        let index_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Sprite Index Buffer"),
                contents: index_bytes,
                usage: wgpu::BufferUsages::INDEX,
            });

        let uniform_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Sprite Uniform Buffer"),
                contents: bytemuck::cast_slice(matrix),
                usage: wgpu::BufferUsages::UNIFORM,
            });

        let sprite_texture_view = self.sprite_texture_views.get(&texture_id).unwrap();
        let bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Sprite Bind Group"),
            layout: &self.sprite_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: uniform_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(sprite_texture_view),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(&self.linear_sampler),
                },
            ],
        });

        pass.set_pipeline(&self.sprite_pipeline);
        pass.set_bind_group(0, &bind_group, &[]);
        pass.set_vertex_buffer(0, vertex_buffer.slice(..));
        pass.set_index_buffer(index_buffer.slice(..), wgpu::IndexFormat::Uint32);
        pass.draw_indexed(0..indices.len() as u32, 0, 0..1);
    }
}
