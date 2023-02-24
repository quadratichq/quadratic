const positionEqual = (a: [number, number], b: [number, number]) => {
  return a[0] === b[0] && a[1] === b[1];
};

export class CellDependencyManager {
  private dependencies: Map<string, [number, number][]> = new Map();

  clear(): void {
    this.dependencies.clear();
  }

  private getKey(location: [number, number]): string {
    return `${location[0]},${location[1]}`;
  }

  // add dependencies
  addDependency(trigger_cell: [number, number], updates_cell: [number, number]): void {
    const dependent_key = this.getKey(trigger_cell);
    const existing = this.dependencies.get(dependent_key);
    if (existing) {
      this.dependencies.set(dependent_key, [...existing, updates_cell]);
    } else {
      this.dependencies.set(dependent_key, [updates_cell]);
    }
  }

  // remove dependencies
  removeDependency(trigger_cell: [number, number], updates_cell: [number, number]): void {
    const dependent_key = this.getKey(trigger_cell);
    const existing = this.dependencies.get(dependent_key);
    if (existing) {
      // subtract dependency from existing
      this.dependencies.set(
        dependent_key,
        existing.filter((cell) => !positionEqual(cell, updates_cell))
      );

      // remove key if empty
      if (this.dependencies.get(dependent_key)?.length === 0) {
        this.dependencies.delete(dependent_key);
      }
    }
  }

  getDependencies(dependent: [number, number]): [number, number][] {
    return this.dependencies.get(this.getKey(dependent)) || [];
  }

  // save to string
  exportToString(): string {
    return JSON.stringify(
      Array.from(this.dependencies.entries()).map(([key, value]) => ({
        key,
        value,
      }))
    );
  }

  // load from string
  loadFromString(dependencies: string | undefined): void {
    if (dependencies === undefined || dependencies === '') {
      this.dependencies = new Map();
    } else {
      this.dependencies = new Map(
        JSON.parse(dependencies).map(({ key, value }: { key: string; value: [number, number][] }) => [key, value])
      );
    }
  }

  // test combination

  // Get dependent cells, that's it! Maybe add some sort of object to make it clear
  // Cell A updates cell B, C, D etc.
}
