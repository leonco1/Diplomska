import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Requires the caller's Keycloak token to carry at least one of these realm roles. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
