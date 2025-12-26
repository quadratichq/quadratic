use web_sys::WebGl2RenderingContext;

use crate::webgl::WebGLContext;

impl WebGLContext {
    /// Render text mesh
    /// vertices: [x, y, u, v, r, g, b, a] per vertex (8 floats)
    /// indices: triangle indices (u32 to support large meshes)
    /// Render text mesh with MSDF shader
    ///
    /// Parameters:
    /// - `vertices`: Vertex data [x, y, u, v, r, g, b, a] per vertex
    /// - `indices`: Triangle indices
    /// - `texture_uid`: Font texture ID
    /// - `matrix`: View-projection matrix
    /// - `viewport_scale`: Current zoom level
    /// - `font_scale`: render_font_size / atlas_font_size (e.g., 14/42 for OpenSans)
    /// - `distance_range`: MSDF distance field range (typically 4)
    pub fn draw_text(
        &self,
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

        let texture = match self.font_texture_manager.get(texture_uid) {
            Some(t) => t,
            None => {
                log::warn!("Font texture {} not found", texture_uid);
                return;
            }
        };

        self.gl.use_program(Some(&self.text_program));
        self.gl.bind_vertex_array(Some(&self.text_vao));

        // Bind texture
        self.gl.active_texture(WebGl2RenderingContext::TEXTURE0);
        self.gl
            .bind_texture(WebGl2RenderingContext::TEXTURE_2D, Some(texture));
        self.gl.uniform1i(Some(&self.text_texture_location), 0);

        // Set fwidth uniform (for MSDF anti-aliasing)
        // Formula: distance_range * font_scale * viewport_scale
        // For OpenSans at 14px (atlas 42px): 4 * (14/42) * scale ≈ 1.33 * scale
        let fwidth = distance_range * font_scale * viewport_scale;
        self.gl.uniform1f(Some(&self.text_fwidth_location), fwidth);

        // Upload vertex data
        self.gl.bind_buffer(
            WebGl2RenderingContext::ARRAY_BUFFER,
            Some(&self.text_vertex_buffer),
        );

        unsafe {
            let array = js_sys::Float32Array::view(vertices);
            self.gl.buffer_data_with_array_buffer_view(
                WebGl2RenderingContext::ARRAY_BUFFER,
                &array,
                WebGl2RenderingContext::DYNAMIC_DRAW,
            );
        }

        // Upload index data (u32 to support large meshes)
        self.gl.bind_buffer(
            WebGl2RenderingContext::ELEMENT_ARRAY_BUFFER,
            Some(&self.text_index_buffer),
        );

        unsafe {
            let array = js_sys::Uint32Array::view(indices);
            self.gl.buffer_data_with_array_buffer_view(
                WebGl2RenderingContext::ELEMENT_ARRAY_BUFFER,
                &array,
                WebGl2RenderingContext::DYNAMIC_DRAW,
            );
        }

        // Set matrix uniform
        self.gl
            .uniform_matrix4fv_with_f32_array(Some(&self.text_matrix_location), false, matrix);

        // Draw indexed triangles (UNSIGNED_INT for u32 indices)
        self.gl.draw_elements_with_i32(
            WebGl2RenderingContext::TRIANGLES,
            indices.len() as i32,
            WebGl2RenderingContext::UNSIGNED_INT,
            0,
        );

        self.gl.bind_vertex_array(None);
    }
}
