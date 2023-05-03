import { useAuth0 } from '@auth0/auth0-react';
import { Send, Stop } from '@mui/icons-material';
import { Avatar, CircularProgress, FormControl, IconButton, InputAdornment, OutlinedInput } from '@mui/material';
import { useRef, useState } from 'react';
import apiClientSingleton from '../../../api-client/apiClientSingleton';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { CellEvaluationResult } from '../../../grid/computations/types';
import { colors } from '../../../theme/colors';
import { TooltipHint } from '../../components/TooltipHint';
import { AI } from '../../icons';
import { CodeBlockParser } from './AICodeBlockParser';
import './AITab.css';

interface Props {
  editorMode: EditorInteractionState['mode'];
  evalResult: CellEvaluationResult | undefined;
  editorContent: string | undefined;
}

type Message = {
  role: 'user' | 'system' | 'assistant';
  content: string;
};

export const AITab = ({ evalResult, editorMode, editorContent }: Props) => {
  // TODO: Improve these messages. Pass current location and more docs.
  // store in a separate location for different cells
  const systemMessages = [
    {
      role: 'system',
      content:
        'You are a helpful assistant inside of a spreadsheet application called Quadratic. The cell type is: ' +
        editorMode,
    },
    {
      role: 'system',
      content: `here are the docs: Python Quadratic uses pyodide under the hood to provide a Python scripting environment directly in the browser. No more headaches around setting up or sharing a development environment. If it works for you, it’ll work when you share it. Cells icon Cell positioning within a spreadsheet is explained in the Overview. Referencing individual cells To reference an individual cell, use the global function cell (or c for short) which returns the cell value. cell(2, 3) # Returns the value of the cell c(2, 3) # Returns the value of the cell The resulting value can be used directly in a Pythonic way. c(0, 0) + c(0, 1) # Adds cell 0, 0 and cell 0, 1 c(0, 0) == c(0, 1) # Is cell 0, 0 equal to cell 0, 1 ? When a cell depends on other cells and the other cells update, this dependent cell will also update — just like in Excel. Referencing a range of cells To reference a range of cells, use the global function cells which returns a Pandas DataFrame. cells((0, 0), (2, 2)) # Returns a DataFrame with the cell values If the first row of cells is a header, you can set first_row_header as an argument. cells((2, 2), (7, 52), first_row_header=True) As an example, this code references a table of expenses, filters it based on a user-specified column, and returns the resulting DataFrame to the spreadsheet. # Pull the full expenses table in as a DataFrame expenses_table = cells((2, 2), (7, 52), first_row_header=True) # Take user input at a cell (Category = "Gas") category = cell(10, 0) # Filter the full expenses table to the "Gas" category, return the resulting DataFrame expenses_table[expenses_table["Category"] == category] Returning a Python list of values You can return multiple values to the spreadsheet by returning a list of values in Python. For example: # Loop over a list of values result = [] for x in range(0, 5): result.append(x) # Return it to the spreadsheet result By default arrays are expanded vertically. To have an array expand horizontally, wrap it in a second array, e.g. [result] # result: [0, 1, 2, 3, 4] # Return it to the spreadsheet **vertically** result # [0][ ][ ][ ][ ] # [1][ ][ ][ ][ ] # [2][ ][ ][ ][ ] # [3][ ][ ][ ][ ] # [4][ ][ ][ ][ ] # Return it to the spreadsheet horizontally [result] # [0][1][2][3][4] # [ ][ ][ ][ ][ ] # [ ][ ][ ][ ][ ] # [ ][ ][ ][ ][ ] # [ ][ ][ ][ ][ ] Returning a Pandas DataFrame The following code creates a DataFrame of 15 rows, by 4 columns filled with random numbers between 0 and 100. It is the last expression, so it is returned to the the spreadsheet. # pandas and numpy are preloaded by default! import pandas as pd import numpy as np # using numpy's randint, return df to Grid pd.DataFrame(np.random.randint( 0, 100, size=(15, 4), )) Fetching data You can make an external HTTP request directly from a Quadratic Cell using js.fetch. See pyodide’s docs for detailed information on using the fetch API in Python icon Note: requests are made client-side from your web browser and are subject to CORS limitations. You may need to proxy requests through a CORS proxy such as cors.sh. Example: making an API call to OpenAPI with a prompt import json import pyodide api_key = c(0,3) model = c(0, 5) max_tokens = c(0, 7) temperature = c(0, 9) top_p = c(0, 11) prompt = c(0, 13) # Make API Request response = await pyodide.http.pyfetch( 'https://api.openai.com/v1/completions', method= "POST", headers = { "Content-Type": "application/json", "Authorization": "Bearer {}".format(api_key), }, body = json.dumps({ "model": str(model), "prompt": str(prompt), "max_tokens": int(max_tokens), "temperature":  float(temperature), "top_p": float(top_p) }) ) # debug # print(await response.string()) if (response.status == 401): raise Exception("Check your OpenAI API key") else: response_json = await response.json() result = response_json["choices"][0]["text"].strip() Example: pulling stock data from the Polygon API import json import pyodide api_key = c(0,3) model = c(0, 5) max_tokens = c(0, 7) temperature = c(0, 9) top_p = c(0, 11) prompt = c(0, 13) # Make API Request response = await pyodide.http.pyfetch( 'https://api.openai.com/v1/completions', method= "POST", headers = { "Content-Type": "application/json", "Authorization": "Bearer {}".format(api_key), }, body = json.dumps({ "model": str(model), "prompt": str(prompt), "max_tokens": int(max_tokens), "temperature":  float(temperature), "top_p": float(top_p) }) ) # debug # print(await response.string()) if (response.status == 401): raise Exception("Check your OpenAI API key") else: response_json = await response.json() result = response_json["choices"][0]["text"].strip() Packages The following libraries are included by default: Pandas (https://pandas.pydata.org/) NumPy (https://numpy.org/) SciPy (https://scipy.org/) You can import them like any other native Python package. import pandas as pd Additionally, you can use Micropip to install additional Python packages (and their dependencies). import micropip # 'await' is necessary to wait until the package is available await micropip.install("faker") # import installed package from faker import Faker # use the package! fake = Faker() fake.name() This only works for packages that are either pure Python or for packages with C extensions that are built in Pyodide. If a pure Python package is not found in the Pyodide repository it will be loaded from PyPI. Learn more about how packages work in Pyodide.`,
    },
    {
      role: 'system',
      content: 'Currently, you are in a cell that is being edited. The code in the cell is:' + editorContent,
    },
    {
      role: 'system',
      content: 'If the code was recently run here was the result:' + JSON.stringify(evalResult),
    },
  ] as Message[];

  const [prompt, setPrompt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const controller = useRef<AbortController>();
  const { user } = useAuth0();

  const abortPrompt = () => {
    controller.current?.abort();
    setLoading(false);
  };

  const submitPrompt = async () => {
    if (loading) return;
    controller.current = new AbortController();
    setLoading(true);
    const token = await apiClientSingleton.getAuth();
    const updatedMessages = [...messages, { role: 'user', content: prompt }] as Message[];
    const request_body = {
      model: 'gpt-4',
      messages: [...systemMessages, ...updatedMessages],
    };
    setMessages(updatedMessages);
    setPrompt('');

    await fetch(`${apiClientSingleton.getAPIURL()}/ai/chat/stream`, {
      method: 'POST',
      signal: controller.current.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request_body),
    })
      .then((response) => {
        if (response.status !== 200) {
          if (response.status === 429) {
            setMessages((old) => [
              ...old,
              {
                role: 'assistant',
                content: 'You have exceeded the maximum number of requests. Please try again later.',
              },
            ]);
          } else {
            setMessages((old) => [
              ...old,
              {
                role: 'assistant',
                content: 'Looks like there was a problem. Status Code: ' + response.status,
              },
            ]);
            console.error(`error retrieving data from AI API: ${response.status}`);
          }
          return;
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        let responseMessage = {
          role: 'assistant',
          content: '',
        } as Message;
        setMessages((old) => [...old, responseMessage]);

        return reader?.read().then(function processResult(result): any {
          buffer += decoder.decode(result.value || new Uint8Array(), { stream: !result.done });
          const parts = buffer.split('\n');
          buffer = parts.pop() || '';
          for (const part of parts) {
            const message = part.replace(/^data: /, '');
            try {
              const data = JSON.parse(message);

              // Do something with the JSON data here
              if (data.choices[0].delta.content !== undefined) {
                responseMessage.content += data.choices[0].delta.content;
                setMessages((old) => {
                  old.pop();
                  old.push(responseMessage);
                  return [...old];
                });
              }
            } catch (err) {
              // Not JSON, nothing to do.
            }
          }
          if (result.done) {
            // stream complete
            return;
          }
          return reader.read().then(processResult);
        });
      })
      .catch((err) => {
        // not sure what would cause this to happen
        if (err.name !== 'AbortError') {
          console.log(err);
          return;
        }
      });
    // eslint-disable-next-line no-unreachable

    setLoading(false);
  };

  const display_message = messages.filter((message, index) => message.role !== 'system');

  return (
    <>
      <div
        style={{
          position: 'absolute',
          bottom: '0',
          left: '0',
          right: '1rem',
          padding: '1rem 0 .5rem 1rem',
          background: 'linear-gradient(0deg, rgba(255,255,255,1) 85%, rgba(255,255,255,0) 100%)',
          zIndex: 100,
        }}
      >
        <FormControl fullWidth>
          <OutlinedInput
            id="prompt-input"
            value={prompt}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              setPrompt(event.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                submitPrompt();
              }
            }}
            placeholder="Ask a question"
            endAdornment={
              <InputAdornment position="end">
                {loading && <CircularProgress size="1.25rem" sx={{ mx: '1rem' }} />}
                {loading ? (
                  <TooltipHint title="Stop generating">
                    <IconButton size="small" color="primary" onClick={abortPrompt} edge="end">
                      <Stop />
                    </IconButton>
                  </TooltipHint>
                ) : (
                  <TooltipHint title="Send">
                    <IconButton size="small" color="primary" onClick={submitPrompt} edge="end" disabled={loading}>
                      <Send />
                    </IconButton>
                  </TooltipHint>
                )}
              </InputAdornment>
            }
            size="small"
            fullWidth
            autoFocus
            sx={{ py: '.25rem', pr: '1rem' }}
          />
        </FormControl>
      </div>
      <div
        contentEditable="true"
        suppressContentEditableWarning={true}
        spellCheck={false}
        onKeyDown={(e) => {
          if (((e.metaKey || e.ctrlKey) && e.key === 'a') || ((e.metaKey || e.ctrlKey) && e.key === 'c')) {
            // Allow a few commands, but nothing else
          } else {
            e.preventDefault();
          }
        }}
        style={{
          outline: 'none',
          // fontFamily: 'monospace',
          fontSize: '.875rem',
          lineHeight: '1.3',
          whiteSpace: 'pre-wrap',
          paddingBottom: '5rem',
        }}
        // Disable Grammarly
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
      >
        {display_message.length === 0 ? (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '1rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 500, marginBottom: '1rem' }}>
                <AI sx={{ color: colors.languageAI }} fontSize="large"></AI>
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 400, marginBottom: '1rem' }}>
                Ask a question to get started.
              </div>
            </div>
          </div>
        ) : (
          <div id="ai-streaming-output">
            {display_message.map((message, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  borderTop: index !== 0 ? `1px solid ${colors.lightGray}` : 'none',
                  marginTop: '1rem',
                  paddingTop: index !== 0 ? '1rem' : '0',
                  paddingLeft: '1rem',
                  paddingRight: '1rem',
                }}
              >
                {message.role === 'user' ? (
                  <Avatar
                    variant="rounded"
                    sx={{
                      bgcolor: colors.quadraticSecondary,
                      width: 24,
                      height: 24,
                      fontSize: '0.8rem',
                      marginBottom: '0.5rem',
                    }}
                    alt={user?.name}
                    src={user?.picture}
                  ></Avatar>
                ) : (
                  <Avatar
                    variant="rounded"
                    sx={{
                      bgcolor: 'white',
                      width: 24,
                      height: 24,
                      fontSize: '0.8rem',
                      marginBottom: '0.5rem',
                    }}
                    alt="AI Assistant"
                  >
                    <AI sx={{ color: colors.languageAI }}></AI>
                  </Avatar>
                )}
                <span>{CodeBlockParser({ input: message.content })}</span>
              </div>
            ))}
            <div id="ai-streaming-output-anchor" key="ai-streaming-output-anchor" />
          </div>
        )}
      </div>
    </>
  );
};
