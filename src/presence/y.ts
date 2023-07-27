import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

// replace http(s) with ws(s) in process.env.REACT_APP_QUADRATIC_API_URL
const WS_URL = process.env.REACT_APP_QUADRATIC_API_URL?.replace('http', 'ws');

// Create the shared doc
export const doc = new Y.Doc();

// Create a websocket provider
export const provider = new WebsocketProvider(`${WS_URL}/ws`, 'demo-room-4', doc);

// Export the provider's awareness API
export const awareness = provider.awareness;
