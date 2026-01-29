//! BMFont XML parser for loading font data
//!
//! This module parses BMFont XML (.fnt) files and produces `BitmapFont` structs
//! that can be used for text rendering. The actual file I/O is left to the caller,
//! so this can work in both native and WASM environments.

#[cfg(not(target_arch = "wasm32"))]
use crate::sheets::text::BitmapFonts;
use crate::sheets::text::{BitmapChar, BitmapFont, CharFrame};
use std::collections::HashMap;

/// Parse a BMFont XML string into a BitmapFont
///
/// # Arguments
/// * `xml` - The BMFont XML content as a string
/// * `font_index` - The index of this font (used for texture UID calculation)
///
/// # Returns
/// A `BitmapFont` struct or an error
pub fn parse_bmfont_xml(xml: &str, font_index: u32) -> anyhow::Result<BitmapFont> {
    use quick_xml::events::Event;
    use quick_xml::Reader;

    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut font_name = String::new();
    let mut font_size: f32 = 42.0;
    let mut line_height: f32 = 57.0;
    let mut scale_w: f32 = 512.0;
    let mut scale_h: f32 = 512.0;
    let mut distance_range: f32 = 4.0;
    let mut chars: HashMap<u32, BitmapChar> = HashMap::new();
    let mut kernings: HashMap<(u32, u32), f32> = HashMap::new();
    let mut page_count: u32 = 1;

    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Empty(e)) | Ok(Event::Start(e)) => {
                let name = e.name();
                match name.as_ref() {
                    b"info" => {
                        for attr in e.attributes().flatten() {
                            match attr.key.as_ref() {
                                b"face" => {
                                    font_name = String::from_utf8_lossy(&attr.value).to_string();
                                }
                                b"size" => {
                                    if let Ok(s) = String::from_utf8_lossy(&attr.value).parse() {
                                        font_size = s;
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                    b"common" => {
                        for attr in e.attributes().flatten() {
                            match attr.key.as_ref() {
                                b"lineHeight" => {
                                    if let Ok(h) = String::from_utf8_lossy(&attr.value).parse() {
                                        line_height = h;
                                    }
                                }
                                b"scaleW" => {
                                    if let Ok(w) =
                                        String::from_utf8_lossy(&attr.value).parse::<f32>()
                                    {
                                        if w > 0.0 {
                                            scale_w = w;
                                        }
                                    }
                                }
                                b"scaleH" => {
                                    if let Ok(h) =
                                        String::from_utf8_lossy(&attr.value).parse::<f32>()
                                    {
                                        if h > 0.0 {
                                            scale_h = h;
                                        }
                                    }
                                }
                                b"pages" => {
                                    if let Ok(p) = String::from_utf8_lossy(&attr.value).parse() {
                                        page_count = p;
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                    b"distanceField" => {
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"distanceRange" {
                                if let Ok(r) = String::from_utf8_lossy(&attr.value).parse() {
                                    distance_range = r;
                                }
                            }
                        }
                    }
                    b"char" => {
                        let mut id: u32 = 0;
                        let mut x: f32 = 0.0;
                        let mut y: f32 = 0.0;
                        let mut width: f32 = 0.0;
                        let mut height: f32 = 0.0;
                        let mut xoffset: f32 = 0.0;
                        let mut yoffset: f32 = 0.0;
                        let mut xadvance: f32 = 0.0;
                        let mut page: u32 = 0;

                        for attr in e.attributes().flatten() {
                            let val = String::from_utf8_lossy(&attr.value);
                            match attr.key.as_ref() {
                                b"id" => id = val.parse().unwrap_or(0),
                                b"x" => x = val.parse().unwrap_or(0.0),
                                b"y" => y = val.parse().unwrap_or(0.0),
                                b"width" => width = val.parse().unwrap_or(0.0),
                                b"height" => height = val.parse().unwrap_or(0.0),
                                b"xoffset" => xoffset = val.parse().unwrap_or(0.0),
                                b"yoffset" => yoffset = val.parse().unwrap_or(0.0),
                                b"xadvance" => xadvance = val.parse().unwrap_or(0.0),
                                b"page" => page = val.parse().unwrap_or(0),
                                _ => {}
                            }
                        }

                        // Validate texture dimensions to avoid division by zero
                        if scale_w <= 0.0 || scale_h <= 0.0 {
                            return Err(anyhow::anyhow!(
                                "Invalid font texture dimensions: {}x{}",
                                scale_w,
                                scale_h
                            ));
                        }

                        // Calculate UV coordinates
                        let u0 = x / scale_w;
                        let v0 = y / scale_h;
                        let u1 = (x + width) / scale_w;
                        let v1 = (y + height) / scale_h;

                        // Global texture UID: font_index * 1000 + page
                        let texture_uid = font_index * 1000 + page;

                        chars.insert(
                            id,
                            BitmapChar {
                                texture_uid,
                                x_advance: xadvance,
                                x_offset: xoffset,
                                y_offset: yoffset,
                                orig_width: width,
                                texture_height: height,
                                kerning: HashMap::new(),
                                uvs: [u0, v0, u1, v0, u1, v1, u0, v1],
                                frame: CharFrame {
                                    x,
                                    y,
                                    width,
                                    height,
                                },
                            },
                        );
                    }
                    b"kerning" => {
                        let mut first: u32 = 0;
                        let mut second: u32 = 0;
                        let mut amount: f32 = 0.0;

                        for attr in e.attributes().flatten() {
                            let val = String::from_utf8_lossy(&attr.value);
                            match attr.key.as_ref() {
                                b"first" => first = val.parse().unwrap_or(0),
                                b"second" => second = val.parse().unwrap_or(0),
                                b"amount" => amount = val.parse().unwrap_or(0.0),
                                _ => {}
                            }
                        }

                        if first != 0 && second != 0 {
                            kernings.insert((first, second), amount);
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(anyhow::anyhow!("Error parsing BMFont XML: {:?}", e)),
            _ => {}
        }
        buf.clear();
    }

    // Apply kerning to character data
    for ((first, second), amount) in kernings {
        if let Some(char_data) = chars.get_mut(&first) {
            char_data.kerning.insert(second, amount);
        }
    }

    log::debug!(
        "Parsed font '{}': size={}, line_height={}, {} chars, {} pages",
        font_name,
        font_size,
        line_height,
        chars.len(),
        page_count
    );

    Ok(BitmapFont {
        font: font_name,
        size: font_size,
        line_height,
        distance_range,
        chars,
    })
}

/// Information about font texture pages
#[derive(Debug, Clone)]
pub struct FontTextureInfo {
    /// Global texture UID (font_index * 1000 + page)
    pub texture_uid: u32,
    /// Page index within this font
    pub page: u32,
    /// Filename of the texture (from the .fnt file)
    pub filename: String,
}

/// Parse font texture page information from BMFont XML
pub fn parse_font_texture_pages(
    xml: &str,
    font_index: u32,
) -> anyhow::Result<Vec<FontTextureInfo>> {
    use quick_xml::events::Event;
    use quick_xml::Reader;

    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut pages = Vec::new();
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Empty(e)) | Ok(Event::Start(e)) => {
                if e.name().as_ref() == b"page" {
                    let mut page_id: u32 = 0;
                    let mut filename = String::new();

                    for attr in e.attributes().flatten() {
                        let val = String::from_utf8_lossy(&attr.value);
                        match attr.key.as_ref() {
                            b"id" => page_id = val.parse().unwrap_or(0),
                            b"file" => {
                                // Remove query string if present (e.g., "OpenSans.0.png?v=1.0.1")
                                filename = val.split('?').next().unwrap_or(&val).to_string();
                            }
                            _ => {}
                        }
                    }

                    pages.push(FontTextureInfo {
                        texture_uid: font_index * 1000 + page_id,
                        page: page_id,
                        filename,
                    });
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(anyhow::anyhow!("Error parsing BMFont XML: {:?}", e)),
            _ => {}
        }
        buf.clear();
    }

    Ok(pages)
}

/// Load fonts from a directory containing .fnt files
///
/// This is a helper for native environments. Returns the fonts and texture info.
#[cfg(not(target_arch = "wasm32"))]
pub fn load_fonts_from_directory(
    font_dir: &std::path::Path,
    font_files: &[&str],
) -> anyhow::Result<(BitmapFonts, Vec<FontTextureInfo>)> {
    use std::fs;

    let mut fonts = BitmapFonts::new();
    let mut all_textures = Vec::new();

    for (index, font_file) in font_files.iter().enumerate() {
        let fnt_path = font_dir.join(font_file);
        let xml = fs::read_to_string(&fnt_path)?;

        let font = parse_bmfont_xml(&xml, index as u32)?;
        let textures = parse_font_texture_pages(&xml, index as u32)?;

        log::debug!(
            "Loaded font '{}' with {} chars, {} texture pages",
            font.font,
            font.chars.len(),
            textures.len()
        );

        fonts.add(font);
        all_textures.extend(textures);
    }

    Ok((fonts, all_textures))
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_FNT: &str = r#"<?xml version="1.0"?>
<font>
  <info face="TestFont" size="42" bold="0" italic="0"/>
  <common lineHeight="57" base="45" scaleW="512" scaleH="512" pages="1"/>
  <pages>
    <page id="0" file="TestFont.0.png"/>
  </pages>
  <distanceField fieldType="msdf" distanceRange="4"/>
  <chars count="2">
    <char id="65" x="0" y="0" width="30" height="40" xoffset="1" yoffset="5" xadvance="28" page="0"/>
    <char id="66" x="31" y="0" width="28" height="40" xoffset="2" yoffset="5" xadvance="27" page="0"/>
  </chars>
  <kernings count="1">
    <kerning first="65" second="66" amount="-2"/>
  </kernings>
</font>"#;

    #[test]
    fn test_parse_bmfont_xml() {
        let font = parse_bmfont_xml(SAMPLE_FNT, 0).unwrap();
        assert_eq!(font.font, "TestFont");
        assert_eq!(font.size, 42.0);
        assert_eq!(font.line_height, 57.0);
        assert_eq!(font.distance_range, 4.0);
        assert_eq!(font.chars.len(), 2);

        let char_a = font.chars.get(&65).unwrap();
        assert_eq!(char_a.x_advance, 28.0);
        assert_eq!(char_a.texture_uid, 0); // font_index 0 * 1000 + page 0

        // Check kerning
        assert_eq!(*char_a.kerning.get(&66).unwrap(), -2.0);
    }

    #[test]
    fn test_parse_font_texture_pages() {
        let pages = parse_font_texture_pages(SAMPLE_FNT, 0).unwrap();
        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0].texture_uid, 0);
        assert_eq!(pages[0].page, 0);
        assert_eq!(pages[0].filename, "TestFont.0.png");
    }
}
