# Description of how we render text in the Grid

Each `Sheet` within the `Grid` is rendered independently.

## Summary of text rendering

The `CellsSheet` contains a `CellsLabels`, which is responsible for all text
rendering for a `Sheet`. Text rendering is the most expensive part of rendering
the Grid. The following is a description of the optimizations we've been to
improve the rendering performance.

Note: `CellsLabels` is responsible for rendering individual glyphs that contain
the font, style (eg, bold and italic), and text color. Text background is
separately rendered in the `CellsFills` object.

## How CellsLabels renders

### CellsLabels

Each `CellsLabels` is divided into hashes that contain, among other things, blocks
of text. As of this writing, the hashes are set at:

```ts
export const sheetHashWidth = 15;
export const sheetHashHeight = 30;
```

This means that all text within a 15x30 cell range will be batched together for
efficiently rendering.

`CellsLabels` is the parent of `CellsTextHash`.

### CellsTextHash

A `CellsTextHash` is created for each hashed region that contains text.
`CellsTextHash` includes bounds for that region: view bounds, column/row bounds,
and bounds that contains actual glyphs. These are used for culling, user
interaction, etc.

The `CellsTextHash` contains `CellLabel` data, and uses `LabelMeshes` to render
those labels.

### CellLabel

A `CellLabel` contains the data necessary to render an individual cell within
the Grid. It is never rendered but instead populates LabelMeshes that are
rendered by `CellsTextHash`.

The CellLabel is responsible for calculating the position and style of
each glyph within the cell's text. It is also responsible for tracking any
overflow of the cell's text. It also populates the buffers for the relevant
LabelMeshes based on this data.

### LabelMeshes

`LabelMeshes` is a container for the `LabelMesh` objects.

### LabelMesh

`LabelMesh` is a container that holds a specific font/style combination of text.

Where needed there will be two LabelMesh objects for the same font/style: one
that includes color information, and one without color information because we
need to track color information per vertex, which can get moderately expensive.

### LabelMeshEntry

`LabelMeshEntry` is what is actually rendered by the GPU. It ties together the
geometry, shader, and material necessary to render glyphs to the GPU. There may
be multiple LabelMeshEntry for the same font/style/color combination to ensure
the GPU buffer sizes do not grow too large.

## Text clipping

TODO: write Description here...

## GPU Shaders

Each `LabelMeshEntry` is rendered to the GPU using MSDL (see
https://medium.com/@calebfaith/implementing-msdf-font-in-opengl-ea09a9ab7e00 for
a description).

The `cellLabelShader.ts` and `cellLabelShaderTint.ts` contain the shader code.
We separately render text that needs a color from black text. This reduces the
amount of data we need to send to the renderer since text with a tint requires a
three separate color entries for each vertex.

TODO: we can probably use a color map instead of sending individual color values
to further reduce the amount of data for tinted glyphs.
