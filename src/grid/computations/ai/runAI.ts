// import { GetCellsDB } from '../../sheet/Cells/GetCellsDB';
import { Coordinate } from '../../../gridGL/types/size';
import { Configuration, OpenAIApi } from 'openai';

export interface runAIReturnType {
  cells_accessed: [number, number][];
  success: boolean;
  error_span: [number, number] | null;
  error_msg: string | null;
  output_value: string | null;
  array_output: string[][] | null;
}

const configuration = new Configuration({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export async function runAI(prompt: string, pos: Coordinate): Promise<runAIReturnType> {
  const completion = await openai.createChatCompletion({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a helpful assistant inside of a spreadsheet application called Quadratic.' },
      { role: 'system', content: 'You generate responses either as a single short string, or a list of strings.' },
      {
        role: 'system',
        content:
          'For example if a user asks for a list of 3 months starting at Jan 2020, you reply ["Jan 2020", "Feb 2020", "Mar 2020"].',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  });
  console.log(completion.data.choices[0].message?.content);
  console.log(completion.data.choices[0]);

  const result = completion.data.choices[0].message?.content;

  // try and parse the result as JSON
  let parsedResult = null;
  try {
    parsedResult = JSON.parse(result || '');
  } catch (e) {
    console.log('Could not parse result as JSON');
  }

  return {
    cells_accessed: [],
    success: true,
    error_span: null,
    error_msg: null,
    output_value: completion.data.choices[0].message?.content?.trim(),
    array_output: parsedResult,
  } as runAIReturnType;
}
