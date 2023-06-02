import { Rectangle } from 'pixi.js';
import { Coordinate, coordinateEqual } from '../../gridGL/types/size';
import { Bounds } from './Bounds';
import { Quadrants } from '../../gridGL/quadrants/Quadrants';
import { intersects } from '../../gridGL/helpers/intersects';

interface Dependency {
  location: Coordinate;
  needToRender: Coordinate[];
  renderThisCell: Coordinate[];
}

export class GridRenderDependency {
  private dependents: Map<string, Dependency> = new Map();
  private bounds = new Bounds();

  // tracks which quadrants need to render based on GridSparse data
  quadrants = new Set<string>();

  clear(): void {
    this.dependents.clear();
    this.bounds.clear();
  }

  recalculateBounds(): void {
    this.bounds.clear();
    this.quadrants.clear();
    if (this.dependents.size === 0) return;
    this.dependents.forEach((dependent) => {
      this.bounds.addCoordinate(dependent.location);
      this.quadrants.add(Quadrants.getKey(dependent.location.x, dependent.location.y));
    });
  }

  private getKey(location: Coordinate): string {
    return `${location.x},${location.y}`;
  }

  empty(cell: Coordinate): Coordinate[] {
    const changes: Coordinate[] = [];
    const cellKey = this.getKey(cell);
    const originalDependency = this.dependents.get(cellKey);
    if (originalDependency) {
      // remove all cells that expect to renderThisCell
      originalDependency.renderThisCell.forEach((renderLocation) => {
        const renderKey = this.getKey(renderLocation);
        const renderDependency = this.dependents.get(renderKey);
        if (renderDependency) {
          const index = renderDependency.needToRender.findIndex((search) => coordinateEqual(search, cell));
          if (index !== -1) {
            renderDependency.needToRender.splice(index, 1);
            changes.push(renderLocation);
          }
        }
      });
      this.dependents.set(cellKey, { ...originalDependency, renderThisCell: [] });
    }
    this.recalculateBounds();
    return changes;
  }

  /**
   * changes a cell's dependents
   * @param cell
   * @param needToRender
   * @returns dependent cells that have changed
   */
  update(cell: Coordinate, renderThisCell: Coordinate[]): Coordinate[] {
    const changes: Coordinate[] = [];
    const cellKey = this.getKey(cell);
    const originalDependency = this.dependents.get(cellKey);

    // update an existing dependency for that cell
    if (originalDependency) {
      // remove needToRender entries for cells that are no longer dependents
      originalDependency.renderThisCell.forEach((entry) => {
        if (!renderThisCell.find((search) => coordinateEqual(search, entry))) {
          // remove needsToRender entry from those cells
          const remove = this.dependents.get(this.getKey(entry));
          if (remove) {
            const index = remove.needToRender.findIndex((search) => coordinateEqual(search, cell));
            if (index !== -1) {
              remove.needToRender.splice(index, 1);
              changes.push(entry);
            }
          }
        }
      });

      // add render entries for cells that are new dependents
      renderThisCell.forEach((entry) => {
        if (!originalDependency.renderThisCell.find((search) => coordinateEqual(search, entry))) {
          const keyEntry = this.getKey(entry);
          const add = this.dependents.get(keyEntry);
          if (add) {
            add.needToRender.push(cell);
          } else {
            this.dependents.set(keyEntry, { location: entry, needToRender: [cell], renderThisCell: [] });
          }
          changes.push(entry);
        }
      });
      this.dependents.set(cellKey, { ...originalDependency, renderThisCell });
    } else {
      // add render entries for cells that are dependents
      renderThisCell.forEach((entry) => {
        const entryKey = this.getKey(entry);
        const add = this.dependents.get(entryKey);
        if (add) {
          add.needToRender.push(cell);
        } else {
          this.dependents.set(entryKey, { location: entry, needToRender: [cell], renderThisCell: [] });
        }
        changes.push(entry);
      });
      this.dependents.set(cellKey, { location: cell, needToRender: [], renderThisCell });
    }

    this.recalculateBounds();
    return changes;
  }

  /**
   * Gets cells that need to render when rendering a cell
   * @param cell
   * @returns
   */
  getDependents(cell: Coordinate): Coordinate[] | undefined {
    if (!this.bounds.containsCoordinate(cell)) return;
    const entry = this.dependents.get(this.getKey(cell));
    if (entry) {
      return entry.needToRender;
    }
  }

  /** find all cell dependents that point to a cell that is inside the bounds */
  getDependentsInBounds(bounds: Rectangle): Coordinate[] {
    const coordinates = new Set<Coordinate>();
    this.dependents.forEach((dependent) => {
      const location = dependent.location;

      // first check that the dependent is within the full bounds
      if (
        location.x >= bounds.left &&
        location.x <= bounds.right &&
        location.y >= bounds.top &&
        location.y <= bounds.bottom
      ) {
        dependent.needToRender.forEach((coordinate) => coordinates.add(coordinate));
      }
    });
    return Array.from(coordinates);
  }

  /**
   * Gets cells that need to rerender upon a change to this cell
   * @param cell
   * @returns
   */
  getChangedCells(cell: Coordinate): Coordinate[] | undefined {
    const entry = this.dependents.get(this.getKey(cell));
    if (entry) {
      return entry.renderThisCell;
    }
  }

  save(): Dependency[] {
    return Array.from(this.dependents, ([key, value]) => value);
  }

  load(dependents: Dependency[]): void {
    this.dependents.clear();
    this.bounds.clear();

    // todo: this can be removed once we move past older files
    if (!dependents) return;

    dependents.forEach((dependent) => {
      this.dependents.set(this.getKey(dependent.location), dependent);
      this.bounds.addCoordinate(dependent.location);
    });
  }

  getGridBounds(): Rectangle | undefined {
    return this.bounds.toRectangle();
  }

  getBounds(bounds: Rectangle): Rectangle | undefined {
    const gridBounds = this.getGridBounds();
    if (gridBounds) {
      return intersects.rectangleClip(gridBounds, bounds);
    }
  }

  hasQuadrant(x: number, y: number): boolean {
    return this.quadrants.has(Quadrants.getKey(x, y));
  }
}
