import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../common/prisma/prisma.service";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes, randomUUID } from "crypto";
import { LoginDto } from "./dto/login.dto";
import { AcceptInviteDto } from "./dto/accept-invite.dto";
import { InviteTokenPayload } from "./invite-token.types";
import { RegisterDto } from "./dto/register.dto";
import { JwtPayload, AuthUser } from "./strategies/jwt.strategy";
import { RefreshTokenService } from "./refresh-token.service";
import { WorkspaceUserRole } from "@prisma/client";
import { DemoDataService } from "../demo/demo-data.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly demoData: DemoDataService,
  ) {}
  private readonly logger = new Logger(AuthService.name);

  // ── Login ──────────────────────────────────────────────────────────────────

  async login(dto: LoginDto, workspaceSlug: string | undefined) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.password_hash) {
      throw new UnauthorizedException("Credenciales inválidas.");
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordMatch) throw new UnauthorizedException("Credenciales inválidas.");

    if (user.status !== "ACTIVE") {
      throw new UnauthorizedException("Usuario inactivo o suspendido.");
    }

    // Auto-detect workspace if no slug provided
    let effectiveSlug = workspaceSlug;
    if (!effectiveSlug) {
      const memberships = await this.prisma.workspaceUser.findMany({
        where: { user_id: user.id },
        select: { workspace: { select: { id: true, slug: true, name: true } } },
      });

      if (memberships.length === 0) {
        throw new UnauthorizedException("No tenés acceso a ningún workspace.");
      }

      if (memberships.length === 1) {
        effectiveSlug = memberships[0].workspace.slug;
      } else {
        throw new UnauthorizedException(
          "MULTIPLE_WORKSPACES:" +
            JSON.stringify(
              memberships.map((m) => ({
                id: m.workspace.id,
                slug: m.workspace.slug,
                name: m.workspace.name,
              })),
            ),
        );
      }
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { slug: effectiveSlug },
    });
    if (!workspace) throw new UnauthorizedException("Workspace no encontrado.");

    const [membership, refresh_token] = await Promise.all([
      this.prisma.workspaceUser.findUnique({
        where: {
          workspace_id_user_id: {
            workspace_id: workspace.id,
            user_id: user.id,
          },
        },
      }),
      this.refreshTokenService.create(user.id, workspace.id),
    ]);
    if (!membership) throw new UnauthorizedException("Sin acceso a este workspace.");

    const access_token = this.signToken({
      sub: user.id,
      email: user.email,
      workspace_id: workspace.id,
      role: membership.role,
      is_platform_admin: user.is_platform_admin,
    });

    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: membership.role,
        is_owner: membership.is_owner,
        is_platform_admin: user.is_platform_admin,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          plan: workspace.plan,
        },
      },
    };
  }

  // ── Register (primer usuario = owner del nuevo workspace) ─────────────────

  async register(dto: RegisterDto) {
    if (!dto.terms_accepted) {
      throw new BadRequestException("Debés aceptar los Términos de Servicio para registrarte.");
    }

    if (dto.invite_token) {
      const result = await this.acceptInvite({
        token: dto.invite_token,
        name: dto.name,
        password: dto.password,
      });
      await this.prisma.user.update({
        where: { id: result.user.id },
        data: { terms_accepted_at: new Date() },
      });
      return result;
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("El email ya está registrado.");

    const password_hash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        status: "ACTIVE",
        ...(password_hash && { password_hash }),
        terms_accepted_at: new Date(),
      },
    });

    const slug = await this.generateUniqueWorkspaceSlug();

    const workspace = await this.prisma.workspace.create({
      data: {
        name: `${dto.name}'s Workspace`,
        slug,
        status: "ACTIVE",
        plan: "FREE",
        workspace_users: {
          create: {
            user_id: user.id,
            role: "OWNER",
            is_owner: true,
          },
        },
      },
    });

    // ──────────────────────────────────────────────────────────────────────
    // IMPORTANTE — DATA DEMO AUTOMATICA EN CADA REGISTRO (DEV ONLY)
    //
    // HOY CADA NUEVO WORKSPACE RECIBE CONTACTOS, FACTURAS, CONVERSACIONES
    // Y AUTOMATIZACIONES FAKE. UTIL EN DEV/SANDBOX PARA QUE LA UI SE VEA
    // POBLADA AL ENTRAR.
    //
    // AL PASAR A PRODUCCION:
    //   - REMOVER ESTA LLAMADA, O
    //   - GATEAR DETRAS DE FEATURE FLAG (`ENABLE_DEMO_DATA=true`), O
    //   - MOVER A UNA OPCION OPT-IN EN EL ONBOARDING.
    // EN PROD INFLA LA BD CON DATA QUE EL USUARIO NO PIDIO.
    // ──────────────────────────────────────────────────────────────────────
    this.demoData.populateDemoWorkspace(workspace.id, workspace.name).catch((err) => {
      // Silent — demo data population failures are non-critical
    });

    const access_token = this.signToken({
      sub: user.id,
      email: user.email,
      workspace_id: workspace.id,
      role: "OWNER",
      is_platform_admin: false,
    });

    const refresh_token = await this.refreshTokenService.create(user.id, workspace.id);

    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: "OWNER",
        is_owner: true,
        is_platform_admin: false,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          plan: workspace.plan,
        },
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        plan: workspace.plan,
      },
    };
  }

  async ssoLogin(workspaceId: string, email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException("Usuario no encontrado para SSO.");
    }

    if (user.status !== "ACTIVE") {
      throw new UnauthorizedException("Usuario inactivo o suspendido.");
    }

    const membership = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: workspaceId,
          user_id: user.id,
        },
      },
    });

    // C3 fix: do NOT auto-provision a workspace membership. A malicious
    // IdP that authenticates an unrelated email would otherwise be added
    // to the target workspace as AGENT. Admins must invite the user
    // through the standard invitation flow before SSO will let them in.
    if (!membership) {
      throw new UnauthorizedException(
        "Tu cuenta no tiene acceso a este workspace. Pide a un administrador que te invite.",
      );
    }

    const effectiveMembership = membership;

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) throw new UnauthorizedException("Workspace no encontrado.");

    const access_token = this.signToken({
      sub: user.id,
      email: user.email,
      workspace_id: workspace.id,
      role: effectiveMembership.role,
      is_platform_admin: user.is_platform_admin,
    });

    const refresh_token = await this.refreshTokenService.create(user.id, workspace.id);

    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: effectiveMembership.role,
        is_owner: effectiveMembership.is_owner,
        is_platform_admin: user.is_platform_admin,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          plan: workspace.plan,
        },
      },
    };
  }

  // ── Unified SSO exchange (SAML + Google) ───────────────────────────────────
  //
  // After a successful SSO callback, mint a 60-second one-shot JWT
  // "exchange code" instead of putting the access/refresh token in the
  // redirect URL. The SPA redeems this code via POST /auth/sso-exchange.
  // C4 fix: bounds Referer / browser-history exposure to a 60s
  // non-renewable code instead of a 15m access token + multi-week
  // refresh token.

  mintSsoExchangeCode(userId: string, workspaceId: string): string {
    return this.jwtService.sign(
      { sub: userId, workspace_id: workspaceId, type: "sso-exchange", jti: randomUUID() },
      { expiresIn: "60s" },
    );
  }

  async consumeSsoExchangeCode(code: string) {
    if (!code) throw new BadRequestException("Código requerido.");
    let payload: { sub: string; workspace_id: string; type?: string };
    try {
      payload = this.jwtService.verify(code);
    } catch {
      throw new UnauthorizedException("Código inválido o expirado.");
    }
    if (payload?.type !== "sso-exchange" || !payload.sub || !payload.workspace_id) {
      throw new UnauthorizedException("Código inválido.");
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Usuario inválido.");
    }
    const membership = await this.prisma.workspaceUser.findUnique({
      where: { workspace_id_user_id: { workspace_id: payload.workspace_id, user_id: user.id } },
    });
    if (!membership) {
      throw new UnauthorizedException("Sin acceso al workspace.");
    }
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: payload.workspace_id },
    });
    if (!workspace) throw new UnauthorizedException("Workspace no encontrado.");

    const access_token = this.signToken({
      sub: user.id,
      email: user.email,
      workspace_id: workspace.id,
      role: membership.role,
      is_platform_admin: user.is_platform_admin,
    });
    const refresh_token = await this.refreshTokenService.create(user.id, workspace.id);
    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: membership.role,
        is_owner: membership.is_owner,
        is_platform_admin: user.is_platform_admin,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          plan: workspace.plan,
        },
      },
    };
  }

  // ── Google OAuth ────────────────────────────────────────────────────────────

  async googleLogin(profile: {
    googleId: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  }) {
    // 1. Try by google_id first
    let user = await this.prisma.user.findUnique({
      where: { google_id: profile.googleId },
    });

    if (user) {
      if (user.status !== "ACTIVE") {
        throw new UnauthorizedException("Usuario inactivo o suspendido.");
      }
    } else {
      // 2. Try by email — link Google account if found
      user = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });

      if (user) {
        if (user.status !== "ACTIVE") {
          throw new UnauthorizedException("Usuario inactivo o suspendido.");
        }
        // Link google_id to existing account
        await this.prisma.user.update({
          where: { id: user.id },
          data: { google_id: profile.googleId },
        });
      }
    }

    if (!user) {
      // 3. New user — create account + workspace
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          google_id: profile.googleId,
          avatar_url: profile.avatarUrl,
          status: "ACTIVE",
        },
      });

      const slug = await this.generateUniqueWorkspaceSlug();
      const workspace = await this.prisma.workspace.create({
        data: {
          name: `${profile.name}'s Workspace`,
          slug,
          status: "ACTIVE",
          plan: "FREE",
          workspace_users: {
            create: {
              user_id: user.id,
              role: "OWNER",
              is_owner: true,
            },
          },
        },
      });

      this.demoData
        .populateDemoWorkspace(workspace.id, workspace.name)
        .catch((err) =>
          this.logger.warn(`Demo data population failed for workspace ${workspace.id}`, err),
        );

      const access_token = this.signToken({
        sub: user.id,
        email: user.email,
        workspace_id: workspace.id,
        role: "OWNER",
        is_platform_admin: false,
      });
      const refresh_token = await this.refreshTokenService.create(user.id, workspace.id);

      return {
        access_token,
        refresh_token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url,
          role: "OWNER",
          is_owner: true,
          is_platform_admin: false,
          workspace: {
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            plan: workspace.plan,
          },
        },
      };
    }

    // Existing user — resolve workspace membership
    const memberships = await this.prisma.workspaceUser.findMany({
      where: { user_id: user.id },
      include: { workspace: { select: { id: true, slug: true, name: true, plan: true } } },
      orderBy: { created_at: "asc" },
    });

    if (memberships.length === 0) {
      // User exists but has no workspace — create one
      const slug = await this.generateUniqueWorkspaceSlug();
      const workspace = await this.prisma.workspace.create({
        data: {
          name: `${user.name}'s Workspace`,
          slug,
          status: "ACTIVE",
          plan: "FREE",
          workspace_users: {
            create: {
              user_id: user.id,
              role: "OWNER",
              is_owner: true,
            },
          },
        },
      });

      const access_token = this.signToken({
        sub: user.id,
        email: user.email,
        workspace_id: workspace.id,
        role: "OWNER",
        is_platform_admin: user.is_platform_admin,
      });
      const refresh_token = await this.refreshTokenService.create(user.id, workspace.id);

      return {
        access_token,
        refresh_token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url,
          role: "OWNER",
          is_owner: true,
          is_platform_admin: user.is_platform_admin,
          workspace: {
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            plan: workspace.plan,
          },
        },
      };
    }

    // Use first membership
    const m = memberships[0];
    const access_token = this.signToken({
      sub: user.id,
      email: user.email,
      workspace_id: m.workspace_id,
      role: m.role,
      is_platform_admin: user.is_platform_admin,
    });
    const refresh_token = await this.refreshTokenService.create(user.id, m.workspace_id);

    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: m.role,
        is_owner: m.is_owner,
        is_platform_admin: user.is_platform_admin,
        workspace: {
          id: m.workspace.id,
          name: m.workspace.name,
          slug: m.workspace.slug,
          plan: m.workspace.plan,
        },
      },
    };
  }

  async exchangeFacebookToken(
    accessToken: string,
  ): Promise<{ facebookId: string; email: string; name: string; avatarUrl: string | null }> {
    const url = `https://graph.facebook.com/v25.0/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    if (!res.ok) throw new UnauthorizedException("Token de Facebook inválido.");
    const data = (await res.json()) as {
      id?: string;
      name?: string;
      email?: string;
      picture?: { data?: { url?: string } };
    };
    if (!data?.id) throw new UnauthorizedException("Token de Facebook inválido.");
    return {
      facebookId: data.id,
      email: data.email || `fb-${data.id}@pymeshub.lat`,
      name: data.name || "Usuario de Facebook",
      avatarUrl: data.picture?.data?.url || null,
    };
  }

  // ── Telegram Login Widget verification ──────────────────────────────────

  async verifyTelegramAuth(
    data: Record<string, unknown>,
  ): Promise<{
    telegramId: string;
    firstName: string;
    lastName?: string;
    username?: string;
    photoUrl?: string;
  }> {
    const { id, first_name, last_name, username, photo_url, auth_date, hash } = data;
    if (!id || !hash) throw new UnauthorizedException("Datos de Telegram incompletos.");

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new InternalServerErrorException("Telegram bot token not configured.");

    // Build data-check-string: sorted alphabetically, format "key=value\n"
    const fields: Record<string, string> = {};
    if (auth_date) fields.auth_date = String(auth_date);
    if (first_name) fields.first_name = String(first_name);
    if (id) fields.id = String(id);
    if (last_name) fields.last_name = String(last_name);
    if (photo_url) fields.photo_url = String(photo_url);
    if (username) fields.username = String(username);

    const checkString = Object.keys(fields)
      .sort()
      .map((k) => `${k}=${fields[k]}`)
      .join("\n");

    // HMAC-SHA256 with bot token as secret key
    const crypto = await import("crypto");
    const secretKey = crypto.createHash("sha256").update(botToken).digest();
    const hmac = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");

    if (hmac !== hash) {
      throw new UnauthorizedException("Firma de Telegram inválida.");
    }

    return {
      telegramId: String(id),
      firstName: first_name ? String(first_name) : "Usuario de Telegram",
      lastName: last_name ? String(last_name) : undefined,
      username: username ? String(username) : undefined,
      photoUrl: photo_url ? String(photo_url) : undefined,
    };
  }

  async telegramLogin(profile: {
    telegramId: string;
    firstName: string;
    lastName?: string;
    username?: string;
    photoUrl?: string;
  }) {
    let user = await this.prisma.user.findUnique({
      where: { telegram_id: profile.telegramId },
    });

    if (user) {
      if (user.status !== "ACTIVE")
        throw new UnauthorizedException("Usuario inactivo o suspendido.");
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          name:
            [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
            "Usuario de Telegram",
          email: `tg-${profile.telegramId}@pymeshub.lat`,
          telegram_id: profile.telegramId,
          avatar_url: profile.photoUrl || null,
          status: "ACTIVE",
        },
      });

      const slug = await this.generateUniqueWorkspaceSlug();
      const workspace = await this.prisma.workspace.create({
        data: {
          name: `${user.name}'s Workspace`,
          slug,
          status: "ACTIVE",
          plan: "FREE",
          workspace_users: { create: { user_id: user.id, role: "OWNER", is_owner: true } },
        },
      });

      this.demoData
        .populateDemoWorkspace(workspace.id, workspace.name)
        .catch((err) =>
          this.logger.warn(`Demo data population failed for workspace ${workspace.id}`, err),
        );

      const access_token = this.signToken({
        sub: user.id,
        email: user.email,
        workspace_id: workspace.id,
        role: "OWNER",
        is_platform_admin: false,
      });
      const refresh_token = await this.refreshTokenService.create(user.id, workspace.id);

      return {
        access_token,
        refresh_token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url,
          role: "OWNER",
          is_owner: true,
          is_platform_admin: false,
          workspace: {
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            plan: workspace.plan,
          },
        },
      };
    }

    const memberships = await this.prisma.workspaceUser.findMany({
      where: { user_id: user.id },
      include: { workspace: { select: { id: true, slug: true, name: true, plan: true } } },
      orderBy: { created_at: "asc" },
    });

    if (memberships.length === 0) {
      const slug = await this.generateUniqueWorkspaceSlug();
      const workspace = await this.prisma.workspace.create({
        data: {
          name: `${user.name}'s Workspace`,
          slug,
          status: "ACTIVE",
          plan: "FREE",
          workspace_users: { create: { user_id: user.id, role: "OWNER", is_owner: true } },
        },
      });

      const access_token = this.signToken({
        sub: user.id,
        email: user.email,
        workspace_id: workspace.id,
        role: "OWNER",
        is_platform_admin: user.is_platform_admin,
      });
      const refresh_token = await this.refreshTokenService.create(user.id, workspace.id);

      return {
        access_token,
        refresh_token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url,
          role: "OWNER",
          is_owner: true,
          is_platform_admin: user.is_platform_admin,
          workspace: {
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            plan: workspace.plan,
          },
        },
      };
    }

    const m = memberships[0];
    const access_token = this.signToken({
      sub: user.id,
      email: user.email,
      workspace_id: m.workspace_id,
      role: m.role,
      is_platform_admin: user.is_platform_admin,
    });
    const refresh_token = await this.refreshTokenService.create(user.id, m.workspace_id);

    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: m.role,
        is_owner: m.is_owner,
        is_platform_admin: user.is_platform_admin,
        workspace: {
          id: m.workspace.id,
          name: m.workspace.name,
          slug: m.workspace.slug,
          plan: m.workspace.plan,
        },
      },
    };
  }

  async facebookLogin(profile: {
    facebookId: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  }) {
    let user = await this.prisma.user.findUnique({
      where: { facebook_id: profile.facebookId },
    });

    if (user) {
      if (user.status !== "ACTIVE") {
        throw new UnauthorizedException("Usuario inactivo o suspendido.");
      }
    } else {
      user = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });

      if (user) {
        if (user.status !== "ACTIVE") {
          throw new UnauthorizedException("Usuario inactivo o suspendido.");
        }
        await this.prisma.user.update({
          where: { id: user.id },
          data: { facebook_id: profile.facebookId },
        });
      }
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          facebook_id: profile.facebookId,
          avatar_url: profile.avatarUrl,
          status: "ACTIVE",
        },
      });

      const slug = await this.generateUniqueWorkspaceSlug();
      const workspace = await this.prisma.workspace.create({
        data: {
          name: `${profile.name}'s Workspace`,
          slug,
          status: "ACTIVE",
          plan: "FREE",
          workspace_users: {
            create: {
              user_id: user.id,
              role: "OWNER",
              is_owner: true,
            },
          },
        },
      });

      this.demoData
        .populateDemoWorkspace(workspace.id, workspace.name)
        .catch((err) =>
          this.logger.warn(`Demo data population failed for workspace ${workspace.id}`, err),
        );

      const access_token = this.signToken({
        sub: user.id,
        email: user.email,
        workspace_id: workspace.id,
        role: "OWNER",
        is_platform_admin: false,
      });
      const refresh_token = await this.refreshTokenService.create(user.id, workspace.id);

      return {
        access_token,
        refresh_token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url,
          role: "OWNER",
          is_owner: true,
          is_platform_admin: false,
          workspace: {
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            plan: workspace.plan,
          },
        },
      };
    }

    const memberships = await this.prisma.workspaceUser.findMany({
      where: { user_id: user.id },
      include: { workspace: { select: { id: true, slug: true, name: true, plan: true } } },
      orderBy: { created_at: "asc" },
    });

    if (memberships.length === 0) {
      const slug = await this.generateUniqueWorkspaceSlug();
      const workspace = await this.prisma.workspace.create({
        data: {
          name: `${user.name}'s Workspace`,
          slug,
          status: "ACTIVE",
          plan: "FREE",
          workspace_users: {
            create: {
              user_id: user.id,
              role: "OWNER",
              is_owner: true,
            },
          },
        },
      });

      const access_token = this.signToken({
        sub: user.id,
        email: user.email,
        workspace_id: workspace.id,
        role: "OWNER",
        is_platform_admin: user.is_platform_admin,
      });
      const refresh_token = await this.refreshTokenService.create(user.id, workspace.id);

      return {
        access_token,
        refresh_token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url,
          role: "OWNER",
          is_owner: true,
          is_platform_admin: user.is_platform_admin,
          workspace: {
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            plan: workspace.plan,
          },
        },
      };
    }

    const m = memberships[0];
    const access_token = this.signToken({
      sub: user.id,
      email: user.email,
      workspace_id: m.workspace_id,
      role: m.role,
      is_platform_admin: user.is_platform_admin,
    });
    const refresh_token = await this.refreshTokenService.create(user.id, m.workspace_id);

    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: m.role,
        is_owner: m.is_owner,
        is_platform_admin: user.is_platform_admin,
        workspace: {
          id: m.workspace.id,
          name: m.workspace.name,
          slug: m.workspace.slug,
          plan: m.workspace.plan,
        },
      },
    };
  }

  async getInvitePreview(rawToken?: string) {
    const payload = this.verifyInviteToken(rawToken);
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: payload.workspace_id },
      select: { id: true, name: true, slug: true },
    });
    if (!workspace) throw new NotFoundException("Workspace de invitación no encontrado.");

    const user = await this.prisma.user.findUnique({
      where: { email: payload.email },
      select: { id: true, email: true, name: true, status: true, password_hash: true },
    });
    if (!user) throw new NotFoundException("Usuario invitado no encontrado.");

    const membership = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: workspace.id,
          user_id: user.id,
        },
      },
    });
    if (!membership) throw new NotFoundException("La invitación ya no es válida.");

    return {
      email: user.email,
      name: user.name,
      requires_account_setup: user.status === "INVITED" || !user.password_hash,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
      },
      role: membership.role,
    };
  }

  async getInviteCodePreview(code: string) {
    const record = await this.prisma.invitationCode.findUnique({
      where: { code: code.toUpperCase() },
      include: { workspace: { select: { id: true, name: true, slug: true } } },
    });
    if (!record) throw new BadRequestException("Código de invitación no encontrado.");
    if (!record.is_active || new Date() > record.expires_at) {
      throw new BadRequestException("Este código ya expiró.");
    }
    if (record.used_count >= record.max_uses) {
      throw new BadRequestException("Este código ya alcanzó el límite de usos.");
    }
    return {
      code_id: record.id,
      workspace_name: record.workspace.name,
      workspace_slug: record.workspace.slug,
      role: record.role,
      requires_account_setup: false,
    };
  }

  async redeemInviteCode(dto: { code: string; name?: string; password?: string }, userId: string) {
    const record = await this.prisma.invitationCode.findUnique({
      where: { code: dto.code.toUpperCase() },
      include: { workspace: { select: { id: true, name: true, slug: true } } },
    });
    if (!record) throw new BadRequestException("Código de invitación no encontrado.");
    if (!record.is_active || new Date() > record.expires_at) {
      throw new BadRequestException("Este código ya expiró.");
    }
    if (record.used_count >= record.max_uses) {
      throw new BadRequestException("Este código ya alcanzó el límite de usos.");
    }

    const workspace = record.workspace;

    const existingMembership = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: workspace.id,
          user_id: userId,
        },
      },
    });
    if (existingMembership) throw new BadRequestException("Ya eres miembro de este workspace.");

    await this.prisma.workspaceUser.create({
      data: {
        workspace_id: workspace.id,
        user_id: userId,
        role: record.role as WorkspaceUserRole,
        is_owner: false,
      },
    });

    await this.prisma.invitationCode.update({
      where: { id: record.id },
      data: { used_count: { increment: 1 } },
    });

    return {
      workspace_id: workspace.id,
      workspace_name: workspace.name,
      workspace_slug: workspace.slug,
      role: record.role,
    };
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const payload = this.verifyInviteToken(dto.token);

    const user = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });
    if (!user) throw new NotFoundException("Usuario invitado no encontrado.");

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: payload.workspace_id },
    });
    if (!workspace || workspace.slug !== payload.workspace_slug) {
      throw new NotFoundException("Workspace de invitación no encontrado.");
    }

    const membership = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: workspace.id,
          user_id: user.id,
        },
      },
    });
    if (!membership) throw new BadRequestException("La invitación ya no es válida.");

    let resolvedUser = user;
    const requiresAccountSetup = user.status === "INVITED" || !user.password_hash;

    if (requiresAccountSetup) {
      if (!dto.name?.trim()) {
        throw new BadRequestException("El nombre es requerido para activar la invitación.");
      }
      if (!dto.password) {
        throw new BadRequestException("La contraseña es requerida para activar la invitación.");
      }

      const password_hash = await bcrypt.hash(dto.password, 10);
      resolvedUser = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name: dto.name.trim(),
          status: "ACTIVE",
          password_hash,
        },
      });
    } else if (user.status !== "ACTIVE") {
      throw new UnauthorizedException("Usuario inactivo o suspendido.");
    }

    const access_token = this.signToken({
      sub: resolvedUser.id,
      email: resolvedUser.email,
      workspace_id: workspace.id,
      role: membership.role,
      is_platform_admin: resolvedUser.is_platform_admin,
    });

    const refresh_token = await this.refreshTokenService.create(resolvedUser.id, workspace.id);

    return {
      access_token,
      refresh_token,
      user: {
        id: resolvedUser.id,
        email: resolvedUser.email,
        name: resolvedUser.name,
        avatar_url: resolvedUser.avatar_url,
        role: membership.role,
        is_owner: membership.is_owner,
        is_platform_admin: resolvedUser.is_platform_admin,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          plan: workspace.plan,
        },
      },
    };
  }

  // ── Me ─────────────────────────────────────────────────────────────────────

  async getMe(user: AuthUser) {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: user.workspace_id },
      select: { id: true, name: true, slug: true, plan: true, timezone: true, locale: true },
    });

    const userData = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { avatar_url: true, name: true },
    });

    return {
      id: user.id,
      email: user.email,
      name: userData.name,
      avatar_url: userData.avatar_url,
      role: user.role,
      is_owner: user.is_owner,
      is_platform_admin: user.is_platform_admin,
      workspace,
    };
  }

  // ── My workspaces (for workspace switcher) ────────────────────────────────

  async getMyWorkspaces(userId: string) {
    const memberships = await this.prisma.workspaceUser.findMany({
      where: { user_id: userId },
      include: {
        workspace: { select: { id: true, name: true, slug: true, plan: true, status: true, logo_url: true } },
      },
      orderBy: { created_at: "asc" },
    });

    return memberships.map((m) => ({
      workspace: m.workspace,
      role: m.role,
      is_owner: m.is_owner,
    }));
  }

  // ── Switch workspace — returns new access_token for target workspace ──────

  async switchWorkspace(userId: string, workspaceSlug: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { slug: workspaceSlug },
    });
    if (!workspace) throw new UnauthorizedException("Workspace no encontrado.");

    const membership = await this.prisma.workspaceUser.findUnique({
      where: {
        workspace_id_user_id: { workspace_id: workspace.id, user_id: userId },
      },
      include: { user: { select: { is_platform_admin: true } } },
    });
    if (!membership) throw new UnauthorizedException("Sin acceso a este workspace.");

    const access_token = this.signToken({
      sub: userId,
      email: (
        await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } })
      ).email,
      workspace_id: workspace.id,
      role: membership.role,
      is_platform_admin: membership.user.is_platform_admin,
    });

    const refresh_token = await this.refreshTokenService.create(userId, workspace.id);

    return {
      access_token,
      refresh_token,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        plan: workspace.plan,
      },
      role: membership.role,
      is_owner: membership.is_owner,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private signToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }

  /**
   * Generates a random, URL-safe workspace slug (base64url, ~72 bits of entropy)
   * and retries on the astronomically rare collision.
   */
  private async generateUniqueWorkspaceSlug(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = randomBytes(9).toString("base64url");
      const exists = await this.prisma.workspace.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }
    throw new InternalServerErrorException("Could not generate unique workspace slug.");
  }

  /**
   * Request a password-reset token. Always returns the same generic
   * message — never reveals whether the email exists (H7). When the user
   * does exist, a short-lived signed JWT is generated; the token's payload
   * embeds a fingerprint of the current password hash so a successful
   * reset invalidates all outstanding tokens (single-use without a DB
   * jti table).
   *
   * TODO(ops): wire this to the transactional email pipeline so the link
   * is delivered to the user's inbox. For now the token is logged; in
   * production the log line MUST be scrubbed or replaced with email send.
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const generic = {
      message: "Si el correo existe, recibirás un enlace para restablecer tu contraseña.",
    };

    if (!email || typeof email !== "string") return generic;
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, password_hash: true, status: true },
    });
    if (!user || user.status !== "ACTIVE") return generic;

    const pwh = createHash("sha256")
      .update(user.password_hash || "")
      .digest("hex")
      .slice(0, 16);
    const token = this.jwtService.sign(
      { sub: user.id, type: "password-reset", pwh, jti: randomUUID() },
      { expiresIn: "15m" },
    );

    // Avoid leaking the token to general logs in production.
    if (process.env.NODE_ENV !== "production") {
      Logger.log(`Password reset token for ${email}: ${token}`, "AuthService");
    }

    // TODO: dispatch via transactional email (Resend/SES) pointing to
    // ${APP_URL}/reset-password?token=${token}.
    return generic;
  }

  /**
   * Complete a password reset using a token issued by requestPasswordReset.
   * Requires:
   *   - valid JWT signature
   *   - type === 'password-reset'
   *   - not expired
   *   - the password-hash fingerprint embedded in the token still matches
   *     the user's current hash (so once the password is reset, all
   *     previously-issued tokens become invalid → single-use).
   */
  async resetPassword(token: string, newPassword: string) {
    if (!token) throw new BadRequestException("Token requerido.");
    const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s])\S{12,}$/;
    if (!newPassword || !strongPassword.test(newPassword)) {
      throw new BadRequestException(
        "La contraseña debe tener al menos 12 caracteres e incluir mayúscula, minúscula, número y carácter especial.",
      );
    }

    let payload: { sub: string; type?: string; pwh?: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException("Token inválido o expirado.");
    }
    if (payload?.type !== "password-reset" || !payload.sub || !payload.pwh) {
      throw new UnauthorizedException("Token inválido.");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, password_hash: true, status: true },
    });
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Token inválido.");
    }

    const currentPwh = createHash("sha256")
      .update(user.password_hash || "")
      .digest("hex")
      .slice(0, 16);
    if (currentPwh !== payload.pwh) {
      // Password already changed since the token was issued.
      throw new UnauthorizedException("Token ya utilizado o expirado.");
    }

    const password_hash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password_hash },
    });

    // Revoke all existing refresh tokens for this user across workspaces
    // so a stolen token cannot survive the password reset.
    await this.prisma.refreshToken
      .updateMany({
        where: { user_id: user.id, revoked_at: null },
        data: { revoked_at: new Date() },
      })
      .catch((err: unknown) => {
        this.logger.error(
          `Failed to revoke refresh tokens on password reset for user ${user.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

    return { message: "Contraseña actualizada correctamente." };
  }

  private verifyInviteToken(rawToken?: string): InviteTokenPayload {
    if (!rawToken) throw new BadRequestException("Invite token requerido.");

    try {
      const payload = this.jwtService.verify<InviteTokenPayload>(rawToken);
      if (payload.type !== "workspace-invite") {
        throw new BadRequestException("Invite token inválido.");
      }
      return payload;
    } catch {
      throw new BadRequestException("Invite token inválido o expirado.");
    }
  }
}
