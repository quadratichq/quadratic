//! User-focused URL parameters (default behavior)

import { filesFromIframe, IMPORT_FILE_EXTENSIONS } from '@/app/ai/iframeAiChatFiles/FilesFromIframe';
import type { DbFile } from '@/app/ai/iframeAiChatFiles/IframeMessages';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { arrayBufferToBase64, getExtension, getFileTypeFromName } from '@/app/helpers/files';
import type { CodeCellLanguage, JsCoordinate } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { isSupportedMimeType } from 'quadratic-shared/ai/helpers/files.helper';
import type { FileContent } from 'quadratic-shared/typesAndSchemasAI';

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

  private importDbFilesToGrid = async (importFiles: DbFile[]) => {
    if (!this.pixiAppSettingsInitialized || !this.iframeFilesLoaded || importFiles.length === 0) return;

    if (!pixiAppSettings.permissions.includes('FILE_EDIT')) return;

    const { setFilesImportProgress } = pixiAppSettings;
    if (!setFilesImportProgress) {
      throw new Error('Expected setFilesImportProgress to be set in urlParams.loadAIAnalystPrompt');
    }

    const firstSheet = sheets.getFirst();
    if (!firstSheet) {
      throw new Error('Expected to find firstSheet in urlParams.loadAIAnalystPrompt');
    }

    // push excel files to the end of the array
    importFiles.sort((a, b) => {
      const extensionA = getExtension(a.name);
      const extensionB = getExtension(b.name);
      if (['xls', 'xlsx'].includes(extensionA)) return 1;
      if (['xls', 'xlsx'].includes(extensionB)) return -1;
      return 0;
    });

    // initialize the import progress state
    setFilesImportProgress(() => ({
      importing: true,
      createNewFile: false,
      files: importFiles.map((file) => ({
        name: file.name,
        size: file.size,
        step: 'read',
        progress: 0,
      })),
    }));

    // import files to the grid
    for (const file of importFiles) {
      // update the current file index
      setFilesImportProgress((prev) => {
        const currentFileIndex = (prev.currentFileIndex ?? -1) + 1;
        return {
          ...prev,
          currentFileIndex,
        };
      });

      const fileType = getFileTypeFromName(file.name);
      if (!fileType || fileType === 'grid') {
        console.warn(`Unsupported file type: ${file.name}`);
        continue;
      }

      const sheetBounds = firstSheet.bounds;
      const insertAt: JsCoordinate = {
        x: sheetBounds.type === 'empty' ? 1 : Number(sheetBounds.max.x) + 2,
        y: 1,
      };

      await quadraticCore.importFile({
        file: file.data,
        fileName: file.name,
        fileType,
        sheetId: firstSheet.id,
        location: insertAt,
        cursor: sheets.sheet.cursor.position.toString(),
        isAi: false,
      });
    }

    // reset the import progress state
    setFilesImportProgress(() => ({
      importing: false,
      createNewFile: false,
      files: [],
    }));

    // reset the open sheet and cursor to the first sheet and first cell
    sheets.current = firstSheet.id;
    sheets.sheet.cursor.moveTo(1, 1);
  };

  private loadAIAnalystPrompt = async (params: URLSearchParams) => {
    if (this.aiAnalystPromptLoaded) return;

    if (!this.pixiAppSettingsInitialized || !this.iframeFilesLoaded || !this.aiAnalystInitialized) return;

    this.aiAnalystPromptLoaded = true;

    const prompt = params.get('prompt');
    if (!prompt) return;

    // Remove the `prompt` param when we're done
    const url = new URL(window.location.href);
    params.delete('prompt');
    url.search = params.toString();
    window.history.replaceState(null, '', url.toString());

    if (!pixiAppSettings.permissions.includes('FILE_EDIT')) return;

    const { submitAIAnalystPrompt } = pixiAppSettings;
    if (!submitAIAnalystPrompt) {
      throw new Error('Expected submitAIAnalystPrompt to be set in urlParams.loadAIAnalystPrompt');
    }

    const chatId = this.chatId;
    this.chatId = undefined;

    const importFiles: DbFile[] = [];
    const aiFiles: FileContent[] = [];

    // segregate files into aiFiles and importFiles
    for (const file of filesFromIframe.dbFiles) {
      if (isSupportedMimeType(file.mimeType)) {
        aiFiles.push({
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

    // import the files to the grid
    await this.importDbFilesToGrid(importFiles).catch((error) => {
      console.error('Error importing files to grid', error);
    });

    // submit the prompt and files to the ai analyst
    submitAIAnalystPrompt({
      chatId,
      content: [...aiFiles, { type: 'text', text: prompt }],
      messageSource: chatId ? 'MarketingSite' : 'UrlPrompt',
      context: {
        sheets: [],
        currentSheet: sheets.sheet.name,
        selection: undefined,
      },
      messageIndex: 0,
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
