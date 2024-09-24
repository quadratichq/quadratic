import { aiAssistantContextAtom, CodeCell } from '@/app/atoms/aiAssistantAtom';
import { codeEditorModifiedEditorContentAtom } from '@/app/atoms/codeEditorAtom';
import {
  editorInteractionStateModeAtom,
  editorInteractionStateSelectedCellAtom,
  editorInteractionStateSelectedCellSheetAtom,
  editorInteractionStateWaitingForEditorCloseAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { getCodeCellLanguage } from '@/app/helpers/codeCellLanguage';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { codeEditorBaseStyles } from '@/app/ui/menus/CodeEditor/styles';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import Editor from '@monaco-editor/react';
import {
  ContentCopyOutlined,
  ContentPasteGoOutlined,
  DifferenceOutlined,
  PlayArrowOutlined,
} from '@mui/icons-material';
import { IconButton } from '@mui/material';
import mixpanel from 'mixpanel-browser';
import { useCallback, useMemo, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

interface CodeSnippetProps {
  code: string;
  language: string;
}

export function CodeSnippet({ code, language = 'plaintext' }: CodeSnippetProps) {
  let syntax = language.toLowerCase();
  if (syntax === 'postgres') {
    syntax = 'sql';
  } else if (syntax === 'mysql') {
    syntax = 'sql';
  } else if (syntax === 'mssql') {
    syntax = 'sql';
  }

  return (
    <div style={codeEditorBaseStyles} className="overflow-hidden rounded border shadow-sm">
      <div className="flex flex-row items-center justify-between gap-2 bg-accent px-3 py-1">
        <div className="lowercase text-muted-foreground">{language}</div>

        <div className="flex items-center gap-1">
          <CodeSnippetRunButton text={code} language={language} />
          <CodeSnippetReplaceButton text={code} language={language} />
          <CodeSnippetDiffEditor text={code} language={language} />
          <CodeSnippetCopyButton text={code} language={language} />
        </div>
      </div>
      <div
        className="relative pt-2"
        style={{
          // calculate height based on number of lines
          height: `${Math.ceil(code.split('\n').length) * 19 + 16}px`,
        }}
      >
        <Editor
          language={syntax}
          value={code}
          height="100%"
          width="100%"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            scrollbar: {
              vertical: 'hidden',
              handleMouseWheel: false,
            },
            scrollBeyondLastLine: false,
            wordWrap: 'off',
            lineNumbers: 'off',
            automaticLayout: true,
            folding: false,
            renderLineHighlightOnlyWhenFocus: true,
          }}
        />
      </div>
    </div>
  );
}

function CodeSnippetRunButton({ language, text }: { language: CodeSnippetProps['language']; text: string }) {
  const selectedCellSheet = useRecoilValue(editorInteractionStateSelectedCellSheetAtom);
  const selectedCell = useRecoilValue(editorInteractionStateSelectedCellAtom);
  const mode = useRecoilValue(editorInteractionStateModeAtom);
  const setModifiedEditorContent = useSetRecoilState(codeEditorModifiedEditorContentAtom);
  const aiAssistantContext = useRecoilValue(aiAssistantContextAtom);
  const codeCell: CodeCell = useMemo(
    () =>
      aiAssistantContext.codeCell ?? {
        sheetId: selectedCellSheet ? selectedCellSheet : sheets.current,
        pos: selectedCell,
        language: getCodeCellLanguage(language) ?? mode ?? 'Python',
      },
    [aiAssistantContext.codeCell, language, mode, selectedCell, selectedCellSheet]
  );
  const handleSaveAndRun = useCallback(() => {
    mixpanel.track('[AI].code.run', { language });
    quadraticCore.setCodeCellValue({
      sheetId: codeCell.sheetId,
      x: codeCell.pos.x,
      y: codeCell.pos.y,
      codeString: text ?? '',
      language: codeCell.language,
      cursor: sheets.getCursorPosition(),
    });
    setModifiedEditorContent(undefined);
  }, [codeCell.language, codeCell.pos.x, codeCell.pos.y, codeCell.sheetId, language, setModifiedEditorContent, text]);

  return (
    <TooltipHint title={'Save and run code'}>
      <IconButton size="small" onClick={handleSaveAndRun}>
        <PlayArrowOutlined fontSize="inherit" color="inherit" className="text-muted-foreground" />
      </IconButton>
    </TooltipHint>
  );
}

