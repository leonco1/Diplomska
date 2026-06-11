import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { UsersService } from '../users/users.service';
import type { AuthUser } from './auth-user';

/**
 * Keycloak access-token claims we rely on. `sub` identifies the user;
 * `realm_access.roles` carries the realm roles used for authorization.
 */
interface KeycloakJwtPayload {
  sub: string;
  email?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
}

const ISSUER =
  process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/streamapp';
const JWKS_URI =
  process.env.KEYCLOAK_JWKS_URI ||
  `${ISSUER}/protocol/openid-connect/certs`;
// Optional. Keycloak's default access tokens for a public SPA client carry no
// `aud` claim, so audience validation is off unless KEYCLOAK_AUDIENCE is set
// (e.g. after adding an audience mapper). Signature + issuer are always checked.
const AUDIENCE = process.env.KEYCLOAK_AUDIENCE?.trim();

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Fetch + cache Keycloak's signing keys (JWKS) to verify token signatures.
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: JWKS_URI,
      }),
      issuer: ISSUER,
      ...(AUDIENCE ? { audience: AUDIENCE } : {}),
      algorithms: ['RS256'],
    });
  }

  /** Runs after the signature/issuer/audience checks pass. JIT-provisions the user. */
  async validate(payload: KeycloakJwtPayload): Promise<AuthUser> {
    if (!payload?.sub) {
      throw new UnauthorizedException('Token missing subject');
    }
    const user = await this.users.upsertFromToken({
      keycloakId: payload.sub,
      email: payload.email ?? '',
      username: payload.preferred_username ?? '',
    });
    return { user, roles: payload.realm_access?.roles ?? [] };
  }
}
