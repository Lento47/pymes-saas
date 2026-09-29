import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../common/prisma/prisma.service";
import { validateJwtSecret } from "../../common/validation/env.validation";

export interface JwtPayload {
  sub: string; // user.id
  email: string;
  workspace_id: string;
  role: string;
  is_platform_admin: boolean;
  iat?: number;
  exp?: number;
  /**
   * Absent on a normal access token — the overwhelming majority never set it. It exists
   * so a **short-lived, single-purpose token cannot be used as a bearer**.
   *
   * The admin login hands the browser a 60-second bootstrap code in a redirect URL
   * instead of the real tokens (`AdminAuthService.exchangeBootstrapCode`). That code is
   * signed with the same secret and carries a valid `sub` + `workspace_id`, so without
   * this check it would sail through `validate()` below and authenticate as its owner —
   * not as a platform admin, but as an ordinary user, from a URL that sits in browser
   * history and in access logs.
   *
   * Tokens that predate this field stay valid, so no existing session is invalidated.
   */
  typ?: "admin_bootstrap";
}

/** Contexto del usuario autenticado — disponible en req.user */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  workspace_id: string;
  role: string;
  is_owner: boolean;
  is_platform_admin: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: validateJwtSecret(),
      algorithms: ["HS256"],
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    // Signed, unexpired, and the wrong *kind* of token. Rejected before the database is
    // touched, so a leaked bootstrap code is worth nothing to anyone holding it as a
    // bearer token. `undefined` is the normal case and falls through untouched.
    if (payload.typ !== undefined) {
      throw new UnauthorizedException();
    }

    const workspaceUser = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: payload.workspace_id,
          user_id: payload.sub,
        },
      },
      include: { user: true },
    });

    if (!workspaceUser || workspaceUser.user.status !== "ACTIVE") {
      throw new UnauthorizedException();
    }

    return {
      id: workspaceUser.user.id,
      email: workspaceUser.user.email,
      name: workspaceUser.user.name,
      workspace_id: workspaceUser.workspace_id,
      role: workspaceUser.role,
      is_owner: workspaceUser.is_owner,
      is_platform_admin: workspaceUser.user.is_platform_admin ?? false,
    };
  }
}
