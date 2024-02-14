import { JsCodeCell } from '@/quadratic-core/types';

export interface ClientCoreLoad {
  type: 'clientCoreLoad';
  url: string;
  version: string;
  sequenceNumber: number;
  id: number;
}

export interface SheetMetadata {
  offsets: string;
  bounds?: { x: number; y: number; width: number; height: number };
  boundsNoFormatting?: { x: number; y: number; width: number; height: number };
  name: string;
  order: string;
  color?: string;
}

export interface GridMetadata {
  undo: boolean;
  redo: boolean;
  sheets: Record<string, SheetMetadata>;
}

export interface CoreClientLoad {
  type: 'coreClientLoad';
  id: number;
  metadata: GridMetadata;
}

export interface ClientCoreGetCodeCell {
  type: 'clientCoreGetCodeCell';
  sheetId: string;
  x: number;
  y: number;
  id: number;
}

export interface CoreClientGetCodeCell {
  type: 'coreClientGetCodeCell';
  cell: JsCodeCell | undefined;
  id: number;
}

export type ClientCoreMessage = ClientCoreLoad | ClientCoreGetCodeCell;
export type CoreClientMessage = CoreClientLoad | CoreClientGetCodeCell;
