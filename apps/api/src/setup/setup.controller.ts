import { Controller, Post, Body, HttpCode, Logger, Get } from '@nestjs/common';
import { SetupService } from './setup.service';
import { CreateAdminDto, SetupStatusDto } from './setup.dto';

@Controller('api/setup')
export class SetupController {
  private readonly logger = new Logger(SetupController.name);

  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  async getStatus(): Promise<SetupStatusDto> {
    const isSetupComplete = await this.setupService.isSetupComplete();
    return { setupComplete: isSetupComplete };
  }

  @Post('initialize')
  @HttpCode(201)
  async initializeSetup(@Body() createAdminDto: CreateAdminDto) {
    this.logger.log('Initializing setup with admin user');

    const admin = await this.setupService.createAdminUser(createAdminDto);

    return {
      success: true,
      message: 'Admin user created successfully',
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
    };
  }
}
