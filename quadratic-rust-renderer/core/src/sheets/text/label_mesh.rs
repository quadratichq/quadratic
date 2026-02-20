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

#[cfg(test)]
mod tests {
    use super::*;

    const WHITE: [f32; 4] = [1.0, 1.0, 1.0, 1.0];
    const RED: [f32; 4] = [1.0, 0.0, 0.0, 1.0];
    const BLUE: [f32; 4] = [0.0, 0.0, 1.0, 1.0];

    // =========================================================================
    // TextVertex tests
    // =========================================================================

    #[test]
    fn test_text_vertex_new() {
        let vertex = TextVertex::new(10.0, 20.0, 0.1, 0.2, RED);
        assert_eq!(vertex.x, 10.0);
        assert_eq!(vertex.y, 20.0);
        assert_eq!(vertex.u, 0.1);
        assert_eq!(vertex.v, 0.2);
        assert_eq!(vertex.r, 1.0);
        assert_eq!(vertex.g, 0.0);
        assert_eq!(vertex.b, 0.0);
        assert_eq!(vertex.a, 1.0);
    }

    #[test]
    fn test_text_vertex_to_array() {
        let vertex = TextVertex::new(10.0, 20.0, 0.1, 0.2, [0.5, 0.6, 0.7, 0.8]);
        let array = vertex.to_array();
        assert_eq!(array, [10.0, 20.0, 0.1, 0.2, 0.5, 0.6, 0.7, 0.8]);
    }

    #[test]
    fn test_text_vertex_clone() {
        let vertex = TextVertex::new(10.0, 20.0, 0.1, 0.2, BLUE);
        let cloned = vertex;
        assert_eq!(cloned.x, 10.0);
        assert_eq!(cloned.r, 0.0);
        assert_eq!(cloned.b, 1.0);
    }

    // =========================================================================
    // LabelMesh tests
    // =========================================================================

    #[test]
    fn test_label_mesh_new() {
        let mesh = LabelMesh::new("Arial".to_string(), 16.0, 42);
        assert_eq!(mesh.font_name, "Arial");
        assert_eq!(mesh.font_size, 16.0);
        assert_eq!(mesh.texture_uid, 42);
        assert!(mesh.is_empty());
        assert_eq!(mesh.glyph_count(), 0);
    }

    #[test]
    fn test_label_mesh_default() {
        let mesh = LabelMesh::default();
        assert_eq!(mesh.font_name, "");
        assert_eq!(mesh.font_size, 14.0);
        assert_eq!(mesh.texture_uid, 0);
        assert!(mesh.is_empty());
    }

    #[test]
    fn test_label_mesh_add_glyph() {
        let mut mesh = LabelMesh::new("Arial".to_string(), 16.0, 1);
        let uvs = [0.0, 0.0, 0.1, 0.0, 0.1, 0.1, 0.0, 0.1];
        mesh.add_glyph(10.0, 20.0, 50.0, 60.0, &uvs, WHITE);

        assert!(!mesh.is_empty());
        assert_eq!(mesh.glyph_count(), 1);
        assert_eq!(mesh.vertices.len(), 4);
        assert_eq!(mesh.indices.len(), 6);

        // Check first vertex (top-left)
        let v0 = &mesh.vertices[0];
        assert_eq!(v0.x, 10.0);
        assert_eq!(v0.y, 20.0);
        assert_eq!(v0.u, 0.0);
        assert_eq!(v0.v, 0.0);

        // Check second vertex (top-right)
        let v1 = &mesh.vertices[1];
        assert_eq!(v1.x, 60.0); // 10.0 + 50.0
        assert_eq!(v1.y, 20.0);
        assert_eq!(v1.u, 0.1);
        assert_eq!(v1.v, 0.0);

        // Check third vertex (bottom-right)
        let v2 = &mesh.vertices[2];
        assert_eq!(v2.x, 60.0);
        assert_eq!(v2.y, 80.0); // 20.0 + 60.0
        assert_eq!(v2.u, 0.1);
        assert_eq!(v2.v, 0.1);

        // Check fourth vertex (bottom-left)
        let v3 = &mesh.vertices[3];
        assert_eq!(v3.x, 10.0);
        assert_eq!(v3.y, 80.0);
        assert_eq!(v3.u, 0.0);
        assert_eq!(v3.v, 0.1);

        // Check indices (two triangles)
        assert_eq!(mesh.indices, [0, 1, 2, 0, 2, 3]);
    }

    #[test]
    fn test_label_mesh_add_multiple_glyphs() {
        let mut mesh = LabelMesh::new("Arial".to_string(), 16.0, 1);
        let uvs = [0.0, 0.0, 0.1, 0.0, 0.1, 0.1, 0.0, 0.1];

        mesh.add_glyph(0.0, 0.0, 50.0, 60.0, &uvs, WHITE);
        mesh.add_glyph(50.0, 0.0, 50.0, 60.0, &uvs, RED);
        mesh.add_glyph(100.0, 0.0, 50.0, 60.0, &uvs, BLUE);

        assert_eq!(mesh.glyph_count(), 3);
        assert_eq!(mesh.vertices.len(), 12); // 3 glyphs * 4 vertices
        assert_eq!(mesh.indices.len(), 18); // 3 glyphs * 6 indices

        // Check that indices are correctly offset
        assert_eq!(mesh.indices[0..6], [0, 1, 2, 0, 2, 3]); // First glyph
        assert_eq!(mesh.indices[6..12], [4, 5, 6, 4, 6, 7]); // Second glyph
        assert_eq!(mesh.indices[12..18], [8, 9, 10, 8, 10, 11]); // Third glyph
    }

