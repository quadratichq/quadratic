class Q {
  constructor() {}

  cells(a1, firstRowHeader = false) {
    // call the injected get_cells function
    if (typeof globalThis.__get_cells__ === "function") {
      try {
        const get_cells_response = globalThis.__get_cells__(a1, firstRowHeader);

        if (get_cells_response.error) {
          throw new Error(
            get_cells_response.error.core_error || get_cells_response.error,
          );
        }

        // convert the response to the format expected by JavaScript code
        if (get_cells_response.values) {
          return this.convertCellsResponse(
            get_cells_response.values,
            firstRowHeader,
          );
        }

        return null;
      } catch (e) {
        console.log(`Error getting cells for range: ${a1}, error: ${e}`);
        throw e;
      }
    } else {
      console.log(
        `Getting cells for range: ${a1}, firstRowHeader: ${firstRowHeader} (no get_cells function)`,
      );
      return null;
    }
  }

  convertCellsResponse(values, firstRowHeader) {
    const { cells, w, h, x, y, one_dimensional, two_dimensional } = values;

    // if it's a single cell, return the value directly
    if (!one_dimensional && !two_dimensional && cells.length > 0) {
      const cell = cells[0];
      return this.convertCellValue(cell.v, cell.t);
    }

    // if it's a one-dimensional array, return as array
    if (one_dimensional) {
      return cells.map((cell) => this.convertCellValue(cell.v, cell.t));
    }

    // if it's a two-dimensional array, construct the 2D array
    if (two_dimensional) {
      const result = [];

      // initialize the result array with the proper dimensions
      for (let row = 0; row < h; row++) {
        result[row] = new Array(w);
      }

      // fill in the values from the cells
      for (const cell of cells) {
        const localX = cell.x - x;
        const localY = cell.y - y;
        if (localY >= 0 && localY < h && localX >= 0 && localX < w) {
          result[localY][localX] = this.convertCellValue(cell.v, cell.t);
        }
      }

      // fill in any missing values with empty strings
      for (let row = 0; row < h; row++) {
        for (let col = 0; col < w; col++) {
          if (result[row][col] === undefined) {
            result[row][col] = "";
          }
        }
      }

      return result;
    }

    return null;
  }

  convertCellValue(value, cellType) {
    // cellValueType mapping from quadratic-core
    // 0: blank, 1: text, 2: number, 3: logical, 4: duration, 5: error, 6: html, 8: image, 9: date, 10: time, 11: datetime

    switch (cellType) {
      case 0: // blank
        return undefined;
      case 2: // number
        return parseFloat(value);
      case 9: // date
      case 11: // datetime
        return new Date(value);
      default:
        // For all other types (text, logical, duration, error, html, image, time), return the raw string value
        return value;
    }
  }

  pos() {
    // get the current position from global state
    if (typeof globalThis.__current_pos__ === "function") {
      return globalThis.__current_pos__();
    }
    return [0, 0];
  }
}

globalThis.q = new Q();
