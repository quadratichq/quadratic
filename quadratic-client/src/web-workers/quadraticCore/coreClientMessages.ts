import { CellFormatSummary, JsCodeCell, JsRenderCodeCell, JsRenderFill } from '@/quadratic-core/types';

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

export interface ClientCoreGetAllRenderFills {
  type: 'clientCoreGetAllRenderFills';
  sheetId: string;
  id: number;
}

export interface CoreClientGetAllRenderFills {
  type: 'coreClientGetAllRenderFills';
  fills: JsRenderFill[];
  id: number;
}

export interface ClientCoreGetRenderCodeCells {
  type: 'clientCoreGetRenderCodeCells';
  sheetId: string;
  id: number;
}

export interface CoreClientGetRenderCodeCells {
  type: 'coreClientGetRenderCodeCells';
  codeCells: JsRenderCodeCell[];
  id: number;
}

export interface ClientCoreCellHasContent {
  type: 'clientCoreCellHasContent';
  sheetId: string;
  x: number;
  y: number;
  id: number;
}

export interface CoreClientCellHasContent {
  type: 'coreClientCellHasContent';
  hasContent: boolean;
  id: number;
}

export interface ClientCoreGetEditCell {
  type: 'clientCoreGetEditCell';
  sheetId: string;
  x: number;
  y: number;
  id: number;
}

export interface CoreClientGetEditCell {
  type: 'coreClientGetEditCell';
  cell: string | undefined;
  id: number;
}

export interface ClientCoreSetCellValue {
  type: 'clientCoreSetCellValue';
  sheetId: string;
  x: number;
  y: number;
  value: string;
  cursor?: string;
}

export interface ClientCoreGetCellFormatSummary {
  type: 'clientCoreGetCellFormatSummary';
  sheetId: string;
  x: number;
  y: number;
  id: number;
}

export interface CoreClientGetCellFormatSummary {
  type: 'coreClientGetCellFormatSummary';
  formatSummary: CellFormatSummary;
  id: number;
}

export interface ClientCoreInitMultiplayer {
  type: 'clientCoreInitMultiplayer';
}

export type ClientCoreMessage =
  | ClientCoreLoad
  | ClientCoreGetCodeCell
  | ClientCoreGetAllRenderFills
  | ClientCoreGetRenderCodeCells
  | ClientCoreCellHasContent
  | ClientCoreGetEditCell
  | ClientCoreSetCellValue
  | ClientCoreGetCellFormatSummary
  | ClientCoreInitMultiplayer;

export type CoreClientMessage =
  | CoreClientLoad
  | CoreClientGetCodeCell
  | CoreClientGetAllRenderFills
  | CoreClientGetRenderCodeCells
  | CoreClientGetEditCell
  | CoreClientCellHasContent
  | CoreClientGetCellFormatSummary;
