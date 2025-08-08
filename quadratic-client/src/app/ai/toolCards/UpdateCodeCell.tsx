import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { codeEditorAtom, codeEditorCodeCellAtom, codeEditorEditorContentAtom } from '@/app/atoms/codeEditorAtom';
import { getLanguage, getLanguageForMonaco } from '@/app/helpers/codeCellLanguage';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { CollapseIcon, CopyIcon, ExpandIcon, SaveAndRunIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { Editor } from '@monaco-editor/react';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilCallback, useRecoilValue } from 'recoil';
import type { z } from 'zod';

type UpdateCodeCellResponse = z.infer<(typeof aiToolsSpec)[AITool.UpdateCodeCell]['responseSchema']>;

export const UpdateCodeCell = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<UpdateCodeCellResponse, UpdateCodeCellResponse>>();
    const editorContent = useRecoilValue(codeEditorEditorContentAtom);
    const codeCell = useRecoilValue(codeEditorCodeCellAtom);
    const [showCode, setShowCode] = useState(false);

    const handleCopy = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (!toolArgs?.data) {
          return;
        }

        trackEvent('[AI].UpdateCodeCell.copy', { language: getLanguage(codeCell.language) });
        navigator.clipboard.writeText(toolArgs.data.code_string);
      },
      [codeCell.language, toolArgs?.data]
    );

    const handleSaveAndRun = useRecoilCallback(
      ({ snapshot, set }) =>
        async () => {
          if (!toolArgs?.data) {
            return;
          }

          const { code_string } = toolArgs.data;
          const editorContent = await snapshot.getPromise(codeEditorEditorContentAtom);
          if (editorContent === code_string) {
            return;
          }

          const codeCell = await snapshot.getPromise(codeEditorCodeCellAtom);

          set(codeEditorAtom, (prev) => ({
            ...prev,
            diffEditorContent: { editorContent, isApplied: true },
            waitingForEditorClose: {
              codeCell,
              showCellTypeMenu: false,
              initialCode: code_string,
              inlineEditor: false,
            },
          }));

          quadraticCore.setCodeCellValue({
            sheetId: codeCell.sheetId,
            x: codeCell.pos.x,
            y: codeCell.pos.y,
            codeString: code_string ?? '',
            language: codeCell.language,
          });
        },
      [toolArgs]
    );

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.UpdateCodeCell].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[UpdateCodeCell] Failed to parse args: ', error);
      }
    }, [args, loading]);

    useEffect(() => {
      if (showCode && editorContent === toolArgs?.data?.code_string) {
        setShowCode(false);
      }
    }, [codeCell.language, editorContent, showCode, toolArgs]);

    const estimatedNumberOfLines = useMemo(() => {
      if (toolArgs) {
        return toolArgs.data?.code_string.split('\n').length;
      } else {
        return args.split('\\n').length;
      }
    }, [toolArgs, args]);

    if (loading) {
      return (
        <ToolCard
          icon={<LanguageIcon language={getLanguage(codeCell.language)} />}
          label={getLanguage(codeCell.language)}
          description={`${estimatedNumberOfLines} line` + (estimatedNumberOfLines === 1 ? '' : 's')}
          isLoading={true}
          className={className}
        />
      );
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={<LanguageIcon language="" />} label="Code" hasError className={className} />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard isLoading className={className} />;
    }

    return (
      <div>
        <ToolCard
          icon={<LanguageIcon language={getLanguage(codeCell.language)} />}
          label={getLanguage(codeCell.language)}
          description={`${estimatedNumberOfLines} line` + (estimatedNumberOfLines === 1 ? '' : 's')}
          actions={
            editorContent !== toolArgs.data.code_string && (
              <div className="flex gap-1">
                <TooltipPopover label={showCode ? 'Hide code' : 'Show code'}>
                  <Button size="icon-sm" variant="ghost" onClick={() => setShowCode(!showCode)}>
                    {showCode ? <ExpandIcon /> : <CollapseIcon />}
                  </Button>
                </TooltipPopover>

                <TooltipPopover label={'Copy'}>
                  <Button size="icon-sm" variant="ghost" onClick={handleCopy}>
                    <CopyIcon />
                  </Button>
                </TooltipPopover>

                <TooltipPopover label={'Apply'}>
                  <Button size="icon-sm" variant="ghost" onClick={handleSaveAndRun}>
                    <SaveAndRunIcon />
                  </Button>
                </TooltipPopover>
              </div>
            )
          }
          className={className}
        />

        {showCode && (
          <div
            className="-mt-0.5 h-max overflow-hidden rounded-b-md rounded-e-md rounded-r-none rounded-s-none border border-t-0 border-border bg-background shadow-sm"
            style={{ height: `${Math.ceil(toolArgs.data.code_string.split('\n').length) * 19 + 16}px` }}
          >
            <Editor
              className="dark-mode-hack bg-transparent pt-1"
              language={getLanguageForMonaco(codeCell.language)}
              value={toolArgs.data.code_string}
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
        )}
      </div>
    );
  }
);
