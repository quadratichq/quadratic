import { Rectangle } from 'pixi.js';
import { Coordinate, coordinateEqual } from '../gridGL/types/size';

export interface Dependency {
  location: Coordinate;
  needToRender: Coordinate[]; // these are cells that must be rendered when drawing this cell
  renderThisCell: Coordinate[]; // these are cells that render this cell when drawing
}

export class GridRenderDependency {
  private dependents: Map<string, Dependency> = new Map();
  private minX = 0;
  private maxX = 0;
  private minY = 0;
  private maxY = 0;
  private isEmpty = true;

  clear(): void {
    this.dependents.clear();
    this.minX = 0;
    this.maxX = 0;
    this.minY = 0;
    this.maxY = 0;
    this.isEmpty = true;
  }

  recalculateBounds(): void {
    if (this.dependents.size === 0) {
      this.clear();
      return;
    }
    this.minX = Infinity;
    this.maxX = -Infinity;
    this.minY = Infinity;
    this.maxY = -Infinity;
    this.dependents.forEach((dependent) => {
      this.minX = Math.min(this.minX, dependent.location.x);
      this.maxX = Math.max(this.maxX, dependent.location.x);
      this.minY = Math.min(this.minY, dependent.location.y);
      this.maxY = Math.max(this.maxY, dependent.location.y);
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
        changes.push(cell);
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
    const entry = this.dependents.get(this.getKey(cell));
    if (entry) {
      return entry.needToRender;
    }
  }

  /** find all cell dependents that point to a cell that is inside the bounds */
  getDependentsInBounds(bounds: Rectangle): Coordinate[] {
    const coordinates: Coordinate[] = [];
    this.dependents.forEach((dependent) => {
      const location = dependent.location;

      // first check that the dependent is within the full bounds
      if (
        location.x >= bounds.left &&
        location.x <= bounds.right &&
        location.y >= bounds.top &&
        location.y <= bounds.bottom
      ) {
        coordinates.push(...dependent.needToRender);
      }
    });
    return coordinates;
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

    // todo: this can be removed once we move past older files
    if (!dependents) return;

    dependents.forEach((dependent) => this.dependents.set(this.getKey(dependent.location), dependent));
  }

  getGridBounds(): Rectangle | undefined {
    if (this.isEmpty) return;
    return new Rectangle(this.minX, this.minY, this.maxX - this.minX, this.maxY - this.minY);
  }
}
