import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';

export const debugAIContext = (messagesForAI: ChatMessage[]) => {
  let output = '';
  for (const message of messagesForAI) {
    const boxWidth = 72;
    const contextTypeLabel = ` Context Type: ${message.contextType} `;
    const roleLabel = ` Role: ${message.role} `;
    const contextTypePadding = Math.max(0, boxWidth - contextTypeLabel.length);
    const rolePadding = Math.max(0, boxWidth - roleLabel.length);
    output += `╔${'═'.repeat(boxWidth)}╗
║${contextTypeLabel}${' '.repeat(contextTypePadding)}║
║${roleLabel}${' '.repeat(rolePadding)}║
╚${'═'.repeat(boxWidth)}╝
`;

    if ('content' in message && Array.isArray(message.content)) {
      for (const content of message.content) {
        if ('text' in content) {
          output += content.text;
        } else if ('mimeType' in content) {
          output += content.mimeType;
        }
        output += '\n\n';
      }
    }
  }
  console.log(output);
};
