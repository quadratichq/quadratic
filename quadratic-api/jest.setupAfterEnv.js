// Setup that runs after Jest environment is initializedAdd a comment on lines R1 to R5Add diff commentMarkdown input:  edit mode selected.WritePreviewAdd a suggestionHeadingBoldItalicQuoteCodeLinkUnordered listNumbered listTask listMentionReferenceSaved repliesAdd FilesPaste, drop, or click to add filesCancelCommentStart a reviewReturn to code
// This has access to Jest globals like afterAll, beforeAll, etc.

// Global cleanup for each test suite
afterAll(async () => {
  try {
    const dbClient = require('./src/dbClient').default;
    await dbClient.$disconnect();
  } catch (error) {
    // Ignore errors during cleanup
    console.warn('Warning: Error during test cleanup:', error.message);
  }
});
