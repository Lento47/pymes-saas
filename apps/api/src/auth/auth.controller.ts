import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  MethodNotAllowedException,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Request, Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { AcceptInviteDto } from "./dto/accept-invite.dto";
import { InvitePreviewDto } from "./dto/invite-preview.dto";
import { RegisterDto } from "./dto/register.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { CurrentUser } from "./decorators/current-user.decorator";
import { AuthUser } from "./strategies/jwt.strategy";
import { RefreshTokenService } from "./refresh-token.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  @Get("login")
  loginGet() {
    throw new MethodNotAllowedException(
      "Usa POST /api/auth/login con JSON { email, password } y cabecera x-workspace-slug",
    );
  }

  /** POST /auth/login */
  @Post("login")
  @Throttle({ auth: { limit: 5, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Headers("x-workspace-slug") workspaceSlug: string | undefined) {
    return this.authService.login(dto, workspaceSlug);
  }

  /** POST /auth/register */
  @Post("register")
  @Throttle({ auth: { limit: 3, ttl: 3600_000 } })
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /** POST /auth/invite-preview */
  @Post("invite-preview")
  @HttpCode(HttpStatus.OK)
  invitePreview(@Body() dto: InvitePreviewDto) {
    return this.authService.getInvitePreview(dto.token);
  }

  /** POST /auth/accept-invite */
  @Post("accept-invite")
  @Throttle({ auth: { limit: 10, ttl: 600_000 } })
  @HttpCode(HttpStatus.OK)
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.authService.acceptInvite(dto);
  }

  /** POST /auth/invite-code-preview */
  @Post("invite-code-preview")
  @HttpCode(HttpStatus.OK)
  inviteCodePreview(@Body() dto: { code: string }) {
    return this.authService.getInviteCodePreview(dto.code);
  }

  /** POST /auth/redeem-invite-code */
  @Post("redeem-invite-code")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  redeemInviteCode(
    @CurrentUser("id") userId: string,
    @Body() dto: { code: string; name?: string; password?: string },
  ) {
    return this.authService.redeemInviteCode(dto, userId);
  }

  /** GET /auth/me */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user);
  }

  /**
   * POST /auth/refresh
   * Body: { refresh_token: string }
   * Returns new access_token + refresh_token (rotation).
   */
  @Post("refresh")
  @Throttle({ auth: { limit: 20, ttl: 3600_000 } })
  @HttpCode(HttpStatus.OK)
  async refresh(@Body("refresh_token") rawToken: string) {
    if (!rawToken) throw new UnauthorizedException("refresh_token requerido.");
    const { accessToken, refreshToken } = await this.refreshTokenService.rotate(rawToken);
    return { access_token: accessToken, refresh_token: refreshToken };
  }

  /** POST /auth/logout — revokes all refresh tokens for the session */
  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: AuthUser) {
    await this.refreshTokenService.revokeAll(user.id, user.workspace_id);
    return { message: "Sesión cerrada." };
  }

  /**
   * POST /auth/request-password-reset — request a reset link.
   * Always returns the same generic message regardless of whether the
   * email exists (H7 — prevent email enumeration).
   */
  @Post("request-password-reset")
  @Throttle({ auth: { limit: 5, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  requestPasswordReset(@Body("email") email: string) {
    return this.authService.requestPasswordReset(email);
  }

  /**
   * POST /auth/reset-password — complete a reset with a token issued by
   * /auth/request-password-reset. Requires a valid, unexpired, single-use
   * token (C1 fix — no longer allows arbitrary password change by email).
   */
  @Post("reset-password")
  @Throttle({ auth: { limit: 5, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body("token") token: string, @Body("newPassword") newPassword: string) {
    return this.authService.resetPassword(token, newPassword);
  }

  /** POST /auth/verify-email — confirm email with token from registration email */
  @Post("verify-email")
  @Throttle({ auth: { limit: 20, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body("token") token: string) {
    return this.authService.verifyEmail(token);
  }

  /** POST /auth/resend-verification — resend verification email for authenticated user */
  @Post("resend-verification")
  @UseGuards(JwtAuthGuard)
  @Throttle({ auth: { limit: 3, ttl: 3_600_000 } })
  @HttpCode(HttpStatus.OK)
  resendVerification(@CurrentUser() user: AuthUser) {
    return this.authService.resendVerificationEmail(user.id);
  }

  /** GET /auth/my-workspaces — list all workspaces the user belongs to */
  @Get("my-workspaces")
  @UseGuards(JwtAuthGuard)
  getMyWorkspaces(@CurrentUser() user: AuthUser) {
    return this.authService.getMyWorkspaces(user.id);
  }

  /** POST /auth/switch-workspace — get new JWT for a different workspace */
  @Post("switch-workspace")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  switchWorkspace(@CurrentUser() user: AuthUser, @Body("workspace_slug") workspaceSlug: string) {
    return this.authService.switchWorkspace(user.id, workspaceSlug);
  }

  // ── Google OAuth ───────────────────────────────────────────────────────────

  @Get("google")
  @UseGuards(AuthGuard("google"))
  googleAuth() {
    // Initiates Google OAuth flow — redirects to Google
  }

  @Get("google/callback")
  @UseGuards(AuthGuard("google"))
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as {
      googleId: string;
      email: string;
      name: string;
      avatarUrl: string | null;
    };
    const frontendUrl = process.env.PUBLIC_URL ?? "https://pymeshub.lat";
    try {
      // Resolve / create the user via Google profile, then mint a 60s
      // exchange code instead of putting the access + refresh token in
      // the URL (C4 fix). The SPA redeems the code at POST /auth/sso-exchange.
      const result = await this.authService.googleLogin(profile);
      const code = this.authService.mintSsoExchangeCode(result.user.id, result.user.workspace.id);
      res.redirect(
        `${frontendUrl}/login?code=${encodeURIComponent(code)}&slug=${encodeURIComponent(result.user.workspace.slug)}`,
      );
    } catch (err) {
      // Don't interpolate err.message — it leaks into Referer / proxy logs.
      res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }
  }

  // Unified SSO exchange endpoint — used by both SAML and Google callbacks.
  @Post("sso-exchange")
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async ssoExchange(@Body("code") code: string) {
    return this.authService.consumeSsoExchangeCode(code);
  }

  // The previous POST /auth/google accepted an unverified email + googleId
  // from the request body — a complete authentication bypass. It is now
  // disabled. Clients that need server-side Google sign-in must:
  //   1. Use GET /auth/google → /auth/google/callback (Passport-protected),
  //      then POST /auth/sso-exchange with the returned `code`; OR
  //   2. Implement Google ID-token verification via google-auth-library
  //      and re-enable this endpoint with verified credentials only.
  @Post("google")
  @HttpCode(HttpStatus.GONE)
  googleLoginDeprecated() {
    throw new BadRequestException(
      "POST /auth/google is disabled. Use GET /auth/google then redeem the code at POST /auth/sso-exchange.",
    );
  }

  // ── Facebook OAuth — token exchange via SDK ──────────────────────────────

  @Post("facebook/token")
  @HttpCode(HttpStatus.OK)
  async facebookTokenLogin(@Body("accessToken") accessToken: string) {
    const profile = await this.authService.exchangeFacebookToken(accessToken);
    const result = await this.authService.facebookLogin(profile);
    const code = this.authService.mintSsoExchangeCode(result.user.id, result.user.workspace.id);
    return {
      code,
      slug: result.user.workspace.slug,
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      user: result.user,
    };
  }

  // ── Telegram Login Widget ─────────────────────────────────────────────────

  @Post("telegram/token")
  @HttpCode(HttpStatus.OK)
  async telegramTokenLogin(@Body() data: Record<string, any>) {
    const profile = await this.authService.verifyTelegramAuth(data);
    const result = await this.authService.telegramLogin(profile);
    const code = this.authService.mintSsoExchangeCode(result.user.id, result.user.workspace.id);
    return {
      code,
      slug: result.user.workspace.slug,
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      user: result.user,
    };
  }
}
