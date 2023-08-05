import { Mesh, Point, Texture } from 'pixi.js';

export interface PageMeshData {
  fontName: string;
  fontSize: number;
  index: number;
  indexCount: number;
  vertexCount: number;
  uvsCount: number;
  total: number;
  mesh: Mesh;
  vertices?: Float32Array;
  uvs?: Float32Array;
  indices?: Uint16Array;
  colors?: Float32Array;
}

export interface CharRenderData {
  texture: Texture;
  line: number;
  charCode: number;
  position: Point;
  prevSpaces: number;
}
