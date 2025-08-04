import {
  aiAssistantLoadingAtom,
  codeEditorAtom,
  codeEditorCodeCellAtom,
  codeEditorEditorContentAtom,
} from '@/app/atoms/codeEditorAtom';
import { codeEditorBaseStyles } from '@/app/ui/menus/CodeEditor/styles';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { CopyIcon, SaveAndRunIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import Editor from '@monaco-editor/react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilCallback, useRecoilValue } from 'recoil';

const MAX_LINES = 6;

interface CodeSnippetProps {
  code: string;
  language: string;
}

export const CodeSnippet = memo(({ code, language = 'plaintext' }: CodeSnippetProps) => {
  const isLoading = useRecoilValue(aiAssistantLoadingAtom);
  const syntax = useMemo(() => {
    const lowerCaseLanguage = language.toLowerCase();
    if (
      lowerCaseLanguage === 'postgres' ||
      lowerCaseLanguage === 'mysql' ||
      lowerCaseLanguage === 'mssql' ||
      lowerCaseLanguage === 'snowflake' ||
      lowerCaseLanguage === 'cockroachdb' ||
      lowerCaseLanguage === 'bigquery' ||
      lowerCaseLanguage === 'mariadb' ||
      lowerCaseLanguage === 'supabase' ||
      lowerCaseLanguage === 'neon'
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
        <div className="relative flex flex-row items-center pl-1.5 pt-1.5">
          <Button
            variant="ghost"
            className={cn('gap-0.5 px-2 lowercase', `${isCollapsible ? '' : '!'}text-muted-foreground`)}
            size="sm"
            onClick={() => setIsCollapsed((prev) => !prev)}
            disabled={!isCollapsible}
            aria-label={isCollapsible ? 'Collapse code' : 'Expand code'}
          >
            {isCollapsible && (
              <ChevronDownIcon
                className={`-ml-1 mr-0.5 text-muted-foreground transition ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
              />
            )}
            <span>
              {language} (<span className="tabular-nums">{numberOfLines}</span> lines)
            </span>
          </Button>

          <div className="absolute right-1.5 top-1.5 flex items-center">
            <CodeSnippetCopyButton text={code} language={language} isLoading={isLoading} />
            <CodeSnippetRunButton text={code} language={language} isLoading={isLoading} />
          </div>
        </div>

        <div
          className={cn(
            'dark-mode-hack',
            isCollapsible &&
              isCollapsed &&
              "relative after:absolute after:inset-0 after:flex after:items-end after:justify-center after:bg-gradient-to-t after:from-white after:to-transparent after:content-['']"
          )}
          style={{
            ...codeEditorBaseStyles,
            // calculate height based on number of lines
            height: calculateHeightInPx(numberOfLines),
            maxHeight: isCollapsed ? calculateHeightInPx(MAX_LINES) : undefined,
          }}
        >
          <Editor
            className="pt-2"
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
          {isCollapsible && isCollapsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="absolute bottom-0.5 left-1/2 z-10 -translate-x-1/2 font-sans text-muted-foreground"
            >
              Show all code
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

const CodeSnippetRunButton = memo(
  ({ language, text, isLoading }: { language: CodeSnippetProps['language']; text: string; isLoading: boolean }) => {
    const handleSaveAndRun = useRecoilCallback(
      ({ snapshot, set }) =>
        async () => {
          mixpanel.track('[AI].code.run', { language });

          const editorContent = await snapshot.getPromise(codeEditorEditorContentAtom);
          if (editorContent === text) {
            return;
          }

          const codeCell = await snapshot.getPromise(codeEditorCodeCellAtom);

          set(codeEditorAtom, (prev) => ({
            ...prev,
            diffEditorContent: { editorContent, isApplied: true },
            waitingForEditorClose: {
              codeCell,
              showCellTypeMenu: false,
              initialCode: text,
              inlineEditor: false,
            },
          }));

          quadraticCore.setCodeCellValue({
            sheetId: codeCell.sheetId,
            pos: codeCell.pos,
            tablePos: undefined,
            codeString: text ?? '',
            language: codeCell.language,
            isAi: false,
          });
        },
      [language, text]
    );

    return (
      <Button
        variant="ghost"
        size="sm"
        className="bg-background px-2 text-muted-foreground hover:text-foreground"
        onClick={handleSaveAndRun}
        disabled={isLoading}
      >
        <SaveAndRunIcon /> Apply & run
      </Button>
    );
  }
);

const CodeSnippetCopyButton = memo(
  ({ language, text, isLoading }: { language: CodeSnippetProps['language']; text: string; isLoading: boolean }) => {
    const [tooltipMsg, setTooltipMsg] = useState<string>('Copy');

    const handleCopy = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
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
      <Button
        variant="ghost"
        size="sm"
        className="bg-background px-2 text-muted-foreground hover:text-foreground"
        onClick={handleCopy}
        disabled={isLoading}
      >
        <CopyIcon className="mr-1" /> {tooltipMsg}
      </Button>
    );
  }
);

const calculateHeightInPx = (numberOfLines: number) => {
  return Math.ceil(numberOfLines) * 19 + 16 + 'px';
};
