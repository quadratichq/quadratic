/// Vertex shader for rendering lines and rectangles
/// Uses a view-projection matrix uniform and per-vertex positions
pub const BASIC_VERTEX_SHADER: &str = r#"#version 300 es
precision highp float;

// Vertex attributes
in vec2 a_position;
in vec4 a_color;

// Uniforms
uniform mat4 u_matrix;

// Varyings (passed to fragment shader)
out vec4 v_color;

void main() {
    gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
    v_color = a_color;
}
"#;

/// Fragment shader for solid colors
pub const BASIC_FRAGMENT_SHADER: &str = r#"#version 300 es
precision highp float;

in vec4 v_color;
out vec4 fragColor;

void main() {
    fragColor = v_color;
}
"#;
