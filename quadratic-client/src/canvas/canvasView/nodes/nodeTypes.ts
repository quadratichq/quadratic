import { DataTableInputNode } from './DataTableInputNode';
import { InputNode } from './InputNode';
import { TransformNode } from './TransformNode';
import { OutputNode } from './OutputNode';

export const nodeTypes = {
  input: InputNode,
  dataTableInput: DataTableInputNode,
  transform: TransformNode,
  output: OutputNode,
};
