import { debugWebWorkers } from '@/debugFlags';
import './multiplayerClient';
import './multiplayerServer';

if (debugWebWorkers) console.log('[multiplayer.worker] created');

/*

export class MultiplayerWebWorker {
  private sessionId: string;
  private updateId?: number;
  private fileId?: string;
  private user?: User;
  private anonymous?: boolean;




  async sendMouseMove(x?: number, y?: number) {
    if (this.lastMouseMove === undefined && x === undefined) return;
    if (this.lastMouseMove && this.lastMouseMove.x === x && this.lastMouseMove.y === y) return;
    const userUpdate = this.getUserUpdate().update;
    if (x === undefined || y === undefined) {
      userUpdate.visible = false;
    } else {
      userUpdate.x = x;
      userUpdate.y = y;
      userUpdate.visible = true;
    }
    this.lastMouseMove = x === undefined || y === undefined ? undefined : { x, y };
  }

  async sendSelection(selection: string) {
    const userUpdate = this.getUserUpdate().update;
    userUpdate.selection = selection;
  }

  sendChangeSheet = () => {
    const userUpdate = this.getUserUpdate().update;
    userUpdate.sheet_id = sheets.sheet.id;
  };

  sendCellEdit(text: string, cursor: number, codeEditor: boolean, bold?: boolean, italic?: boolean) {
    const userUpdate = this.getUserUpdate().update;
    userUpdate.cell_edit = {
      text,
      cursor,
      active: true,
      code_editor: codeEditor,
      bold,
      italic,
    };
  }

  sendEndCellEdit() {
    const userUpdate = this.getUserUpdate().update;
    userUpdate.cell_edit = {
      text: '',
      cursor: 0,
      active: false,
      code_editor: false,
    };
  }

  sendViewport(viewport: string) {
    const userUpdate = this.getUserUpdate().update;
    userUpdate.viewport = viewport;
  }

  sendCodeRunning(sheetPos: SheetPos[]) {
    const userUpdate = this.getUserUpdate().update;
    userUpdate.code_running = JSON.stringify(sheetPos);
  }

  async sendTransaction(id: string, operations: string) {
    await this.init();
    if (!this.websocket) throw new Error('Expected websocket to be defined in sendTransaction');
    // it's possible that we try to send a transaction before we've entered a room (eg, unsent_transactions)
    if (!this.fileId) return;
    const message: SendTransaction = {
      type: 'Transaction',
      id,
      session_id: this.sessionId,
      file_id: this.fileId,
      operations,
    };
    this.state = 'syncing';
    const stringified = JSON.stringify(message);
    this.websocket.send(stringified);
    if (debugShowMultiplayer)
      console.log(`[Multiplayer] Sent transaction ${id} (${Math.round(stringified.length / 1000000)}MB).`);
  }

  async sendGetTransactions(min_sequence_num: bigint) {
    await this.init();
    if (!this.websocket) throw new Error('Expected websocket to be defined in sendGetTransactions');
    const message: SendGetTransactions = {
      type: 'GetTransactions',
      session_id: this.sessionId,
      file_id: this.fileId!,
      min_sequence_num,
    };
    if (debugShowMultiplayer) console.log(`[Multiplayer] Requesting transactions starting from ${min_sequence_num}.`);
    this.websocket.send(JSON.stringify(message));
    this.state = 'syncing';
  }

  sendFollow(follow: string) {
    const userUpdate = this.getUserUpdate().update;
    userUpdate.follow = follow;
  }


  // Receives a new transaction from the server
  private async receiveTransaction(data: ReceiveTransaction) {
    if (debugShowMultiplayer) console.log(`[Multiplayer] Received transaction ${data.id}.`);
    if (data.file_id !== this.fileId) {
      throw new Error("Expected file_id to match room before receiving a message of type 'Transaction'");
    }
    grid.multiplayerTransaction(data.id, data.sequence_num, data.operations);
    offline.markTransactionSent(data.id);
    if (await offline.unsentTransactionsCount()) {
      this.state = 'syncing';
    } else {
      this.state = 'connected';
    }
  }

  // Receives a collection of transactions to catch us up based on our sequenceNum
  private async receiveTransactions(data: ReceiveTransactions) {
    if (debugShowMultiplayer)
      console.log(`[Multiplayer] Received ${Math.floor(data.transactions.length / 1000)}MB transactions data.`);
    grid.receiveMultiplayerTransactions(data.transactions);
    if (await offline.unsentTransactionsCount()) {
      this.state = 'syncing';
    } else {
      this.state = 'connected';
    }
  }

  // Receives the current transaction number from the server when entering a room.
  // Note: this may be different than the one provided by the api as there may be unsaved Transactions.
  private receiveEnterRoom(data: ReceiveEnterRoom) {
    if (data.file_id !== this.fileId) {
      throw new Error("Expected file_id to match room before receiving a message of type 'EnterRoom'");
    }
    grid.receiveSequenceNum(data.sequence_num);
  }

  // Called during a heartbeat from the server to verify we're at the correct sequenceNum
  private receiveCurrentTransaction(data: ReceiveCurrentTransaction) {
    grid.receiveSequenceNum(data.sequence_num);
  }



export const multiplayer = new MultiplayerWebWorker();

*/
