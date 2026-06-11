import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from './roles.decorator';
import type { AuthUser } from './auth-user';

/**
 * Checks `@Roles(...)` metadata against the realm roles on the authenticated
 * user. Runs after JwtAuthGuard, so `req.user` is already populated.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const authUser = req.user as AuthUser | undefined;
    const roles = authUser?.roles ?? [];
    if (required.some((role) => roles.includes(role))) return true;

    throw new ForbiddenException(
      `Requires one of the following roles: ${required.join(', ')}`,
    );
  }
}
