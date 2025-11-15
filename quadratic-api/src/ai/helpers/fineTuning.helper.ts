import fs from 'node:fs';
import path from 'node:path';
import { getModelFromModelKey } from 'quadratic-shared/ai/helpers/model.helper';
import { isContentText } from 'quadratic-shared/ai/helpers/message.helper';
import type { AIModelKey, AIRequestHelperArgs, ParsedAIResponse, Content } from 'quadratic-shared/typesAndSchemasAI';

/**
 * Creates fine-tuning data file in OpenAI chat format
 */
export const createFileForFineTuning = (
  modelKey: AIModelKey,
  args: AIRequestHelperArgs,
  parsedResponse: ParsedAIResponse
) => {
  const model = getModelFromModelKey(modelKey);

  // Convert to OpenAI chat format
  const messages = args.messages
    .map((msg) => {
      if (msg.role === 'user' || msg.role === 'assistant') {
        if (!Array.isArray(msg.content) || msg.content.length === 0) {
          return null;
        }

        let textContent = '';

        // Check if this is a nested content array (e.g., ToolResult with { id, content })
        const firstItem = msg.content[0];
        if (firstItem && typeof firstItem === 'object' && 'id' in firstItem && 'content' in firstItem) {
          // Handle nested ToolResult structure: extract text from nested content
          type NestedContentItem = { id: string; content: unknown };
          textContent = (msg.content as NestedContentItem[])
            .map((item) => {
              if (Array.isArray(item.content)) {
                return item.content
                  .filter((c) => isContentText(c))
                  .map((c) => c.text)
                  .join('\n');
              }
              return '';
            })
            .filter(Boolean)
            .join('\n');
        } else {
          // Handle simple content array (TextContent | FileContent)
          const simpleContent = msg.content as Content;
          textContent = simpleContent
            .filter((c) => isContentText(c))
            .map((c) => c.text)
            .join('\n');
        }

        return textContent ? { role: msg.role, content: textContent } : null;
      }
      return null;
    })
    .filter(Boolean);

  // Add the assistant's response
  const responseText = parsedResponse.responseMessage.content.map((c) => c.text).join('\n');
  messages.push({ role: 'assistant', content: responseText });

  const fineTuningInput = { messages };

  // Write to finetuning directory
  const dirPath = path.join(__dirname, '../../../../finetuning');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const sanitizedModel = model.replace(/\//g, '_');
  fs.writeFileSync(
    path.join(dirPath, `${sanitizedModel}_${Date.now()}.json`),
    JSON.stringify(fineTuningInput, null, 2)
  );
};
