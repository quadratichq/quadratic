//! Font loader for WASM
//!
//! Handles loading BMFont XML files and texture atlases from the server.
//! Parses the XML to dynamically determine the number of texture pages.

use super::{BitmapChar, BitmapFont, CharFrame};
use regex_lite::Regex;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;

/// Font base URL (relative to origin)
pub const FONT_BASE_URL: &str = "/fonts/opensans/";

/// Font names to load
pub const FONT_NAMES: &[&str] = &[
    "OpenSans",
    "OpenSans-Bold",
    "OpenSans-Italic",
    "OpenSans-BoldItalic",
];

/// Helper to perform fetch that works in both Window and Worker contexts
async fn do_fetch(request: &web_sys::Request) -> Result<JsValue, JsValue> {
    // Use Reflect to call fetch on the global object (works in both Window and Worker)
    let global = js_sys::global();
    let fetch_fn = js_sys::Reflect::get(&global, &"fetch".into())?;
    let fetch_fn: js_sys::Function = fetch_fn.dyn_into()?;
    let promise = fetch_fn.call1(&global, request)?;
    let promise: js_sys::Promise = promise.dyn_into()?;
    JsFuture::from(promise).await
}

/// Fetch text from a URL
pub async fn fetch_text(url: &str) -> Result<String, JsValue> {
    use web_sys::{Request, RequestInit, RequestMode, Response};

    let opts = RequestInit::new();
    opts.set_method("GET");
    opts.set_mode(RequestMode::Cors);

    let request = Request::new_with_str_and_init(url, &opts)?;

    // Fetch using the global scope (works in both Window and Worker contexts)
    let resp_value = do_fetch(&request).await?;
    let resp: Response = resp_value.dyn_into()?;

    if !resp.ok() {
        return Err(JsValue::from_str(&format!(
            "HTTP error: {} {}",
            resp.status(),
            resp.status_text()
        )));
    }

    let text = JsFuture::from(resp.text()?).await?;
    text.as_string()
        .ok_or_else(|| JsValue::from_str("Response was not a string"))
}

/// Fetch binary data from a URL
pub async fn fetch_bytes(url: &str) -> Result<Vec<u8>, JsValue> {
    use web_sys::{Request, RequestInit, RequestMode, Response};

    let opts = RequestInit::new();
    opts.set_method("GET");
    opts.set_mode(RequestMode::Cors);

    let request = Request::new_with_str_and_init(url, &opts)?;

    // Fetch using the global scope (works in both Window and Worker contexts)
    let resp_value = do_fetch(&request).await?;

    let resp: Response = resp_value.dyn_into()?;

    if !resp.ok() {
        return Err(JsValue::from_str(&format!(
            "HTTP error: {} {}",
            resp.status(),
            resp.status_text()
        )));
    }

    let array_buffer = JsFuture::from(resp.array_buffer()?).await?;
    let uint8_array = js_sys::Uint8Array::new(&array_buffer);
    Ok(uint8_array.to_vec())
}

/// Decode PNG bytes to RGBA pixel data using browser APIs
pub async fn decode_png_to_rgba(png_data: &[u8]) -> Result<(u32, u32, Vec<u8>), JsValue> {
    use js_sys::{Object, Reflect, Uint8Array};
    use web_sys::{Blob, ImageData};

    // Create a Blob from the PNG data
    let array = Uint8Array::new_with_length(png_data.len() as u32);
    array.copy_from(png_data);

    let blob_parts = js_sys::Array::new();
    blob_parts.push(&array.buffer());

    // Create blob options using Object (avoids type mismatch with BlobPropertyBag)
    let blob_options = Object::new();
    Reflect::set(&blob_options, &"type".into(), &"image/png".into())?;

    let blob = Blob::new_with_buffer_source_sequence_and_options(&blob_parts, &blob_options.unchecked_into())?;

    // Create ImageBitmap from Blob using dynamic call (since typed bindings aren't available)
    let global = js_sys::global();
    let create_image_bitmap = Reflect::get(&global, &"createImageBitmap".into())?;
    let create_image_bitmap_fn: js_sys::Function = create_image_bitmap.dyn_into()?;

    let bitmap_promise = create_image_bitmap_fn.call1(&global, &blob)?;
    let bitmap_promise: js_sys::Promise = bitmap_promise.dyn_into()?;
    let bitmap_value = JsFuture::from(bitmap_promise).await?;
    let bitmap: web_sys::ImageBitmap = bitmap_value.dyn_into()?;

    let width = bitmap.width();
    let height = bitmap.height();

    // Create OffscreenCanvas and draw the bitmap to it
    let canvas = web_sys::OffscreenCanvas::new(width, height)?;
    let ctx: web_sys::OffscreenCanvasRenderingContext2d = canvas
        .get_context("2d")?
        .ok_or_else(|| JsValue::from_str("Failed to get 2d context"))?
        .dyn_into()?;

    ctx.draw_image_with_image_bitmap(&bitmap, 0.0, 0.0)?;

    // Get pixel data
    let image_data: ImageData = ctx.get_image_data(0.0, 0.0, width as f64, height as f64)?;
    let data = image_data.data().to_vec();

    Ok((width, height, data))
}

