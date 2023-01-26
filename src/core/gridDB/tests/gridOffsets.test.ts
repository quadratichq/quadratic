import { CELL_HEIGHT, CELL_WIDTH } from '../../../constants/gridConstants';
import { GridOffsets, HeadingResizing } from '../GridOffsets';

describe('gridOffsets', () => {
  let gridOffsets: GridOffsets;

  beforeEach(() => {
    gridOffsets = new GridOffsets();
  });

  it('populates rows and columns', () => {
    gridOffsets.populate(
      [{ id: 3, size: 10 }],
      [
        { id: 4, size: 5 },
        { id: 5, size: 6 },
      ]
    );
    const { rows, columns } = gridOffsets.debugRowsColumns();
    expect(columns.length).toBe(1);
    expect(rows.length).toBe(2);
    // expect(app.gridLines.dirty).toBe(true);
    // expect(app.headings.dirty).toBe(true);
    // expect(app.cursor.dirty).toBe(true);
  });

  it('gets column default width', () => {
    gridOffsets.populate([], []);
    expect(gridOffsets.getColumnWidth(0)).toBe(CELL_WIDTH);
  });

  it('gets column width', () => {
    gridOffsets.populate([{ id: 3, size: 10 }], []);
    expect(gridOffsets.getColumnWidth(3)).toBe(10);
  });

  it('gets column width w/headingResize', () => {
    gridOffsets.populate([{ id: 3, size: 10 }], []);
    gridOffsets.headingResizing = { column: 3, width: 15 } as any as HeadingResizing;
    expect(gridOffsets.getColumnWidth(3)).toBe(15);
  });

  it('gets row default height', () => {
    gridOffsets.populate([], []);
    expect(gridOffsets.getRowHeight(0)).toBe(CELL_HEIGHT);
  });

  it('gets row height', () => {
    gridOffsets.populate([], [{ id: 3, size: 10 }]);
    expect(gridOffsets.getRowHeight(3)).toBe(10);
  });

  it('gets row height w/headingResize', () => {
    gridOffsets.populate([], [{ id: 3, size: 10 }]);
    gridOffsets.headingResizing = { row: 3, height: 15 } as any as HeadingResizing;
    expect(gridOffsets.getRowHeight(3)).toBe(15);
  });

  it('gets the start and end of a range of columns (positive to positive)', () => {
    gridOffsets.populate(
      [
        { id: 1, size: 5 },
        { id: 2, size: 6 },
        { id: 3, size: 7 },
      ],
      []
    );
    const { xStart, xEnd } = gridOffsets.getColumnsStartEnd(0, 5);
    expect(xStart).toBe(0);
    expect(xEnd).toBe(CELL_WIDTH + 5 + 6 + 7 + CELL_WIDTH - 1);
  });

  it('gets the start and end of a range of columns (negative to 0)', () => {
    gridOffsets.populate(
      [
        { id: -1, size: 5 },
        { id: -2, size: 6 },
        { id: -3, size: 7 },
      ],
      []
    );
    const { xStart, xEnd } = gridOffsets.getColumnsStartEnd(-5, 5);
    expect(xStart).toBe(-(5 + 6 + 7 + CELL_WIDTH * 2));
    expect(xEnd).toBe(-1);
  });

  it('gets the start and end of a range of columns (negative to negative)', () => {
    gridOffsets.populate(
      [
        { id: -1, size: 5 },
        { id: -2, size: 6 },
        { id: -3, size: 7 },
      ],
      []
    );
    const { xStart, xEnd } = gridOffsets.getColumnsStartEnd(-5, 3);
    expect(xStart).toBe(-(CELL_WIDTH * 2 + 5 + 6 + 7));
    expect(xEnd).toBe(-5 - 1);
  });

  it('gets the start and end of a range of columns (negative) to < 0', () => {
    gridOffsets.populate(
      [
        { id: -1, size: 5 },
        { id: -2, size: 6 },
        { id: -3, size: 7 },
      ],
      []
    );
    const { xStart, xEnd } = gridOffsets.getColumnsStartEnd(-5, 4);
    expect(xStart).toBe(-(CELL_WIDTH + CELL_WIDTH + 7 + 6 + 5));
    expect(xEnd).toBe(-1);
  });

  it('gets the start and end of a range of columns (negative) to > 0', () => {
    gridOffsets.populate(
      [
        { id: -1, size: 5 },
        { id: -2, size: 6 },
        { id: -3, size: 7 },
        { id: 0, size: 4 },
      ],
      []
    );
    const { xStart, xEnd } = gridOffsets.getColumnsStartEnd(-5, 7);
    expect(xStart).toBe(-(CELL_WIDTH + CELL_WIDTH + 7 + 6 + 5));
    expect(xEnd).toBe(4 + CELL_WIDTH - 1);
  });

  it('gets the start and end of a range of columns (rows to negative)', () => {
    gridOffsets.populate(
      [],
      [
        { id: -1, size: 5 },
        { id: -2, size: 6 },
        { id: -3, size: 7 },
      ]
    );
    const { yStart, yEnd } = gridOffsets.getRowsStartEnd(-5, 3);
    expect(yStart).toBe(-(CELL_HEIGHT * 2 + 5 + 6 + 7));
    expect(yEnd).toBe(-5 - 1);
  });

  it('gets the start and end of a range of row (positive)', () => {
    gridOffsets.populate(
      [],
      [
        { id: 1, size: 5 },
        { id: 2, size: 6 },
        { id: 3, size: 7 },
      ]
    );
    const { yStart, yEnd } = gridOffsets.getRowsStartEnd(0, 5);
    expect(yStart).toBe(0);
    expect(yEnd).toBe(CELL_HEIGHT + 5 + 6 + 7 + CELL_HEIGHT - 1);
  });

  it('gets the start and end of a range of rows (negative) to 0', () => {
    gridOffsets.populate(
      [],
      [
        { id: -1, size: 5 },
        { id: -2, size: 6 },
        { id: -3, size: 7 },
      ]
    );
    const { yStart, yEnd } = gridOffsets.getRowsStartEnd(-5, 5);
    expect(yStart).toBe(-(CELL_HEIGHT + 5 + 6 + 7 + CELL_HEIGHT));
    expect(yEnd).toBe(-1);
  });

  it('gets the start and end of a range of rows (negative) to < 0', () => {
    gridOffsets.populate(
      [],
      [
        { id: -1, size: 5 },
        { id: -2, size: 6 },
        { id: -3, size: 7 },
      ]
    );
    const { yStart, yEnd } = gridOffsets.getRowsStartEnd(-5, 4);
    expect(yStart).toBe(-(CELL_HEIGHT + CELL_HEIGHT + 7 + 6 + 5));
    expect(yEnd).toBe(-1);
  });

  it('gets the start and end of a range of rows (negative) to > 0', () => {
    gridOffsets.populate(
      [],
      [
        { id: -1, size: 5 },
        { id: -2, size: 6 },
        { id: -3, size: 7 },
        { id: 0, size: 4 },
      ]
    );
    const { yStart, yEnd } = gridOffsets.getRowsStartEnd(-5, 7);
    expect(yStart).toBe(-(CELL_HEIGHT + CELL_HEIGHT + 7 + 6 + 5));
    expect(yEnd).toBe(4 + CELL_HEIGHT - 1);
  });
});
