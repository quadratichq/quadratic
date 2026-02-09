//! Image encoding utilities

use image::{ImageBuffer, ImageFormat as ImgFormat, Rgba};
use std::io::Cursor;

/// Output image format
#[derive(Debug, Clone, Copy, Default)]
pub enum ImageFormat {
    /// PNG format (lossless)
    #[default]
    Png,
    /// JPEG format with quality (0-100)
    Jpeg(u8),
    /// WebP format (lossless only)
    Webp,
}

/// Encode RGBA pixels to an image format
pub fn encode(
    pixels: &[u8],
    width: u32,
    height: u32,
    format: ImageFormat,
) -> anyhow::Result<Vec<u8>> {
    // Create image from raw pixels
    let image: ImageBuffer<Rgba<u8>, _> = ImageBuffer::from_raw(width, height, pixels.to_vec())
        .ok_or_else(|| anyhow::anyhow!("Failed to create image buffer"))?;

    let mut output = Vec::new();
    let mut cursor = Cursor::new(&mut output);

    match format {
        ImageFormat::Png => {
            image.write_to(&mut cursor, ImgFormat::Png)?;
        }
        ImageFormat::Jpeg(quality) => {
            // Convert to RGB for JPEG (no alpha channel)
            let rgb_image = image::DynamicImage::ImageRgba8(image).into_rgb8();

            let mut encoder =
                image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, quality);
            encoder.encode(
                rgb_image.as_raw(),
                width,
                height,
                image::ExtendedColorType::Rgb8,
            )?;
        }
        ImageFormat::Webp => {
            // Note: image crate only supports lossless WebP encoding
            let encoder = image::codecs::webp::WebPEncoder::new_lossless(&mut cursor);
            encoder.encode(
                image.as_raw(),
                width,
                height,
                image::ExtendedColorType::Rgba8,
            )?;
        }
    }

    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_png() {
        // Create a simple 2x2 image
        let pixels = vec![
            255, 0, 0, 255, // Red
            0, 255, 0, 255, // Green
            0, 0, 255, 255, // Blue
            255, 255, 255, 255, // White
        ];

        let png = encode(&pixels, 2, 2, ImageFormat::Png).unwrap();

        // PNG magic bytes
        assert_eq!(&png[0..8], &[137, 80, 78, 71, 13, 10, 26, 10]);
    }

    #[test]
    fn test_encode_jpeg() {
        // Create a simple 2x2 image
        let pixels = vec![
            255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
        ];

        let jpeg = encode(&pixels, 2, 2, ImageFormat::Jpeg(80)).unwrap();

        // JPEG magic bytes
        assert_eq!(&jpeg[0..2], &[0xFF, 0xD8]);
    }

    #[test]
    fn test_encode_webp() {
        // Create a simple 2x2 image
        let pixels = vec![
            255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
        ];

        let webp = encode(&pixels, 2, 2, ImageFormat::Webp).unwrap();

        // WebP magic bytes (RIFF....WEBP)
        assert_eq!(&webp[0..4], b"RIFF");
        assert_eq!(&webp[8..12], b"WEBP");
    }
}
