# Description of how the text in the Grid renders

## Summary of text rendering

Each **Sheet** is divided into hashes that contain, among other things, blocks
of text. The text is rendered using MDSL (see
https://medium.com/@calebfaith/implementing-msdf-font-in-opengl-ea09a9ab7e00 for
a description). As of this writing, the hashes are set at:

```ts
export const sheetHashWidth = 15;
export const sheetHashHeight = 30;
```

This means that all text within a 15x30 cell range will be rendered in one or
more passes (see below for why there may be more than one).

## How the classes are organized

### CellsSheet

CellsSheet holds `this.cellsTextHashContainer`. This is where all data for

CellsTextHash is the parent container for all text of cells in a hashed region of the sheet.
