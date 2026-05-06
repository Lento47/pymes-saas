import {
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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { InvitePreviewDto } from './dto/invite-preview.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthUser } from './strategies/jwt.strategy';
import { RefreshTokenService } from './refresh-token.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  @Get('login')
  loginGet() {
    throw new MethodNotAllowedException(
      'Usa POST /api/auth/login con JSON { email, password } y cabecera x-workspace-slug',
    );
  }

  /** POST /auth/login */
  @Post('login')
  @Throttle({ auth: { limit: 5, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  login(
    @Body() dto: LoginDto,
    @Headers('x-workspace-slug') workspaceSlug: string | undefined,
  ) {
    return this.authService.login(dto, workspaceSlug);
  }

  /** POST /auth/register */
  @Post('register')
  @Throttle({ auth: { limit: 3, ttl: 3600_000 } })
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /** POST /auth/invite-preview */
  @Post('invite-preview')
  @HttpCode(HttpStatus.OK)
  invitePreview(@Body() dto: InvitePreviewDto) {
    return this.authService.getInvitePreview(dto.token);
  }

  /** POST /auth/accept-invite */
  @Post('accept-invite')
  @Throttle({ auth: { limit: 10, ttl: 600_000 } })
  @HttpCode(HttpStatus.OK)
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.authService.acceptInvite(dto);
  }

  /** POST /auth/invite-code-preview */
  @Post('invite-code-preview')
  @HttpCode(HttpStatus.OK)
  inviteCodePreview(@Body() dto: { code: string }) {
    return this.authService.getInviteCodePreview(dto.code);
  }

  /** POST /auth/redeem-invite-code */
  @Post('redeem-invite-code')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  redeemInviteCode(
    @CurrentUser('id') userId: string,
    @Body() dto: { code: string; name?: string; password?: string },
  ) {
    return this.authService.redeemInviteCode(dto, userId);
  }

  /** GET /auth/me */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user);
  }

  /**
   * POST /auth/refresh
   * Body: { refresh_token: string }
   * Returns new access_token + refresh_token (rotation).
   */
  @Post('refresh')
  @Throttle({ auth: { limit: 20, ttl: 3600_000 } })
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refresh_token') rawToken: string) {
    if (!rawToken) throw new UnauthorizedException('refresh_token requerido.');
    const { accessToken, refreshToken } = await this.refreshTokenService.rotate(rawToken);
    return { access_token: accessToken, refresh_token: refreshToken };
  }

  /** POST /auth/logout — revokes all refresh tokens for the session */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: AuthUser) {
    await this.refreshTokenService.revokeAll(user.id, user.workspace_id);
    return { message: 'Sesión cerrada.' };
  }

  /** GET /auth/my-workspaces — list all workspaces the user belongs to */
  @Get('my-workspaces')
  @UseGuards(JwtAuthGuard)
  getMyWorkspaces(@CurrentUser() user: AuthUser) {
    return this.authService.getMyWorkspaces(user.id);
  }

  /** POST /auth/switch-workspace — get new JWT for a different workspace */
  @Post('switch-workspace')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  switchWorkspace(
    @CurrentUser() user: AuthUser,
    @Body('workspace_slug') workspaceSlug: string,
  ) {
    return this.authService.switchWorkspace(user.id, workspaceSlug);
  }

  // ── Google OAuth ───────────────────────────────────────────────────────────

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Initiates Google OAuth flow — redirects to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: any, @Res() res: any) {
    const profile = req.user as { googleId: string; email: string; name: string; avatarUrl: string | null };
    try {
      const result = await this.authService.googleLogin(profile);
      // Redirect to frontend with token in hash
      const frontendUrl = process.env.PUBLIC_URL ?? 'https://pymeshub.lat';
      res.redirect(`${frontendUrl}/login?token=${encodeURIComponent(result.access_token)}&refresh_token=${encodeURIComponent(result.refresh_token)}&slug=${encodeURIComponent(result.user.workspace.slug)}`);
    } catch (err: any) {
      const frontendUrl = process.env.PUBLIC_URL ?? 'https://pymeshub.lat';
      res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(err?.message || 'google_auth_failed')}`);
    }
  }

  // POST variant for SPA/mobile (receives Google credential/ID token directly)
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleLogin(@Body() body: { credential?: string; email?: string; googleId?: string; name?: string; avatarUrl?: string }) {
    if (!body.email) throw new UnauthorizedException('Email is required from Google profile.');
    return this.authService.googleLogin({
      googleId: body.googleId || body.email,
      email: body.email,
      name: body.name || body.email.split('@')[0],
      avatarUrl: body.avatarUrl || null,
    });
  }
}
