// Instanced rectangle shader (WebGPU optimization)
//
// Instead of 6 vertices per rectangle (36 bytes), we use:
// - 4 unit quad vertices (shared across all instances)
// - Per-instance data: position, size, color (32 bytes per rect)
//
// This reduces vertex data by ~6x and enables efficient GPU instancing.

struct Uniforms {
    matrix: mat4x4<f32>,
}

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

// Per-instance data: packed into a storage buffer
struct RectInstance {
    // Position (x, y) and size (width, height) packed as vec4
    pos_size: vec4<f32>,
    // Color (r, g, b, a)
    color: vec4<f32>,
}

@group(0) @binding(1)
var<storage, read> instances: array<RectInstance>;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
}

// Unit quad vertices (CCW winding)
const QUAD_VERTICES: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0),  // Top-left
    vec2<f32>(1.0, 0.0),  // Top-right
    vec2<f32>(1.0, 1.0),  // Bottom-right
    vec2<f32>(0.0, 0.0),  // Top-left
    vec2<f32>(1.0, 1.0),  // Bottom-right
    vec2<f32>(0.0, 1.0),  // Bottom-left
);

@vertex
fn vs_main(
    @builtin(vertex_index) vertex_index: u32,
    @builtin(instance_index) instance_index: u32,
) -> VertexOutput {
    let instance = instances[instance_index];
    let quad_pos = QUAD_VERTICES[vertex_index];

    // Transform unit quad to world position
    let world_pos = vec2<f32>(
        instance.pos_size.x + quad_pos.x * instance.pos_size.z,
        instance.pos_size.y + quad_pos.y * instance.pos_size.w,
    );

    var output: VertexOutput;
    output.position = uniforms.matrix * vec4<f32>(world_pos, 0.0, 1.0);
    output.color = instance.color;
    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    return input.color;
}
