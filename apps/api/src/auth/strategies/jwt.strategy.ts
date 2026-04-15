import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface JwtPayload {
  sub: string;         // user.id
  email: string;
  workspace_id: string;
  role: string;
  iat?: number;
  exp?: number;
}

/** Contexto del usuario autenticado — disponible en req.user */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  workspace_id: string;
  role: string;
  is_owner: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const workspaceUser = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: payload.workspace_id,
          user_id: payload.sub,
        },
      },
      include: { user: true },
    });

    if (!workspaceUser || workspaceUser.user.status !== 'ACTIVE') {
      throw new UnauthorizedException();
    }

    return {
      id: workspaceUser.user.id,
      email: workspaceUser.user.email,
      name: workspaceUser.user.name,
      workspace_id: workspaceUser.workspace_id,
      role: workspaceUser.role,
      is_owner: workspaceUser.is_owner,
    };
  }
}
