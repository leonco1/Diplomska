import { User } from '../users/user.entity';

/**
 * What the JWT strategy attaches to `req.user`: the local DB user plus the
 * realm roles carried in the Keycloak access token.
 */
export interface AuthUser {
  user: User;
  roles: string[];
}
