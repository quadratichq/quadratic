import { isSupportedImageMimeType, isSupportedPdfMimeType } from 'quadratic-shared/ai/helpers/files.helper';
import type { ChatMessage, FileContent } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export function useFilesContextMessages() {
  const getFilesContext = useCallback(async ({ files }: { files: FileContent[] }): Promise<ChatMessage[]> => {
    if (files.length === 0) return [];

    const imageFiles = files.filter((file) => isSupportedImageMimeType(file.mimeType));
    const pdfFiles = files.filter((file) => isSupportedPdfMimeType(file.mimeType));

    return [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `
Note: This is an internal message for context. Do not quote it in your response.\n\n

I am sharing the following files:\n

${imageFiles.length > 0 ? `Images: ${imageFiles.map((file) => file.fileName).join(', ')}` : ''}\n
${pdfFiles.length > 0 ? `PDFs: ${pdfFiles.map((file) => file.fileName).join(', ')}` : ''}\n

Use the attached files as context to answer your questions. Use pdf files only when prompted by calling the pdf_import for extracting data.
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
${pdfFiles.length > 0 ? `I will use pdf_import tool to extract data from the attached pdf files.` : ''}\n
I will reference it to answer following messages.\n
How can I help you?`,
          },
        ],
        contextType: 'files',
      },
    ];
  }, []);

  return { getFilesContext };
}
