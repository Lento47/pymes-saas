import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';

@Injectable()
export class ValidateUUIDPipe implements PipeTransform {
  transform(value: string): string {
    if (!isUUID(value, '4')) {
      throw new BadRequestException(`Invalid ID format. Expected UUID v4, got: "${value}"`);
    }
    return value;
  }
}
