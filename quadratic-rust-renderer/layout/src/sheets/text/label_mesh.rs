//! Label mesh - vertex and index buffers for text rendering

use quadratic_renderer_core::TextBuffer;

/// Mesh data for a text label, grouped by texture
#[derive(Debug, Clone, Default)]
pub struct LabelMesh {
    pub texture_uid: u32,
    pub font_size: f32,
    vertices: Vec<f32>,  // x, y, u, v, r, g, b, a per vertex
    indices: Vec<u16>,
    vertex_count: u16,
}

impl LabelMesh {
    pub fn new(texture_uid: u32, font_size: f32) -> Self {
        Self {
            texture_uid,
            font_size,
            vertices: Vec::new(),
            indices: Vec::new(),
            vertex_count: 0,
        }
    }

    pub fn is_empty(&self) -> bool {
        self.vertices.is_empty()
    }

    /// Add a glyph quad
    pub fn add_quad(
        &mut self,
        x: f32,
        y: f32,
        width: f32,
        height: f32,
        u0: f32,
        v0: f32,
        u1: f32,
        v1: f32,
        color: [f32; 4],
    ) {
        let [r, g, b, a] = color;
        let base = self.vertex_count;

        // Four vertices: top-left, top-right, bottom-right, bottom-left
        // Each vertex: x, y, u, v, r, g, b, a
        self.vertices.extend_from_slice(&[
            x,
            y,
            u0,
            v0,
            r,
            g,
            b,
            a, // top-left
            x + width,
            y,
            u1,
            v0,
            r,
            g,
            b,
            a, // top-right
            x + width,
            y + height,
            u1,
            v1,
            r,
            g,
            b,
            a, // bottom-right
            x,
            y + height,
            u0,
            v1,
            r,
            g,
            b,
            a, // bottom-left
        ]);

        // Two triangles: 0-1-2, 0-2-3
        self.indices.extend_from_slice(&[
            base,
            base + 1,
            base + 2,
            base,
            base + 2,
            base + 3,
        ]);

        self.vertex_count += 4;
    }

    /// Get vertex data
    pub fn get_vertex_data(&self) -> &[f32] {
        &self.vertices
    }

    /// Get index data
    pub fn get_index_data(&self) -> &[u16] {
        &self.indices
    }

    /// Convert to TextBuffer for transfer
    pub fn to_text_buffer(&self) -> TextBuffer {
        TextBuffer {
            texture_uid: self.texture_uid,
            font_size: self.font_size,
            vertices: self.vertices.clone(),
            indices: self.indices.iter().map(|&i| i as u32).collect(),
        }
    }
}

/// Collection of meshes grouped by texture
#[derive(Debug, Default)]
pub struct LabelMeshes {
    meshes: Vec<LabelMesh>,
}

impl LabelMeshes {
    pub fn new() -> Self {
        Self::default()
    }

    /// Get or create a mesh for the given texture
    pub fn get_or_create(&mut self, texture_uid: u32, font_size: f32) -> &mut LabelMesh {
        let pos = self
            .meshes
            .iter()
            .position(|m| m.texture_uid == texture_uid && (m.font_size - font_size).abs() < 0.01);

        if let Some(idx) = pos {
            &mut self.meshes[idx]
        } else {
            self.meshes.push(LabelMesh::new(texture_uid, font_size));
            self.meshes.last_mut().unwrap()
        }
    }

    /// Get all non-empty meshes as TextBuffers
    pub fn to_text_buffers(&self) -> Vec<TextBuffer> {
        self.meshes
            .iter()
            .filter(|m| !m.is_empty())
            .map(|m| m.to_text_buffer())
            .collect()
    }

    /// Clear all meshes
    pub fn clear(&mut self) {
        self.meshes.clear();
    }
}
