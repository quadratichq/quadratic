//! Render request types (re-exported from core) and native-only chart image decoding.

pub use quadratic_renderer_core::{
    build_render_request, ChartImage, GridExclusionZone, RenderRequest, SelectionRange,
    TableNameIcon,
};

/// Decode base64 chart image data to raw RGBA bytes (native only; uses image crate).
pub fn decode_chart_image(img: &ChartImage) -> anyhow::Result<(Vec<u8>, u32, u32)> {
    use base64::Engine;

    let base64_data = if let Some(comma_pos) = img.image_data.find(',') {
        &img.image_data[comma_pos + 1..]
    } else {
        &img.image_data
    };

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| anyhow::anyhow!("Failed to decode base64: {}", e))?;

    let image_img = image::load_from_memory(&bytes)
        .map_err(|e| anyhow::anyhow!("Failed to decode image: {}", e))?;

    let rgba = image_img.into_rgba8();
    let (width, height) = (rgba.width(), rgba.height());

    Ok((rgba.into_raw(), width, height))
}
