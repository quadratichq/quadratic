import { GetCellsDB } from '../../sheet/Cells/GetCellsDB';
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
  const top_cells = await GetCellsDB(pos.x - 25, pos.y - 50, pos.x + 25, pos.y - 1);
  const left_cells = await GetCellsDB(pos.x - 25, pos.y - 25, pos.x - 1, pos.y + 50);

  let nearby_cells_string = '';
  for (let i = 0; i < top_cells.length; i++) {
    const cell = top_cells[i];
    nearby_cells_string += `${cell.x},${cell.y}: "${cell.value}" \n`;
    // top_cells_string += `||| ${cell.x},${cell.y}: "${cell.value}" ||| "${cell.type}" ||| "${cell.formula_code}" "${cell.python_code}" "${cell.ai_prompt}" |||\n`;
  }
  for (let i = 0; i < left_cells.length; i++) {
    const cell = left_cells[i];
    nearby_cells_string += `${cell.x},${cell.y}: "${cell.value}" \n`;
    // top_cells_string += `||| ${cell.x},${cell.y}: "${cell.value}" ||| "${cell.type}" ||| "${cell.formula_code}" "${cell.python_code}" "${cell.ai_prompt}" |||\n`;
  }

  const completion = await openai.createChatCompletion({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a helpful assistant inside of a spreadsheet application called Quadratic.' },
      {
        role: 'system',
        content:
          'For example if a user asks for a list of 3 months starting at Jan 2020, you reply ["Jan 2020", "Feb 2020", "Mar 2020"].',
      },
      {
        role: 'system',
        content:
          'For example if a user asks for the top 3 scoring basketball players and their score, you reply [["PLAYER_NAME", "SCORE"], ["PLAYER_NAME", "SCORE"], ["PLAYER_NAME", "SCORE"]].',
      },
      {
        role: 'system',
        content:
          'Here are the nearby cells above this cell. You can use these cells to help you answer the question:' +
          nearby_cells_string,
      },
      {
        role: 'system',
        content: `The following prompt is located at ${pos.x},${pos.y}`,
      },
      {
        role: 'system',
        content:
          'You only ever respond with a one or two dimensional array of strings to put in the cell. Just the array, no other text.',
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
