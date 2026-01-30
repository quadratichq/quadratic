//! User-focused URL parameters (default behavior)

import { getAIAnalystInitialized } from '@/app/ai/atoms/aiAnalystAtoms';
import { type ImportFile } from '@/app/ai/hooks/useImportFilesToGrid';
import { filesFromIframe, IMPORT_FILE_EXTENSIONS } from '@/app/ai/iframeAiChatFiles/FilesFromIframe';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { arrayBufferToBase64, getExtension } from '@/app/helpers/files';
import type { CodeCellLanguage } from '@/app/quadratic-core-types';
import { isSupportedMimeType } from 'quadratic-shared/ai/helpers/files.helper';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { FileContent } from 'quadratic-shared/typesAndSchemasAI';
import { ConnectionTypeSchema } from 'quadratic-shared/typesAndSchemasConnections';

export class UrlParamsUser {
  private pixiAppSettingsInitialized = false;
  private aiAnalystInitialized = false;
  private chatId?: string;
  private iframeFilesLoaded = false;
  private aiAnalystPromptLoaded = false;

  dirty = false;

  constructor(params: URLSearchParams) {
    this.loadSheet(params);
    this.loadCursor(params);
    this.loadCode(params);
    this.loadIframeFiles(params);
    this.loadAIAnalystPrompt(params);
    this.setupListeners(params);
  }

  private loadSheet = (params: URLSearchParams) => {
    const sheetName = params.get('sheet');
    if (sheetName) {
      const sheetId = sheets.getSheetByName(decodeURI(sheetName), true)?.id;
      if (sheetId) {
        sheets.current = sheetId;
        return;
      }
    }
  };

  private loadCursor = (params: URLSearchParams) => {
    const x = parseInt(params.get('x') ?? '');
    const y = parseInt(params.get('y') ?? '');
    if (!isNaN(x) && !isNaN(y)) {
      sheets.sheet.cursor.moveTo(x, y, { checkForTableRef: true });
    }
  };

  private loadCode = (params: URLSearchParams) => {
    const code = params.get('code');
    if (code) {
      let language: CodeCellLanguage | undefined;
      if (code === 'python') language = 'Python';
      else if (code === 'javascript') language = 'Javascript';
      else if (code === 'formula') language = 'Formula';
      if (language) {
        if (!pixiAppSettings.setEditorInteractionState) {
          throw new Error('Expected setEditorInteractionState to be set in urlParams.loadCode');
        }
        const { x, y } = sheets.sheet.cursor.position;
        pixiAppSettings.setCodeEditorState?.((prev) => ({
          ...prev,
          showCodeEditor: true,
          initialCode: '',
          codeCell: {
            sheetId: sheets.current,
            pos: { x, y },
            language,
            lastModified: 0,
          },
        }));
      }
    }
  };

  private loadIframeFiles = (params: URLSearchParams) => {
    if (this.iframeFilesLoaded) return;

    const chatId = params.get('chat-id');
    if (!chatId) {
      this.iframeFilesLoaded = true;
      return;
    }

    this.chatId = chatId;

    // Remove the `chat-id` param when we're done
    const url = new URL(window.location.href);
    params.delete('chat-id');
    url.search = params.toString();
    window.history.replaceState(null, '', url.toString());

    filesFromIframe.loadFiles(chatId);
  };

  private loadAIAnalystPrompt = async (params: URLSearchParams) => {
    if (this.aiAnalystPromptLoaded) return;

    this.aiAnalystInitialized = getAIAnalystInitialized();

    if (!this.pixiAppSettingsInitialized || !this.iframeFilesLoaded || !this.aiAnalystInitialized) return;

    this.aiAnalystPromptLoaded = true;

    const prompt = params.get('prompt');
    if (!prompt) return;

    // Read connection params if present
    const connectionUuid = params.get('connection-uuid');
    const connectionType = params.get('connection-type');
    const connectionName = params.get('connection-name');

    // Remove the URL params when we're done
    const url = new URL(window.location.href);
    params.delete('prompt');
    params.delete('connection-uuid');
    params.delete('connection-type');
    params.delete('connection-name');
    url.search = params.toString();
    window.history.replaceState(null, '', url.toString());

    if (!pixiAppSettings.permissions.includes('FILE_EDIT')) return;

    const chatId = this.chatId;
    this.chatId = undefined;

    const files: FileContent[] = [];
    const importFiles: ImportFile[] = [];

    // segregate files into aiFiles and importFiles
    for (const file of filesFromIframe.dbFiles) {
      if (isSupportedMimeType(file.mimeType)) {
        files.push({
          type: 'data',
          data: arrayBufferToBase64(file.data),
          mimeType: file.mimeType,
          fileName: file.name,
        });
      } else if (IMPORT_FILE_EXTENSIONS.includes(getExtension(file.name))) {
        importFiles.push(file);
      }
    }
    filesFromIframe.dbFiles = [];

    // Build connection context if connection params are present and connection type is valid
    const parsedConnectionType = connectionType ? ConnectionTypeSchema.safeParse(connectionType) : null;
    const connection =
      connectionUuid && parsedConnectionType?.success && connectionName
        ? { id: connectionUuid, type: parsedConnectionType.data, name: connectionName }
        : undefined;

    // Emit event for React to handle the prompt submission
    events.emit('aiAnalystSubmitPrompt', {
      content: [...files, createTextContent(prompt)],
      messageSource: chatId ? `MarketingSite:${chatId}` : 'UrlPrompt',
      context: { codeCell: undefined, connection },
      messageIndex: 0,
      importFiles,
    });
  };

  private setupListeners = (params: URLSearchParams) => {
    events.on('cursorPosition', this.setDirty);
    events.on('changeSheet', this.setDirty);
    events.on('codeEditor', this.setDirty);

    events.on('pixiAppSettingsInitialized', () => {
      this.pixiAppSettingsInitialized = true;
      this.loadAIAnalystPrompt(params);
    });
    events.on('aiAnalystInitialized', () => {
      this.aiAnalystInitialized = true;
      this.loadAIAnalystPrompt(params);
    });
    events.on('filesFromIframeInitialized', () => {
      this.iframeFilesLoaded = true;
      this.loadAIAnalystPrompt(params);
    });
  };

  private setDirty = () => {
    this.dirty = true;
  };

  updateParams = () => {
    if (this.dirty) {
      this.dirty = false;
      const url = new URLSearchParams(window.location.search);
      const { showCodeEditor, codeCell } = pixiAppSettings.codeEditorState;

      // if code editor is open, we use its x, y, and sheet name
      if (showCodeEditor) {
        url.set('code', getLanguage(codeCell.language).toLowerCase());
        url.set('x', codeCell.pos.x.toString());
        url.set('y', codeCell.pos.y.toString());
        if (codeCell.sheetId !== sheets.getFirst().id) {
          const sheetName = sheets.getById(codeCell.sheetId)?.name;
          if (!sheetName) {
            throw new Error('Expected to find sheet in urlParams.updateParams');
          }
          url.set('sheet', encodeURI(sheetName));
        } else {
          url.delete('sheet');
        }
      }

      // otherwise we use the normal cursor
      else {
        const cursor = sheets.sheet.cursor.position;
        url.set('x', cursor.x.toString());
        url.set('y', cursor.y.toString());
        if (sheets.sheet !== sheets.getFirst()) {
          url.set('sheet', encodeURI(sheets.sheet.name));
        } else {
          url.delete('sheet');
        }
        url.delete('code');
      }

      window.history.replaceState({}, '', `?${url.toString()}`);
    }
  };
}
