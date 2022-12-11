import { GridDependency } from '../GridDependency';

describe('gridOffsets', () => {
  let gridDependency: GridDependency;

  beforeEach(() => {
    gridDependency = new GridDependency();
  });

  it('adds a new cell dependency', () => {
    expect(gridDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }])?.length).toBe(2);
    expect(gridDependency.getDependents({ x: 1, y: 2 })?.length).toBe(0);
    expect(gridDependency.getDependents({ x: 2, y: 2 })?.length).toBe(1);
    expect(gridDependency.getDependents({ x: 3, y: 2 })?.length).toBe(1);
    expect(gridDependency.getDependents({ x: 4, y: 2 })?.length).toBe(undefined);
    expect(gridDependency.getChangedCells({ x: 1, y: 2 })?.length).toBe(2);
  });

  it('removes a cell dependency', () => {
    gridDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }]);
    expect(gridDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }])?.length).toBe(1);
    expect(gridDependency.getDependents({ x: 1, y: 2 })?.length).toBe(0);
    expect(gridDependency.getDependents({ x: 2, y: 2 })?.length).toBe(1);
    expect(gridDependency.getDependents({ x: 3, y: 2 })?.length).toBe(0);
    expect(gridDependency.getDependents({ x: 4, y: 2 })?.length).toBe(undefined);
    expect(gridDependency.getChangedCells({ x: 1, y: 2 })?.length).toBe(1);
  });

  it('adds a cell dependency', () => {
    gridDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }]);
    expect(gridDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }])?.length).toBe(1);
    expect(gridDependency.getDependents({ x: 1, y: 2 })?.length).toBe(0);
    expect(gridDependency.getDependents({ x: 2, y: 2 })?.length).toBe(1);
    expect(gridDependency.getDependents({ x: 3, y: 2 })?.length).toBe(1);
    expect(gridDependency.getDependents({ x: 4, y: 2 })?.length).toBe(1);
    expect(gridDependency.getDependents({ x: 5, y: 2 })?.length).toBe(undefined);
    expect(gridDependency.getChangedCells({ x: 1, y: 2 })?.length).toBe(3);
  });

  it('clears cell dependencies', () => {
    gridDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }]);
    expect(gridDependency.empty({ x: 1, y: 2 })?.length).toBe(2);
    expect(gridDependency.getDependents({ x: 1, y: 2 })?.length).toBe(0);
    expect(gridDependency.getDependents({ x: 2, y: 2 })?.length).toBe(0);
    expect(gridDependency.getDependents({ x: 3, y: 2 })?.length).toBe(0);
    expect(gridDependency.getDependents({ x: 4, y: 2 })?.length).toBe(undefined);
    expect(gridDependency.getChangedCells({ x: 1, y: 2 })?.length).toBe(0);
  });

  it('saves cell dependencies', () => {
    gridDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }]);
    expect(JSON.stringify(gridDependency.save())).toBe("[{\"location\":{\"x\":2,\"y\":2},\"needToRender\":[{\"x\":1,\"y\":2}],\"renderThisCell\":[]},{\"location\":{\"x\":3,\"y\":2},\"needToRender\":[{\"x\":1,\"y\":2}],\"renderThisCell\":[]},{\"location\":{\"x\":1,\"y\":2},\"needToRender\":[],\"renderThisCell\":[{\"x\":2,\"y\":2},{\"x\":3,\"y\":2}]}]");
  });

  it('clears all cell dependencies', () => {
    gridDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }]);
    gridDependency.clear();
    expect(gridDependency.getDependents({ x: 1, y: 2 })?.length).toBe(undefined);
    expect(gridDependency.getDependents({ x: 2, y: 2 })?.length).toBe(undefined);
    expect(gridDependency.getDependents({ x: 3, y: 2 })?.length).toBe(undefined);
    expect(gridDependency.getDependents({ x: 4, y: 2 })?.length).toBe(undefined);
    expect(gridDependency.getChangedCells({ x: 1, y: 2 })?.length).toBe(undefined);
  });

  it('loads cell dependencies', () => {
    gridDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }]);
    const save = gridDependency.save();
    gridDependency.clear();
    gridDependency.load(save);
    expect(gridDependency.getDependents({ x: 1, y: 2 })?.length).toBe(0);
    expect(gridDependency.getDependents({ x: 2, y: 2 })?.length).toBe(1);
    expect(gridDependency.getDependents({ x: 3, y: 2 })?.length).toBe(1);
    expect(gridDependency.getDependents({ x: 4, y: 2 })?.length).toBe(undefined);
    expect(gridDependency.getChangedCells({ x: 1, y: 2 })?.length).toBe(2);
  });

  it('does not have multiples of the same dependency', () => {
    gridDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }]);
    expect(gridDependency.update({ x: 1, y: 2 }, [{ x: 2, y: 2 }, { x: 3, y: 2 }])?.length).toBe(0);
    expect(gridDependency.getDependents({ x: 1, y: 2 })?.length).toBe(0);
    expect(gridDependency.getDependents({ x: 2, y: 2 })?.length).toBe(1);
    expect(gridDependency.getDependents({ x: 3, y: 2 })?.length).toBe(1);
    expect(gridDependency.getDependents({ x: 4, y: 2 })?.length).toBe(undefined);
    expect(gridDependency.getChangedCells({ x: 1, y: 2 })?.length).toBe(2);
  });
});
