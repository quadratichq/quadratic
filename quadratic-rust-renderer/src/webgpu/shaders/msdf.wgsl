// MSDF text shader
// Implements multi-channel signed distance field rendering

struct Uniforms {
    matrix: mat4x4<f32>,
    fwidth: f32,
    _padding: vec3<f32>,
}

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

@group(0) @binding(1)
var font_texture: texture_2d<f32>;

@group(0) @binding(2)
var font_sampler: sampler;

struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) texcoord: vec2<f32>,
    @location(2) color: vec4<f32>,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) texcoord: vec2<f32>,
    @location(1) color: vec4<f32>,
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.position = uniforms.matrix * vec4<f32>(input.position, 0.0, 1.0);
    output.texcoord = input.texcoord;
    output.color = input.color;
    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    // Sample the MSDF texture
    let tex_color = textureSample(font_texture, font_sampler, input.texcoord);

    // MSDF: Calculate median of RGB channels
    var median = tex_color.r + tex_color.g + tex_color.b
                 - min(tex_color.r, min(tex_color.g, tex_color.b))
                 - max(tex_color.r, max(tex_color.g, tex_color.b));

    // SDF fallback: use alpha channel
    median = min(median, tex_color.a);

    // Calculate screen-space distance
    let screen_px_distance = uniforms.fwidth * (median - 0.5);
    var alpha = clamp(screen_px_distance + 0.5, 0.0, 1.0);

    // Clean up edges
    if (median < 0.01) {
        alpha = 0.0;
    } else if (median > 0.99) {
        alpha = 1.0;
    }

    // Output with color
    return vec4<f32>(input.color.rgb, input.color.a * alpha);
}