/// Parse a BMFont XML file and extract font data
///
/// Returns the BitmapFont and the number of texture pages
pub fn parse_bmfont_xml(
    xml_text: &str,
    font_name: &str,
    texture_uid_base: u32,
) -> Result<(BitmapFont, u32), String> {
    // Extract info attributes
    let size = extract_attr(xml_text, r#"<info[^>]*size="(\d+)""#, 42);

    // Extract common attributes
    let line_height = extract_attr(xml_text, r#"<common[^>]*lineHeight="(\d+)""#, 57);
    let scale_w = extract_attr(xml_text, r#"<common[^>]*scaleW="(\d+)""#, 512);
    let scale_h = extract_attr(xml_text, r#"<common[^>]*scaleH="(\d+)""#, 512);
    let pages_count = extract_attr(xml_text, r#"<common[^>]*pages="(\d+)""#, 1);

    // Extract distance field info
    let distance_range = extract_attr(xml_text, r#"<distanceField[^>]*distanceRange="(\d+)""#, 4);

    // Parse character data
    let mut chars: HashMap<u32, BitmapChar> = HashMap::new();

    let char_regex = Regex::new(r#"<char[^>]+>"#).unwrap();
    for cap in char_regex.find_iter(xml_text) {
        let char_str = cap.as_str();

        if let Some(id) = extract_attr_from_str(char_str, r#"id="(\d+)""#) {
            let x = extract_attr_from_str(char_str, r#"\bx="(-?\d+)""#).unwrap_or(0);
            let y = extract_attr_from_str(char_str, r#"\by="(-?\d+)""#).unwrap_or(0);
            let width = extract_attr_from_str(char_str, r#"width="(-?\d+)""#).unwrap_or(0);
            let height = extract_attr_from_str(char_str, r#"height="(-?\d+)""#).unwrap_or(0);
            let page = extract_attr_from_str(char_str, r#"page="(\d+)""#).unwrap_or(0);
            let x_offset = extract_attr_from_str(char_str, r#"xoffset="(-?\d+)""#).unwrap_or(0);
            let y_offset = extract_attr_from_str(char_str, r#"yoffset="(-?\d+)""#).unwrap_or(0);
            let x_advance = extract_attr_from_str(char_str, r#"xadvance="(-?\d+)""#).unwrap_or(0);

            // Calculate UV coordinates (normalized 0-1)
            let u0 = x as f32 / scale_w as f32;
            let v0 = y as f32 / scale_h as f32;
            let u1 = (x + width) as f32 / scale_w as f32;
            let v1 = (y + height) as f32 / scale_h as f32;

            chars.insert(
                id as u32,
                BitmapChar {
                    texture_uid: texture_uid_base + page as u32,
                    x_advance: x_advance as f32,
                    x_offset: x_offset as f32,
                    y_offset: y_offset as f32,
                    orig_width: width as f32,
                    texture_height: height as f32,
                    kerning: HashMap::new(),
                    uvs: [u0, v0, u1, v0, u1, v1, u0, v1],
                    frame: CharFrame {
                        x: x as f32,
                        y: y as f32,
                        width: width as f32,
                        height: height as f32,
                    },
                },
            );
        }
    }

    Ok((
        BitmapFont {
            font: font_name.to_string(),
            size: size as f32,
            line_height: line_height as f32,
            distance_range: distance_range as f32,
            chars,
        },
        pages_count as u32,
    ))
}

/// Extract an integer attribute from XML text
fn extract_attr(xml_text: &str, pattern: &str, default: i32) -> i32 {
    let re = Regex::new(pattern).ok();
    re.and_then(|r| r.captures(xml_text))
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse().ok())
        .unwrap_or(default)
}

/// Extract an integer attribute from a string
fn extract_attr_from_str(text: &str, pattern: &str) -> Option<i32> {
    let re = Regex::new(pattern).ok()?;
    re.captures(text)?
        .get(1)?
        .as_str()
        .parse()
        .ok()
}

/// Callback type for uploading font textures
/// Takes texture_uid, width, height, and RGBA data
pub type TextureUploadFn = Box<dyn Fn(u32, u32, u32, &[u8]) -> Result<(), JsValue>>;

/// Load all fonts and upload their textures
///
/// This is a shared implementation that works for both WebGL and WebGPU renderers.
/// The `upload_texture` callback handles the backend-specific texture upload.
pub async fn load_all_fonts<F>(
    fonts: &mut super::BitmapFonts,
    upload_texture: F,
) -> Result<(), JsValue>
where
    F: Fn(u32, u32, u32, &[u8]) -> Result<(), JsValue>,
{
    let mut texture_uid_base: u32 = 0;

    for font_name in FONT_NAMES {
        // Load the .fnt file
        let fnt_url = format!("{}{}.fnt", FONT_BASE_URL, font_name);
        let fnt_text = match fetch_text(&fnt_url).await {
            Ok(text) => text,
            Err(e) => {
                log::warn!("Failed to load font {}: {:?}", font_name, e);
                continue;
            }
        };

        // Parse the BMFont XML (this tells us how many pages there are)
        let (font, num_pages) = match parse_bmfont_xml(&fnt_text, font_name, texture_uid_base) {
            Ok(result) => result,
            Err(e) => {
                log::warn!("Failed to parse font {}: {}", font_name, e);
                continue;
            }
        };

        fonts.add(font);

        // Load texture pages (determined from XML)
        for page in 0..num_pages {
            let texture_url = format!("{}{}.{}.png", FONT_BASE_URL, font_name, page);
            let png_data = match fetch_bytes(&texture_url).await {
                Ok(data) => data,
                Err(e) => {
                    log::warn!("Failed to load texture {}: {:?}", texture_url, e);
                    continue;
                }
            };

            // Decode PNG to RGBA
            let (width, height, rgba_data) = match decode_png_to_rgba(&png_data).await {
                Ok(result) => result,
                Err(e) => {
                    log::warn!("Failed to decode texture {}: {:?}", texture_url, e);
                    continue;
                }
            };

            // Upload texture using the provided callback
            let texture_uid = texture_uid_base + page;
            upload_texture(texture_uid, width, height, &rgba_data)?;
        }

        log::info!(
            "Loaded font: {} (textures {}-{})",
            font_name,
            texture_uid_base,
            texture_uid_base + num_pages - 1
        );

        texture_uid_base += num_pages;
    }

    log::info!("All fonts loaded successfully");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_attr() {
        let xml = r#"<common lineHeight="57" base="45" scaleW="512" scaleH="512" pages="5"/>"#;
        assert_eq!(
            extract_attr(xml, r#"<common[^>]*lineHeight="(\d+)""#, 0),
            57
        );
        assert_eq!(extract_attr(xml, r#"<common[^>]*pages="(\d+)""#, 0), 5);
    }

    #[test]
    fn test_extract_attr_from_str() {
        let char_str = r#"<char id="65" x="10" y="20" width="30" height="40" page="0"/>"#;
        assert_eq!(extract_attr_from_str(char_str, r#"id="(\d+)""#), Some(65));
        assert_eq!(
            extract_attr_from_str(char_str, r#"\bx="(-?\d+)""#),
            Some(10)
        );
        assert_eq!(
            extract_attr_from_str(char_str, r#"width="(-?\d+)""#),
            Some(30)
        );
    }
}
