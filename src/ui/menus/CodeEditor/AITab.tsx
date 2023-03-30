import { Send } from '@mui/icons-material';
import { CircularProgress, FormControl, IconButton, InputAdornment, OutlinedInput } from '@mui/material';
import { useState } from 'react';
import apiClientSingleton from '../../../api-client/apiClientSingleton';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { cellEvaluationReturnType } from '../../../grid/computations/types';
// import hljs from 'highlight.js/lib/core';
// import python from 'highlight.js/lib/languages/python';
// import MarkdownIt from 'markdown-it';
// import 'highlight.js/styles/atom-one-dark.css';
import { CodeBlockParser } from './AICodeBlockParser';
// hljs.registerLanguage('python', python);

// var markdown = MarkdownIt({
//   highlight: function (str, lang) {
//     if (lang && hljs.getLanguage(lang)) {
//       try {
//         return hljs.highlight(str, { language: lang }).value;
//       } catch (__) {}
//     }

//     return ''; // use external default escaping
//   },
// });

interface Props {
  editorMode: EditorInteractionState['mode'];
  evalResult: cellEvaluationReturnType | undefined;
  editorContent: string | undefined;
}

export const AITab = ({ evalResult, editorMode, editorContent }: Props) => {
  const [prompt, setPrompt] = useState<string>('');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const submitPrompt = async () => {
    setLoading(true);
    console.log('submitting prompt', prompt);

    const token = await apiClientSingleton.getAuth();

    let response;
    try {
      const request_body = {
        model: 'gpt-4',
        messages: [
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
          {
            role: 'user',
            content: prompt,
          },
        ],
      };

      response = await fetch(`${apiClientSingleton.getAPIURL()}/ai/autocomplete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request_body),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const res_json = await response.json();

      setResult(res_json.data.choices[0].message?.content);
    } catch (err: any) {
      setResult('Error');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'red', overflow: 'hidden' }}>
      <div style={{ alignSelf: 'end', width: '100%' }}>
        <FormControl fullWidth>
          <OutlinedInput
            id="prompt-input"
            value={prompt}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              setPrompt(event.target.value);
            }}
            placeholder="Ask a question"
            endAdornment={
              <InputAdornment position="end">
                <IconButton onClick={submitPrompt} edge="end" disabled={loading}>
                  {loading ? <CircularProgress></CircularProgress> : <Send></Send>}
                </IconButton>
              </InputAdornment>
            }
            size="small"
            fullWidth
          />
        </FormControl>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ overflow: 'scroll' }}>
          {CodeBlockParser({ input: result })}
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore
          magna aliqua. In nisl nisi scelerisque eu ultrices vitae auctor. Quam nulla porttitor massa id neque aliquam
          vestibulum morbi blandit. Eget mauris pharetra et ultrices neque ornare aenean. Tincidunt eget nullam non nisi
          est sit amet facilisis. Amet tellus cras adipiscing enim eu turpis egestas. Sapien et ligula ullamcorper
          malesuada. Ultrices in iaculis nunc sed. Eleifend quam adipiscing vitae proin. Laoreet sit amet cursus sit.
          Egestas congue quisque egestas diam in arcu. A condimentum vitae sapien pellentesque habitant morbi. Varius
          sit amet mattis vulputate enim nulla aliquet porttitor lacus. Sapien faucibus et molestie ac feugiat sed
          lectus. Natoque penatibus et magnis dis parturient montes nascetur ridiculus mus. Eget sit amet tellus cras
          adipiscing enim eu turpis. Ut morbi tincidunt augue interdum velit euismod in pellentesque. Risus commodo
          viverra maecenas accumsan lacus. Mollis aliquam ut porttitor leo a diam sollicitudin tempor. Tortor posuere ac
          ut consequat semper viverra nam libero justo. Convallis a cras semper auctor neque vitae tempus quam. Dictum
          non consectetur a erat nam at lectus. Cras adipiscing enim eu turpis egestas pretium aenean pharetra magna.
          Imperdiet dui accumsan sit amet nulla facilisi morbi tempus iaculis. Sit amet est placerat in egestas. Lacus
          sed turpis tincidunt id. Scelerisque eleifend donec pretium vulputate sapien nec sagittis. Viverra suspendisse
          potenti nullam ac tortor. Velit scelerisque in dictum non consectetur a erat. Ornare lectus sit amet est
          placerat in egestas erat imperdiet. Vel pharetra vel turpis nunc. Risus feugiat in ante metus dictum at tempor
          commodo ullamcorper. Commodo ullamcorper a lacus vestibulum sed. Lacus vel facilisis volutpat est velit
          egestas dui id. Faucibus scelerisque eleifend donec pretium vulputate sapien nec sagittis aliquam. Commodo
          elit at imperdiet dui. Sit amet facilisis magna etiam. Orci eu lobortis elementum nibh tellus molestie nunc.
          Magnis dis parturient montes nascetur ridiculus mus mauris vitae. Duis at consectetur lorem donec massa
          sapien. Etiam tempor orci eu lobortis elementum nibh tellus. Viverra justo nec ultrices dui sapien eget mi
          proin sed. Leo vel orci porta non pulvinar neque. Aliquet risus feugiat in ante metus dictum. Nascetur
          ridiculus mus mauris vitae ultricies leo. Ac auctor augue mauris augue neque gravida in fermentum. Vitae proin
          sagittis nisl rhoncus mattis rhoncus. Feugiat in ante metus dictum at tempor commodo ullamcorper. Id ornare
          arcu odio ut sem nulla pharetra diam sit. Viverra tellus in hac habitasse. Nascetur ridiculus mus mauris vitae
          ultricies leo integer malesuada nunc. Mi proin sed libero enim sed faucibus turpis in. Orci a scelerisque
          purus semper eget duis at. Amet consectetur adipiscing elit pellentesque habitant morbi tristique senectus.
          Nulla facilisi etiam dignissim diam. Aliquam id diam maecenas ultricies mi eget mauris pharetra et.
          Pellentesque eu tincidunt tortor aliquam nulla facilisi. Feugiat sed lectus vestibulum mattis ullamcorper
          velit sed ullamcorper. Aliquam ultrices sagittis orci a scelerisque purus semper eget. Nunc scelerisque
          viverra mauris in aliquam sem fringilla. Nisl vel pretium lectus quam. Dignissim sodales ut eu sem integer
          vitae justo eget magna. Ullamcorper velit sed ullamcorper morbi tincidunt ornare massa eget egestas. Convallis
          aenean et tortor at risus. Pellentesque sit amet porttitor eget. Adipiscing elit ut aliquam purus sit amet
          luctus. Sit amet commodo nulla facilisi nullam vehicula. Viverra vitae congue eu consequat ac felis donec et
          odio. Fringilla ut morbi tincidunt augue interdum velit euismod in pellentesque. In hac habitasse platea
          dictumst vestibulum rhoncus. Tortor at risus viverra adipiscing at in tellus. Et malesuada fames ac turpis
          egestas integer eget aliquet. Eu volutpat odio facilisis mauris sit amet massa. Tellus integer feugiat
          scelerisque varius morbi enim nunc faucibus a. Odio tempor orci dapibus ultrices. Purus semper eget duis at.
          Morbi quis commodo odio aenean sed adipiscing diam. Velit scelerisque in dictum non consectetur a erat nam at.
          Pretium viverra suspendisse potenti nullam ac tortor. Interdum velit laoreet id donec ultrices tincidunt.
          Mattis nunc sed blandit libero volutpat sed cras. Ultricies lacus sed turpis tincidunt id. Mauris cursus
          mattis molestie a iaculis at. Felis bibendum ut tristique et egestas quis ipsum suspendisse ultrices.
          Suspendisse sed nisi lacus sed viverra tellus in hac habitasse. Molestie ac feugiat sed lectus. Pretium nibh
          ipsum consequat nisl vel pretium lectus quam. Nisi scelerisque eu ultrices vitae auctor eu augue ut. Elit ut
          aliquam purus sit amet luctus venenatis. In ornare quam viverra orci sagittis eu volutpat odio. Est velit
          egestas dui id ornare arcu odio. Lectus urna duis convallis convallis tellus. Facilisis leo vel fringilla est
          ullamcorper eget nulla facilisi. Egestas pretium aenean pharetra magna ac placerat vestibulum lectus. Aenean
          et tortor at risus viverra. Orci eu lobortis elementum nibh tellus molestie nunc non blandit. Scelerisque
          viverra mauris in aliquam sem. Mi bibendum neque egestas congue quisque egestas diam in. In hac habitasse
          platea dictumst quisque sagittis purus sit. Egestas integer eget aliquet nibh praesent tristique magna sit
          amet. Tincidunt praesent semper feugiat nibh sed pulvinar proin. Hac habitasse platea dictumst quisque
          sagittis purus sit amet volutpat. Enim blandit volutpat maecenas volutpat. Vestibulum mattis ullamcorper velit
          sed ullamcorper morbi. Nibh sed pulvinar proin gravida. Egestas quis ipsum suspendisse ultrices gravida dictum
          fusce ut. Nam at lectus urna duis convallis convallis. Quisque egestas diam in arcu cursus euismod quis
          viverra nibh. Diam sollicitudin tempor id eu nisl nunc mi ipsum faucibus. Nec dui nunc mattis enim. Nunc id
          cursus metus aliquam eleifend mi in nulla. Viverra nam libero justo laoreet sit amet cursus. Imperdiet sed
          euismod nisi porta lorem mollis. Elementum integer enim neque volutpat ac. Mattis pellentesque id nibh tortor
          id aliquet lectus. Non nisi est sit amet facilisis magna etiam tempor. Posuere sollicitudin aliquam ultrices
          sagittis orci a. Vulputate dignissim suspendisse in est ante in nibh. Sit amet facilisis magna etiam tempor
          orci eu lobortis elementum. Viverra vitae congue eu consequat ac. Morbi quis commodo odio aenean sed. Cursus
          eget nunc scelerisque viverra. Senectus et netus et malesuada fames ac. Faucibus purus in massa tempor nec
          feugiat nisl. Convallis posuere morbi leo urna molestie at elementum eu facilisis. Vel facilisis volutpat est
          velit egestas dui id. Morbi tincidunt ornare massa eget egestas purus viverra accumsan. Ultrices dui sapien
          eget mi proin. Felis donec et odio pellentesque diam volutpat commodo. Sit amet cursus sit amet dictum sit.
          Adipiscing bibendum est ultricies integer quis. Tellus in hac habitasse platea dictumst vestibulum rhoncus.
          Nec sagittis aliquam malesuada bibendum. Venenatis tellus in metus vulputate. Bibendum arcu vitae elementum
          curabitur vitae nunc sed. Blandit turpis cursus in hac. Commodo elit at imperdiet dui accumsan. Etiam tempor
          orci eu lobortis. Erat velit scelerisque in dictum. Sollicitudin aliquam ultrices sagittis orci a scelerisque.
          Faucibus in ornare quam viverra orci sagittis eu. Tristique sollicitudin nibh sit amet commodo nulla facilisi
          nullam. At augue eget arcu dictum varius duis at. Orci porta non pulvinar neque laoreet. Tempus quam
          pellentesque nec nam. Tempus quam pellentesque nec nam aliquam sem et tortor consequat. Ut tortor pretium
          viverra suspendisse potenti nullam. Nisl nunc mi ipsum faucibus.
        </div>
      </div>
    </div>
  );
};
