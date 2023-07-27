import { createServer, Server as HTTPServer } from 'http';
import { Server as WebSocketServer } from 'ws';
import { app } from './app';
const server: HTTPServer = createServer(app);
const wss: WebSocketServer = new WebSocketServer({ server });
const setupWSConnection = require('./websocket/utils').setupWSConnection;

// Handle WebSocket connections here
wss.on('connection', setupWSConnection);
server.on('upgrade', (request, socket, head) => {
  // You may check auth of request here..
  // See https://github.com/websockets/ws#client-authentication

  // const handleAuth = (ws: any) => {
  //   wss.emit('connection', ws, request);
  // };
  // wss.handleUpgrade(request, socket, head, handleAuth);

  if (request.url === '/ws') {
    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Start the server
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
