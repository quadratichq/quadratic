import { sheets } from '@/app/grid/controller/Sheets';
import { Coordinate } from '@/app/gridGL/types/size';
import { useAI } from '@/app/ui/hooks/useAI';
import { QuadraticDocs } from '@/app/ui/menus/CodeEditor/QuadraticDocs';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { TextArea } from '@/shared/shadcn/ui/textarea';
import { Button } from '@mui/material';
import { AIMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback, useRef, useState } from 'react';

export function AIAssist() {
  const abortController = useRef<AbortController | null>(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const getSystemMessages = useCallback(
    (cursorPosition: Coordinate): AIMessage[] => [
      {
        role: 'system',
        content: `
  You are a helpful assistant inside of a spreadsheet application called Quadratic.
  
  This is the documentation for Quadratic:
  ${QuadraticDocs}
  
  The response format is a JSON object with the following properties cellValues and codeCells properties.
  - cellValues represents data values to be inserted into the spreadsheet.
  - codeCells represents code values to be inserted into the spreadsheet. The language is one of the following: Formula, Python, or Javascript.
  - The codeCells array should contain the language and corresponding code to be inserted into the spreadsheet.
  
  Both of these (cellValues and codeCells) are arrays, representing the value to be inserted relative to the cursor position.
  The cursor is located at ${cursorPosition.x}, ${cursorPosition.y}.
  The pos property of the cellValues and codeCells is the relative position to the cursor, these will be inserted. pos { x: 0, y: 0} is the cursor position.
  `,
      },
    ],
    []
  );

  const handleAIPrompt = useAI();
  const handleSubmit = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    abortController.current = new AbortController();

    const updatedMessages: AIMessage[] = [...messages, { role: 'user', content: prompt }];
    setMessages(updatedMessages);
    setPrompt('');

    const cursorPosition = sheets.sheet.cursor.cursorPosition;

    const { content, error } = await handleAIPrompt({
      type: 'assist',
      model: 'gpt-4o-2024-08-06',
      systemMessages: getSystemMessages(cursorPosition),
      messages: updatedMessages,
      setMessages,
      signal: abortController.current.signal,
    });
    setLoading(false);

    if (error) {
      console.warn(content);
      return;
    }

    const transactionId = await quadraticCore.setAIAssistResponse(
      sheets.sheet.id,
      sheets.sheet.cursor.cursorPosition,
      content,
      sheets.getCursorPosition()
    );
    setTransactionId(transactionId);
  }, [getSystemMessages, handleAIPrompt, loading, messages, prompt]);

  const handleConfirm = useCallback(
    (accept: boolean) => {
      if (transactionId === null) return;
      quadraticCore.confirmAIAssistResponse(transactionId, accept);
      setTransactionId(null);
    },
    [transactionId]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter') {
        if (event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        if (prompt.trim().length === 0) return;
        handleSubmit();
        event.currentTarget.focus();
      }
    },
    [handleSubmit, prompt]
  );

  return (
    <div className="absolute bottom-8 right-0 z-50 flex max-h-[40vh] w-full max-w-[50vw] flex-col items-end overflow-y-auto bg-white bg-opacity-90 p-4">
      <div className="flex w-full flex-row gap-2">
        <TextArea
          value={prompt}
          onChange={(event) => {
            setPrompt(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          placeholder="Ask a question"
          autoHeight={true}
          maxHeight="120px"
        ></TextArea>
        <Button className="w-24" onClick={handleSubmit}>
          AI Assist
        </Button>
      </div>

      <div>
        {messages.map((message, index) => (
          <div className="border border-gray-300 p-2" key={index}>
            {message.content}
          </div>
        ))}
      </div>
      {messages.length > 0 && (
        <Button color="secondary" onClick={() => setMessages([])}>
          Clear
        </Button>
      )}
      {transactionId !== null && (
        <div>
          <Button color="error" onClick={() => handleConfirm(false)}>
            Reject
          </Button>
          <Button color="success" onClick={() => handleConfirm(true)}>
            Accept
          </Button>
        </div>
      )}
    </div>
  );
}
