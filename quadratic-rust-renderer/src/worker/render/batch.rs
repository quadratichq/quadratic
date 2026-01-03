//! Batch-based rendering from pre-computed RenderBatch data
//!
//! This module renders directly from the RenderBatch sent by the Layout Worker,
//! avoiding the heavy computation of text layout in the render thread.

use quadratic_rust_renderer_shared::{HashRenderData, RenderBatch};

use crate::renderers::WebGLContext;

#[cfg(all(target_arch = "wasm32", feature = "wasm"))]
use crate::renderers::WebGPUContext;

/// Render text from pre-computed batch data (WebGL)
///
/// This renders directly from the HashRenderData buffers without calling
/// rebuild_if_dirty(). The Layout Worker has already computed all the vertices.
///
/// # Arguments
/// * `gl` - WebGL context
/// * `batch` - Pre-computed RenderBatch from Layout Worker
/// * `matrix` - View-projection matrix
/// * `effective_scale` - Effective scale (scale * dpr)
/// * `atlas_font_size` - The font size the atlas was generated at
/// * `distance_range` - MSDF distance range
pub fn render_text_from_batch(
    gl: &WebGLContext,
    batch: &RenderBatch,
    matrix: &[f32; 16],
    effective_scale: f32,
    atlas_font_size: f32,
    distance_range: f32,
) {
    for hash_data in &batch.hashes {
        render_hash_text(gl, hash_data, matrix, effective_scale, atlas_font_size, distance_range);
        render_hash_emoji_sprites(gl, hash_data, matrix);
    }
}

/// Render text for a single hash from pre-computed data
fn render_hash_text(
    gl: &WebGLContext,
    hash_data: &HashRenderData,
    matrix: &[f32; 16],
    effective_scale: f32,
    atlas_font_size: f32,
    distance_range: f32,
) {
    for text_buffer in &hash_data.text_buffers {
        if text_buffer.vertices.is_empty() || text_buffer.indices.is_empty() {
            continue;
        }

        // Check if we have this texture
        if !gl.has_font_texture(text_buffer.texture_uid) {
            continue;
        }

        let font_scale = text_buffer.font_size / atlas_font_size;

        // Render the pre-computed text buffer
        gl.draw_text(
            &text_buffer.vertices,
            &text_buffer.indices,
            text_buffer.texture_uid,
            matrix,
            effective_scale,
            font_scale,
            distance_range,
        );
    }
}

/// Render emoji sprites for a hash from pre-computed data
fn render_hash_emoji_sprites(gl: &WebGLContext, hash_data: &HashRenderData, matrix: &[f32; 16]) {
    if hash_data.emoji_sprites.is_empty() {
        return;
    }

    for (&texture_uid, sprites) in &hash_data.emoji_sprites {
        if sprites.is_empty() {
            continue;
        }

        // Check if we have this texture
        if !gl.has_emoji_texture(texture_uid) {
            continue;
        }

        // Build vertex data for all sprites
        let mut vertices: Vec<f32> = Vec::with_capacity(sprites.len() * 32);
        let mut indices: Vec<u32> = Vec::with_capacity(sprites.len() * 6);

        for (i, sprite) in sprites.iter().enumerate() {
            let half_w = sprite.width / 2.0;
            let half_h = sprite.height / 2.0;
            let x = sprite.x - half_w;
            let y = sprite.y - half_h;
            let x2 = sprite.x + half_w;
            let y2 = sprite.y + half_h;
            let u1 = sprite.uvs[0];
            let v1 = sprite.uvs[1];
            let u2 = sprite.uvs[2];
            let v2 = sprite.uvs[3];

            let base_index = (i * 4) as u32;

            // Top-left, top-right, bottom-right, bottom-left
            // Format: x, y, u, v, r, g, b, a
            vertices.extend_from_slice(&[
                x, y, u1, v1, 1.0, 1.0, 1.0, 1.0, // Top-left
                x2, y, u2, v1, 1.0, 1.0, 1.0, 1.0, // Top-right
                x2, y2, u2, v2, 1.0, 1.0, 1.0, 1.0, // Bottom-right
                x, y2, u1, v2, 1.0, 1.0, 1.0, 1.0, // Bottom-left
            ]);

            indices.extend_from_slice(&[
                base_index,
                base_index + 1,
                base_index + 2,
                base_index,
                base_index + 2,
                base_index + 3,
            ]);
        }

        gl.draw_emoji_sprites(texture_uid, &vertices, &indices, matrix);
    }
}

