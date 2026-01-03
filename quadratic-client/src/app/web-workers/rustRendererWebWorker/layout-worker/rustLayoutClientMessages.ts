/**
 * Messages between the main thread (client) and the Layout Worker
 */

/**
 * Messages from the main thread to the Layout Worker
 */
export type ClientRustLayoutMessage =
  | {
      type: 'clientRustLayoutInit';
      corePort: MessagePort;
      renderPort: MessagePort;
      viewportBuffer: SharedArrayBuffer;
    }
  | {
      type: 'clientRustLayoutResize';
      width: number;
      height: number;
      devicePixelRatio: number;
    }
  | {
      type: 'clientRustLayoutSetSheet';
      sheetId: string;
    }
  | {
      type: 'clientRustLayoutSetCursor';
      col: number;
      row: number;
    }
  | {
      type: 'clientRustLayoutSetSelection';
      startCol: number;
      startRow: number;
      endCol: number;
      endRow: number;
    }
  | {
      type: 'clientRustLayoutShowHeadings';
      show: boolean;
    }
  | {
      type: 'clientRustLayoutPing';
      timestamp: number;
    };

/**
 * Messages from the Layout Worker to the main thread
 */
export type RustLayoutClientMessage =
  | {
      type: 'rustLayoutClientReady';
    }
  | {
      type: 'rustLayoutClientError';
      error: string;
      fatal: boolean;
    }
  | {
      type: 'rustLayoutClientPong';
      timestamp: number;
      roundTripMs: number;
    }
  | {
      type: 'rustLayoutClientAutoSize';
      column?: number;
      row?: number;
      maxWidth?: number;
      maxHeight?: number;
    };
