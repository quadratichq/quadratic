export interface CoreClientLoad {
  type: 'load';
  contents: string;
  lastSequenceNum: number;
}

export type CoreClientMessage = CoreClientLoad;
