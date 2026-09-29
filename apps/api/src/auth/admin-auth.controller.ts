import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { AdminAuthService } from "./admin-auth.service";

/**
 * The platform-admin sign-in, and the one place in the API that redirects.
 *
 * ## Why the callback hands over a code and not a token
 *
 * This used to finish with
 * `/admin/login?admin_token=<jwt>&admin_refresh=<opaque>&admin_slug=<slug>`. A URL is a
 * bad place for a credential: it persists in browser history, it is written into the
 * `Location` header of every proxy between this process and the browser, and it is sent
 * in `Referer` for anything the landing page loads before it can scrub itself. The
 * refresh token made it worse than the access token, because it is long-lived and only
 * becomes useless once it is rotated.
 *
 * The redirect now carries a **60-second bootstrap code** which `JwtStrategy` refuses to
 * accept as a bearer, and the browser trades it for the real session over
 * `POST /exchange`. The credentials exist only in a response body, which is what a
 * credential belongs in. Same shape as the existing `POST /auth/sso-exchange`.
 *
 * ## What is deliberately still here
 *
 * `buildAuthUrl` generates `state` and `nonce` and neither is stored or verified — the
 * callback only checks that `state` is at least 16 characters. That is a real CSRF gap
 * and it is a separate fix: it needs a place to keep the state, which means the session
 * store or Redis, not a string comparison. Flagged rather than half-done.
 */
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
      const { bootstrap_code } = await this.service.handleCallback(code, state);
      // Only the code, which is worthless as a credential on its own.
      const params = new URLSearchParams({ code: bootstrap_code });
      return res.redirect(`/admin/login?${params.toString()}`);
    } catch (err) {
      this.logger.error(`Admin login error: ${err?.message}`);
      const error = err?.status === 401 ? "not_admin" : "auth_failed";
      return res.redirect(`/admin/login?error=${error}`);
    }
  }

  /**
   * POST /api/auth/admin/exchange — trade the bootstrap code for a session.
   *
   * Unguarded on purpose, exactly like `POST /auth/refresh` and `POST /auth/sso-exchange`:
   * the code *is* the credential here, and it is verified before anything is minted.
   */
  @Post("exchange")
  @HttpCode(HttpStatus.OK)
  exchange(@Body("code") code: string) {
    return this.service.exchangeBootstrapCode(code);
  }
}
