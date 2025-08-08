import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { codeEditorAtom } from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
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

type SetSQLCodeCellValueResponse = z.infer<(typeof aiToolsSpec)[AITool.SetSQLCodeCellValue]['responseSchema']>;

export const SetSQLCodeCellValue = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] =
      useState<z.SafeParseReturnType<SetSQLCodeCellValueResponse, SetSQLCodeCellValueResponse>>();
    const [codeCellPos, setCodeCellPos] = useState<JsCoordinate | undefined>();

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      const fullJson = parseFullJson<SetSQLCodeCellValueResponse>(args);
      if (!fullJson) {
        setToolArgs(undefined);
        setCodeCellPos(undefined);
        return;
      }

      const toolArgs = aiToolsSpec[AITool.SetSQLCodeCellValue].responseSchema.safeParse(fullJson);
      setToolArgs(toolArgs);

      if (toolArgs.success) {
        try {
          const sheetId = toolArgs.data.sheet_name
            ? (sheets.getSheetByName(toolArgs.data.sheet_name)?.id ?? sheets.current)
            : sheets.current;
          const selection = sheets.stringToSelection(toolArgs.data.code_cell_position, sheetId);
          const { x, y } = selection.getCursor();
          selection.free();
          setCodeCellPos({ x, y });
        } catch (e) {
          console.warn('[SetSQLCodeCellValue] Failed to set code cell position: ', e);
          setCodeCellPos(undefined);
        }
      }
    }, [args, loading]);

    const openDiffInEditor = useRecoilCallback(
      ({ set }) =>
        (toolArgs: SetSQLCodeCellValueResponse) => {
          if (!codeCellPos) {
            return;
          }

          set(codeEditorAtom, (prev) => ({
            ...prev,
            diffEditorContent: { editorContent: toolArgs.sql_code_string, isApplied: false },
            waitingForEditorClose: {
              codeCell: {
                sheetId: sheets.current,
                pos: codeCellPos,
                language: {
                  Connection: {
                    kind: toolArgs.connection_kind,
                    id: toolArgs.connection_id,
                  },
                },
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
      () => (toolArgs: SetSQLCodeCellValueResponse) => {
        if (!codeCellPos) {
          return;
        }

        quadraticCore.setCodeCellValue({
          sheetId: sheets.current,
          x: codeCellPos.x,
          y: codeCellPos.y,
          codeString: toolArgs.sql_code_string,
          language: {
            Connection: {
              kind: toolArgs.connection_kind,
              id: toolArgs.connection_id,
            },
          },
        });
      },
      [codeCellPos]
    );

    const estimatedNumberOfLines = useMemo(() => {
      if (toolArgs?.data) {
        return toolArgs.data.sql_code_string.split('\n').length;
      } else {
        return args.split('\\n').length;
      }
    }, [toolArgs, args]);

    if (loading && estimatedNumberOfLines) {
      const partialJson = parsePartialJson<SetSQLCodeCellValueResponse>(args);
      if (partialJson && 'connection_kind' in partialJson) {
        const { connection_kind, code_cell_position: position } = partialJson;
        return (
          <ToolCard
            icon={<LanguageIcon language={connection_kind ?? ''} />}
            label={connection_kind}
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

    const { code_cell_name, connection_kind, code_cell_position } = toolArgs.data;
    return (
      <ToolCard
        icon={<LanguageIcon language={connection_kind} />}
        label={code_cell_name || connection_kind}
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
