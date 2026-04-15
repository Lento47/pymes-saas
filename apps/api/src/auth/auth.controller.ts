import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  MethodNotAllowedException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthUser } from './strategies/jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * GET no está soportado (p. ej. abrir la URL en el navegador devuelve 405 con mensaje).
   * Login: POST con JSON y cabecera x-workspace-slug.
   */
  @Get('login')
  loginGet() {
    throw new MethodNotAllowedException(
      'Usa POST /api/auth/login con JSON { email, password } y cabecera x-workspace-slug',
    );
  }

  /**
   * POST /auth/login
   * Header: X-Workspace-Slug: acme-corp
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body() dto: LoginDto,
    @Headers('x-workspace-slug') workspaceSlug: string,
  ) {
    return this.authService.login(dto, workspaceSlug);
  }

  /**
   * POST /auth/register
   * Crea usuario + workspace propio. Si trae invite_token, se une al workspace existente.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * GET /auth/me
   * Retorna el perfil del usuario autenticado + membership del workspace activo.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user.id, user.workspace_id);
  }

  /**
   * POST /auth/logout
   * El JWT es stateless: el cliente simplemente descarta el token.
   * Aquí se puede invalidar via Redis blocklist si se requiere.
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout() {
    return { message: 'Sesión cerrada. Descarta el token en el cliente.' };
  }
}
