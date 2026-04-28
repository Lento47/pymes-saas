import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { I18nService } from './i18n.service';

@Injectable()
export class I18nInterceptor implements NestInterceptor {
  constructor(private readonly i18n: I18nService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const acceptLang = req.headers?.['accept-language'] || req.headers?.['x-locale'] || 'es';
    this.i18n.setLocale(acceptLang);
    return next.handle();
  }
}
