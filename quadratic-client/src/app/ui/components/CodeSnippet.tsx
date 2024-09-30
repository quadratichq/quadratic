import { codeEditorAtom, codeEditorModifiedEditorContentAtom } from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { useGetCodeCell } from '@/app/ui/menus/AIAssistant/useGetCodeCell';
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
import { useCallback, useState } from 'react';
import { useSetRecoilState } from 'recoil';

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
  } else if (syntax === 'snowflake') {
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
  const setModifiedEditorContent = useSetRecoilState(codeEditorModifiedEditorContentAtom);
  const { getCodeCell } = useGetCodeCell();

  const handleSaveAndRun = useCallback(() => {
    mixpanel.track('[AI].code.run', { language });
    const codeCell = getCodeCell();
    quadraticCore.setCodeCellValue({
      sheetId: codeCell.sheetId,
      x: codeCell.pos.x,
      y: codeCell.pos.y,
      codeString: text ?? '',
      language: codeCell.language,
      cursor: sheets.getCursorPosition(),
    });
    setModifiedEditorContent(undefined);
  }, [getCodeCell, language, setModifiedEditorContent, text]);

  return (
    <TooltipHint title={'Save and run code'}>
      <IconButton size="small" onClick={handleSaveAndRun}>
        <PlayArrowOutlined fontSize="inherit" color="inherit" className="text-muted-foreground" />
      </IconButton>
    </TooltipHint>
  );
}

function CodeSnippetReplaceButton({ language, text }: { language: CodeSnippetProps['language']; text: string }) {
  const setCodeEditorState = useSetRecoilState(codeEditorAtom);
  const { getCodeCell } = useGetCodeCell();

  const handleReplace = useCallback(() => {
    mixpanel.track('[AI].code.replace', { language });
    const codeCell = getCodeCell();
    setCodeEditorState((prev) => ({
      ...prev,
      modifiedEditorContent: undefined,
      waitingForEditorClose: {
        codeCell,
        showCellTypeMenu: false,
        inlineEditor: false,
        initialCode: text,
      },
    }));
  }, [getCodeCell, language, setCodeEditorState, text]);

  return (
    <TooltipHint title={'Open in code editor'}>
      <IconButton size="small" onClick={handleReplace} disabled={!language}>
        <ContentPasteGoOutlined fontSize="inherit" color="inherit" className="text-muted-foreground" />
      </IconButton>
    </TooltipHint>
  );
}

function CodeSnippetDiffEditor({ language, text }: { language: CodeSnippetProps['language']; text: string }) {
  const setCodeEditorState = useSetRecoilState(codeEditorAtom);
  const { getCodeCell } = useGetCodeCell();

  const handleEditorDiff = useCallback(() => {
    mixpanel.track('[AI].code.diff');
    const codeCell = getCodeCell();
    setCodeEditorState((prev) => ({
      ...prev,
      modifiedEditorContent: text,
      waitingForEditorClose: {
        codeCell,
        showCellTypeMenu: false,
        inlineEditor: false,
        initialCode: undefined,
      },
    }));
  }, [getCodeCell, setCodeEditorState, text]);

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
