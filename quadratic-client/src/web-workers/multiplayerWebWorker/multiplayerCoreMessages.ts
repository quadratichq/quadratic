export interface MultiplayerCoreSequenceNum {
  type: 'multiplayerCoreSequenceNum';
  sequenceNum: number;
}

export type MultiplayerCoreMessage = MultiplayerCoreSequenceNum;

export type CoreMultiplayerMessage = { type: string };
