//! Label mesh - builds vertex buffers for text rendering
//!
//! Equivalent to LabelMesh/LabelMeshEntry from TypeScript.

/// Vertex data for text rendering
/// Layout: [x, y, u, v, r, g, b, a] per vertex (8 floats)
#[derive(Debug, Clone, Copy)]
pub struct TextVertex {
    pub x: f32,
    pub y: f32,
    pub u: f32,
    pub v: f32,
    pub r: f32,
    pub g: f32,
    pub b: f32,
    pub a: f32,
}

impl TextVertex {
    pub fn new(x: f32, y: f32, u: f32, v: f32, color: [f32; 4]) -> Self {
        Self {
            x,
            y,
            u,
            v,
            r: color[0],
            g: color[1],
            b: color[2],
            a: color[3],
        }
    }

    /// Convert to array for buffer upload
    pub fn to_array(&self) -> [f32; 8] {
        [
            self.x, self.y, self.u, self.v, self.r, self.g, self.b, self.a,
        ]
    }
}

/// A mesh of text glyphs for a specific font/texture combination
#[derive(Debug, Clone)]
pub struct LabelMesh {
    /// Font name
    pub font_name: String,

    /// Font size
    pub font_size: f32,

    /// Texture UID
    pub texture_uid: u32,

    /// Vertices (4 per glyph)
    pub vertices: Vec<TextVertex>,

    /// Indices (6 per glyph - two triangles)
    pub indices: Vec<u32>,
}

impl LabelMesh {
    /// Create a new label mesh
    pub fn new(font_name: String, font_size: f32, texture_uid: u32) -> Self {
        Self {
            font_name,
            font_size,
            texture_uid,
            vertices: Vec::new(),
            indices: Vec::new(),
        }
    }

    /// Add a glyph quad to the mesh
    pub fn add_glyph(
        &mut self,
        x: f32,
        y: f32,
        width: f32,
        height: f32,
        uvs: &[f32; 8],
        color: [f32; 4],
    ) {
        let base_index = self.vertices.len() as u32;

        // Add 4 vertices (top-left, top-right, bottom-right, bottom-left)
        self.vertices
            .push(TextVertex::new(x, y, uvs[0], uvs[1], color));
        self.vertices
            .push(TextVertex::new(x + width, y, uvs[2], uvs[3], color));
        self.vertices.push(TextVertex::new(
            x + width,
            y + height,
            uvs[4],
            uvs[5],
            color,
        ));
        self.vertices
            .push(TextVertex::new(x, y + height, uvs[6], uvs[7], color));

        // Add 6 indices (two triangles)
        self.indices.push(base_index);
        self.indices.push(base_index + 1);
        self.indices.push(base_index + 2);
        self.indices.push(base_index);
        self.indices.push(base_index + 2);
        self.indices.push(base_index + 3);
    }

    /// Get vertex data as a flat array for GPU upload
    pub fn get_vertex_data(&self) -> Vec<f32> {
        let mut data = Vec::with_capacity(self.vertices.len() * 8);
        for vertex in &self.vertices {
            data.extend_from_slice(&vertex.to_array());
        }
        data
    }

    /// Get index data
    pub fn get_index_data(&self) -> &[u32] {
        &self.indices
    }

    /// Check if the mesh is empty
    pub fn is_empty(&self) -> bool {
        self.vertices.is_empty()
    }

    /// Clear the mesh for reuse
    pub fn clear(&mut self) {
        self.vertices.clear();
        self.indices.clear();
    }

    /// Get number of glyphs
    pub fn glyph_count(&self) -> usize {
        self.vertices.len() / 4
    }
}

impl Default for LabelMesh {
    fn default() -> Self {
        Self::new(String::new(), 14.0, 0)
    }
}

impl LabelMesh {
    /// Convert to TextBuffer for serialization/transfer
    pub fn to_text_buffer(&self) -> crate::types::TextBuffer {
        crate::types::TextBuffer {
            texture_uid: self.texture_uid,
            font_size: self.font_size,
            vertices: self.get_vertex_data(),
            indices: self.indices.clone(),
        }
    }
}
