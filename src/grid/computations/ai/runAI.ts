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
  const completion = await openai.createCompletion({
    model: 'text-davinci-003',
    prompt,
    temperature: 0.7,
    max_tokens: 256,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });
  console.log(completion.data.choices[0].text);

  return {
    cells_accessed: [],
    success: true,
    error_span: null,
    error_msg: null,
    output_value: completion.data.choices[0].text?.trim(),
    array_output: null,
  } as runAIReturnType;
}