function CodeSnippetReplaceButton({ language, text }: { language: CodeSnippetProps['language']; text: string }) {
  const selectedCellSheet = useRecoilValue(editorInteractionStateSelectedCellSheetAtom);
  const selectedCell = useRecoilValue(editorInteractionStateSelectedCellAtom);
  const mode = useRecoilValue(editorInteractionStateModeAtom);
  const setWaitingForEditorClose = useSetRecoilState(editorInteractionStateWaitingForEditorCloseAtom);
  const setModifiedEditorContent = useSetRecoilState(codeEditorModifiedEditorContentAtom);
  const aiAssistantContext = useRecoilValue(aiAssistantContextAtom);
  const codeCell: CodeCell = useMemo(
    () =>
      aiAssistantContext.codeCell ?? {
        sheetId: selectedCellSheet ? selectedCellSheet : sheets.current,
        pos: selectedCell,
        language: getCodeCellLanguage(language) ?? mode ?? 'Python',
      },
    [aiAssistantContext.codeCell, language, mode, selectedCell, selectedCellSheet]
  );
  const handleReplace = useCallback(() => {
    mixpanel.track('[AI].code.replace', { language });
    setWaitingForEditorClose({
      selectedCellSheet: codeCell.sheetId,
      selectedCell: codeCell.pos,
      mode: codeCell.language,
      showCellTypeMenu: false,
      inlineEditor: false,
      initialCode: text,
    });
    setModifiedEditorContent(undefined);
  }, [
    codeCell.language,
    codeCell.pos,
    codeCell.sheetId,
    language,
    setModifiedEditorContent,
    setWaitingForEditorClose,
    text,
  ]);

  return (
    <TooltipHint title={'Open in code editor'}>
      <IconButton size="small" onClick={handleReplace} disabled={!language}>
        <ContentPasteGoOutlined fontSize="inherit" color="inherit" className="text-muted-foreground" />
      </IconButton>
    </TooltipHint>
  );
}

function CodeSnippetDiffEditor({ language, text }: { language: CodeSnippetProps['language']; text: string }) {
  const selectedCellSheet = useRecoilValue(editorInteractionStateSelectedCellSheetAtom);
  const selectedCell = useRecoilValue(editorInteractionStateSelectedCellAtom);
  const mode = useRecoilValue(editorInteractionStateModeAtom);
  const setWaitingForEditorClose = useSetRecoilState(editorInteractionStateWaitingForEditorCloseAtom);
  const setModifiedEditorContent = useSetRecoilState(codeEditorModifiedEditorContentAtom);
  const aiAssistantContext = useRecoilValue(aiAssistantContextAtom);
  const codeCell: CodeCell = useMemo(
    () =>
      aiAssistantContext.codeCell ?? {
        sheetId: selectedCellSheet ? selectedCellSheet : sheets.current,
        pos: selectedCell,
        language: getCodeCellLanguage(language) ?? mode ?? 'Python',
      },
    [aiAssistantContext.codeCell, language, mode, selectedCell, selectedCellSheet]
  );
  const handleEditorDiff = useCallback(() => {
    mixpanel.track('[AI].code.diff');
    setWaitingForEditorClose({
      selectedCellSheet: codeCell.sheetId,
      selectedCell: codeCell.pos,
      mode: codeCell.language,
      showCellTypeMenu: false,
      inlineEditor: false,
      initialCode: undefined,
    });
    setModifiedEditorContent(text);
  }, [setWaitingForEditorClose, codeCell.sheetId, codeCell.pos, codeCell.language, setModifiedEditorContent, text]);

  return (
    <TooltipHint title={'Show diff in code editor'}>
      <IconButton onClick={handleEditorDiff} size="small">
        <DifferenceOutlined fontSize="inherit" color="inherit" className="text-muted-foreground" />
      </IconButton>
    </TooltipHint>
  );
}

function CodeSnippetCopyButton({ language, text }: { language: CodeSnippetProps['language']; text: string }) {
  const [tooltipMsg, setTooltipMsg] = useState<string>('Copy');
  const handleCopy = useCallback(() => {
    mixpanel.track('[AI].code.copy', { language });
    navigator.clipboard.writeText(text);
    setTooltipMsg('Copied!');
    setTimeout(() => {
      setTooltipMsg('Copy');
    }, 2000);
  }, [language, text]);

  return (
    <TooltipHint title={tooltipMsg}>
      <IconButton onClick={handleCopy} size="small">
        <ContentCopyOutlined fontSize="inherit" color="inherit" className="text-muted-foreground" />
      </IconButton>
    </TooltipHint>
  );
}
