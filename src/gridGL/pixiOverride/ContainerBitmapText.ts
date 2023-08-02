import {
  BLEND_MODES,
  BitmapFont,
  Container,
  Mesh,
  MeshGeometry,
  MeshMaterial,
  Program,
  Renderer,
  Texture,
} from 'pixi.js';
import { CellLabel } from '../cells/CellLabel';
import { msdfFrag, msdfVert } from './shader';

interface PageMeshData {
  index: number;
  indexCount: number;
  vertexCount: number;
  uvsCount: number;
  total: number;
  mesh: Mesh;
  fontName: string;
  fontSize: number;
  vertices?: Float32Array;
  uvs?: Float32Array;
  indices?: Uint16Array;
}

export class ContainerBitmapText extends Container {
  private textureCache: Texture[] = [];
  cellLabels: CellLabel[];

  // this is used to render all bitmapText within this region
  private finalBitmapText: Container;
  private pagesMeshData: Record<number, PageMeshData> = {};

  dirty = true;

  constructor() {
    super();
    this.cellLabels = [];
    this.finalBitmapText = this.addChild(new Container());
  }

  addLabel(label: CellLabel): CellLabel {
    this.cellLabels.push(label);
    return label;
  }

  render(renderer: Renderer) {
    // if the object is not visible or the alpha is 0 then no need to render this element
    if (!this.visible || this.worldAlpha <= 0 || !this.renderable) {
      return;
    }

    if (this.dirty) {
      this.dirty = false;
      this.updateText();
    }

    // Inject the shader code with the correct value
    const { a, b, c, d } = this.transform.worldTransform;

    const dx = Math.sqrt(a * a + b * b);
    const dy = Math.sqrt(c * c + d * d);
    const worldScale = (Math.abs(dx) + Math.abs(dy)) / 2;

    const resolution = renderer.resolution;

    for (const id in this.pagesMeshData) {
      const pagesMeshData = this.pagesMeshData[id];
      const { distanceFieldRange, size } = BitmapFont.available[pagesMeshData.fontName];
      const fontScale = pagesMeshData.fontSize / size;
      pagesMeshData.mesh.shader.uniforms.uFWidth = worldScale * distanceFieldRange * fontScale * resolution;
    }
    this.finalBitmapText.render(renderer);
  }

  public updateText(): void {
    this.finalBitmapText.removeChildren();

    this.cellLabels.forEach((child) => child.updateText());
    this.pagesMeshData = {};

    this.cellLabels.forEach((cellLabel) => {
      const lenChars = cellLabel.chars.length;

      for (let i = 0; i < lenChars; i++) {
        const texture = cellLabel.chars[i].texture;
        const baseTextureUid = texture.baseTexture.uid;

        let pageMeshData = this.pagesMeshData[baseTextureUid];
        if (!pageMeshData) {
          const geometry = new MeshGeometry();
          let material: MeshMaterial;
          let meshBlendMode: BLEND_MODES;

          material = new MeshMaterial(Texture.EMPTY, {
            program: Program.from(msdfVert, msdfFrag),
            uniforms: { uFWidth: 0 },
          });
          meshBlendMode = BLEND_MODES.NORMAL_NPM;

          const mesh = new Mesh(geometry, material);

          mesh.blendMode = meshBlendMode;

          const pageMeshData = {
            fontName: cellLabel.fontName,
            fontSize: cellLabel.fontSize,
            index: 0,
            indexCount: 0,
            vertexCount: 0,
            uvsCount: 0,
            total: 0,
            mesh,
            vertices: undefined,
            uvs: undefined,
            indices: undefined,
          };

          this.textureCache[baseTextureUid] = this.textureCache[baseTextureUid] || new Texture(texture.baseTexture);
          pageMeshData.mesh.texture = this.textureCache[baseTextureUid];
          this.pagesMeshData[baseTextureUid] = pageMeshData;
          this.finalBitmapText.addChild(pageMeshData.mesh);

          // todo: can't tint -- will need to have separate batches based on tinting.... :(
          pageMeshData.mesh.tint = 0; //this.tint;
        }

        this.pagesMeshData[baseTextureUid].total++;
      }
    });

    for (const id in this.pagesMeshData) {
      const pageMeshData = this.pagesMeshData[id];
      const total = pageMeshData.total;
      pageMeshData.vertices = new Float32Array(4 * 2 * total);
      pageMeshData.uvs = new Float32Array(4 * 2 * total);
      pageMeshData.indices = new Uint16Array(6 * total);

      // as a buffer maybe bigger than the current word, we set the size of the meshMaterial
      // to match the number of letters needed
      pageMeshData.mesh.size = 6 * total;
    }

    this.cellLabels.forEach((cellLabel) => cellLabel.updatePageMesh(this.pagesMeshData));

    for (const id in this.pagesMeshData) {
      const pageMeshData = this.pagesMeshData[id];

      // cellLabel.maxLineHeight = maxLineHeight * scale;

      const vertexBuffer = pageMeshData.mesh.geometry.getBuffer('aVertexPosition');
      const textureBuffer = pageMeshData.mesh.geometry.getBuffer('aTextureCoord');
      const indexBuffer = pageMeshData.mesh.geometry.getIndex();

      vertexBuffer.data = pageMeshData.vertices!;
      textureBuffer.data = pageMeshData.uvs!;
      indexBuffer.data = pageMeshData.indices!;

      vertexBuffer.update();
      textureBuffer.update();
      indexBuffer.update();
    }
  }
}
