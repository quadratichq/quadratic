import { API_URL } from "../../constants/api";
import CellReference from "../types/cellReference";
import APICell from "./interfaces/APICell";
import APIDeleteCell from "./interfaces/APIDeleteCell";

const axios = require("axios").default;

export const getCells = async (
  point0: CellReference,
  point1: CellReference
): Promise<APICell[] | null> => {
  try {
    const { data } = await axios.get(
      `${API_URL}/grid/cells/?x0=${point0.x}&y0=${point0.y}&x1=${point1.x}&y1=${point1.y}`
    );
    return data;
  } catch (error) {
    console.log(error);
  }
  return null;
};

export const updateCells = async (
  cells: APICell[]
): Promise<APICell[] | null> => {
  try {
    const { data } = await axios.post(`${API_URL}/grid/cells/`, cells);
    return data;
  } catch (error) {
    console.log(error);
  }
  return null;
};

export const deleteCells = async (cells: APIDeleteCell[]): Promise<null> => {
  try {
    const { data } = await axios.post(`${API_URL}/grid/cells/delete/`, cells);
    return data;
  } catch (error) {
    console.log(error);
  }
  return null;
};
