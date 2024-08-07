import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { getCodeCell } from '@/app/helpers/codeCellLanguage';
import { BoxIcon } from '@/app/ui/icons';
import { SNIPPET_PYTHON_API, SNIPPET_PYTHON_CHART, SNIPPET_PYTHON_PACKAGE } from '@/app/ui/menus/CodeEditor/snippets';
import { Button } from '@/shared/shadcn/ui/button';
import { ApiOutlined, BarChartOutlined, IntegrationInstructionsOutlined } from '@mui/icons-material';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { useCodeEditor } from './CodeEditorContext';

export function CodeEditorPlaceholder({
  editorContent,
  setEditorContent,
}: {
  editorContent: string | undefined;
  setEditorContent: (str: string | undefined) => void;
}) {
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const codeCell = getCodeCell(editorInteractionState.mode);
  const [shouldRunEffect, setShouldRunEffect] = useState<boolean>(false);
  const {
    editorRef,
    showSnippetsPopover: [, setShowSnippetsPopover],
  } = useCodeEditor();

  // When the user chooses to autofill the editor with a predefined snippet,
  // focus the editor and set the initial cursor position
  useEffect(() => {
    if (editorRef && editorRef.current && shouldRunEffect) {
      editorRef.current.focus();
      editorRef.current.setPosition({ lineNumber: 0, column: 0 });
      setShouldRunEffect(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorContent, shouldRunEffect]);

  console.log(Boolean(editorContent && codeCell?.id === 'Python'));

  // Must meet these criteria to even show in the UI
  if (editorContent) {
    return null;
  }
  if (!(codeCell?.id === 'Javascript' || codeCell?.id === 'Python')) {
    return null;
  }

  const buttons = [
    {
      label: 'Fetch API data',
      Icon: ApiOutlined,
      onClick: () => {
        setEditorContent(SNIPPET_PYTHON_API);
        editorRef.current?.focus();
      },
    },
    {
      label: 'Create chart',
      Icon: BarChartOutlined,
      onClick: () => {
        setEditorContent(SNIPPET_PYTHON_CHART);
        editorRef.current?.focus();
      },
    },
    {
      label: 'Install package',
      Icon: BoxIcon,
      onClick: () => {
        setEditorContent(SNIPPET_PYTHON_PACKAGE);
        editorRef.current?.focus();
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
      <div className="grid grid-cols-2 gap-2 p-4 @lg:grid-cols-4">
        {buttons.map(({ label, Icon, onClick }) => (
          <Button
            key={label}
            className="flex h-auto flex-col gap-2 bg-background py-4"
            variant="outline"
            onClick={onClick}
          >
            <Icon fontSize="medium" color="primary" />
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
