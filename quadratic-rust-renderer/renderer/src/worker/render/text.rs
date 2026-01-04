//! Cell text rendering

use crate::renderers::WebGLContext;
use crate::sheets::text::BitmapFonts;
use crate::sheets::text::EmojiSprites;
use crate::sheets::text::SPRITE_SCALE_THRESHOLD;
use crate::sheets::Sheet;
use crate::viewport::Viewport;

/// Render cell text using WebGL
///
/// Returns visible_count for debug logging
///
/// # Arguments
/// * `gl` - WebGL context
/// * `sheet` - Sheet to render
/// * `viewport` - Viewport for culling and scale
/// * `fonts` - Bitmap fonts
/// * `emoji_sprites` - Emoji spritesheets (optional)
/// * `matrix` - View-projection matrix
/// * `atlas_font_size` - The font size the atlas was generated at (e.g., 42.0 for OpenSans)
/// * `distance_range` - MSDF distance range
pub fn render_text(
    gl: &WebGLContext,
    sheet: &mut Sheet,
    viewport: &Viewport,
    fonts: &BitmapFonts,
    emoji_sprites: Option<&EmojiSprites>,
    matrix: &[f32; 16],
    atlas_font_size: f32,
    distance_range: f32,
) -> usize {
    if sheet.hashes.is_empty() {
        return 0;
    }

    let scale = viewport.scale();
    let effective_scale = viewport.effective_scale();
    let use_sprites = scale < SPRITE_SCALE_THRESHOLD;

    let bounds = viewport.visible_bounds();
    let padding = 100.0;
    let min_x = bounds.left - padding;
    let max_x = bounds.left + bounds.width + padding;
    let min_y = bounds.top - padding;
    let max_y = bounds.top + bounds.height + padding;

    let mut visible_count = 0;

    for hash in sheet.hashes.values_mut() {
        if !hash.intersects_viewport(min_x, max_x, min_y, max_y) {
            continue;
        }

        // Rebuild mesh cache if dirty (needed before rendering)
        hash.rebuild_if_dirty_with_emojis(fonts, emoji_sprites);

        // Rebuild sprite cache if zoomed out and sprite is dirty
        if use_sprites {
            hash.rebuild_sprite_if_dirty(gl, fonts, atlas_font_size, distance_range);
        }

        visible_count += 1;

        hash.render(
            gl,
            matrix,
            scale,
            effective_scale,
            atlas_font_size,
            distance_range,
        );

        // Render emoji sprites
        render_emoji_sprites(gl, hash, matrix);
    }

    visible_count
}

/// Render emoji sprites for a hash using WebGL
fn render_emoji_sprites(
    gl: &WebGLContext,
    hash: &crate::sheets::text::CellsTextHash,
    matrix: &[f32; 16],
) {
    let emoji_sprites = hash.get_emoji_sprites();
    if emoji_sprites.is_empty() {
        return;
    }

    // Render each texture group
    for (&texture_uid, sprites) in emoji_sprites {
        if sprites.is_empty() {
            continue;
        }

        // Check if we have this texture
        if !gl.has_emoji_texture(texture_uid) {
            continue;
        }

        // Build vertex data for all sprites in this group
        let mut vertices: Vec<f32> = Vec::with_capacity(sprites.len() * 32);
        let mut indices: Vec<u32> = Vec::with_capacity(sprites.len() * 6);

        for (i, sprite) in sprites.iter().enumerate() {
            // sprite.x and sprite.y are CENTER positions (matching TypeScript's anchor=0.5)
            // Convert to corner positions for rendering
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

        // Draw the emoji sprites
        gl.draw_emoji_sprites(texture_uid, &vertices, &indices, matrix);
    }
}

/// Render cell text using WebGPU
///
/// Returns visible_count for debug logging
///
/// # Arguments
/// * `gpu` - WebGPU context
/// * `pass` - Render pass
/// * `sheet` - Sheet to render
/// * `viewport` - Viewport for culling and scale
/// * `fonts` - Bitmap fonts
/// * `emoji_sprites` - Emoji spritesheets (optional)
/// * `matrix` - View-projection matrix
/// * `atlas_font_size` - The font size the atlas was generated at (e.g., 42.0 for OpenSans)
/// * `distance_range` - MSDF distance range
#[cfg(feature = "wasm")]
pub fn render_text_webgpu<'a>(
    gpu: &mut crate::renderers::WebGPUContext,
    pass: &mut wgpu::RenderPass<'a>,
    sheet: &mut Sheet,
    viewport: &Viewport,
    fonts: &BitmapFonts,
    emoji_sprites: Option<&EmojiSprites>,
    matrix: &[f32; 16],
    atlas_font_size: f32,
    distance_range: f32,
) -> usize {
    if sheet.hashes.is_empty() {
        return 0;
    }

    let scale = viewport.scale();
    let effective_scale = viewport.effective_scale();

    let bounds = viewport.visible_bounds();
    let padding = 100.0;
    let min_x = bounds.left - padding;
    let max_x = bounds.left + bounds.width + padding;
    let min_y = bounds.top - padding;
    let max_y = bounds.top + bounds.height + padding;

    let mut visible_count = 0;

    for hash in sheet.hashes.values_mut() {
        if !hash.intersects_viewport(min_x, max_x, min_y, max_y) {
            continue;
        }

        // Rebuild mesh cache if dirty (needed before rendering)
        hash.rebuild_if_dirty_with_emojis(fonts, emoji_sprites);

        visible_count += 1;

        hash.render_webgpu(
            gpu,
            pass,
            matrix,
            scale,
            effective_scale,
            atlas_font_size,
            distance_range,
        );

        // Render emoji sprites for WebGPU
        render_emoji_sprites_webgpu(gpu, pass, hash, matrix);
    }

    visible_count
}

/// Render emoji sprites for a hash using WebGPU
#[cfg(feature = "wasm")]
fn render_emoji_sprites_webgpu(
    gpu: &mut crate::renderers::WebGPUContext,
    pass: &mut wgpu::RenderPass<'_>,
    hash: &crate::sheets::text::CellsTextHash,
    matrix: &[f32; 16],
) {
    let emoji_sprites = hash.get_emoji_sprites();
    if emoji_sprites.is_empty() {
        return;
    }

    // Render each texture group
    for (&texture_uid, sprites) in emoji_sprites {
        if sprites.is_empty() {
            continue;
        }

        // Build vertex data for all sprites in this group
        let mut vertices: Vec<f32> = Vec::with_capacity(sprites.len() * 32);
        let mut indices: Vec<u32> = Vec::with_capacity(sprites.len() * 6);

        for (i, sprite) in sprites.iter().enumerate() {
            // sprite.x and sprite.y are CENTER positions (matching TypeScript's anchor=0.5)
            // Convert to corner positions for rendering
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

        // Draw the emoji sprites
        gpu.draw_emoji_sprites(pass, texture_uid, &vertices, &indices, matrix);
    }
}
