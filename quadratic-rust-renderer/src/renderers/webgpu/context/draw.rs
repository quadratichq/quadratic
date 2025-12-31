use wgpu::util::DeviceExt;

use super::WebGPUContext;

impl WebGPUContext {
    /// Ensure vertex buffer is large enough
    fn ensure_vertex_buffer(&mut self, size: u64) {
        if size > self.vertex_buffer_size {
            let new_size = (size * 2).max(1024 * 1024);
            self.vertex_buffer = self.device.create_buffer(&wgpu::BufferDescriptor {
                label: Some("Vertex Buffer"),
                size: new_size,
                usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            });
            self.vertex_buffer_size = new_size;
        }
    }

    /// Ensure index buffer is large enough
    fn ensure_index_buffer(&mut self, size: u64) {
        if size > self.index_buffer_size {
            let new_size = (size * 2).max(256 * 1024);
            self.index_buffer = self.device.create_buffer(&wgpu::BufferDescriptor {
                label: Some("Index Buffer"),
                size: new_size,
                usage: wgpu::BufferUsages::INDEX | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            });
            self.index_buffer_size = new_size;
        }
    }

    /// Create a basic bind group
    #[allow(dead_code)]
    fn create_basic_bind_group(&self) -> wgpu::BindGroup {
        self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Basic Bind Group"),
            layout: &self.basic_bind_group_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: self.uniform_buffer.as_entire_binding(),
            }],
        })
    }

    /// Get the basic pipeline
    pub fn basic_pipeline(&self) -> &wgpu::RenderPipeline {
        &self.basic_pipeline
    }

    /// Get the vertex buffer
    pub fn vertex_buffer(&self) -> &wgpu::Buffer {
        &self.vertex_buffer
    }

    /// Draw triangles using cached bind group (WebGPU optimization)
    ///
    /// Unlike WebGL which requires setting uniforms each draw call,
    /// WebGPU uses a cached bind group, reducing per-frame overhead.
    pub fn draw_triangles(
        &mut self,
        pass: &mut wgpu::RenderPass<'_>,
        vertices: &[f32],
        matrix: &[f32; 16],
    ) {
        if vertices.is_empty() {
            return;
        }

        // Create a temporary vertex buffer for this draw call
        // This is necessary because queue.write_buffer writes immediately,
        // but the GPU executes draws later. Multiple draws would see the last write.
        let vertex_bytes: &[u8] = bytemuck::cast_slice(vertices);
        let vertex_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Temp Vertex Buffer"),
                contents: vertex_bytes,
                usage: wgpu::BufferUsages::VERTEX,
            });

        // Create a temporary uniform buffer with the matrix
        let uniform_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Temp Uniform Buffer"),
                contents: bytemuck::cast_slice(matrix),
                usage: wgpu::BufferUsages::UNIFORM,
            });

        // Create a bind group for this draw
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

    /// Draw lines using native GPU line rasterization
    ///
    /// Each line is defined by 2 vertices, each with 6 floats: [x, y, r, g, b, a]
    /// So each line is 12 floats total.
    ///
    /// This uses WebGPU's native LineList topology which renders 1-pixel-wide lines
    /// consistently, matching WebGL's GL_LINES behavior.
    pub fn draw_lines(
        &mut self,
        pass: &mut wgpu::RenderPass<'_>,
        vertices: &[f32],
        matrix: &[f32; 16],
    ) {
        if vertices.is_empty() {
            return;
        }

        // Create a temporary vertex buffer for this draw call
        let vertex_bytes: &[u8] = bytemuck::cast_slice(vertices);
        let vertex_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Line Vertex Buffer"),
                contents: vertex_bytes,
                usage: wgpu::BufferUsages::VERTEX,
            });

        // Create a temporary uniform buffer with the matrix
        let uniform_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Line Uniform Buffer"),
                contents: bytemuck::cast_slice(matrix),
                usage: wgpu::BufferUsages::UNIFORM,
            });

        // Create a bind group for this draw
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

        // Each vertex is 6 floats
        let vertex_count = (vertices.len() / 6) as u32;
        pass.draw(0..vertex_count, 0..1);
    }

    /// Draw lines as thin triangles (fallback for thick lines)
    ///
    /// Input vertices are in format: [x1, y1, r1, g1, b1, a1, x2, y2, r2, g2, b2, a2] per line (12 floats)
    /// This matches the WebGL Lines primitive format.
    /// Each line is converted to a thin rectangle (2 triangles = 6 vertices)
    pub fn draw_lines_as_triangles(
        &mut self,
        pass: &mut wgpu::RenderPass<'_>,
        line_vertices: &[f32],
        matrix: &[f32; 16],
        line_width: f32,
    ) {
        if line_vertices.is_empty() {
            return;
        }

        // Each line has 12 floats: x1, y1, r1, g1, b1, a1, x2, y2, r2, g2, b2, a2
        let line_count = line_vertices.len() / 12;

        // Each line becomes 6 triangle vertices (2 triangles), each with 6 floats
        let mut triangle_vertices = Vec::with_capacity(line_count * 36);

        let half_width = line_width / 2.0;

        for i in 0..line_count {
            let base = i * 12;
            let x1 = line_vertices[base];
            let y1 = line_vertices[base + 1];
            let r1 = line_vertices[base + 2];
            let g1 = line_vertices[base + 3];
            let b1 = line_vertices[base + 4];
            let a1 = line_vertices[base + 5];
            let x2 = line_vertices[base + 6];
            let y2 = line_vertices[base + 7];
            let r2 = line_vertices[base + 8];
            let g2 = line_vertices[base + 9];
            let b2 = line_vertices[base + 10];
            let a2 = line_vertices[base + 11];

            let dx = x2 - x1;
            let dy = y2 - y1;

            // For axis-aligned lines, use exact perpendicular offsets to avoid
            // floating point precision issues that cause fuzzy/diagonal lines
            let (px, py) = if dy.abs() < 0.0001 {
                // Horizontal line: offset in Y direction only
                (0.0, half_width)
            } else if dx.abs() < 0.0001 {
                // Vertical line: offset in X direction only
                (half_width, 0.0)
            } else {
                // Diagonal line: calculate perpendicular offset
                let len = (dx * dx + dy * dy).sqrt();
                if len < 0.0001 {
                    continue; // Skip degenerate lines
                }
                (-dy / len * half_width, dx / len * half_width)
            };

            // Four corners of the line rectangle
            // v1, v2 use color from point 1; v3, v4 use color from point 2
            let v1 = [x1 + px, y1 + py, r1, g1, b1, a1];
            let v2 = [x1 - px, y1 - py, r1, g1, b1, a1];
            let v3 = [x2 + px, y2 + py, r2, g2, b2, a2];
            let v4 = [x2 - px, y2 - py, r2, g2, b2, a2];

            // Triangle 1: v1, v2, v3
            triangle_vertices.extend_from_slice(&v1);
            triangle_vertices.extend_from_slice(&v2);
            triangle_vertices.extend_from_slice(&v3);

            // Triangle 2: v2, v4, v3
            triangle_vertices.extend_from_slice(&v2);
            triangle_vertices.extend_from_slice(&v4);
            triangle_vertices.extend_from_slice(&v3);
        }

        if !triangle_vertices.is_empty() {
            self.draw_triangles(pass, &triangle_vertices, matrix);
        }
    }

    // =========================================================================
    // Render Bundles (WebGPU-specific optimization)
    // =========================================================================

    /// Create a render bundle for static geometry
    ///
    /// Render bundles are pre-recorded command sequences that can be replayed
    /// with near-zero CPU overhead. Ideal for:
    /// - Grid lines (only change on zoom)
    /// - Cached text regions
    /// - Static UI elements
    ///
    /// Returns the bundle and the vertex buffer it uses (caller must keep alive).
    pub fn create_render_bundle(
        &self,
        vertices: &[f32],
        matrix: &[f32; 16],
    ) -> Option<(wgpu::RenderBundle, wgpu::Buffer, wgpu::Buffer)> {
        if vertices.is_empty() {
            return None;
        }

        // Create dedicated buffers for this bundle (must outlive the bundle)
        let vertex_buffer = self.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Bundle Vertex Buffer"),
            size: (vertices.len() * 4) as u64,
            usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let uniform_buffer = self.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Bundle Uniform Buffer"),
            size: 64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        // Upload data
        self.queue
            .write_buffer(&vertex_buffer, 0, bytemuck::cast_slice(vertices));
        self.queue
            .write_buffer(&uniform_buffer, 0, bytemuck::cast_slice(matrix));

        // Create bind group for this bundle
        let bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Bundle Bind Group"),
            layout: &self.basic_bind_group_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: uniform_buffer.as_entire_binding(),
            }],
        });

        // Record the bundle
        let mut encoder =
            self.device
                .create_render_bundle_encoder(&wgpu::RenderBundleEncoderDescriptor {
                    label: Some("Static Geometry Bundle"),
                    color_formats: &[Some(self.surface_format)],
                    depth_stencil: None,
                    sample_count: 1,
                    multiview: None,
                });

        encoder.set_pipeline(&self.basic_pipeline);
        encoder.set_bind_group(0, &bind_group, &[]);
        encoder.set_vertex_buffer(0, vertex_buffer.slice(..));

        let vertex_count = (vertices.len() / 6) as u32;
        encoder.draw(0..vertex_count, 0..1);

        let bundle = encoder.finish(&wgpu::RenderBundleDescriptor {
            label: Some("Static Geometry Bundle"),
        });

        Some((bundle, vertex_buffer, uniform_buffer))
    }

    /// Execute a pre-recorded render bundle
    ///
    /// This is extremely fast compared to re-recording commands each frame.
    /// The bundle must have been created with compatible surface format.
    pub fn execute_bundle(&self, pass: &mut wgpu::RenderPass<'_>, bundle: &wgpu::RenderBundle) {
        pass.execute_bundles(std::iter::once(bundle));
    }

    /// Get the surface format (needed for render bundle creation)
    pub fn surface_format(&self) -> wgpu::TextureFormat {
        self.surface_format
    }

    /// Draw text with MSDF shader
    pub fn draw_text(
        &mut self,
        pass: &mut wgpu::RenderPass<'_>,
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

        // Check if font texture exists
        let font_texture_view = match self.font_texture_manager.get_view(texture_uid) {
            Some(v) => v,
            None => {
                log::warn!("Font texture {} not found", texture_uid);
                return;
            }
        };

        // Create temporary buffers for this draw call
        // This prevents buffer overwrites when multiple draw calls happen per frame
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

        // Calculate fwidth for MSDF anti-aliasing
        // Uniform struct in shader: mat4x4 (64 bytes) + vec4 (16 bytes for fwidth + padding)
        let fwidth = distance_range * font_scale * viewport_scale;
        let mut uniform_data = [0f32; 24]; // 96 bytes = 24 floats
        uniform_data[..16].copy_from_slice(matrix);
        uniform_data[16] = fwidth;
        // uniform_data[17..24] are padding (zeros)

        let uniform_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Text Uniform Buffer"),
                contents: bytemuck::cast_slice(&uniform_data),
                usage: wgpu::BufferUsages::UNIFORM,
            });

        // Create a new bind group with the temporary uniform buffer and the font texture
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

        // Draw
        pass.set_pipeline(&self.text_pipeline);
        pass.set_bind_group(0, &bind_group, &[]);
        pass.set_vertex_buffer(0, vertex_buffer.slice(..));
        pass.set_index_buffer(index_buffer.slice(..), wgpu::IndexFormat::Uint32);
        pass.draw_indexed(0..indices.len() as u32, 0, 0..1);
    }

    /// Draw sprites with indexed rendering
    pub fn draw_sprites(
        &mut self,
        pass: &mut wgpu::RenderPass<'_>,
        texture_id: u32,
        vertices: &[f32],
        indices: &[u32],
        matrix: &[f32; 16],
    ) {
        if vertices.is_empty() || indices.is_empty() {
            return;
        }

        // Check if bind group exists
        if !self.sprite_bind_groups.contains_key(&texture_id) {
            log::warn!("Sprite texture {} not found", texture_id);
            return;
        }

        // Upload matrix to uniform buffer
        self.queue
            .write_buffer(&self.uniform_buffer, 0, bytemuck::cast_slice(matrix));

        // Upload vertex data
        let vertex_bytes: &[u8] = bytemuck::cast_slice(vertices);
        let vertex_size = vertex_bytes.len() as u64;
        self.ensure_vertex_buffer(vertex_size);
        self.queue
            .write_buffer(&self.vertex_buffer, 0, vertex_bytes);

        // Upload index data
        let index_bytes: &[u8] = bytemuck::cast_slice(indices);
        let index_size = index_bytes.len() as u64;
        self.ensure_index_buffer(index_size);
        self.queue.write_buffer(&self.index_buffer, 0, index_bytes);

        // Get bind group
        let bind_group = self.sprite_bind_groups.get(&texture_id).unwrap();

        // Draw
        pass.set_pipeline(&self.sprite_pipeline);
        pass.set_bind_group(0, bind_group, &[]);
        pass.set_vertex_buffer(0, self.vertex_buffer.slice(..));
        pass.set_index_buffer(self.index_buffer.slice(..), wgpu::IndexFormat::Uint32);
        pass.draw_indexed(0..indices.len() as u32, 0, 0..1);
    }

    /// Draw a sprite using a texture view directly (for sprite cache)
    ///
    /// This creates temporary buffers for the draw call to prevent
    /// buffer overwrites when multiple sprites are drawn per frame.
    pub fn draw_sprite_texture(
        &mut self,
        pass: &mut wgpu::RenderPass<'_>,
        texture_view: &wgpu::TextureView,
        x: f32,
        y: f32,
        width: f32,
        height: f32,
        matrix: &[f32; 16],
    ) {
        // Generate quad vertices
        // Format: [x, y, u, v, r, g, b, a] per vertex
        // WebGPU texture coordinates: V=0 at top, V=1 at bottom (unlike OpenGL)
        // No flip needed - direct mapping from world space to texture space
        let x2 = x + width;
        let y2 = y + height;
        let vertices: [f32; 32] = [
            // Top-left (UV: 0, 0)
            x, y, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, // Top-right (UV: 1, 0)
            x2, y, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, // Bottom-right (UV: 1, 1)
            x2, y2, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, // Bottom-left (UV: 0, 1)
            x, y2, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0,
        ];

        // Quad indices (two triangles)
        let indices: [u32; 6] = [0, 1, 2, 0, 2, 3];

        // Create temporary buffers for this draw call to prevent overwrites
        let vertex_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Sprite Cache Vertex Buffer"),
                contents: bytemuck::cast_slice(&vertices),
                usage: wgpu::BufferUsages::VERTEX,
            });

        let index_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Sprite Cache Index Buffer"),
                contents: bytemuck::cast_slice(&indices),
                usage: wgpu::BufferUsages::INDEX,
            });

        let uniform_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Sprite Cache Uniform Buffer"),
                contents: bytemuck::cast_slice(matrix),
                usage: wgpu::BufferUsages::UNIFORM,
            });

        // Create temporary bind group for this texture
        let bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Sprite Cache Bind Group"),
            layout: &self.sprite_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: uniform_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(texture_view),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(&self.linear_sampler),
                },
            ],
        });

        // Draw using premultiplied alpha pipeline for render target textures
        // (render target textures have RGB premultiplied by alpha)
        pass.set_pipeline(&self.sprite_premult_pipeline);
        pass.set_bind_group(0, &bind_group, &[]);
        pass.set_vertex_buffer(0, vertex_buffer.slice(..));
        pass.set_index_buffer(index_buffer.slice(..), wgpu::IndexFormat::Uint32);
        pass.draw_indexed(0..6, 0, 0..1);
    }

    /// Draw emoji sprites using font texture manager
    ///
    /// Emoji textures are stored in the font texture manager (shared upload path).
    /// Vertex format: [x, y, u, v, r, g, b, a] per vertex (8 floats)
    pub fn draw_emoji_sprites(
        &mut self,
        pass: &mut wgpu::RenderPass<'_>,
        texture_uid: u32,
        vertices: &[f32],
        indices: &[u32],
        matrix: &[f32; 16],
    ) {
        if vertices.is_empty() || indices.is_empty() {
            return;
        }

        // Get font texture view (emoji textures use font manager)
        let font_texture_view = match self.font_texture_manager.get_view(texture_uid) {
            Some(v) => v,
            None => {
                log::warn!("Emoji texture {} not found in font manager", texture_uid);
                return;
            }
        };

        // Create temporary buffers for this draw call
        let vertex_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Emoji Sprite Vertex Buffer"),
                contents: bytemuck::cast_slice(vertices),
                usage: wgpu::BufferUsages::VERTEX,
            });

        let index_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Emoji Sprite Index Buffer"),
                contents: bytemuck::cast_slice(indices),
                usage: wgpu::BufferUsages::INDEX,
            });

        // Create uniform buffer with matrix
        let uniform_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Emoji Sprite Uniform Buffer"),
                contents: bytemuck::cast_slice(matrix),
                usage: wgpu::BufferUsages::UNIFORM,
            });

        // Create bind group with uniform buffer, texture view, and sampler
        let bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Emoji Sprite Bind Group"),
            layout: &self.sprite_bind_group_layout,
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

        // Draw using standard sprite pipeline (non-premultiplied alpha)
        pass.set_pipeline(&self.sprite_pipeline);
        pass.set_bind_group(0, &bind_group, &[]);
        pass.set_vertex_buffer(0, vertex_buffer.slice(..));
        pass.set_index_buffer(index_buffer.slice(..), wgpu::IndexFormat::Uint32);
        pass.draw_indexed(0..indices.len() as u32, 0, 0..1);
    }
}
