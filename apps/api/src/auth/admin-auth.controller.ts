import { Controller, Get, Logger, Query, Res } from "@nestjs/common";
import { Response } from "express";
import { AdminAuthService } from "./admin-auth.service";

@Controller("auth/admin")
export class AdminAuthController {
  private readonly logger = new Logger(AdminAuthController.name);

  constructor(private readonly service: AdminAuthService) {}

  @Get("login")
  login(@Res() res: Response) {
    const url = this.service.buildAuthUrl();
    res.redirect(302, url);
  }

  @Get("callback")
  async callback(@Query("code") code: string, @Query("state") state: string, @Res() res: Response) {
    if (!code) {
      // NOTE: /admin/login is NOT behind the workspace-slug router; it's a public route.
      return res.redirect(`/admin/login?error=no_code`);
    }
    try {
      const result = await this.service.handleCallback(code, state);
      const params = new URLSearchParams({
        admin_token: result.access_token,
        admin_slug: result.user.workspace.slug,
        ...(result.refresh_token ? { admin_refresh: result.refresh_token } : {}),
      });
      return res.redirect(`/admin/login?${params.toString()}`);
    } catch (err) {
      this.logger.error(`Admin login error: ${err?.message}`);
      const error = err?.status === 401 ? "not_admin" : "auth_failed";
      return res.redirect(`/admin/login?error=${error}`);
    }
  }
}
