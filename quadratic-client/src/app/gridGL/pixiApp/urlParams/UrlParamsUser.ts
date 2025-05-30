//! User-focused URL parameters (default behavior)

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import type { CodeCellLanguage } from '@/app/quadratic-core-types';

export class UrlParamsUser {
  private pixiAppSettingsInitialized = false;
  private aiAnalystInitialized = false;
  private aiAnalystPromptLoaded = false;

  dirty = false;

  constructor(params: URLSearchParams) {
    this.loadSheet(params);
    this.loadCursor(params);
    this.loadCode(params);
    this.loadAIAnalystPrompt(params);
    this.setupListeners(params);
  }

  private loadSheet(params: URLSearchParams) {
    const sheetName = params.get('sheet');
    if (sheetName) {
      const sheetId = sheets.getSheetByName(decodeURI(sheetName), true)?.id;
      if (sheetId) {
        sheets.current = sheetId;
        return;
      }
    }
  }

  private loadCursor(params: URLSearchParams) {
    const x = parseInt(params.get('x') ?? '');
    const y = parseInt(params.get('y') ?? '');
    if (!isNaN(x) && !isNaN(y)) {
      sheets.sheet.cursor.moveTo(x, y, { checkForTableRef: true });
    }
  }

  private loadCode(params: URLSearchParams) {
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
  }

  private loadAIAnalystPrompt = (params: URLSearchParams) => {
    if (!this.pixiAppSettingsInitialized || !this.aiAnalystInitialized) return;
    if (this.aiAnalystPromptLoaded) return;
    if (!pixiAppSettings.permissions.includes('FILE_EDIT')) return;

    const prompt = params.get('prompt');
    if (!prompt) return;

    const { submitAIAnalystPrompt } = pixiAppSettings;
    if (!submitAIAnalystPrompt) {
      throw new Error('Expected submitAIAnalystPrompt to be set in urlParams.loadAIAnalystPrompt');
    }

    submitAIAnalystPrompt({
      content: [{ type: 'text', text: prompt }],
      context: {
        sheets: [],
        currentSheet: sheets.sheet.name,
        selection: undefined,
      },
      messageIndex: 0,
    });

    // Remove the `prompt` param when we're done
    const url = new URL(window.location.href);
    params.delete('prompt');
    url.search = params.toString();
    window.history.replaceState(null, '', url.toString());

    this.aiAnalystPromptLoaded = true;
  };

  private setupListeners(params: URLSearchParams) {
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
  }

  private setDirty = () => {
    this.dirty = true;
  };

  updateParams() {
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
  }
}
