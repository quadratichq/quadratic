import { useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Box, IconButton, Stack, useTheme } from '@mui/material';
import { ContentCopy } from '@mui/icons-material';
import { TooltipHint } from './TooltipHint';
import { codeEditorBaseStyles } from '../menus/CodeEditor/styles';

interface Props {
  code: string;
  language?: string;
}

export function CodeSnippet({ code, language = 'plaintext' }: Props) {
  const [tooltipMsg, setTooltipMsg] = useState<string>('Click to copy');
  const editorRef = useRef(null);
  const theme = useTheme();

  const handleClick = (e: any) => {
    if (editorRef.current) {
      navigator.clipboard.writeText(code);
      setTooltipMsg('Copied!');
      setTimeout(() => {
        setTooltipMsg('Click to copy');
      }, 2000);
    }
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  return (
    <Box style={codeEditorBaseStyles}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
        sx={{
          backgroundColor: theme.palette.grey['100'],
          pt: theme.spacing(0.5),
          pb: theme.spacing(0.5),
          // 10px on Monaco + 2px border
          pr: '12px',
          pl: '12px',
        }}
      >
        <Box sx={{ color: 'text.secondary' }}>{language}</Box>

        <TooltipHint title={tooltipMsg}>
          <IconButton onClick={handleClick} size="small">
            <ContentCopy fontSize="inherit" />
          </IconButton>
        </TooltipHint>
      </Stack>
      <div
        style={{
          // calculate height based on number of lines
          height: `${Math.ceil(code.split('\n').length) * 19}px`,
          position: 'relative',
          border: `2px solid ${theme.palette.grey['100']}`,
          borderTop: 'none',
        }}
      >
        <Editor
          language={language}
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
    </Box>
  );
}
