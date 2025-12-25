#!/bin/bash
# Simple dev server for testing the renderer
# Run from the quadratic-rust-renderer directory

echo "🦀 Quadratic Rust Renderer - Dev Server"
echo "========================================"
echo ""
echo "Building WASM..."
wasm-pack build --target web --dev --out-dir pkg -- --features wasm

echo ""
echo "Starting Vite dev server..."
echo "Open http://localhost:8080 in your browser"
echo ""
echo "Press Ctrl+C to stop"

npm run serve
