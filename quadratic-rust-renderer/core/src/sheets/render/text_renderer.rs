//! Text rendering using RenderContext
//!
//! Renders TextHash content using the platform-agnostic RenderContext trait.

use crate::render_context::RenderContext;
use crate::sheets::text::TextHash;
use crate::sheets::text::{lines_to_vertices, HorizontalLine, TextCache};
use crate::types::{FillBuffer, TextBuffer};

/// Render all cached text from a TextHash
///
/// Renders each (texture_uid, font_size) group with the correct font_scale
/// for proper MSDF anti-aliasing.
///
/// # Arguments
/// * `ctx` - Render context implementing RenderContext trait
/// * `hash` - TextHash containing cached text data
/// * `matrix` - View-projection matrix
/// * `viewport_scale` - Current viewport scale (zoom level * DPR)
/// * `atlas_font_size` - Font size the atlas was generated at (e.g., 42.0 for OpenSans)
/// * `distance_range` - MSDF distance range (typically 4.0)
pub fn render_text_hash(
    ctx: &mut impl RenderContext,
    hash: &TextHash,
    matrix: &[f32; 16],
    viewport_scale: f32,
    atlas_font_size: f32,
    distance_range: f32,
) {
    // Render text meshes from TextBuffers
    render_text_buffers(
        ctx,
        hash.cached_text_buffers(),
        matrix,
        viewport_scale,
        atlas_font_size,
        distance_range,
    );

    // Render horizontal lines (underline/strikethrough)
    if let Some(lines_buffer) = hash.cached_horizontal_lines_buffer() {
        render_fill_buffer(ctx, lines_buffer, matrix);
    }
}

/// Render text from TextBuffer slices
///
/// # Arguments
/// * `ctx` - Render context
/// * `buffers` - TextBuffer slice with vertex/index data grouped by (texture_uid, font_size)
/// * `matrix` - View-projection matrix
/// * `viewport_scale` - Current viewport scale
/// * `atlas_font_size` - Font size the atlas was generated at
/// * `distance_range` - MSDF distance range
pub fn render_text_buffers(
    ctx: &mut impl RenderContext,
    buffers: &[TextBuffer],
    matrix: &[f32; 16],
    viewport_scale: f32,
    atlas_font_size: f32,
    distance_range: f32,
) {
    for buf in buffers {
        if buf.is_empty() {
            continue;
        }
        if !ctx.has_font_texture(buf.texture_uid) {
            continue;
        }

        // Calculate font_scale for this buffer's font size
        let font_scale = buf.font_size / atlas_font_size;

        ctx.draw_text(
            &buf.vertices,
            &buf.indices,
            buf.texture_uid,
            matrix,
            viewport_scale,
            font_scale,
            distance_range,
        );
    }
}

/// Render text from a TextCache (legacy API)
///
/// # Arguments
/// * `ctx` - Render context
/// * `cache` - TextCache with vertex/index data grouped by (texture_uid, font_size)
/// * `matrix` - View-projection matrix
/// * `viewport_scale` - Current viewport scale
/// * `atlas_font_size` - Font size the atlas was generated at
/// * `distance_range` - MSDF distance range
pub fn render_text_cache(
    ctx: &mut impl RenderContext,
    cache: &TextCache,
    matrix: &[f32; 16],
    viewport_scale: f32,
    atlas_font_size: f32,
    distance_range: f32,
) {
    for (cache_key, entry) in cache {
        if entry.is_empty() {
            continue;
        }
        if !ctx.has_font_texture(cache_key.texture_uid) {
            continue;
        }

        // Calculate font_scale for this group's font size
        let font_scale = cache_key.font_size() / atlas_font_size;

        ctx.draw_text(
            &entry.vertices,
            &entry.indices,
            cache_key.texture_uid,
            matrix,
            viewport_scale,
            font_scale,
            distance_range,
        );
    }
}

/// Render a FillBuffer (triangles) directly
pub fn render_fill_buffer(ctx: &mut impl RenderContext, buffer: &FillBuffer, matrix: &[f32; 16]) {
    if !buffer.is_empty() {
        ctx.draw_triangles(&buffer.vertices, matrix);
    }
}

/// Render horizontal lines (underline/strikethrough) as triangles
pub fn render_horizontal_lines(
    ctx: &mut impl RenderContext,
    lines: &[HorizontalLine],
    matrix: &[f32; 16],
) {
    if lines.is_empty() {
        return;
    }

    let vertices = lines_to_vertices(lines);
    ctx.draw_triangles(&vertices, matrix);
}

/// Render emoji sprites
///
/// # Arguments
/// * `ctx` - Render context
/// * `emojis` - Emoji sprite cache grouped by texture ID
/// * `matrix` - View-projection matrix
pub fn render_emoji_sprites(
    ctx: &mut impl RenderContext,
    emojis: &crate::sheets::text::EmojiSpriteCache,
    matrix: &[f32; 16],
) {
    for (&texture_id, sprites) in emojis {
        if sprites.is_empty() {
            continue;
        }
        if !ctx.has_sprite_texture(texture_id) {
            continue;
        }

        // Build vertex and index data
        let mut vertices = Vec::with_capacity(sprites.len() * 32);
        let mut indices = Vec::with_capacity(sprites.len() * 6);

        for (i, sprite) in sprites.iter().enumerate() {
            let offset = (i * 4) as u32;
            vertices.extend_from_slice(&sprite.to_vertices());
            indices.extend_from_slice(&crate::sheets::text::EmojiSpriteData::to_indices(offset));
        }

        ctx.draw_sprites(texture_id, &vertices, &indices, matrix);
    }
}