    #[test]
    fn test_label_mesh_get_vertex_data() {
        let mut mesh = LabelMesh::new("Arial".to_string(), 16.0, 1);
        let uvs = [0.0, 0.0, 0.1, 0.0, 0.1, 0.1, 0.0, 0.1];
        mesh.add_glyph(10.0, 20.0, 50.0, 60.0, &uvs, [0.5, 0.6, 0.7, 0.8]);

        let vertex_data = mesh.get_vertex_data();
        assert_eq!(vertex_data.len(), 32); // 4 vertices * 8 floats

        // Check first vertex data
        assert_eq!(vertex_data[0], 10.0); // x
        assert_eq!(vertex_data[1], 20.0); // y
        assert_eq!(vertex_data[2], 0.0); // u
        assert_eq!(vertex_data[3], 0.0); // v
        assert_eq!(vertex_data[4], 0.5); // r
        assert_eq!(vertex_data[5], 0.6); // g
        assert_eq!(vertex_data[6], 0.7); // b
        assert_eq!(vertex_data[7], 0.8); // a
    }

    #[test]
    fn test_label_mesh_get_index_data() {
        let mut mesh = LabelMesh::new("Arial".to_string(), 16.0, 1);
        let uvs = [0.0, 0.0, 0.1, 0.0, 0.1, 0.1, 0.0, 0.1];
        mesh.add_glyph(10.0, 20.0, 50.0, 60.0, &uvs, WHITE);

        let index_data = mesh.get_index_data();
        assert_eq!(index_data.len(), 6);
        assert_eq!(index_data, &[0, 1, 2, 0, 2, 3]);
    }

    #[test]
    fn test_label_mesh_is_empty() {
        let mesh = LabelMesh::new("Arial".to_string(), 16.0, 1);
        assert!(mesh.is_empty());

        let mut mesh_with_glyph = LabelMesh::new("Arial".to_string(), 16.0, 1);
        let uvs = [0.0, 0.0, 0.1, 0.0, 0.1, 0.1, 0.0, 0.1];
        mesh_with_glyph.add_glyph(10.0, 20.0, 50.0, 60.0, &uvs, WHITE);
        assert!(!mesh_with_glyph.is_empty());
    }

    #[test]
    fn test_label_mesh_clear() {
        let mut mesh = LabelMesh::new("Arial".to_string(), 16.0, 1);
        let uvs = [0.0, 0.0, 0.1, 0.0, 0.1, 0.1, 0.0, 0.1];
        mesh.add_glyph(10.0, 20.0, 50.0, 60.0, &uvs, WHITE);
        assert!(!mesh.is_empty());

        mesh.clear();
        assert!(mesh.is_empty());
        assert_eq!(mesh.glyph_count(), 0);
        assert_eq!(mesh.vertices.len(), 0);
        assert_eq!(mesh.indices.len(), 0);
    }

    #[test]
    fn test_label_mesh_glyph_count() {
        let mut mesh = LabelMesh::new("Arial".to_string(), 16.0, 1);
        assert_eq!(mesh.glyph_count(), 0);

        let uvs = [0.0, 0.0, 0.1, 0.0, 0.1, 0.1, 0.0, 0.1];
        mesh.add_glyph(10.0, 20.0, 50.0, 60.0, &uvs, WHITE);
        assert_eq!(mesh.glyph_count(), 1);

        mesh.add_glyph(60.0, 20.0, 50.0, 60.0, &uvs, RED);
        assert_eq!(mesh.glyph_count(), 2);

        mesh.add_glyph(110.0, 20.0, 50.0, 60.0, &uvs, BLUE);
        assert_eq!(mesh.glyph_count(), 3);
    }

    #[test]
    fn test_label_mesh_to_text_buffer() {
        let mut mesh = LabelMesh::new("Arial".to_string(), 16.0, 42);
        let uvs = [0.0, 0.0, 0.1, 0.0, 0.1, 0.1, 0.0, 0.1];
        mesh.add_glyph(10.0, 20.0, 50.0, 60.0, &uvs, WHITE);

        let buffer = mesh.to_text_buffer();
        assert_eq!(buffer.texture_uid, 42);
        assert_eq!(buffer.font_size, 16.0);
        assert_eq!(buffer.vertices.len(), 32); // 4 vertices * 8 floats
        assert_eq!(buffer.indices.len(), 6);
        assert_eq!(buffer.indices, [0, 1, 2, 0, 2, 3]);
    }

    #[test]
    fn test_label_mesh_to_text_buffer_empty() {
        let mesh = LabelMesh::new("Arial".to_string(), 16.0, 42);
        let buffer = mesh.to_text_buffer();
        assert_eq!(buffer.texture_uid, 42);
        assert_eq!(buffer.font_size, 16.0);
        assert!(buffer.vertices.is_empty());
        assert!(buffer.indices.is_empty());
    }

    #[test]
    fn test_label_mesh_glyph_vertex_colors() {
        let mut mesh = LabelMesh::new("Arial".to_string(), 16.0, 1);
        let uvs = [0.0, 0.0, 0.1, 0.0, 0.1, 0.1, 0.0, 0.1];
        mesh.add_glyph(10.0, 20.0, 50.0, 60.0, &uvs, [0.25, 0.5, 0.75, 1.0]);

        // All vertices should have the same color
        for vertex in &mesh.vertices {
            assert_eq!(vertex.r, 0.25);
            assert_eq!(vertex.g, 0.5);
            assert_eq!(vertex.b, 0.75);
            assert_eq!(vertex.a, 1.0);
        }
    }
}
