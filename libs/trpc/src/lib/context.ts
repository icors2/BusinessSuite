import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { AppConfig } from 'config';
import { JwtPayload } from 'auth';
import { createTrpcContext } from './trpc';

export function createContextFromRequest(
  req: Request,
  config: AppConfig,
): ReturnType<typeof createTrpcContext> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return createTrpcContext(undefined);
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    const payload = jwt.verify(
      token,
      config.jwt.accessSecret,
    ) as JwtPayload;

    return createTrpcContext({
      userId: payload.sub,
      email: payload.email,
      roles: payload.roles,
    });
  } catch {
    return createTrpcContext(undefined);
  }
}
