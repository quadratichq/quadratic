//! Render pipelines for wgpu

use wgpu::util::DeviceExt;
use wgpu::*;

use super::shaders;

/// Render pipelines for different draw types
pub struct RenderPipelines {
    triangle_pipeline: RenderPipeline,
    line_pipeline: RenderPipeline,
    text_pipeline: RenderPipeline,
    sprite_pipeline: RenderPipeline,

    // Bind group layouts
    matrix_bind_group_layout: BindGroupLayout,
    text_bind_group_layout: BindGroupLayout,

    // Samplers
    linear_sampler: Sampler,
}

impl RenderPipelines {
    pub fn new(device: &Device, target_format: TextureFormat) -> Self {
        // Create shader modules
        let triangle_shader = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("Triangle Shader"),
            source: ShaderSource::Wgsl(shaders::TRIANGLE_SHADER.into()),
        });

        let line_shader = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("Line Shader"),
            source: ShaderSource::Wgsl(shaders::LINE_SHADER.into()),
        });

        let text_shader = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("Text Shader"),
            source: ShaderSource::Wgsl(shaders::TEXT_SHADER.into()),
        });

        let sprite_shader = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("Sprite Shader"),
            source: ShaderSource::Wgsl(shaders::SPRITE_SHADER.into()),
        });

        // Bind group layouts
        let matrix_bind_group_layout =
            device.create_bind_group_layout(&BindGroupLayoutDescriptor {
                label: Some("Matrix Bind Group Layout"),
                entries: &[BindGroupLayoutEntry {
                    binding: 0,
                    visibility: ShaderStages::VERTEX,
                    ty: BindingType::Buffer {
                        ty: BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                }],
            });

        let text_bind_group_layout = device.create_bind_group_layout(&BindGroupLayoutDescriptor {
            label: Some("Text Bind Group Layout"),
            entries: &[
                BindGroupLayoutEntry {
                    binding: 0,
                    visibility: ShaderStages::VERTEX | ShaderStages::FRAGMENT,
                    ty: BindingType::Buffer {
                        ty: BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 1,
                    visibility: ShaderStages::FRAGMENT,
                    ty: BindingType::Texture {
                        sample_type: TextureSampleType::Float { filterable: true },
                        view_dimension: TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 2,
                    visibility: ShaderStages::FRAGMENT,
                    ty: BindingType::Sampler(SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });

        // Sampler
        let linear_sampler = device.create_sampler(&SamplerDescriptor {
            label: Some("Linear Sampler"),
            mag_filter: FilterMode::Linear,
            min_filter: FilterMode::Linear,
            mipmap_filter: FilterMode::Linear,
            ..Default::default()
        });

        // Vertex buffer layout for triangles/lines (position + color)
        let vertex_layout = VertexBufferLayout {
            array_stride: 6 * 4, // 6 floats: x, y, r, g, b, a
            step_mode: VertexStepMode::Vertex,
            attributes: &[
                VertexAttribute {
                    format: VertexFormat::Float32x2,
                    offset: 0,
                    shader_location: 0,
                },
                VertexAttribute {
                    format: VertexFormat::Float32x4,
                    offset: 8,
                    shader_location: 1,
                },
            ],
        };

        // Vertex buffer layout for text (position + uv + color)
        let text_vertex_layout = VertexBufferLayout {
            array_stride: 8 * 4, // 8 floats: x, y, u, v, r, g, b, a
            step_mode: VertexStepMode::Vertex,
            attributes: &[
                VertexAttribute {
                    format: VertexFormat::Float32x2,
                    offset: 0,
                    shader_location: 0,
                },
                VertexAttribute {
                    format: VertexFormat::Float32x2,
                    offset: 8,
                    shader_location: 1,
                },
                VertexAttribute {
                    format: VertexFormat::Float32x4,
                    offset: 16,
                    shader_location: 2,
                },
            ],
        };

        // Create pipelines
        let triangle_pipeline_layout = device.create_pipeline_layout(&PipelineLayoutDescriptor {
            label: Some("Triangle Pipeline Layout"),
            bind_group_layouts: &[&matrix_bind_group_layout],
            push_constant_ranges: &[],
        });

        let triangle_pipeline = device.create_render_pipeline(&RenderPipelineDescriptor {
            label: Some("Triangle Pipeline"),
            layout: Some(&triangle_pipeline_layout),
            vertex: VertexState {
                module: &triangle_shader,
                entry_point: Some("vs_main"),
                buffers: std::slice::from_ref(&vertex_layout),
                compilation_options: Default::default(),
            },
            fragment: Some(FragmentState {
                module: &triangle_shader,
                entry_point: Some("fs_main"),
                targets: &[Some(ColorTargetState {
                    format: target_format,
                    blend: Some(BlendState::ALPHA_BLENDING),
                    write_mask: ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: PrimitiveState {
                topology: PrimitiveTopology::TriangleList,
                ..Default::default()
            },
            depth_stencil: None,
            multisample: MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        let line_pipeline = device.create_render_pipeline(&RenderPipelineDescriptor {
            label: Some("Line Pipeline"),
            layout: Some(&triangle_pipeline_layout),
            vertex: VertexState {
                module: &line_shader,
                entry_point: Some("vs_main"),
                buffers: &[vertex_layout],
                compilation_options: Default::default(),
            },
            fragment: Some(FragmentState {
                module: &line_shader,
                entry_point: Some("fs_main"),
                targets: &[Some(ColorTargetState {
                    format: target_format,
                    blend: Some(BlendState::ALPHA_BLENDING),
                    write_mask: ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: PrimitiveState {
                topology: PrimitiveTopology::LineList,
                ..Default::default()
            },
            depth_stencil: None,
            multisample: MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        let text_pipeline_layout = device.create_pipeline_layout(&PipelineLayoutDescriptor {
            label: Some("Text Pipeline Layout"),
            bind_group_layouts: &[&text_bind_group_layout],
            push_constant_ranges: &[],
        });

        let text_pipeline = device.create_render_pipeline(&RenderPipelineDescriptor {
            label: Some("Text Pipeline"),
            layout: Some(&text_pipeline_layout),
            vertex: VertexState {
                module: &text_shader,
                entry_point: Some("vs_main"),
                buffers: std::slice::from_ref(&text_vertex_layout),
                compilation_options: Default::default(),
            },
            fragment: Some(FragmentState {
                module: &text_shader,
                entry_point: Some("fs_main"),
                targets: &[Some(ColorTargetState {
                    format: target_format,
                    blend: Some(BlendState::ALPHA_BLENDING),
                    write_mask: ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: PrimitiveState {
                topology: PrimitiveTopology::TriangleList,
                ..Default::default()
            },
            depth_stencil: None,
            multisample: MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        let sprite_pipeline = device.create_render_pipeline(&RenderPipelineDescriptor {
            label: Some("Sprite Pipeline"),
            layout: Some(&text_pipeline_layout),
            vertex: VertexState {
                module: &sprite_shader,
                entry_point: Some("vs_main"),
                buffers: &[text_vertex_layout],
                compilation_options: Default::default(),
            },
            fragment: Some(FragmentState {
                module: &sprite_shader,
                entry_point: Some("fs_main"),
                targets: &[Some(ColorTargetState {
                    format: target_format,
                    blend: Some(BlendState::ALPHA_BLENDING),
                    write_mask: ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: PrimitiveState {
                topology: PrimitiveTopology::TriangleList,
                ..Default::default()
            },
            depth_stencil: None,
            multisample: MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        Self {
            triangle_pipeline,
            line_pipeline,
            text_pipeline,
            sprite_pipeline,
            matrix_bind_group_layout,
            text_bind_group_layout,
            linear_sampler,
        }
    }

    pub fn draw_triangles<'a>(
        &'a self,
        pass: &mut RenderPass<'a>,
        device: &Device,
        _queue: &Queue,
        vertices: &[f32],
        matrix: &[f32; 16],
    ) {
        let vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Triangle Vertex Buffer"),
            contents: bytemuck::cast_slice(vertices),
            usage: BufferUsages::VERTEX,
        });

        let matrix_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Matrix Buffer"),
            contents: bytemuck::cast_slice(matrix),
            usage: BufferUsages::UNIFORM,
        });

        let bind_group = device.create_bind_group(&BindGroupDescriptor {
            label: Some("Matrix Bind Group"),
            layout: &self.matrix_bind_group_layout,
            entries: &[BindGroupEntry {
                binding: 0,
                resource: matrix_buffer.as_entire_binding(),
            }],
        });

        pass.set_pipeline(&self.triangle_pipeline);
        pass.set_bind_group(0, &bind_group, &[]);
        pass.set_vertex_buffer(0, vertex_buffer.slice(..));
        pass.draw(0..(vertices.len() / 6) as u32, 0..1);
    }

    pub fn draw_lines<'a>(
        &'a self,
        pass: &mut RenderPass<'a>,
        device: &Device,
        _queue: &Queue,
        vertices: &[f32],
        matrix: &[f32; 16],
    ) {
        let vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Line Vertex Buffer"),
            contents: bytemuck::cast_slice(vertices),
            usage: BufferUsages::VERTEX,
        });

        let matrix_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Matrix Buffer"),
            contents: bytemuck::cast_slice(matrix),
            usage: BufferUsages::UNIFORM,
        });

        let bind_group = device.create_bind_group(&BindGroupDescriptor {
            label: Some("Matrix Bind Group"),
            layout: &self.matrix_bind_group_layout,
            entries: &[BindGroupEntry {
                binding: 0,
                resource: matrix_buffer.as_entire_binding(),
            }],
        });

        pass.set_pipeline(&self.line_pipeline);
        pass.set_bind_group(0, &bind_group, &[]);
        pass.set_vertex_buffer(0, vertex_buffer.slice(..));
        pass.draw(0..(vertices.len() / 6) as u32, 0..1);
    }

    #[allow(clippy::too_many_arguments)]
    pub fn draw_text<'a>(
        &'a self,
        pass: &mut RenderPass<'a>,
        device: &Device,
        _queue: &Queue,
        vertices: &[f32],
        indices: &[u32],
        texture_view: &'a TextureView,
        matrix: &[f32; 16],
        scale: f32,
        font_scale: f32,
        distance_range: f32,
    ) {
        let vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Text Vertex Buffer"),
            contents: bytemuck::cast_slice(vertices),
            usage: BufferUsages::VERTEX,
        });

        let index_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Text Index Buffer"),
            contents: bytemuck::cast_slice(indices),
            usage: BufferUsages::INDEX,
        });

        // Uniforms: matrix (64 bytes) + scale, font_scale, distance_range, padding (16 bytes)
        let mut uniform_data = [0u8; 80];
        uniform_data[..64].copy_from_slice(bytemuck::cast_slice(matrix));
        uniform_data[64..68].copy_from_slice(&scale.to_le_bytes());
        uniform_data[68..72].copy_from_slice(&font_scale.to_le_bytes());
        uniform_data[72..76].copy_from_slice(&distance_range.to_le_bytes());

        let uniform_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Text Uniform Buffer"),
            contents: &uniform_data,
            usage: BufferUsages::UNIFORM,
        });

        let bind_group = device.create_bind_group(&BindGroupDescriptor {
            label: Some("Text Bind Group"),
            layout: &self.text_bind_group_layout,
            entries: &[
                BindGroupEntry {
                    binding: 0,
                    resource: uniform_buffer.as_entire_binding(),
                },
                BindGroupEntry {
                    binding: 1,
                    resource: BindingResource::TextureView(texture_view),
                },
                BindGroupEntry {
                    binding: 2,
                    resource: BindingResource::Sampler(&self.linear_sampler),
                },
            ],
        });

        pass.set_pipeline(&self.text_pipeline);
        pass.set_bind_group(0, &bind_group, &[]);
        pass.set_vertex_buffer(0, vertex_buffer.slice(..));
        pass.set_index_buffer(index_buffer.slice(..), IndexFormat::Uint32);
        pass.draw_indexed(0..indices.len() as u32, 0, 0..1);
    }

    #[allow(clippy::too_many_arguments)]
    pub fn draw_sprites<'a>(
        &'a self,
        pass: &mut RenderPass<'a>,
        device: &Device,
        _queue: &Queue,
        vertices: &[f32],
        indices: &[u32],
        texture_view: &'a TextureView,
        matrix: &[f32; 16],
    ) {
        let vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Sprite Vertex Buffer"),
            contents: bytemuck::cast_slice(vertices),
            usage: BufferUsages::VERTEX,
        });

        let index_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Sprite Index Buffer"),
            contents: bytemuck::cast_slice(indices),
            usage: BufferUsages::INDEX,
        });

        // Uniforms: just matrix for sprites
        let mut uniform_data = [0u8; 80];
        uniform_data[..64].copy_from_slice(bytemuck::cast_slice(matrix));

        let uniform_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Sprite Uniform Buffer"),
            contents: &uniform_data,
            usage: BufferUsages::UNIFORM,
        });

        let bind_group = device.create_bind_group(&BindGroupDescriptor {
            label: Some("Sprite Bind Group"),
            layout: &self.text_bind_group_layout,
            entries: &[
                BindGroupEntry {
                    binding: 0,
                    resource: uniform_buffer.as_entire_binding(),
                },
                BindGroupEntry {
                    binding: 1,
                    resource: BindingResource::TextureView(texture_view),
                },
                BindGroupEntry {
                    binding: 2,
                    resource: BindingResource::Sampler(&self.linear_sampler),
                },
            ],
        });

        pass.set_pipeline(&self.sprite_pipeline);
        pass.set_bind_group(0, &bind_group, &[]);
        pass.set_vertex_buffer(0, vertex_buffer.slice(..));
        pass.set_index_buffer(index_buffer.slice(..), IndexFormat::Uint32);
        pass.draw_indexed(0..indices.len() as u32, 0, 0..1);
    }
}
