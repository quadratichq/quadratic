export interface CoreMessage {
  type: 'load';
}

export interface LoadCoreMessage {
  type: 'load';
  contents: string;
  lastSequenceNum: number;
}

export type CoreMessages = LoadCoreMessage;
