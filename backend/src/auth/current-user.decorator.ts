import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from './auth-user';

/**
 * Injects the authenticated user (local DB user + roles) into a handler param.
 * Pass a key (e.g. `@CurrentUser('user')`) to pluck a single field.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const authUser = req.user as AuthUser | undefined;
    if (!authUser) return undefined;
    return data ? authUser[data] : authUser;
  },
);
