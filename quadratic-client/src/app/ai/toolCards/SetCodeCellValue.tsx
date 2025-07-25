import { ToolCard } from '@/app/ai/toolCards/ToolCard';
import { codeEditorAtom } from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { getConnectionKind } from '@/app/helpers/codeCellLanguage';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { CodeIcon, SaveAndRunIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { OBJ, parse, STR } from 'partial-json';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useEffect, useMemo, useState } from 'react';
import { useRecoilCallback } from 'recoil';
import type { z } from 'zod';

type SetCodeCellValueResponse = z.infer<(typeof aiToolsSpec)[AITool.SetCodeCellValue]['responseSchema']>;

type SetCodeCellValueProps = {
  args: string;
  loading: boolean;
};

export const SetCodeCellValue = memo(({ args, loading }: SetCodeCellValueProps) => {
  const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<SetCodeCellValueResponse, SetCodeCellValueResponse>>();
  const [codeCellPos, setCodeCellPos] = useState<JsCoordinate | undefined>();

  useEffect(() => {
    if (!loading) {
      const fullJson = parseFullJson(args);
      if (fullJson) {
        const toolArgs = aiToolsSpec[AITool.SetCodeCellValue].responseSchema.safeParse(fullJson);
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
            console.error('[SetCodeCellValue] Failed to parse args: ', e);
            setCodeCellPos(undefined);
          }
        }
      } else {
        setToolArgs(undefined);
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
              language: convertToCodeCellLanguage(toolArgs.code_cell_language),
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
        language: convertToCodeCellLanguage(toolArgs.code_cell_language),
        cursor: sheets.getCursorPosition(),
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

  const getLanguageString = (language: any): string => {
    if (typeof language === 'string') {
      return language;
    }
    if (language?.Connection?.kind) {
      return language.Connection.kind;
    }
    return '';
  };

  const convertToCodeCellLanguage = (language: any): any => {
    if (typeof language === 'string') {
      return language;
    }
    if (language?.Connection?.kind) {
      // Convert connection kind to proper enum values
      const kindMap: Record<string, string> = {
        Postgres: 'postgres',
        Mysql: 'mysql',
        Mssql: 'mssql',
        Snowflake: 'snowflake',
        Bigquery: 'bigquery',
        Cockroachdb: 'cockroachdb',
        Mariadb: 'mariadb',
        Neon: 'neon',
        Supabase: 'supabase',
      };
      const convertedKind = kindMap[language.Connection.kind] || language.Connection.kind;
      return { Connection: { kind: convertedKind, id: language.Connection.id } };
    }
    return language;
  };

  if (loading && estimatedNumberOfLines) {
    const partialJson = parsePartialJson(args);
    if (partialJson && 'code_cell_language' in partialJson) {
      const { code_cell_language: language, code_cell_position: position } = partialJson;

      return (
        <ToolCard
          icon={<LanguageIcon language={getLanguageString(language)} />}
          label={getConnectionKind(convertToCodeCellLanguage(language))}
          description={
            `${estimatedNumberOfLines} line` +
            (estimatedNumberOfLines === 1 ? '' : 's') +
            (position ? ` at ${position}` : '')
          }
          isLoading={true}
        />
      );
    }
  }

  if (!!toolArgs && !toolArgs.success) {
    return <ToolCard icon={<LanguageIcon language="" />} label="Code" hasError />;
  } else if (!toolArgs || !toolArgs.data) {
    return <ToolCard isLoading />;
  }

  const { code_cell_name, code_cell_language, code_cell_position } = toolArgs.data;
  return (
    <ToolCard
      icon={<LanguageIcon language={getLanguageString(code_cell_language)} />}
      label={code_cell_name || getConnectionKind(convertToCodeCellLanguage(code_cell_language))}
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
                onClick={() => openDiffInEditor(toolArgs.data)}
                disabled={!codeCellPos}
              >
                <CodeIcon />
              </Button>
            </TooltipPopover>

            <TooltipPopover label={'Apply'}>
              <Button size="icon-sm" variant="ghost" onClick={() => saveAndRun(toolArgs.data)} disabled={!codeCellPos}>
                <SaveAndRunIcon />
              </Button>
            </TooltipPopover>
          </div>
        ) : undefined
      }
    />
  );
});

const parsePartialJson = (args: string): Partial<SetCodeCellValueResponse> | null => {
  try {
    const parsed = parse(args, STR | OBJ);
    return parsed;
  } catch (error) {
    return null;
  }
};

const parseFullJson = (args: string): Partial<SetCodeCellValueResponse> | null => {
  try {
    const json = JSON.parse(args);
    return json;
  } catch (error) {
    console.error('[SetCodeCellValue] Failed to parse args: ', error);
    return null;
  }
};
