import { Rectangle } from 'pixi.js';
import { GridRenderDependency } from '../GridRenderDependency';

describe('gridOffsets', () => {
  let gridRenderDependency: GridRenderDependency;

  beforeEach(() => {
    gridRenderDependency = new GridRenderDependency();
  });

  it('adds a new cell dependency', () => {
    expect(gridRenderDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }])?.length).toBe(2);
    expect(gridRenderDependency.getDependents({ x: 1, y: 2 })?.length).toBe(0);
    expect(gridRenderDependency.getDependents({ x: 2, y: 2 })).toEqual([{ x: 1, y: 2 }]);
    expect(gridRenderDependency.getDependents({ x: 3, y: 2 })).toEqual([{ x: 1, y: 2 }]);
    expect(gridRenderDependency.getDependents({ x: 4, y: 2 })?.length).toBe(undefined);
    expect(gridRenderDependency.getChangedCells({ x: 1, y: 2 })).toEqual([{ x: 2, y: 2 }, { x: 3, y: 2 }]);
  });

  it('removes a cell dependency', () => {
    gridRenderDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }]);
    expect(gridRenderDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }])?.length).toBe(1);
    expect(gridRenderDependency.getDependents({ x: 1, y: 2 })?.length).toBe(0);
    expect(gridRenderDependency.getDependents({ x: 2, y: 2 })?.length).toBe(1);
    expect(gridRenderDependency.getDependents({ x: 3, y: 2 })?.length).toBe(0);
    expect(gridRenderDependency.getDependents({ x: 4, y: 2 })?.length).toBe(undefined);
    expect(gridRenderDependency.getChangedCells({ x: 1, y: 2 })?.length).toBe(1);
  });

  it('adds a cell dependency', () => {
    gridRenderDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }]);
    expect(gridRenderDependency.update({ x: 1, y: 2 }, [{ x: 3, y: 2 }, { x: 4, y: 2 }])?.length).toBe(2);
    expect(gridRenderDependency.getDependents({ x: 1, y: 2 })?.length).toBe(0);
    expect(gridRenderDependency.getDependents({ x: 2, y: 2 })?.length).toBe(0);
    expect(gridRenderDependency.getDependents({ x: 3, y: 2 })?.length).toBe(1);
    expect(gridRenderDependency.getDependents({ x: 4, y: 2 })?.length).toBe(1);
    expect(gridRenderDependency.getDependents({ x: 5, y: 2 })?.length).toBe(undefined);
    expect(gridRenderDependency.getChangedCells({ x: 1, y: 2 })?.length).toBe(2);
  });

  it('clears cell dependencies', () => {
    gridRenderDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }]);
    expect(gridRenderDependency.empty({ x: 1, y: 2 })?.length).toBe(2);
    expect(gridRenderDependency.getDependents({ x: 1, y: 2 })?.length).toBe(0);
    expect(gridRenderDependency.getDependents({ x: 2, y: 2 })?.length).toBe(0);
    expect(gridRenderDependency.getDependents({ x: 3, y: 2 })?.length).toBe(0);
    expect(gridRenderDependency.getDependents({ x: 4, y: 2 })?.length).toBe(undefined);
    expect(gridRenderDependency.getChangedCells({ x: 1, y: 2 })?.length).toBe(0);
  });

  it('saves cell dependencies', () => {
    gridRenderDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }]);
    expect(JSON.stringify(gridRenderDependency.save())).toBe("[{\"location\":{\"x\":2,\"y\":2},\"needToRender\":[{\"x\":1,\"y\":2}],\"renderThisCell\":[]},{\"location\":{\"x\":3,\"y\":2},\"needToRender\":[{\"x\":1,\"y\":2}],\"renderThisCell\":[]},{\"location\":{\"x\":1,\"y\":2},\"needToRender\":[],\"renderThisCell\":[{\"x\":2,\"y\":2},{\"x\":3,\"y\":2}]}]");
  });

  it('clears all cell dependencies', () => {
    gridRenderDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }]);
    gridRenderDependency.clear();
    expect(gridRenderDependency.getDependents({ x: 1, y: 2 })?.length).toBe(undefined);
    expect(gridRenderDependency.getDependents({ x: 2, y: 2 })?.length).toBe(undefined);
    expect(gridRenderDependency.getDependents({ x: 3, y: 2 })?.length).toBe(undefined);
    expect(gridRenderDependency.getDependents({ x: 4, y: 2 })?.length).toBe(undefined);
    expect(gridRenderDependency.getChangedCells({ x: 1, y: 2 })?.length).toBe(undefined);
  });

  it('loads cell dependencies', () => {
    gridRenderDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }]);
    const save = gridRenderDependency.save();
    gridRenderDependency.clear();
    gridRenderDependency.load(save);
    expect(gridRenderDependency.getDependents({ x: 1, y: 2 })?.length).toBe(0);
    expect(gridRenderDependency.getDependents({ x: 2, y: 2 })?.length).toBe(1);
    expect(gridRenderDependency.getDependents({ x: 3, y: 2 })?.length).toBe(1);
    expect(gridRenderDependency.getDependents({ x: 4, y: 2 })?.length).toBe(undefined);
    expect(gridRenderDependency.getChangedCells({ x: 1, y: 2 })?.length).toBe(2);
  });

  it('does not have multiples of the same dependency', () => {
    gridRenderDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }]);
    expect(gridRenderDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }])?.length).toBe(0);
    expect(gridRenderDependency.getDependents({ x: 1, y: 2 })?.length).toBe(0);
    expect(gridRenderDependency.getDependents({ x: 2, y: 2 })?.length).toBe(1);
    expect(gridRenderDependency.getDependents({ x: 3, y: 2 })?.length).toBe(1);
    expect(gridRenderDependency.getDependents({ x: 4, y: 2 })?.length).toBe(undefined);
    expect(gridRenderDependency.getChangedCells({ x: 1, y: 2 })?.length).toBe(2);
  });

  it('gets dependency within bounds', () => {
    gridRenderDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }]);
    gridRenderDependency.update({ x: 1, y: 3 }, [{ x: 2, y: 3 }]);
    expect(gridRenderDependency.getDependentsInBounds(new Rectangle(1, 2, 0, 0))?.length).toBe(0);
    expect(gridRenderDependency.getDependentsInBounds(new Rectangle(1, 2, 0, 1))?.length).toBe(0);
    expect(gridRenderDependency.getDependentsInBounds(new Rectangle(0, 0, 0, 1))?.length).toBe(0);
    expect(gridRenderDependency.getDependentsInBounds(new Rectangle(2, 2, 0, 1))?.length).toBe(2);
    gridRenderDependency.update({ x: 2, y: 2 }, [{ x: 3, y: 2 }, { x: 4, y: 2 }]);
    expect(gridRenderDependency.getDependentsInBounds(new Rectangle(4, 2, 0, 0))?.length).toBe(1);
  })
});
