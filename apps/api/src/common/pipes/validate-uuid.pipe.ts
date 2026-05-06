import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';

// cuid format: 'c' followed by 24 alphanumeric chars (lowercase)
const CUID_REGEX = /^c[a-z0-9]{24}$/;

@Injectable()
export class ValidateUUIDPipe implements PipeTransform {
  transform(value: string): string {
    if (isUUID(value, '4') || CUID_REGEX.test(value)) {
      return value;
    }
    throw new BadRequestException(`Invalid ID format. Expected UUID v4 or cuid, got: "${value}"`);
  }
}
