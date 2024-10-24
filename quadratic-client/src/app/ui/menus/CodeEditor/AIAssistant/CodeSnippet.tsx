import { aiAssistantLoadingAtom, codeEditorAtom, codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { codeEditorBaseStyles } from '@/app/ui/menus/CodeEditor/styles';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { CollapseIcon, CopyIcon, ExpandIcon, SaveAndRunIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import Editor from '@monaco-editor/react';
import mixpanel from 'mixpanel-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilCallback, useRecoilValue } from 'recoil';

const MAX_LINES = 8;

interface CodeSnippetProps {
  code: string;
  language: string;
}

export function CodeSnippet({ code, language = 'plaintext' }: CodeSnippetProps) {
  const isLoading = useRecoilValue(aiAssistantLoadingAtom);
  const syntax = useMemo(() => {
    const lowerCaseLanguage = language.toLowerCase();
    if (
      lowerCaseLanguage === 'postgres' ||
      lowerCaseLanguage === 'mysql' ||
      lowerCaseLanguage === 'mssql' ||
      lowerCaseLanguage === 'snowflake'
    ) {
      return 'sql';
    }
    return lowerCaseLanguage;
  }, [language]);
  const numberOfLines = useMemo(() => code.split('\n').length, [code]);
  const [isCollapsible, setIsCollapsible] = useState(numberOfLines > MAX_LINES);
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    if (numberOfLines > MAX_LINES) {
      setIsCollapsible(true);
    }
  }, [numberOfLines]);

  return (
    <div className="relative">
      <div className="overflow-hidden rounded border shadow-sm">
        <div className="relative flex flex-row">
          <button
            className="relative flex w-full flex-row items-center py-2 pl-2 pr-3 font-medium lowercase [&:not(:disabled)]:hover:bg-accent"
            onClick={() => setIsCollapsed((prev) => !prev)}
            disabled={!isCollapsible}
            aria-label={isCollapsible ? 'Collapse code' : 'Expand code'}
          >
            <LanguageIcon language={language} />
            <span className="ml-2 mr-1">
              {language} (<span className="tabular-nums">{numberOfLines}</span> lines)
            </span>
            {isCollapsible &&
              (isCollapsed ? (
                <CollapseIcon className="mr-0.5 text-muted-foreground opacity-50" />
              ) : (
                <ExpandIcon className="mr-0.5 text-muted-foreground opacity-50" />
              ))}
          </button>
          {!isLoading && (
            <div className="absolute right-2 top-1.5 flex items-center gap-1">
              <CodeSnippetRunButton text={code} language={language} />
              {/* <CodeSnippetDiffButton text={code} language={language} /> */}
              <CodeSnippetCopyButton text={code} language={language} />
            </div>
          )}
        </div>

        <div
          className={cn(
            isCollapsible &&
              isCollapsed &&
              "relative after:absolute after:inset-0 after:bg-gradient-to-t after:from-white after:to-transparent after:content-['']"
          )}
          style={{
            ...codeEditorBaseStyles,
            // calculate height based on number of lines
            height: calculateHeightInPx(numberOfLines),
            maxHeight: isCollapsed ? calculateHeightInPx(MAX_LINES) : undefined,
          }}
        >
          <Editor
            className="border-t border-border pt-2"
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
      {/* {showAsCollapsed && (
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
            onClick={() => setIsCollapsed((prev) => !prev)}
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
      )} */}
    </div>
  );
}

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

        // if (modifiedEditorContent) {
        //   set(codeEditorModifiedEditorContentAtom, undefined);
        // }
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

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={handleSaveAndRun}
        >
          <SaveAndRunIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Apply & run</TooltipContent>
    </Tooltip>
  );
}

// function CodeSnippetDiffButton({ language, text }: { language: CodeSnippetProps['language']; text: string }) {
//   const handleReplace = useRecoilCallback(
//     ({ set, snapshot }) =>
//       async () => {
//         mixpanel.track('[AI].code.insert', { language });
//         const codeCell = await snapshot.getPromise(codeEditorCodeCellAtom);
//         set(codeEditorAtom, (prev) => ({
//           ...prev,
//           modifiedEditorContent: text,
//           waitingForEditorClose: {
//             codeCell,
//             showCellTypeMenu: false,
//             initialCode: '',
//             inlineEditor: false,
//           },
//         }));
//       },
//     [language, text]
//   );
//
//   return (
//     <Tooltip>
//       <TooltipTrigger asChild>
//         <Button
//           variant="ghost"
//           size="icon-sm"
//           className="text-muted-foreground hover:text-foreground"
//           onClick={handleReplace}
//           disabled={!language}
//         >
//           <DiffIcon />
//         </Button>
//       </TooltipTrigger>
//       <TooltipContent>Apply diff</TooltipContent>
//     </Tooltip>
//   );
// }

function CodeSnippetCopyButton({ language, text }: { language: CodeSnippetProps['language']; text: string }) {
  const [tooltipMsg, setTooltipMsg] = useState<string>('Copy');

  const handleCopy = useCallback(
    (e: any) => {
      e.preventDefault();
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
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={handleCopy}
        >
          <CopyIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent
        onPointerDownOutside={(event) => {
          event.preventDefault();
        }}
      >
        {tooltipMsg}
      </TooltipContent>
    </Tooltip>
  );
}

function calculateHeightInPx(numberOfLines: number) {
  return Math.ceil(numberOfLines) * 19 + 16 + 'px';
}