// =========================================================================
// WebGPU Batch Rendering
// =========================================================================

/// Render text from pre-computed batch data (WebGPU)
///
/// This renders directly from the HashRenderData buffers without calling
/// rebuild_if_dirty(). The Layout Worker has already computed all the vertices.
#[cfg(all(target_arch = "wasm32", feature = "wasm"))]
pub fn render_text_from_batch_webgpu(
    gpu: &mut WebGPUContext,
    pass: &mut wgpu::RenderPass<'_>,
    batch: &RenderBatch,
    matrix: &[f32; 16],
    effective_scale: f32,
    atlas_font_size: f32,
    distance_range: f32,
) {
    for hash_data in &batch.hashes {
        render_hash_text_webgpu(
            gpu,
            pass,
            hash_data,
            matrix,
            effective_scale,
            atlas_font_size,
            distance_range,
        );
        render_hash_emoji_sprites_webgpu(gpu, pass, hash_data, matrix);
    }
}

/// Render text for a single hash from pre-computed data (WebGPU)
#[cfg(all(target_arch = "wasm32", feature = "wasm"))]
fn render_hash_text_webgpu(
    gpu: &mut WebGPUContext,
    pass: &mut wgpu::RenderPass<'_>,
    hash_data: &HashRenderData,
    matrix: &[f32; 16],
    effective_scale: f32,
    atlas_font_size: f32,
    distance_range: f32,
) {
    for text_buffer in &hash_data.text_buffers {
        if text_buffer.vertices.is_empty() || text_buffer.indices.is_empty() {
            continue;
        }

        // Check if we have this texture
        if !gpu.has_font_texture(text_buffer.texture_uid) {
            continue;
        }

        let font_scale = text_buffer.font_size / atlas_font_size;

        // Render the pre-computed text buffer
        gpu.draw_text(
            pass,
            &text_buffer.vertices,
            &text_buffer.indices,
            text_buffer.texture_uid,
            matrix,
            effective_scale,
            font_scale,
            distance_range,
        );
    }
}

/// Render emoji sprites for a hash from pre-computed data (WebGPU)
#[cfg(all(target_arch = "wasm32", feature = "wasm"))]
fn render_hash_emoji_sprites_webgpu(
    gpu: &mut WebGPUContext,
    pass: &mut wgpu::RenderPass<'_>,
    hash_data: &HashRenderData,
    matrix: &[f32; 16],
) {
    if hash_data.emoji_sprites.is_empty() {
        return;
    }

    for (&texture_uid, sprites) in &hash_data.emoji_sprites {
        if sprites.is_empty() {
            continue;
        }

        // Check if we have this texture
        if !gpu.has_emoji_texture(texture_uid) {
            continue;
        }

        // Build vertex data for all sprites
        let mut vertices: Vec<f32> = Vec::with_capacity(sprites.len() * 32);
        let mut indices: Vec<u32> = Vec::with_capacity(sprites.len() * 6);

        for (i, sprite) in sprites.iter().enumerate() {
            let half_w = sprite.width / 2.0;
            let half_h = sprite.height / 2.0;
            let x = sprite.x - half_w;
            let y = sprite.y - half_h;
            let x2 = sprite.x + half_w;
            let y2 = sprite.y + half_h;
            let u1 = sprite.uvs[0];
            let v1 = sprite.uvs[1];
            let u2 = sprite.uvs[2];
            let v2 = sprite.uvs[3];

            let base_index = (i * 4) as u32;

            // Top-left, top-right, bottom-right, bottom-left
            // Format: x, y, u, v, r, g, b, a
            vertices.extend_from_slice(&[
                x, y, u1, v1, 1.0, 1.0, 1.0, 1.0, // Top-left
                x2, y, u2, v1, 1.0, 1.0, 1.0, 1.0, // Top-right
                x2, y2, u2, v2, 1.0, 1.0, 1.0, 1.0, // Bottom-right
                x, y2, u1, v2, 1.0, 1.0, 1.0, 1.0, // Bottom-left
            ]);

            indices.extend_from_slice(&[
                base_index,
                base_index + 1,
                base_index + 2,
                base_index,
                base_index + 2,
                base_index + 3,
            ]);
        }

        gpu.draw_emoji_sprites(pass, texture_uid, &vertices, &indices, matrix);
    }
}
