import express from 'express';
import cors from 'cors';
import ai_chat_router from './routes/ai_chat';
import helmet from 'helmet';

const app = express();
app.use(express.json());
app.use(helmet());

// set CORS origin from env variable
const origin = process.env.CORS || '*';
app.use(cors({ origin }));

// Middleware to redirect HTTP requests to HTTPS
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
    return res.redirect(`https://${req.hostname}${req.url}`);
  }
  return next();
});

// Routes
app.use('/ai', ai_chat_router);

// Start the server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
