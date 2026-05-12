import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';

@Controller('auth/admin')
export class AdminAuthController {
  private readonly logger = new Logger(AdminAuthController.name);

  constructor(private readonly service: AdminAuthService) {}

  @Get('login')
  login(@Res() res: any) {
    const url = this.service.buildAuthUrl();
    res.redirect(302, url);
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: any,
  ) {
    if (!code) {
      res.redirect(`/admin/login?error=no_code`);
      return;
    }
    try {
      const result = await this.service.handleCallback(code, state);
      res.cookie('pymes_token', result.access_token, {
        httpOnly: false,
        secure: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });
      if (result.refresh_token) {
        res.cookie('pymes_refresh', result.refresh_token, {
          httpOnly: false,
          secure: true,
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60 * 1000,
          path: '/',
        });
      }
      res.redirect('/admin');
    } catch (err: any) {
      this.logger.error(`Admin login error: ${err?.message}`);
      const error = err?.status === 401 ? 'not_admin' : 'auth_failed';
      res.redirect(`/admin/login?error=${error}`);
    }
  }
}
