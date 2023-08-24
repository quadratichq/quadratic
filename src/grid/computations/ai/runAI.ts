import { apiClient } from '../../../api/apiClient';
import { authClient } from '../../../auth';
import { Coordinate } from '../../../gridGL/types/size';
import { GetCellsDB } from '../../sheet/Cells/GetCellsDB';

export interface runAIReturnType {
  success: boolean;
  error_msg: string | undefined;
  output_value: string | null;
  array_output: string[][] | null;
}

export async function runAI(prompt: string, pos: Coordinate): Promise<runAIReturnType> {
  const token = await authClient.getToken();

  const top_cells = await GetCellsDB(pos.x - 25, pos.y - 50, pos.x + 25, pos.y - 1);
  const left_cells = await GetCellsDB(pos.x - 25, pos.y - 25, pos.x - 1, pos.y + 50);

  let nearby_cells_string = '';
  for (let i = 0; i < top_cells.length; i++) {
    const cell = top_cells[i];
    // nearby_cells_string += `${cell.x},${cell.y}: "${cell.value}" \n`;
    nearby_cells_string += `||| ${cell.x},${cell.y} ||| "${cell.value}" ||| "${cell.type}" ||| "${cell.formula_code}" "${cell.python_code}" "${cell.ai_prompt}" |||\n`;
  }
  for (let i = 0; i < left_cells.length; i++) {
    const cell = left_cells[i];
    // nearby_cells_string += `${cell.x},${cell.y}: "${cell.value}" \n`;
    nearby_cells_string += `||| ${cell.x},${cell.y} ||| "${cell.value}" ||| "${cell.type}" ||| "${cell.formula_code}" "${cell.python_code}" "${cell.ai_prompt}" |||\n`;
  }

  //cut string to 28000 chars to avoid openai error
  nearby_cells_string = nearby_cells_string.slice(0, 20000);

  let response;
  try {
    const request_body = {
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant inside of a spreadsheet application called Quadratic.',
        },
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
            'Here are the nearby cells around this cell. You can use these cells to help you answer the question:' +
            nearby_cells_string,
        },
        {
          role: 'system',
          content: `The following prompt is located at ${pos.x},${pos.y}`,
        },
        {
          role: 'system',
          content: `Cells to my left have a lower x value than me. Cells above me have a lower y value than me.`,
        },
        {
          role: 'system',
          content:
            'You only ever respond with a one or two dimensional array of strings to put in the cell. When responding with a table you add headers to each column. You just reply with the array, no other text, no description, no warnings. Just the array.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    };

    response = await fetch(`${apiClient.getApiUrl()}/ai/chat`, {
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

    const result = res_json.data.choices[0].message?.content;

    // try and parse the result as JSON
    let parsedResult = null;
    try {
      parsedResult = JSON.parse(result || '');
    } catch (e) {
      throw new Error(`Invalid JSON: ${result}`);
    }

    return {
      success: true,
      error_msg: undefined,
      output_value: result.trim(),
      array_output: parsedResult,
    } as runAIReturnType;
  } catch (e: any) {
    return {
      success: false,
      error_msg: `OpenAI API Error: ${e.message} \n ${await response?.text()}`,
      output_value: null,
      array_output: null,
    } as runAIReturnType;
  }
}
