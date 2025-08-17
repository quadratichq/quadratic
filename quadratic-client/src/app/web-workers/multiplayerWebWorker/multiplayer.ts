import { hasPermissionToEditFile } from '@/app/actions';
import { debugFlag } from '@/app/debugFlags/debugFlags';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { MULTIPLAYER_COLORS, MULTIPLAYER_COLORS_TINT } from '@/app/gridGL/HTMLGrid/multiplayerCursor/multiplayerColors';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { JsSelection } from '@/app/quadratic-core/quadratic_core';
import { isPatchVersionDifferent } from '@/app/schemas/compareVersions';
import { RefreshType } from '@/app/shared/types/RefreshType';
import type { SheetPosTS } from '@/app/shared/types/size';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import type { LanguageState } from '@/app/web-workers/languageTypes';
import type {
  ClientMultiplayerMessage,
  MultiplayerClientMessage,
  MultiplayerClientUserUpdate,
  MultiplayerState,
} from '@/app/web-workers/multiplayerWebWorker/multiplayerClientMessages';
import type { MultiplayerUser, ReceiveRoom } from '@/app/web-workers/multiplayerWebWorker/multiplayerTypes';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { User } from '@/auth/auth';
import { authClient } from '@/auth/auth';
import { parseDomain } from '@/auth/auth.helper';
import { VERSION } from '@/shared/constants/appConstants';
import { sendAnalyticsError } from '@/shared/utils/error';
import { displayName } from '@/shared/utils/userUtil';
import { v4 as uuid } from 'uuid';

