// Sprite shader
// Handles position, texture coordinates, and color tint

struct Uniforms {
    matrix: mat4x4<f32>,
}

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

@group(0) @binding(1)
var sprite_texture: texture_2d<f32>;

@group(0) @binding(2)
var sprite_sampler: sampler;

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
    // Sample the texture
    let tex_color = textureSample(sprite_texture, sprite_sampler, input.texcoord);

    // Multiply by color tint
    return tex_color * input.color;
}
