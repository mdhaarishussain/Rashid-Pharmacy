import { Request, Response, NextFunction } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';

export interface AuthRequest<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  apiKey?: string;
  deviceId?: string;
}

export const apiKeyAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  const deviceId = req.headers['x-device-id'] as string;

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing X-API-Key header' });
  }

  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  if (!deviceId) {
    return res.status(400).json({ error: 'Missing X-Device-ID header' });
  }

  req.apiKey = apiKey;
  req.deviceId = deviceId;
  next();
};