// time to recheck the version of the client after receiving a different version
// from the server
const RECHECK_VERSION_INTERVAL = 5000;

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
    window.addEventListener('online', () => this.sendOnline());
    window.addEventListener('offline', () => this.sendOffline());
    events.on('changeSheet', this.sendChangeSheet);
    events.on('pythonState', this.pythonState);
    events.on('multiplayerState', (state: MultiplayerState) => {
      this.state = state;
    });
  }

  private sendAnalyticsError = (from: string, error: Error | unknown) => {
    sendAnalyticsError('multiplayer', from, error);
  };

  initWorker() {
    this.worker = new Worker(new URL('./worker/multiplayer.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;
    this.worker.onerror = (error) => {
      this.sendAnalyticsError('initWorker', error);
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

  private handleMessage = async (e: MessageEvent<MultiplayerClientMessage>) => {
    if (debugFlag('debugWebWorkersMessages')) console.log(`[Multiplayer] message: ${e.data.type}`);

    switch (e.data.type) {
      case 'multiplayerClientState':
        this.state = e.data.state;
        if (this.state === 'no internet' || this.state === 'waiting to reconnect') {
          this.clearAllUsers();
          this.brokenConnection = true;
        } else if (this.state === 'connected') {
          this.brokenConnection = false;
        }
        events.emit('multiplayerState', this.state);
        break;

      case 'multiplayerClientUserUpdate':
        this.receiveUserUpdate(e.data);
        break;

      case 'multiplayerClientUsersInRoom':
        await this.receiveUsersInRoom(e.data.room);
        break;

      case 'multiplayerClientReload':
        events.emit('needRefresh', RefreshType.FORCE);
        break;

      case 'multiplayerClientRefreshJwt':
        await this.addJwtCookie(true);
        this.send({ type: 'clientMultiplayerRefreshJwt', id: e.data.id });
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
        sheetId: sheets.current,
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
        const cursor = player.parsedSelection.getCursor();
        if (cursor.x === x && cursor.y === y) {
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
    this.send({ type: 'clientMultiplayerSheet', sheetId: sheets.current });
  };

  private sendOnline = () => {
    // don't send this event if we not in app, if not initialized yet
    if (this.fileId) {
      this.send({ type: 'clientMultiplayerOnline' });
    }
  };

  private sendOffline = () => {
    // don't send this event if we not in app, if not initialized yet
    if (this.fileId) {
      this.send({ type: 'clientMultiplayerOffline' });
    }
  };

  sendCellEdit(options: {
    text: string;
    cursor: number;
    codeEditor: boolean;
    inlineCodeEditor: boolean;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikeThrough?: boolean;
  }) {
    const { text, cursor, codeEditor, inlineCodeEditor, bold, italic, underline, strikeThrough } = options;
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
        underline,
        strikeThrough,
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
    if (debugFlag('debugShowMultiplayer')) console.log('[Multiplayer] Clearing all users.');
    this.users.clear();
    pixiApp.setCursorDirty({ multiplayerCursor: true });
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
      if (player.sheet_id === sheets.current) {
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
        if (player.sheet_id === sheets.current) {
          pixiApp.setCursorDirty({ multiplayerCursor: true });
          events.emit('multiplayerCursor');
        }
      }
    }

    if (update.selection) {
      player.selection = update.selection;
      player.parsedSelection = new JsSelection(player.sheet_id);
      if (player.selection) {
        player.parsedSelection.load(player.selection);
      }
      if (player.sheet_id === sheets.current) {
        pixiApp.setCursorDirty({ multiplayerCursor: true });
      }
    }

    if (update.cell_edit) {
      player.cell_edit = update.cell_edit;
      if (!update.cell_edit.code_editor) {
        if (player.parsedSelection) {
          // hide the label if the player is editing the cell
          const cursor = player.parsedSelection.getCursor();
          pixiApp.cellsSheets.showLabel(cursor.x, cursor.y, player.sheet_id, !player.cell_edit.active);
        }
        events.emit('multiplayerCellEdit', update.cell_edit, player);
      }
      pixiApp.setCursorDirty({ multiplayerCursor: true });
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

  private async checkVersion(serverVersion: string) {
    if (serverVersion === VERSION) {
      return;
    }

    if (debugFlag('debugShowVersionCheck')) {
      console.log(`Multiplayer server version (${serverVersion}) is different than the client version (${VERSION})`);
    }

    try {
      const versionClientJson = await fetch('/version.json').then((res) => res.json());
      if (typeof versionClientJson !== 'object' || !('version' in versionClientJson)) {
        throw new Error(`Invalid version.json: ${JSON.stringify(versionClientJson)}`);
      }
      const versionClient = versionClientJson.version;

      // we may have to wait to show the update dialog if the client version
      // on the server is different than the one served from the client
      if (versionClient === serverVersion) {
        events.emit(
          'needRefresh',
          isPatchVersionDifferent(versionClient, VERSION) ? RefreshType.RECOMMENDED : RefreshType.REQUIRED
        );
      } else {
        if (debugFlag('debugShowVersionCheck')) {
          console.log(
            `quadratic-client's version (${versionClient}) does not yet match the quadratic-multiplayer's version (${serverVersion}) (trying again in ${RECHECK_VERSION_INTERVAL}ms)`
          );
        }
        setTimeout(() => this.checkVersion(serverVersion), RECHECK_VERSION_INTERVAL);
      }
    } catch (e) {
      console.warn('[multiplayer.ts] checkVersion: Failed to fetch /version.json file', e);
      setTimeout(() => this.checkVersion(serverVersion), RECHECK_VERSION_INTERVAL);
    }
  }

  // updates the React hook to populate the Avatar list
  private async receiveUsersInRoom(room: ReceiveRoom) {
    const remaining = new Set(this.users.keys());
    for (const user of room.users) {
      if (user.session_id === this.sessionId) {
        this.index = user.index;
        this.colorString = MULTIPLAYER_COLORS[user.index % MULTIPLAYER_COLORS.length];
      } else {
        let player = this.users.get(user.session_id);
        const parsedSelection = new JsSelection(user.sheet_id);
        if (user.selection) {
          parsedSelection.load(user.selection);
        }
        if (player) {
          player.first_name = user.first_name;
          player.last_name = user.last_name;
          player.image = user.image;
          player.sheet_id = user.sheet_id;
          player.selection = user.selection;
          player.parsedSelection = parsedSelection;
          remaining.delete(user.session_id);
          if (debugFlag('debugShowMultiplayer')) console.log(`[Multiplayer] Updated player ${user.first_name}.`);
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
            parsedSelection,
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
          if (debugFlag('debugShowMultiplayer')) console.log(`[Multiplayer] Player ${user.first_name} entered room.`);
        }
      }
    }
    remaining.forEach((sessionId) => {
      if (debugFlag('debugShowMultiplayer'))
        console.log(`[Multiplayer] Player ${this.users.get(sessionId)?.first_name} left room.`);
      this.users.delete(sessionId);
    });
    events.emit('multiplayerUpdate', this.getUsers());
    pixiApp.setCursorDirty({ multiplayerCursor: true });

    await this.checkVersion(room.version);
  }
}

export const multiplayer = new Multiplayer();
