import { aiAssistantContextAtom } from '@/app/atoms/aiAssistantAtom';
import {
  codeEditorAtom,
  codeEditorLanguageAtom,
  codeEditorLocationAtom,
  codeEditorModifiedEditorContentAtom,
} from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
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
import { useCallback, useState } from 'react';
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
  const location = useRecoilValue(codeEditorLocationAtom);
  const cellLanguage = useRecoilValue(codeEditorLanguageAtom);
  const setModifiedEditorContent = useSetRecoilState(codeEditorModifiedEditorContentAtom);
  const aiAssistantContext = useRecoilValue(aiAssistantContextAtom);

  const handleSaveAndRun = useCallback(() => {
    mixpanel.track('[AI].code.run', { language });
    quadraticCore.setCodeCellValue({
      sheetId: location.sheetId,
      x: location.pos.x,
      y: location.pos.y,
      codeString: text ?? '',
      language: cellLanguage,
      cursor: sheets.getCursorPosition(),
    });
    setModifiedEditorContent(undefined);
  }, [cellLanguage, language, location.pos.x, location.pos.y, location.sheetId, setModifiedEditorContent, text]);

  return (
    <TooltipHint title={'Save and run code'}>
      <IconButton size="small" onClick={handleSaveAndRun}>
        <PlayArrowOutlined fontSize="inherit" color="inherit" className="text-muted-foreground" />
      </IconButton>
    </TooltipHint>
  );
}

function CodeSnippetReplaceButton({ language, text }: { language: CodeSnippetProps['language']; text: string }) {
  const location = useRecoilValue(codeEditorLocationAtom);
  const cellLanguage = useRecoilValue(codeEditorLanguageAtom);
  const setCodeEditorState = useSetRecoilState(codeEditorAtom);
  const aiAssistantContext = useRecoilValue(aiAssistantContextAtom);
  const handleReplace = useCallback(() => {
    mixpanel.track('[AI].code.replace', { language });
    setCodeEditorState((prev) => ({
      ...prev,
      modifiedEditorContent: undefined,
      waitingForEditorClose: {
        location,
        language: cellLanguage,
        showCellTypeMenu: false,
        inlineEditor: false,
        initialCode: text,
      },
    }));
  }, [cellLanguage, language, location, setCodeEditorState, text]);

  return (
    <TooltipHint title={'Open in code editor'}>
      <IconButton size="small" onClick={handleReplace} disabled={!language}>
        <ContentPasteGoOutlined fontSize="inherit" color="inherit" className="text-muted-foreground" />
      </IconButton>
    </TooltipHint>
  );
}

function CodeSnippetDiffEditor({ language, text }: { language: CodeSnippetProps['language']; text: string }) {
  const location = useRecoilValue(codeEditorLocationAtom);
  const cellLanguage = useRecoilValue(codeEditorLanguageAtom);
  const setCodeEditorState = useSetRecoilState(codeEditorAtom);
  const aiAssistantContext = useRecoilValue(aiAssistantContextAtom);

  const handleEditorDiff = useCallback(() => {
    mixpanel.track('[AI].code.diff');
    setCodeEditorState((prev) => ({
      ...prev,
      modifiedEditorContent: text,
      waitingForEditorClose: {
        location,
        language: cellLanguage,
        showCellTypeMenu: false,
        inlineEditor: false,
        initialCode: undefined,
      },
    }));
  }, [cellLanguage, location, setCodeEditorState, text]);

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
