/**
 * Interface between main thread and core web worker.
 *
 * Also open communication channel between core web worker and render web worker.
 */

import { metadata } from '@/grid/controller/metadata';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { Coordinate } from '@/gridGL/types/size';
import {
  CellAlign,
  CellFormatSummary,
  JsCodeCell,
  JsRenderCell,
  JsRenderCodeCell,
  JsRenderFill,
} from '@/quadratic-core/types';
import { Rectangle } from 'pixi.js';
import { renderWebWorker } from '../renderWebWorker/renderWebWorker';
import {
  ClientCoreCellHasContent,
  ClientCoreGetAllRenderFills,
  ClientCoreGetCellFormatSummary,
  ClientCoreGetCodeCell,
  ClientCoreGetEditCell,
  ClientCoreGetRenderCell,
  ClientCoreGetRenderCodeCells,
  ClientCoreLoad,
  ClientCoreMessage,
  ClientCoreSummarizeSelection,
  CoreClientGetAllRenderFills,
  CoreClientGetCellFormatSummary,
  CoreClientGetCodeCell,
  CoreClientGetEditCell,
  CoreClientGetRenderCell,
  CoreClientGetRenderCodeCells,
  CoreClientImportCsv,
  CoreClientLoad,
  CoreClientMessage,
  CoreClientSummarizeSelection,
} from './coreClientMessages';

class QuadraticCore {
  private worker: Worker;
  private id = 0;
  private waitingForResponse: Record<number, Function> = {};

