import { createServer, Server as HTTPServer } from 'http';
import { Server as WebSocketServer } from 'ws';
import { app } from './app';
const setupWSConnection = require('./websocket/utils').setupWSConnection;

const server: HTTPServer = createServer(app);
const wss: WebSocketServer = new WebSocketServer({ server });

// Handle WebSocket connections here
wss.on('connection', setupWSConnection);

server.on('upgrade', (request, socket, head) => {
  // You may check auth of request here..
  // See https://github.com/websockets/ws#client-authentication

  // const handleAuth = (ws: any) => {
  //   wss.emit('connection', ws, request);
  // };
  // wss.handleUpgrade(request, socket, head, handleAuth);

  // if request.url begins with '/ws', call wss.handleUpgrade
  console.log('request.url', request.url);
  if (request.url?.startsWith('/ws')) {
    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// wss.on('connection', (ws) => {
//   ws.on('close', (code, reason) => {
//     console.log(`Connection closed with code ${code} and reason: ${reason}`);
//   });

//   ws.on('error', (error) => {
//     console.log(`WebSocket error: ${error}`);
//   });

//   setupWSConnection(ws);
// });

// Start the server
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
