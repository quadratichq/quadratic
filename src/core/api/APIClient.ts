import { API_URL } from "../../constants/api";
import Globals from "../../globals";
import CellReference from "../types/cellReference";
import APICell from "./interfaces/APICell";

const axios = require("axios").default;

export const getCells = (
  point0: CellReference,
  point1: CellReference,
  globals: Globals
) => {
  axios
    .get(`${API_URL}/grid/cells/?x0=-100&y0=-100&x1=100&y1=100`)
    .then(function (response: any) {
      // handle success
      console.log(response);
      response.data.forEach((cell: any) => {
        console.log(cell);

        globals.grid.createOrUpdateCell(
          { x: parseInt(cell.x), y: parseInt(cell.y) },
          cell.input_value
        );
      });
    })
    .catch(function (error: any) {
      // handle error
      console.log(error);
    })
    .then(function () {
      // always executed
    });
};

export const updateCells = (cells: Array<APICell>) => {
  axios
    .post(`${API_URL}/grid/cells/`, cells)
    .then(function (response: any) {
      // handle success
      console.log(response);
    })
    .catch(function (error: any) {
      // handle error
      console.log(error);
    })
    .then(function () {
      // always executed
    });
};
