import { Cell } from "../../gridDB/db";
export interface GridFileSchema {
  cells: Cell[];
  dgraph: string;
}
