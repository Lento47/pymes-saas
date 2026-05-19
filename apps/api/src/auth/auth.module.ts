import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { RolesGuard } from './guards/roles.guard';
import { RefreshTokenService } from './refresh-token.service';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { DemoModule } from '../demo/demo.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      // Keep main-api's 30m expiry. Pin algorithm to HS256 to defeat
      // algorithm-confusion attacks (alg=none / RS256-as-HS256). H3 fix.
      signOptions: {
        expiresIn: process.env.JWT_EXPIRES_IN as `${number}m` ?? '30m',
        algorithm: 'HS256',
      },
      verifyOptions: {
        algorithms: ['HS256'],
      },
    }),
    DemoModule,
  ],
  controllers: [AuthController, AdminAuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy, RolesGuard, RefreshTokenService, AdminAuthService],
  exports: [JwtModule, PassportModule, RolesGuard, RefreshTokenService, AuthService],
})
export class AuthModule {}
