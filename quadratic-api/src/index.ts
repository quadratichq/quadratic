import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import ai_chat_router from './routes/ai_chat';
import helmet from 'helmet';
import files_router from './routes/files';
import feedback_router from './routes/feedback';

const app = express();
app.use(express.json({ limit: '5mb' }));
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
app.use('/v0/files', files_router);
app.use('/feedback', feedback_router);

// Error-logging middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(`[${new Date().toISOString()}] ${err.message}`);
  next(err);
});

// Error-handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  res.status(err.status || 500);
  res.json({
    error: {
      message: err.message,
    },
  });
});

// Start the server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
