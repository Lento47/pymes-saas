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
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
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
  @HttpCode(HttpStatus.OK)
  login(
    @Body() dto: LoginDto,
    @Headers('x-workspace-slug') workspaceSlug: string,
  ) {
    return this.authService.login(dto, workspaceSlug);
  }

  /** POST /auth/register */
  @Post('register')
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
  @HttpCode(HttpStatus.OK)
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.authService.acceptInvite(dto);
  }

  /** GET /auth/me */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user.id, user.workspace_id);
  }

  /**
   * POST /auth/refresh
   * Body: { refresh_token: string }
   * Returns new access_token + refresh_token (rotation).
   */
  @Post('refresh')
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
}
