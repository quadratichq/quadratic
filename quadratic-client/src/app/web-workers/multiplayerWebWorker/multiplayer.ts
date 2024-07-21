import { hasPermissionToEditFile } from '@/app/actions';
import { debugShowMultiplayer, debugWebWorkersMessages } from '@/app/debugFlags';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { MULTIPLAYER_COLORS, MULTIPLAYER_COLORS_TINT } from '@/app/gridGL/HTMLGrid/multiplayerCursor/multiplayerColors';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { SheetPosTS } from '@/app/gridGL/types/size';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import { LanguageState } from '@/app/web-workers/languageTypes';
import { authClient, parseDomain } from '@/auth';
import { displayName } from '@/shared/utils/userUtil';
import { User } from '@auth0/auth0-spa-js';
import * as Sentry from '@sentry/react';
import { v4 as uuid } from 'uuid';
import updateAlertVersion from '../../../../../updateAlertVersion.json';
import { quadraticCore } from '../quadraticCore/quadraticCore';
import {
  ClientMultiplayerMessage,
  MultiplayerClientMessage,
  MultiplayerClientUserUpdate,
  MultiplayerState,
} from './multiplayerClientMessages';
import { MultiplayerUser, ReceiveRoom } from './multiplayerTypes';

export class Multiplayer {
  private worker?: Worker;

  state: MultiplayerState = 'startup';
  sessionId: string;

  private anonymous?: boolean;
  private fileId?: string;
  private jwt?: string | void;

  private codeRunning?: SheetPosTS[];
  private lastMouseMove: { x: number; y: number } | undefined;

  brokenConnection = false;

  // server-assigned index of current user
  index?: number;
  colorString?: string;

  // users currently logged in to the room
  users: Map<string, MultiplayerUser> = new Map();

