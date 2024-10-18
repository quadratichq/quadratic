import {
  codeEditorAtom,
  codeEditorCodeCellAtom,
  codeEditorModifiedEditorContentAtom,
} from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { codeEditorBaseStyles } from '@/app/ui/menus/CodeEditor/styles';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import {
  CopyIcon,
  DiffIcon,
  ExpandCircleDownIcon,
  ExpandCircleUpIcon,
  IconComponent,
  SaveAndRunIcon,
} from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import Editor from '@monaco-editor/react';
import mixpanel from 'mixpanel-browser';
import { useCallback, useState } from 'react';
import { useRecoilCallback } from 'recoil';

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
  const numberOfLines = code.split('\n').length;
  const showAsCollapsed = numberOfLines > 10;
  const [collapsed, setCollapsed] = useState(true);

  return (
    <TooltipProvider>
      <div className="relative">
        <div className="overflow-hidden rounded border shadow-sm">
          <div className="flex flex-row items-center justify-between gap-2 bg-accent px-3 py-1">
            <div className="lowercase text-muted-foreground">{language}</div>

            <div className="flex items-center gap-1">
              <CodeSnippetRunButton text={code} language={language} />
              <CodeSnippetInsertButton text={code} language={language} />
              <CodeSnippetCopyButton text={code} language={language} />
            </div>
          </div>

          <div
            className="relative pt-2"
            style={{
              ...codeEditorBaseStyles,
              // calculate height based on number of lines
              height: `${Math.ceil(numberOfLines) * 19 + 16}px`,
              maxHeight: collapsed ? '148px' : '100%',
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
        {showAsCollapsed && (
          <div
            className={cn(
              ' flex  flex-col items-center justify-end rounded bg-gradient-to-t from-white from-50% pb-1',
              collapsed ? 'absolute bottom-[1px] left-[1px] right-[1px] h-16' : ''
            )}
          >
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
              onClick={() => setCollapsed((prev) => !prev)}
            >
              {collapsed ? (
                <>
                  <ExpandCircleDownIcon />
                  Show code ({numberOfLines} lines)
                </>
              ) : (
                <>
                  <ExpandCircleUpIcon />
                  Collapse code
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// function CodeSnippetAIInsertButton({ language, text }: { language: CodeSnippetProps['language']; text: string }) {
//   const { aiSetCodeCellValue } = useAISetCodeCellValue();

//   const handleAIInsert = useCallback(async () => {
//     mixpanel.track('[AI].code.ai_insert_code_cell', { language });
//     const setCodeCellValueArgs = await aiSetCodeCellValue({ language, text });

//     if (setCodeCellValueArgs) {
//       const { language, codeString, x, y, width, height } = setCodeCellValueArgs;
//       quadraticCore.setCodeCellValue({
//         sheetId: sheets.current,
//         x,
//         y,
//         codeString,
//         language,
//         cursor: sheets.getCursorPosition(),
//       });

//       ensureRectVisible({ x, y }, { x: x + width - 1, y: y + height - 1 });
//     }
//   }, [aiSetCodeCellValue, language, text]);

//   return (
//     <TooltipHint title={'Ask AI to Save and Run Code'}>
//       <IconButton size="small" onClick={handleAIInsert}>
//         <PlayArrowOutlined fontSize="inherit" color="inherit" className="text-muted-foreground" />
//       </IconButton>
//     </TooltipHint>
//   );
// }

function CodeSnippetRunButton({ language, text }: { language: CodeSnippetProps['language']; text: string }) {
  const handleSaveAndRun = useRecoilCallback(
    ({ snapshot, set }) =>
      async () => {
        mixpanel.track('[AI].code.run', { language });
        const codeCell = await snapshot.getPromise(codeEditorCodeCellAtom);
        quadraticCore.setCodeCellValue({
          sheetId: codeCell.sheetId,
          x: codeCell.pos.x,
          y: codeCell.pos.y,
          codeString: text ?? '',
          language: codeCell.language,
          cursor: sheets.getCursorPosition(),
        });
        const modifiedEditorContent = await snapshot.getPromise(codeEditorModifiedEditorContentAtom);
        if (modifiedEditorContent) {
          set(codeEditorModifiedEditorContentAtom, undefined);
        }
      },
    [language, text]
  );

  return <CodeSnippetButton onClick={handleSaveAndRun} Icon={SaveAndRunIcon} label="Save & run" />;
}

function CodeSnippetInsertButton({ language, text }: { language: CodeSnippetProps['language']; text: string }) {
  const handleReplace = useRecoilCallback(
    ({ set, snapshot }) =>
      async () => {
        mixpanel.track('[AI].code.insert', { language });
        const codeCell = await snapshot.getPromise(codeEditorCodeCellAtom);
        set(codeEditorAtom, (prev) => ({
          ...prev,
          modifiedEditorContent: text,
          waitingForEditorClose: {
            codeCell,
            showCellTypeMenu: false,
            initialCode: '',
            inlineEditor: false,
          },
        }));
      },
    [language, text]
  );

  return <CodeSnippetButton onClick={handleReplace} Icon={DiffIcon} label="Apply diff" disabled={!language} />;
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

  return <CodeSnippetButton onClick={handleCopy} Icon={CopyIcon} label={tooltipMsg} />;
}

function CodeSnippetButton({
  onClick,
  Icon,
  label,
  disabled,
}: {
  onClick: () => void;
  Icon: IconComponent;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={onClick}
          disabled={disabled}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
