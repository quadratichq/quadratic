export class EmptyMessagesError extends Error {
  constructor() {
    super('No valid messages to send to the AI model after filtering.');
    this.name = 'EmptyMessagesError';
  }
}