  constructor() {
    this.worker = new Worker(new URL('./worker/core.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;
    this.worker.onerror = (e) => console.warn(`[core.worker] error: ${e.message}`);
  }

  private handleMessage = (e: MessageEvent<CoreClientMessage>) => {
    if (e.data.type === 'coreClientFillSheetsModified') {
      pixiApp.cellsSheets.updateFills(e.data.sheetIds);
      return;
    }

    // handle responses
    if (e.data.id !== undefined) {
      if (this.waitingForResponse[e.data.id]) {
        this.waitingForResponse[e.data.id](e.data);
        delete this.waitingForResponse[e.data.id];
      } else {
        console.warn('No resolve for message in quadraticCore', e.data.id);
      }
    }

    // handle requests
    else {
      switch (e.data.type) {
        default:
          console.warn('Unhandled message type', e.data.type);
      }
    }
  };

  private send(message: ClientCoreMessage, extra?: MessagePort | Transferable) {
    if (extra) {
      this.worker.postMessage(message, [extra]);
    } else {
      this.worker.postMessage(message);
    }
  }

  // Loads a Grid file and initializes renderWebWorker upon response
  async load(url: string, version: string, sequenceNumber: number) {
    return new Promise((resolve) => {
      const port = new MessageChannel();
      const id = this.id++;
      const message: ClientCoreLoad = {
        type: 'clientCoreLoad',
        url,
        version,
        sequenceNumber,
        id,
      };
      this.waitingForResponse[id] = (message: CoreClientLoad) => {
        metadata.load(message.metadata);
        renderWebWorker.init(port.port2);
        resolve(undefined);
      };
      this.send(message, port.port1);
    });
  }

  // Gets a code cell from a sheet
  getCodeCell(sheetId: string, x: number, y: number): Promise<JsCodeCell | undefined> {
    return new Promise((resolve) => {
      const id = this.id++;
      const message: ClientCoreGetCodeCell = {
        type: 'clientCoreGetCodeCell',
        sheetId,
        x,
        y,
        id,
      };
      this.waitingForResponse[id] = (message: CoreClientGetCodeCell) => {
        resolve(message.cell);
      };
      this.send(message);
    });
  }

  getRenderCell(sheetId: string, x: number, y: number): Promise<JsRenderCell | undefined> {
    return new Promise((resolve) => {
      const id = this.id++;
      const message: ClientCoreGetRenderCell = {
        type: 'clientCoreGetRenderCell',
        sheetId,
        x,
        y,
        id,
      };
      this.waitingForResponse[id] = (message: CoreClientGetRenderCell) => {
        resolve(message.cell);
      };
      this.send(message);
    });
  }

  getAllRenderFills(sheetId: string): Promise<JsRenderFill[]> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: CoreClientGetAllRenderFills) => {
        resolve(message.fills);
      };
      const message: ClientCoreGetAllRenderFills = {
        type: 'clientCoreGetAllRenderFills',
        sheetId,
        id,
      };
      this.send(message);
    });
  }

  getRenderCodeCells(sheetId: string): Promise<JsRenderCodeCell[]> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: CoreClientGetRenderCodeCells) => {
        resolve(message.codeCells);
      };
      const message: ClientCoreGetRenderCodeCells = {
        type: 'clientCoreGetRenderCodeCells',
        sheetId,
        id,
      };
      this.send(message);
    });
  }

  cellHasContent(sheetId: string, x: number, y: number): Promise<boolean> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: { hasContent: boolean }) => {
        resolve(message.hasContent);
      };
      const message: ClientCoreCellHasContent = {
        type: 'clientCoreCellHasContent',
        sheetId,
        x,
        y,
        id,
      };
      this.send(message);
    });
  }

  getEditCell(sheetId: string, x: number, y: number): Promise<string | undefined> {
    return new Promise((resolve) => {
      const id = this.id++;
      const message: ClientCoreGetEditCell = {
        type: 'clientCoreGetEditCell',
        sheetId,
        x,
        y,
        id,
      };
      this.waitingForResponse[id] = (message: CoreClientGetEditCell) => {
        resolve(message.cell);
      };
      this.send(message);
    });
  }

  setCellValue(sheetId: string, x: number, y: number, value: string, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellValue',
      sheetId,
      x,
      y,
      value,
      cursor,
    });
  }

  getCellFormatSummary(sheetId: string, x: number, y: number): Promise<CellFormatSummary> {
    return new Promise((resolve) => {
      const id = this.id++;
      const message: ClientCoreGetCellFormatSummary = {
        type: 'clientCoreGetCellFormatSummary',
        sheetId,
        x,
        y,
        id,
      };
      this.waitingForResponse[id] = (message: CoreClientGetCellFormatSummary) => {
        resolve(message.formatSummary);
      };
      this.send(message);
    });
  }

  // Imports a CSV and returns a string with an error if not successful
  async importCsv(sheetId: string, file: File, fileName: string, x: number, y: number): Promise<string | undefined> {
    const arrayBuffer = await file.arrayBuffer();
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: CoreClientImportCsv) => resolve(message.error);
      this.send(
        {
          type: 'clientCoreImportCsv',
          sheetId,
          x,
          y,
          id,
          file: arrayBuffer,
          fileName,
        },
        arrayBuffer
      );
    });
  }

  initMultiplayer(port: MessagePort) {
    this.send({ type: 'clientCoreInitMultiplayer' }, port);
  }

  summarizeSelection(
    decimalPlaces: number,
    sheetId: string,
    rectangle: Rectangle
  ): Promise<{ count: number; sum: number | undefined; average: number | undefined } | undefined> {
    return new Promise((resolve) => {
      const id = this.id++;
      const message: ClientCoreSummarizeSelection = {
        type: 'clientCoreSummarizeSelection',
        id,
        sheetId,
        decimalPlaces,
        x: rectangle.x,
        y: rectangle.y,
        width: rectangle.width,
        height: rectangle.height,
      };
      this.waitingForResponse[id] = (message: CoreClientSummarizeSelection) => {
        resolve(message.summary);
      };
      this.send(message);
    });
  }

  setCellBold(sheetId: string, rectangle: Rectangle, bold: boolean, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellBold',
      sheetId,
      x: rectangle.x,
      y: rectangle.y,
      width: rectangle.width,
      height: rectangle.height,
      bold,
      cursor,
    });
  }

  setCellFillColor(sheetId: string, rectangle: Rectangle, fillColor?: string, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellFillColor',
      sheetId,
      x: rectangle.x,
      y: rectangle.y,
      width: rectangle.width,
      height: rectangle.height,
      fillColor,
      cursor,
    });
  }

  setCellItalic(sheetId: string, rectangle: Rectangle, italic: boolean, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellItalic',
      sheetId,
      x: rectangle.x,
      y: rectangle.y,
      width: rectangle.width,
      height: rectangle.height,
      italic,
      cursor,
    });
  }

  setCellTextColor(sheetId: string, rectangle: Rectangle, color?: string, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellTextColor',
      sheetId,
      x: rectangle.x,
      y: rectangle.y,
      width: rectangle.width,
      height: rectangle.height,
      color,
      cursor,
    });
  }

  setCellAlign(sheetId: string, rectangle: Rectangle, align?: CellAlign, cursor?: string) {
    this.send({
      type: 'clientCoreSetCellAlign',
      sheetId,
      x: rectangle.x,
      y: rectangle.y,
      width: rectangle.width,
      height: rectangle.height,
      align,
      cursor,
    });
  }

  setCellCurrency(sheetId: string, rectangle: Rectangle, symbol: string, cursor?: string) {
    this.send({
      type: 'clientCoreSetCurrency',
      sheetId,
      x: rectangle.x,
      y: rectangle.y,
      width: rectangle.width,
      height: rectangle.height,
      symbol,
      cursor,
    });
  }

  setCellPercentage(sheetId: string, rectangle: Rectangle, cursor?: string) {
    this.send({
      type: 'clientCoreSetPercentage',
      sheetId,
      x: rectangle.x,
      y: rectangle.y,
      width: rectangle.width,
      height: rectangle.height,
      cursor,
    });
  }

  setCellExponential(sheetId: string, rectangle: Rectangle, cursor?: string) {
    this.send({
      type: 'clientCoreSetExponential',
      sheetId,
      x: rectangle.x,
      y: rectangle.y,
      width: rectangle.width,
      height: rectangle.height,
      cursor,
    });
  }

  removeCellNumericFormat(sheetId: string, rectangle: Rectangle, cursor?: string) {
    this.send({
      type: 'clientCoreRemoveCellNumericFormat',
      sheetId,
      x: rectangle.x,
      y: rectangle.y,
      width: rectangle.width,
      height: rectangle.height,
      cursor,
    });
  }

  changeDecimalPlaces(sheetId: string, x: number, y: number, rectangle: Rectangle, delta: number, cursor?: string) {
    this.send({
      type: 'clientCoreChangeDecimals',
      sheetId,
      x,
      y,
      width: rectangle.width,
      height: rectangle.height,
      delta,
      cursor,
    });
  }

  clearFormatting(sheetId: string, rectangle: Rectangle, cursor?: string) {
    this.send({
      type: 'clientCoreClearFormatting',
      sheetId,
      x: rectangle.x,
      y: rectangle.y,
      width: rectangle.width,
      height: rectangle.height,
      cursor,
    });
  }

  toggleCommas(sheetId: string, source: Coordinate, rectangle: Rectangle, cursor?: string) {
    this.send({
      type: 'clientCoreToggleCommas',
      sheetId,
      sourceX: source.x,
      sourceY: source.y,
      x: rectangle.x,
      y: rectangle.y,
      width: rectangle.width,
      height: rectangle.height,
      cursor,
    });
  }

  getGridBounds(sheetId: string, ignoreFormatting: boolean) {
    return new Promise<Rectangle | undefined>((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: { bounds?: Rectangle }) => {
        if (message.bounds) {
          resolve(new Rectangle(message.bounds.x, message.bounds.y, message.bounds.width, message.bounds.height));
        } else {
          resolve(undefined);
        }
      };
      this.send({
        type: 'clientCoreGetGridBounds',
        sheetId,
        ignoreFormatting,
        id,
      });
    });
  }
}

export const quadraticCore = new QuadraticCore();
