import { getQuadrantKey } from '../quadrants/quadrantHelper';
import { Coordinate } from '../types/size';

interface QuadrantsSortBase {
  location: Coordinate;
}

/** A generic class that places T in a bucket mapped by quadrant name */
export class QuadrantsSort<T extends QuadrantsSortBase> {
  private quadrants = new Map<string, T[]>();

  empty(): void {
    this.quadrants.clear();
  }

  add(location: Coordinate, entry: T): void {
    const key = getQuadrantKey(location.x, location.y);
    let quadrant = this.quadrants.get(key);
    if (!quadrant) {
      quadrant = [entry];
      this.quadrants.set(key, quadrant);
    } else {
      if (!quadrant.find(search => search === entry)) {
        quadrant.push(entry);
      }
    }
  }

  remove(location: Coordinate): void {
    const key = getQuadrantKey(location.x, location.y);
    const quadrant = this.quadrants.get(key);
    if (!quadrant) throw new Error("Expected to find quadrant in QuadrantsSort.remove");
    const index = quadrant.findIndex(search => search.location.x === location.x && search.location.y === location.y);
    if (index === -1) throw new Error("Expected to find entry in QuadrantsSort.remove");
    quadrant.splice(index, 1);

    // remove quadrant if it no longer contains entries
    if (quadrant.length === 0) {
      this.quadrants.delete(key);
    }
  }
}