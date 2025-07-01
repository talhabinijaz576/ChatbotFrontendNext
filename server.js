// server.js
const express = require('express');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const SOCKET_PATH = process.platform === 'win32'
  ? process.env.WIN_PIPE || '\\\\.\\pipe\\assistant-app-pipe'
  : process.env.PORT || '/tmp/assistant-app.sock';

app.prepare().then(() => {
  const server = express();

  server.all('*', (req, res) => {
    return handle(req, res);
  });

  server.listen(SOCKET_PATH, () => {
    console.log(`✅ Server running on: ${SOCKET_PATH}`);
  });
});
