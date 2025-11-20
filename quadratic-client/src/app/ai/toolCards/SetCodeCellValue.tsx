import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { codeEditorAtom } from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { aiUser } from '@/app/web-workers/multiplayerWebWorker/aiUser';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import { parseFullJson, parsePartialJson } from '@/app/shared/utils/SafeJsonParsing';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { CodeIcon, SaveAndRunIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useEffect, useMemo, useState } from 'react';
import { useRecoilCallback } from 'recoil';
import type { z } from 'zod';

type SetCodeCellValueResponse = z.infer<(typeof aiToolsSpec)[AITool.SetCodeCellValue]['responseSchema']>;

export const SetCodeCellValue = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] =
      useState<z.SafeParseReturnType<SetCodeCellValueResponse, SetCodeCellValueResponse>>();
    const [codeCellPos, setCodeCellPos] = useState<JsCoordinate | undefined>();

    useEffect(() => {
      // Try to parse position even while loading to move cursor early
      if (loading) {
        const partialJson = parsePartialJson<SetCodeCellValueResponse>(args);
        if (partialJson && 'code_cell_position' in partialJson && partialJson.code_cell_position) {
          try {
            const sheetId = partialJson.sheet_name
              ? (sheets.getSheetByName(partialJson.sheet_name)?.id ?? sheets.current)
              : sheets.current;
            const selection = sheets.stringToSelection(partialJson.code_cell_position, sheetId);

            // Move AI cursor to the code cell position as soon as we know the location
            try {
              const selectionString = selection.save();
              aiUser.updateSelection(selectionString, sheetId);
            } catch (e) {
              console.warn('[SetCodeCellValue] Failed to update AI cursor while loading:', e);
            }

            selection.free();
          } catch (e) {
            console.warn('[SetCodeCellValue] Failed to parse position while loading:', e);
          }
        }
        setToolArgs(undefined);
        return;
      }

      const fullJson = parseFullJson<SetCodeCellValueResponse>(args);
      if (!fullJson) {
        setToolArgs(undefined);
        setCodeCellPos(undefined);
        return;
      }

      const toolArgs = aiToolsSpec[AITool.SetCodeCellValue].responseSchema.safeParse(fullJson);
      setToolArgs(toolArgs);

      if (toolArgs.success) {
        try {
          const sheetId = toolArgs.data.sheet_name
            ? (sheets.getSheetByName(toolArgs.data.sheet_name)?.id ?? sheets.current)
            : sheets.current;
          const selection = sheets.stringToSelection(toolArgs.data.code_cell_position, sheetId);
          const { x, y } = selection.getCursor();
          setCodeCellPos({ x, y });
          selection.free();
        } catch (e) {
          console.warn('[SetCodeCellValue] Failed to set code cell position: ', e);
          setCodeCellPos(undefined);
        }
      }
    }, [args, loading]);

    const openDiffInEditor = useRecoilCallback(
      ({ set }) =>
        (toolArgs: SetCodeCellValueResponse) => {
          if (!codeCellPos) {
            return;
          }

          set(codeEditorAtom, (prev) => ({
            ...prev,
            diffEditorContent: { editorContent: toolArgs.code_string, isApplied: false },
            waitingForEditorClose: {
              codeCell: {
                sheetId: sheets.current,
                pos: codeCellPos,
                language: toolArgs.code_cell_language,
                lastModified: 0,
              },
              showCellTypeMenu: false,
              inlineEditor: false,
              initialCode: '',
            },
          }));
        },
      [codeCellPos]
    );

    const saveAndRun = useRecoilCallback(
      () => (toolArgs: SetCodeCellValueResponse) => {
        if (!codeCellPos) {
          return;
        }

        quadraticCore.setCodeCellValue({
          sheetId: sheets.current,
          x: codeCellPos.x,
          y: codeCellPos.y,
          codeString: toolArgs.code_string,
          language: toolArgs.code_cell_language,
          isAi: false,
        });
      },
      [codeCellPos]
    );

    const estimatedNumberOfLines = useMemo(() => {
      if (toolArgs?.data) {
        return toolArgs.data.code_string.split('\n').length;
      } else {
        return args.split('\\n').length;
      }
    }, [toolArgs, args]);

    if (loading && estimatedNumberOfLines) {
      const partialJson = parsePartialJson<SetCodeCellValueResponse>(args);
      if (partialJson && 'code_cell_language' in partialJson) {
        const { code_cell_language: language, code_cell_position: position } = partialJson;
        return (
          <ToolCard
            icon={<LanguageIcon language={language ?? ''} />}
            label={language}
            description={
              `${estimatedNumberOfLines} line` +
              (estimatedNumberOfLines === 1 ? '' : 's') +
              (position ? ` at ${position}` : '')
            }
            isLoading={true}
            className={className}
          />
        );
      }
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={<LanguageIcon language="" />} label="Code" hasError className={className} />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard isLoading className={className} />;
    }

    const { code_cell_name, code_cell_language, code_cell_position } = toolArgs.data;
    return (
      <ToolCard
        icon={<LanguageIcon language={code_cell_language} />}
        label={code_cell_name || code_cell_language}
        description={
          `${estimatedNumberOfLines} line` + (estimatedNumberOfLines === 1 ? '' : 's') + ` at ${code_cell_position}`
        }
        actions={
          codeCellPos ? (
            <div className="flex gap-1">
              <TooltipPopover label={'Open diff in editor'}>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openDiffInEditor(toolArgs.data);
                  }}
                  disabled={!codeCellPos}
                >
                  <CodeIcon />
                </Button>
              </TooltipPopover>

              <TooltipPopover label={'Apply'}>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    saveAndRun(toolArgs.data);
                  }}
                  disabled={!codeCellPos}
                >
                  <SaveAndRunIcon />
                </Button>
              </TooltipPopover>
            </div>
          ) : undefined
        }
        className={className}
      />
    );
  }
);
