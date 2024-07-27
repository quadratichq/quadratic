import Editor from '@monaco-editor/react';
import { ContentCopy, ContentPasteGoOutlined } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import mixpanel from 'mixpanel-browser';
import { useRef, useState } from 'react';

import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { useCodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import { codeEditorBaseStyles } from '@/app/ui/menus/CodeEditor/styles';

interface Props {
  code: string;
  language?: string;
}

export function CodeSnippet({ code, language = 'plaintext' }: Props) {
  const [tooltipMsg, setTooltipMsg] = useState<string>('Copy');
  const editorRef = useRef(null);

  const handleClick = (_e: any) => {
    mixpanel.track('[AI].code.copy', { language });
    if (editorRef.current) {
      navigator.clipboard.writeText(code);
      setTooltipMsg('Copied!');
      setTimeout(() => {
        setTooltipMsg('Copy');
      }, 2000);
    }
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  let syntax = language.toLowerCase();
  if (syntax === 'postgres') {
    syntax = 'sql';
  } else if (syntax === 'mysql') {
    syntax = 'sql';
  }

  return (
    <div style={codeEditorBaseStyles} className="overflow-hidden rounded border shadow-sm">
      <div className="flex flex-row items-center justify-between gap-2 bg-accent px-3 py-1">
        <div className="lowercase text-muted-foreground">{language}</div>

        <div className="flex items-center gap-1">
          <CodeEditorInsertButton text={code} language={language} />
          <TooltipHint title={tooltipMsg}>
            <IconButton onClick={handleClick} size="small">
              <ContentCopy fontSize="inherit" color="inherit" className="text-muted-foreground" />
            </IconButton>
          </TooltipHint>
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
          onMount={handleEditorDidMount}
        />
      </div>
    </div>
  );
}

function CodeEditorInsertButton({ language, text }: { language: Props['language']; text: string }) {
  const { editorRef } = useCodeEditor();

  // Replace what's in the editor with the given text
  const handleClick = () => {
    mixpanel.track('[AI].code.copy', { language });

    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (!model) return;

      const range = model.getFullModelRange();
      editorRef.current.executeEdits('insert-code', [
        {
          range,
          text,
        },
      ]);

      editorRef.current.focus();
    }
  };

  return (
    <TooltipHint title={'Insert and replace'}>
      <IconButton size="small" onClick={handleClick}>
        <ContentPasteGoOutlined fontSize="inherit" color="inherit" className="text-muted-foreground" />
      </IconButton>
    </TooltipHint>
  );
}
