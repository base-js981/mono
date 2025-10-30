const express = require('express');
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const Queue = require('bull');

const app = express();

const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

const emailQueue = new Queue('email', {
  redis: {
    host: REDIS_HOST,
    port: REDIS_PORT,
  },
});

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/');

createBullBoard({
  queues: [new BullAdapter(emailQueue)],
  serverAdapter,
});

app.use('/', serverAdapter.getRouter());

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bull Board đang chạy tại http://0.0.0.0:${PORT}`);
});