  constructor() {
    this.sessionId = uuid();

    // this is only a partial solution mostly for desktop
    // see https://www.igvita.com/2015/11/20/dont-lose-user-and-app-state-use-page-visibility/ for a further discussion
    const alertUser = (e: BeforeUnloadEvent) => {
      if (
        this.state === 'syncing' &&
        !this.brokenConnection &&
        hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions)
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', alertUser);
    events.on('changeSheet', this.sendChangeSheet);
    events.on('pythonState', this.pythonState);
    events.on('multiplayerState', (state: MultiplayerState) => {
      this.state = state;
    });
  }

  initWorker() {
    this.worker = new Worker(new URL('./worker/multiplayer.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;
    this.worker.onerror = (e) => {
      console.warn(`[multiplayer.worker] error: ${e.message}`);
      Sentry.captureException({
        message: 'Error for multiplayer.worker',
        level: 'error',
        extra: {
          error: e.message,
        },
      });
    };
  }

  private pythonState = (_state: LanguageState, current?: CodeRun, awaitingExecution?: CodeRun[]) => {
    const codeRunning: SheetPosTS[] = [];
    if (current) {
      codeRunning.push(current.sheetPos);
    }
    if (awaitingExecution?.length) {
      codeRunning.push(...awaitingExecution.map((cell) => cell.sheetPos));
    }
    if (this.codeRunning) this.sendCodeRunning(codeRunning);
  };

  private handleMessage = (e: MessageEvent<MultiplayerClientMessage>) => {
    if (debugWebWorkersMessages) console.log(`[Multiplayer] message: ${e.data.type}`);

    switch (e.data.type) {
      case 'multiplayerClientState':
        this.state = e.data.state;
        if (this.state === 'no internet' || this.state === 'waiting to reconnect') {
          this.clearAllUsers();
        }
        events.emit('multiplayerState', this.state);
        break;

      case 'multiplayerClientUserUpdate':
        this.receiveUserUpdate(e.data);
        break;

      case 'multiplayerClientUsersInRoom':
        this.receiveUsersInRoom(e.data.room);
        break;

      case 'multiplayerClientReload':
        events.emit('needRefresh', 'force');
        break;

      default:
        console.warn('Unhandled message type', e.data);
    }
  };

  private send(message: ClientMultiplayerMessage, port?: MessagePort) {
    if (!this.worker) {
      throw new Error('Expected Worker to be initialized in multiplayer.send');
    }
    if (port) {
      this.worker.postMessage(message, [port]);
    } else {
      this.worker.postMessage(message);
    }
  }

  private async getJwt() {
    this.jwt = await authClient.getTokenOrRedirect();
  }

  private async addJwtCookie(force: boolean = false) {
    if (force || !this.jwt) {
      await this.getJwt();

      if (this.jwt) {
        let domain = parseDomain(window.location.host);
        document.cookie = `jwt=${this.jwt}; path=/; domain=${domain};`;
      }
    }
  }

  async init(fileId: string, user: User, anonymous: boolean) {
    if (this.state === 'connected' || this.state === 'syncing') return;

    // channel for communication between the quadraticCore and the multiplayer web worker
    const channel = new MessageChannel();

    this.fileId = fileId;
    this.anonymous = anonymous;
    if (!this.anonymous) {
      await this.addJwtCookie();
    }
    this.send(
      {
        type: 'clientMultiplayerInit',
        fileId,
        user,
        anonymous,
        sessionId: this.sessionId,
        sheetId: sheets.sheet.id,
        selection: sheets.getMultiplayerSelection(),
        cellEdit: {
          text: '',
          cursor: 0,
          active: false,
          code_editor: false,
          inline_code_editor: false,
        },
        viewport: pixiApp.saveMultiplayerViewport(),
        codeRunning: JSON.stringify(this.codeRunning),
        follow: pixiAppSettings.editorInteractionState.follow,
      },
      channel.port1
    );
    quadraticCore.initMultiplayer(channel.port2);
  }

  // used to pre-populate useMultiplayerUsers.tsx
  getUsers(): MultiplayerUser[] {
    return Array.from(this.users.values());
  }

  // whether a multiplayer user is already editing a cell
  cellIsBeingEdited(x: number, y: number, sheetId: string): { codeEditor: boolean; user: string } | undefined {
    for (const player of this.users.values()) {
      if (player.sheet_id === sheetId && player.cell_edit.active && player.parsedSelection) {
        if (player.parsedSelection.cursorPosition.x === x && player.parsedSelection.cursorPosition.y === y) {
          const user = displayName(player, false);
          return { codeEditor: player.cell_edit.code_editor, user };
        }
      }
    }
  }

  sendMouseMove(x?: number, y?: number) {
    if (this.lastMouseMove === undefined && x === undefined) return;
    if (this.lastMouseMove && this.lastMouseMove.x === x && this.lastMouseMove.y === y) return;
    this.lastMouseMove = x === undefined || y === undefined ? undefined : { x, y };
    const visible = x !== undefined && y !== undefined;
    this.send({ type: 'clientMultiplayerMouseMove', x, y, visible });
  }

  async sendSelection(selection: string) {
    this.send({ type: 'clientMultiplayerSelection', selection });
  }

  private sendChangeSheet = () => {
    this.send({ type: 'clientMultiplayerSheet', sheetId: sheets.sheet.id });
  };

  sendCellEdit(options: {
    text: string;
    cursor: number;
    codeEditor: boolean;
    inlineCodeEditor: boolean;
    bold?: boolean;
    italic?: boolean;
  }) {
    const { text, cursor, codeEditor, inlineCodeEditor, bold, italic } = options;
    this.send({
      type: 'clientMultiplayerCellEdit',
      cellEdit: {
        text,
        cursor,
        active: true,
        code_editor: codeEditor,
        inline_code_editor: inlineCodeEditor,
        bold,
        italic,
      },
    });
  }

  sendEndCellEdit() {
    this.send({ type: 'clientMultiplayerCellEdit' });
  }

  sendViewport(viewport: string) {
    this.send({ type: 'clientMultiplayerViewport', viewport });
  }

  sendCodeRunning(sheetPos: SheetPosTS[]) {
    this.send({ type: 'clientMultiplayerCodeRunning', sheetPos: JSON.stringify(sheetPos) });
  }

  sendFollow(follow: string) {
    this.send({ type: 'clientMultiplayerFollow', follow });
  }

  private clearAllUsers() {
    if (debugShowMultiplayer) console.log('[Multiplayer] Clearing all users.');
    this.users.clear();
    pixiApp.multiplayerCursor.dirty = true;
    events.emit('multiplayerUpdate', this.getUsers());
    events.emit('multiplayerChangeSheet');
    events.emit('multiplayerCursor');
  }

  private receiveUserUpdate(userUpdate: MultiplayerClientUserUpdate) {
    const player = this.users.get(userUpdate.sessionId);

    // it's possible we get the UserUpdate before the EnterRoom response. No big deal if we do.
    if (!player) return;

    if (userUpdate.fileId !== this.fileId) {
      throw new Error("Expected file_id to match room before receiving a message of type 'MouseMove'");
    }
    const update = userUpdate.userUpdate;
    if (update.x !== null && update.y !== null) {
      player.x = update.x;
      player.y = update.y;
      if (player.sheet_id === sheets.sheet.id) {
        events.emit('multiplayerCursor');
      }
    }

    if (update.visible !== undefined) {
      player.visible = update.visible;
    }

    if (update.sheet_id) {
      if (player.sheet_id !== update.sheet_id) {
        player.sheet_id = update.sheet_id;
        events.emit('multiplayerChangeSheet');
        if (player.sheet_id === sheets.sheet.id) {
          pixiApp.multiplayerCursor.dirty = true;
          events.emit('multiplayerCursor');
        }
      }
    }

    if (update.selection) {
      player.selection = update.selection;
      player.parsedSelection = player.selection ? JSON.parse(player.selection) : undefined;
      if (player.sheet_id === sheets.sheet.id) {
        pixiApp.multiplayerCursor.dirty = true;
      }
    }

    if (update.cell_edit) {
      player.cell_edit = update.cell_edit;
      if (!update.cell_edit.code_editor) {
        if (player.parsedSelection) {
          // hide the label if the player is editing the cell
          pixiApp.cellsSheets.showLabel(
            player.parsedSelection.cursorPosition.x,
            player.parsedSelection.cursorPosition.y,
            player.sheet_id,
            !player.cell_edit.active
          );
        }
        events.emit('multiplayerCellEdit', update.cell_edit, player);
      }
      pixiApp.multiplayerCursor.dirty = true;
    }

    if (update.viewport) {
      player.viewport = update.viewport;
      if (pixiAppSettings.editorInteractionState.follow === player.session_id) {
        pixiApp.viewport.loadMultiplayerViewport(JSON.parse(player.viewport));
      }
    }

    if (update.code_running) {
      player.code_running = update.code_running;
      player.parsedCodeRunning = JSON.parse(update.code_running);

      // trigger changes in CodeRunning.tsx
      events.emit('multiplayerCodeRunning', player);
    }

    if (update.follow !== null) {
      player.follow = update.follow;
      events.emit('multiplayerFollow');
    }
  }

  // updates the React hook to populate the Avatar list
  private receiveUsersInRoom(room: ReceiveRoom) {
    if (room.min_version.requiredVersion > updateAlertVersion.requiredVersion) {
      events.emit('needRefresh', 'required');
    } else if (room.min_version.recommendedVersion > updateAlertVersion.recommendedVersion) {
      events.emit('needRefresh', 'recommended');
    }
    const remaining = new Set(this.users.keys());
    for (const user of room.users) {
      if (user.session_id === this.sessionId) {
        this.index = user.index;
        this.colorString = MULTIPLAYER_COLORS[user.index % MULTIPLAYER_COLORS.length];
      } else {
        let player = this.users.get(user.session_id);
        if (player) {
          player.first_name = user.first_name;
          player.last_name = user.last_name;
          player.image = user.image;
          player.sheet_id = user.sheet_id;
          player.selection = user.selection;
          player.parsedSelection = user.selection ? JSON.parse(user.selection) : undefined;
          remaining.delete(user.session_id);
          if (debugShowMultiplayer) console.log(`[Multiplayer] Updated player ${user.first_name}.`);
        } else {
          player = {
            session_id: user.session_id,
            file_id: user.file_id,
            user_id: user.user_id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            image: user.image,
            sheet_id: user.sheet_id,
            selection: user.selection,
            parsedSelection: user.selection ? JSON.parse(user.selection) : undefined,
            cell_edit: user.cell_edit,
            x: 0,
            y: 0,
            color: MULTIPLAYER_COLORS_TINT[user.index % MULTIPLAYER_COLORS_TINT.length],
            colorString: MULTIPLAYER_COLORS[user.index % MULTIPLAYER_COLORS.length],
            visible: false,
            index: user.index,
            viewport: user.viewport,
            code_running: user.code_running,
            parsedCodeRunning: user.code_running ? JSON.parse(user.code_running) : [],
            follow: user.follow,
          };
          this.users.set(user.session_id, player);
          if (debugShowMultiplayer) console.log(`[Multiplayer] Player ${user.first_name} entered room.`);
        }
      }
    }
    remaining.forEach((sessionId) => {
      if (debugShowMultiplayer) console.log(`[Multiplayer] Player ${this.users.get(sessionId)?.first_name} left room.`);
      this.users.delete(sessionId);
    });
    events.emit('multiplayerUpdate', this.getUsers());
    pixiApp.multiplayerCursor.dirty = true;
  }
}

export const multiplayer = new Multiplayer();
