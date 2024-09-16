import { codeEditorEditorContentAtom, codeEditorModifiedEditorContentAtom } from '@/app/atoms/codeEditorAtom';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { codeEditorBaseStyles } from '@/app/ui/menus/CodeEditor/styles';
import Editor from '@monaco-editor/react';
import { ContentCopyOutlined, ContentPasteGoOutlined, DifferenceOutlined } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import mixpanel from 'mixpanel-browser';
import { useCallback, useState } from 'react';
import { useSetRecoilState } from 'recoil';

interface Props {
  code: string;
  language?: string;
}

export function CodeSnippet({ code, language = 'plaintext' }: Props) {
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
          <CodeSnippetInsertButton text={code} language={language} />
          <CodeSnippetDiffEditor text={code} />
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

function CodeSnippetInsertButton({ language, text }: { language: Props['language']; text: string }) {
  const setEditorContent = useSetRecoilState(codeEditorEditorContentAtom);

  // Replace what's in the editor with the given text
  const handleInsertReplace = useCallback(() => {
    mixpanel.track('[AI].code.replace', { language });
    setEditorContent(text);
  }, [language, text, setEditorContent]);

  return (
    <TooltipHint title={'Insert and replace'}>
      <IconButton size="small" onClick={handleInsertReplace}>
        <ContentPasteGoOutlined fontSize="inherit" color="inherit" className="text-muted-foreground" />
      </IconButton>
    </TooltipHint>
  );
}

function CodeSnippetDiffEditor({ text }: { text: string }) {
  const setModifiedEditorContent = useSetRecoilState(codeEditorModifiedEditorContentAtom);
  const handleEditorDiff = useCallback(() => {
    mixpanel.track('[AI].code.diff');
    setModifiedEditorContent(text);
  }, [text, setModifiedEditorContent]);

  return (
    <TooltipHint title={'Show diff in Code Editor'}>
      <IconButton onClick={handleEditorDiff} size="small">
        <DifferenceOutlined fontSize="inherit" color="inherit" className="text-muted-foreground" />
      </IconButton>
    </TooltipHint>
  );
}

function CodeSnippetCopyButton({ language, text }: { language: Props['language']; text: string }) {
  const [tooltipMsg, setTooltipMsg] = useState<string>('Copy');
  const handleCopy = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      mixpanel.track('[AI].code.copy', { language });
      navigator.clipboard.writeText(text);
      setTooltipMsg('Copied!');
      setTimeout(() => {
        setTooltipMsg('Copy');
      }, 2000);
    },
    [language, text]
  );

  return (
    <TooltipHint title={tooltipMsg}>
      <IconButton onClick={handleCopy} size="small">
        <ContentCopyOutlined fontSize="inherit" color="inherit" className="text-muted-foreground" />
      </IconButton>
    </TooltipHint>
  );
}
