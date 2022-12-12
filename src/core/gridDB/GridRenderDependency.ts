import { Coordinate, coordinateEqual } from '../gridGL/types/size'

export interface Dependency {
  location: Coordinate;
  needToRender: Coordinate[]; // these are cells that must be rendered when drawing this cell
  renderThisCell: Coordinate[]; // these are cells that render this cell when drawing
}

export class GridRenderDependency {
  private dependents: Map<string, Dependency> = new Map();

  clear(): void {
    this.dependents.clear();
  }

  private getKey(location: Coordinate): string {
    return `${location.x},${location.y}`;
  }

  empty(cell: Coordinate): Coordinate[] {
    const changes: Coordinate[] = [];
    const cellKey = this.getKey(cell);
    const originalDependency = this.dependents.get(cellKey);
    if (originalDependency) {

      // remove all needToRender for related cells
      originalDependency.renderThisCell.forEach(renderLocation => {
        const renderKey = this.getKey(renderLocation);
        const renderDependency = this.dependents.get(renderKey);
        if (renderDependency) {
          const index = renderDependency.needToRender.findIndex(search => coordinateEqual(search, cell));
          if (index !== -1) {
            renderDependency.needToRender.splice(index, 1);
            changes.push(renderLocation);
          }
        }
      })
      this.dependents.set(cellKey, { ...originalDependency, renderThisCell: []});
    }
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
    if (originalDependency) {

      // remove needToRender entries for cells that are no longer dependents
      originalDependency.renderThisCell.forEach(entry => {
        if (!renderThisCell.find(search => coordinateEqual(search, entry))) {

          // remove needsToRender entry from those cells
          const remove = this.dependents.get(this.getKey(entry));
          if (remove) {
            const index = remove.needToRender.findIndex(search => coordinateEqual(search, cell));
            if (index !== -1) {
              remove.needToRender.splice(index, 1);
              changes.push(entry);
            }
          }
        }
      });

      // add render entries for cells that are new dependents
      renderThisCell.forEach(entry => {
        if (!originalDependency.renderThisCell.find(search => coordinateEqual(search, entry))) {
          const add = this.dependents.get(this.getKey(entry));
          if (add) {
            add.renderThisCell.push(cell);
          } else {
            this.dependents.set(this.getKey(entry), { location: entry, needToRender: [cell], renderThisCell: [] });
          }
          changes.push(entry);
        }
      });
      this.dependents.set(cellKey, { ...originalDependency, renderThisCell });
    } else {

      // add render entries for cells that are dependents
      renderThisCell.forEach(entry => {
        const add = this.dependents.get(this.getKey(entry));
        if (add) {
          add.renderThisCell.push(cell);
        } else {
          this.dependents.set(this.getKey(entry), { location: entry, needToRender: [cell], renderThisCell: [] });
        }
        changes.push(cell);
      });
      this.dependents.set(cellKey, { location: cell, needToRender: [], renderThisCell });
    }
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
    dependents.forEach(dependent => this.dependents.set(this.getKey(dependent.location), dependent));
  }
}