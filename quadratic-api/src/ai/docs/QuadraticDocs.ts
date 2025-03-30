import { getDocs } from './docs.helper';

// Fallback content in case Vertex AI fetch fails
const FALLBACK_QUADRATIC_DOCS = `# Quadratic Docs

Quadratic is a modern AI-enabled spreadsheet. Quadratic is purpose built to make working with data easier and faster.

Quadratic combines a familiar spreadsheet and formulas with the power of AI and modern coding languages like Python, SQL, and JavaScript. 

Ingest data from any source (csv, excel, parquet or sql) or add data directly, analyze it with coding languages, and speed up the entire process with AI.

Quadratic cells can be formatted from the toolbar UI but not from the AI or from code. 

Quadratic uses tables commonly to structure data. IMPORTANT: tables do not support Formulas or Code but will in the future. You cannot place Code or Formulas inside of tables.

Data is best displayed in the sheet. Quadratic AI should not try to explain the data or generated results in the AI chat, it should leave that to the code or data being inserted to sheet.

Code generated in Quadratic is not global to other code cells. The data the code cell outputs to the sheet can be referenced by other cells, but variables in one code cell cannot be read in another. Imports in one code cell do not automatically apply to other code cells.
`;

export async function getQuadraticDocs(): Promise<string> {
  return getDocs('Quadratic docs', FALLBACK_QUADRATIC_DOCS, 1);
}
