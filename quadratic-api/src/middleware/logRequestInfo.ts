import type { NextFunction, Request, Response } from 'express';
import { v4 } from 'uuid';
import { VERSION } from '../env-vars';

export const logRequestInfo = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || req.headers['x-correlation-id'] || `req_${startTime}_${v4()}`;

  // Log request start
  console.info(
    JSON.stringify({
      level: 'info',
      message: 'HTTP Request',
      method: req.method,
      url: req.originalUrl,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.socket.remoteAddress,
      requestId,
      timestamp: new Date().toISOString(),
      contentType: req.headers['content-type'],
      accept: req.headers['accept'],
      contentLength: req.headers['content-length'] || '0',
      queryParams: Object.keys(req.query).length > 0 ? req.query : undefined,
      protocol: req.protocol,
      host: req.get('host'),
      referrer: req.headers['referer'],
      version: VERSION,
    })
  );

  // Log response when finished
  res.once('finish', () => {
    const duration = Date.now() - startTime;
    console.info(
      JSON.stringify({
        level: 'info',
        message: 'HTTP Response',
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        requestId,
        timestamp: new Date().toISOString(),
        responseSize: res.get('content-length') || '0',
        responseType: res.get('content-type'),
        cacheControl: res.get('cache-control'),
        version: VERSION,
      })
    );
  });

  next();
};
