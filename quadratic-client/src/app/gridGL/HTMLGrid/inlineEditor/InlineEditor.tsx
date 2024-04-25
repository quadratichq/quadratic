/* eslint-disable @typescript-eslint/no-unused-vars */
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { CURSOR_THICKNESS } from '@/app/gridGL/UI/Cursor';
import { useCallback } from 'react';

// need to track globally since monaco is a singleton
let registered = false;

export const InlineEditor = () => {
  /*
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);

  const [showInput, setShowInput] = useState(false);
  useEffect(() => {
    const changeInput = (input: boolean) => {
      setShowInput(input);
      setTimeout(() => editorRef.current?.focus(), 0);
    };
    events.on('changeInput', changeInput);
    return () => {
      events.off('changeInput', changeInput);
    };
  }, []);

  const [value, setValue] = useState<string | undefined>('This should be here');
  const [didMount, setDidMount] = useState(false);
  const [isValidRef, setIsValidRef] = useState(false);
  const [language, setLanguage] = useState<'Formula' | undefined>();
  const fontFamily = 'OpenSans';

  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const sheet = sheets.sheet;
  const cellLocation = sheet.cursor.originPosition;
  const cellOffsets = sheet.getCellOffsets(cellLocation.x, cellLocation.y);

  const onMount = useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
      setIsValidRef(true);

      editor.onKeyDown((e) => {});

      editor.focus();

      // monaco.editor.defineTheme('quadratic', QuadraticEditorTheme);
      // monaco.editor.setTheme('quadratic');

      // this needs to be before the register conditional below
      setDidMount(true);

      // Only register language once
      if (registered) return;

      monaco.languages.register({ id: 'Formula' });
      monaco.languages.setLanguageConfiguration('Formula', FormulaLanguageConfig);
      monaco.languages.setMonarchTokensProvider('Formula', FormulaTokenizerConfig);
      monaco.languages.registerCompletionItemProvider('Formula', {
        provideCompletionItems,
      });
      monaco.languages.registerHoverProvider('Formula', { provideHover });

      registered = true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setDidMount]
  );

  // size of box
  const width =
    Math.max(cellOffsets.width - CURSOR_THICKNESS * 2, editorRef.current ? editorRef.current.getScrollWidth() : 0) +
    'px';
  const height = cellOffsets.height - CURSOR_THICKNESS * 2 + 20 + 'px';
  const padding = `0 ${CURSOR_THICKNESS}px 0 0`;
  const display = showInput ? 'block' : 'none';

  return (
    <div
      id="inline-editor"
      style={{ position: 'absolute', top: 0, left: 0, width, height, padding, margin: 0, display }}
    >
      <Editor
        height="100%"
        width="100%"
        language={language}
        value={value}
        onChange={setValue}
        loading={''}
        saveViewState={false}
        onMount={onMount}
        options={{
          readOnly: false,
          renderLineHighlight: 'none',
          quickSuggestions: false,
          glyphMargin: false,
          lineDecorationsWidth: 0,
          folding: false,
          fixedOverflowWidgets: true,
          roundedSelection: false,
          contextmenu: false,
          links: false,
          minimap: { enabled: false },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          wordWrap: 'off',
          occurrencesHighlight: false,
          wordBasedSuggestions: false,
          find: {
            addExtraSpaceOnTop: false,
            autoFindInSelection: 'never',
            seedSearchStringFromSelection: 'never',
          },
          fontSize: 14,
          fontFamily,
          fontWeight: 'normal',
          lineNumbers: 'off',
          lineNumbersMinChars: 0,
          scrollBeyondLastColumn: 0,
          scrollbar: {
            horizontal: 'hidden',
            vertical: 'hidden',
            alwaysConsumeMouseWheel: false,
          },
        }}
      />
    </div>
  );
  */

  const ref = useCallback((div: HTMLDivElement) => {
    inlineEditorHandler.attach(div);
  }, []);

  return <div ref={ref} style={{ position: 'absolute', padding: `0 ${CURSOR_THICKNESS}px 0 0` }}></div>;
};
