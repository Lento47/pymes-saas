import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-facebook';

export interface FacebookProfile {
  facebookId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor() {
    super({
      clientID: process.env.FACEBOOK_APP_ID!,
      clientSecret: process.env.FACEBOOK_APP_SECRET!,
      callbackURL: `${process.env.PUBLIC_URL ?? 'https://pymeshub.lat'}/api/auth/facebook/callback`,
      profileFields: ['id', 'displayName', 'emails', 'photos'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: (err: any, user: any) => void,
  ): Promise<any> {
    const facebookProfile: FacebookProfile = {
      facebookId: profile.id,
      email: profile.emails?.[0]?.value || `fb-${profile.id}@pymeshub.lat`,
      name: profile.displayName || 'Usuario de Facebook',
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
    done(null, facebookProfile);
  }
}
