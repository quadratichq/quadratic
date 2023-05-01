

const positionEqual = (a: [number, number], b: [number, number]) => {
  return a[0] === b[0] && a[1] === b[1];
};

const getValueFromKey = (a: string): [number, number] => {
  let str_num = a.split(",")
  return [Number(str_num[0]), Number(str_num[1])]
}

class Cycle {
  list: string[] = []

  constructor(list: string[]) {
    this.list = list;
  }

  containsKey(key: string): boolean {
    return this.list.filter((v) => v === key).length > 0
  }

  //returns all the cells in a cycle without the actual cell being updated in an order such that 
  // Cell A gets updated as a starting_cell from somewhere in the code
  // all cells in cycle then get updated excluding Cell A
  // all cells depended on cycle but not apart of cycle get updated (this logic is in the function getDependencies)
  getOrderToUpdate(key: string): string[] {
    let index = this.list.indexOf(key)
    let ordered_list: string[]
    if (index === -1) {

      return []
    }
    if (index === this.list.length - 1) {

      ordered_list = this.list;

    } else {

      ordered_list = this.list.slice(index + 1).concat(this.list.slice(0, index + 1))
    }
    ordered_list.pop();
    ordered_list.reverse();
    return ordered_list;
  }
}


export class CellDependencyManager {
  private dependencies: Map<string, [number, number][]> = new Map();
  private cyclic_lists: Cycle[] = [];

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
    this.findAllCyclicLoops();
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
    this.findAllCyclicLoops();
  }

  getDependencies(dependent: [number, number]): [[number, number][], [number, number][]] {
    let cycle = this.cyclic_lists.filter((cycle) => cycle.containsKey(this.getKey(dependent)));

    if (cycle.length > 0) {
      let dep: [number, number][] = []
      cycle[0].getOrderToUpdate(this.getKey(dependent)).forEach(
        (c) => { dep.push(getValueFromKey(c)) }
      )

      let all_deps = this.dependencies.get(this.getKey(dependent))

      //single cyclic groups return no dependencies
      if (dep.length !== 0) {
        let non_cyclic_deps = all_deps?.filter((d) => {
          let should_add = true;
          dep.forEach((c) => {
            if (positionEqual(c, d)) {
              should_add = false
            }
          })
          return should_add;
        })
        return [non_cyclic_deps || [], dep];
        // return all normal dependencies except for the cell that is dependent on itself.
      } else {
        let non_cyclic_deps = all_deps?.filter((d) => {
          return !positionEqual(dependent, d)
        })
        return [non_cyclic_deps || [], dep]
      }
    }
    return [this.dependencies.get(this.getKey(dependent)) || [], []];
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
    this.findAllCyclicLoops();
  }


  //finds all cylic loops 
  //called after each change in dependences
  //should probably have some way to not have rebuild the whole thing over again every time
  findAllCyclicLoops(): void {
    this.cyclic_lists = []

    let visited: Map<string, boolean> = new Map();
    let finished: Map<string, boolean> = new Map();

    this.dependencies.forEach((_, key) => {
      visited.set(key, false);
      finished.set(key, false);

    })


    this.dependencies.forEach((_, key) => {

      let cycle = this.depthForSearch_Find_cyclic(key, visited, finished)
      if (cycle.length > 0) {

        //quick and diry way to do this, only keeps longest unique cycle, 
        //because depthForSearch_find_cyclic will return copies, and similar cycles without all the cells in them
        //need to do more reading on this
        let found_similar_cycles = false;
        this.cyclic_lists.forEach((c) => {
          cycle.forEach((cell) => {
            if (c.containsKey(cell)) {
              found_similar_cycles = true;
              if (c.list.length < cycle.length) {
                c.list = cycle;
              }
            }
          })
        })

        if (!found_similar_cycles) {
          this.cyclic_lists.push(new Cycle(cycle))
        }


      }
    })


  }


  depthForSearch_Find_cyclic(key: string, visited: Map<string, boolean>, finished: Map<string, boolean>): string[] {


    if (finished.get(key)) {

      return []
    }
    if (visited.get(key)) {
      // //found a cycle
      return [key]
    }
    visited.set(key, true);
    let cycle: string[] = []

    this.dependencies.get(key)?.forEach((value) => {
      let keys = this.depthForSearch_Find_cyclic(this.getKey(value), visited, finished)
      cycle = cycle.concat(keys);
    })
    finished.set(key, true)

    if ((cycle.length > 0 && cycle.filter((v) => v === key).length === 0)) {
      cycle.push(key);
    }

    return cycle;
  }


  // test combination

  // Get dependent cells, that's it! Maybe add some sort of object to make it clear
  // Cell A updates cell B, C, D etc.
}
