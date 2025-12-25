//! Native CLI for server-side rendering
//!
//! This binary can render grid files to PNG images for thumbnails,
//! exports, or other server-side use cases.
//!
//! TODO: Implement software rendering backend (tiny-skia)

use anyhow::Result;

fn main() -> Result<()> {
    quadratic_rust_renderer::init_native();

    log::info!("Quadratic Renderer CLI");
    log::info!("======================");

    // Parse command line arguments
    let args: Vec<String> = std::env::args().collect();

    if args.len() < 2 {
        println!("Usage: quadratic-renderer <command> [options]");
        println!();
        println!("Commands:");
        println!("  render <input.grid> <output.png>  Render a grid file to PNG");
        println!("  thumbnail <input.grid>            Generate a thumbnail");
        println!("  version                           Show version info");
        return Ok(());
    }

    match args[1].as_str() {
        "version" => {
            println!("quadratic-rust-renderer v{}", env!("CARGO_PKG_VERSION"));
        }
        "render" | "thumbnail" => {
            log::warn!("Native rendering not yet implemented - requires software backend");
            log::info!("TODO: Implement tiny-skia based software renderer");
        }
        cmd => {
            anyhow::bail!("Unknown command: {}", cmd);
        }
    }

    Ok(())
}
