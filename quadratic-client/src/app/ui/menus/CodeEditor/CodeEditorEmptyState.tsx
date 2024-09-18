import { codeEditorEditorContentAtom, codeEditorShowSnippetsPopoverAtom } from '@/app/atoms/codeEditorAtom';
import { editorInteractionStateModeAtom } from '@/app/atoms/editorInteractionStateAtom';
import { getCodeCell } from '@/app/helpers/codeCellLanguage';
import { BoxIcon, SheetComeFromIcon, SheetGoToIcon } from '@/app/ui/icons';
import {
  SNIPPET_JS_API,
  SNIPPET_JS_CHART,
  SNIPPET_JS_PACKAGE,
  SNIPPET_JS_READ,
  SNIPPET_JS_RETURN,
} from '@/app/ui/menus/CodeEditor/snippetsJS';
import {
  SNIPPET_PY_API,
  SNIPPET_PY_CHART,
  SNIPPET_PY_PACKAGE,
  SNIPPET_PY_READ,
  SNIPPET_PY_RETURN,
} from '@/app/ui/menus/CodeEditor/snippetsPY';
import { Button } from '@/shared/shadcn/ui/button';
import { ApiOutlined, BarChartOutlined, IntegrationInstructionsOutlined } from '@mui/icons-material';
import mixpanel from 'mixpanel-browser';
import * as monaco from 'monaco-editor';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

type CodeEditorEmptyStateProps = {
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>;
};

export function CodeEditorEmptyState({ editorRef }: CodeEditorEmptyStateProps) {
  const mode = useRecoilValue(editorInteractionStateModeAtom);
  const codeCell = getCodeCell(mode);
  const setShowSnippetsPopover = useSetRecoilState(codeEditorShowSnippetsPopoverAtom);
  const [editorContent, setEditorContent] = useRecoilState(codeEditorEditorContentAtom);

  // Must meet these criteria to even show in the UI
  if (editorContent !== '') {
    return null;
  }
  if (!(codeCell?.id === 'Javascript' || codeCell?.id === 'Python')) {
    return null;
  }

  const fillWithSnippet = (code: string) => {
    setEditorContent(code);
    editorRef.current?.focus();
  };

  const buttons = [
    {
      label: 'Read from sheet',
      Icon: SheetGoToIcon,
      onClick: () => {
        if (codeCell.id === 'Javascript') fillWithSnippet(SNIPPET_JS_READ);
        else fillWithSnippet(SNIPPET_PY_READ);
      },
    },
    {
      label: 'Return to sheet',
      Icon: SheetComeFromIcon,
      onClick: () => {
        if (codeCell.id === 'Javascript') fillWithSnippet(SNIPPET_JS_RETURN);
        else fillWithSnippet(SNIPPET_PY_RETURN);
      },
    },
    {
      label: 'Fetch API data',
      Icon: ApiOutlined,
      onClick: () => {
        if (codeCell.id === 'Javascript') fillWithSnippet(SNIPPET_JS_API);
        else fillWithSnippet(SNIPPET_PY_API);
      },
    },
    {
      label: 'Create chart',
      Icon: BarChartOutlined,
      onClick: () => {
        if (codeCell.id === 'Javascript') fillWithSnippet(SNIPPET_JS_CHART);
        else fillWithSnippet(SNIPPET_PY_CHART);
      },
    },
    {
      // Use language-specific terms
      label: codeCell.id === 'Javascript' ? 'Import module' : 'Install package',
      Icon: BoxIcon,
      onClick: () => {
        if (codeCell.id === 'Javascript') fillWithSnippet(SNIPPET_JS_PACKAGE);
        else fillWithSnippet(SNIPPET_PY_PACKAGE);
      },
    },
    {
      label: 'More snippets',
      Icon: IntegrationInstructionsOutlined,
      onClick: () => {
        setShowSnippetsPopover(true);
      },
    },
  ];

  return (
    <div className="@container">
      <div className="grid grid-cols-2 gap-2 p-4 @lg:grid-cols-3 @4xl:grid-cols-6">
        {buttons.map(({ label, Icon, onClick }) => (
          <Button
            key={label}
            className="flex h-auto flex-col gap-1 bg-background pb-3 pt-3"
            variant="outline"
            onClick={() => {
              mixpanel.track('[SnippetsEmpty].selected', { label, language: codeCell.id });
              onClick();
            }}
          >
            <Icon fontSize="medium" color="primary" />
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
