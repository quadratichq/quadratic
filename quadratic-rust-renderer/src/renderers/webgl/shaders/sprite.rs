//! Sprite shader

/// Sprite vertex shader
/// Handles position, texture coordinates, and color tint
pub const SPRITE_VERTEX_SHADER: &str = r#"#version 300 es
precision highp float;

// Vertex attributes
in vec2 a_position;
in vec2 a_texcoord;
in vec4 a_color;

// Uniforms
uniform mat4 u_matrix;

// Varyings
out vec2 v_texcoord;
out vec4 v_color;

void main() {
    gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
    v_texcoord = a_texcoord;
    v_color = a_color;
}
"#;

/// Sprite fragment shader
/// Samples texture and multiplies by color tint
pub const SPRITE_FRAGMENT_SHADER: &str = r#"#version 300 es
precision highp float;

in vec2 v_texcoord;
in vec4 v_color;

uniform sampler2D u_texture;

out vec4 fragColor;

void main() {
    // Sample the texture
    vec4 texColor = texture(u_texture, v_texcoord);

    // Multiply by color tint
    fragColor = texColor * v_color;
}
"#;
