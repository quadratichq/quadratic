import {
  filterImageFilesInChatMessages,
  filterPdfFilesInChatMessages,
} from 'quadratic-shared/ai/helpers/message.helper';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useFilesContextMessages() {
  const getFilesContext = useCallback(
    async ({ chatMessages }: { chatMessages: ChatMessage[] }): Promise<ChatMessage[]> => {
      const imageFiles = filterImageFilesInChatMessages(chatMessages);
      const pdfFiles = filterPdfFilesInChatMessages(chatMessages);

      return [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `
Note: This is an internal message for context. Do not quote it in your response.\n\n

${
  imageFiles.length === 0 && pdfFiles.length === 0
    ? `No files are attached. Don't use pdf import tool, also do not assume or make any assumptions that files are attached when responding to users. If asked to do anything with an attached files, ask for the file first.`
    : ''
}

${
  imageFiles.length > 0
    ? `
I am sharing these image files, for your reference:\n
Images: ${imageFiles.map((file) => file.fileName).join(', ')}
`
    : ''
}\n


${
  pdfFiles.length > 0
    ? `
Also I have the following pdf files available which you can use for extracting data. Use pdf_import tool for extracting data from these pdfs.\n
PDFs: ${pdfFiles.map((file) => file.fileName).join(', ')}\n
Use pdf files only when prompted by calling the pdf_import for extracting data.\n
`
    : ''
}\n

Use these attached files as context to answer my questions.
`,
            },
          ],
          contextType: 'files',
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: `
I understand the files context,
${imageFiles.length > 0 ? `I will use the attached images as context to answer your questions.` : ''}\n
${pdfFiles.length > 0 ? `When prompted, I will use pdf_import tool to extract data from the attached pdf files.` : ''}\n
I will reference it to answer following messages.\n
How can I help you?`,
            },
          ],
          contextType: 'files',
        },
      ];
    },
    []
  );

  return { getFilesContext };
}
