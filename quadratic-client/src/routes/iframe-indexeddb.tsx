// This route is used to initialize the iframe indexeddb and is meant to visited only in an iframe
// This is loaded in an iframe on the marketing site where the user uploaded files get saved to the iframe's indexeddb
// On submitting the prompt, the user is redirected to app with the chat-id as a query param where this iframe is loaded again,
// files are loaded from the iframe's indexeddb and imported into the grid / ai analyst based on file type

import '@/app/ai/iframeAiChatFiles/IframeAiChatFiles';

export const Component = () => {
  return null;
};
