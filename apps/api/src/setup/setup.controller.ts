import { Controller, Post, Body, HttpCode, Logger, Get } from '@nestjs/common';
import { SetupService } from './setup.service';
import { CreateAdminDto, SetupStatusDto, SavePortsDto } from './setup.dto';

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

  @Post('complete')
  @HttpCode(200)
  async completeSetup() {
    this.logger.log('Marking setup as complete');
    await this.setupService.markSetupComplete();
    return { success: true, message: 'Setup marked as complete' };
  }

  @Post('ports')
  @HttpCode(201)
  async savePorts(@Body() savePortsDto: SavePortsDto) {
    this.logger.log(
      `Saving port configuration: API=${savePortsDto.apiPort}, Web=${savePortsDto.webPort}`
    );
    await this.setupService.savePortConfiguration(
      savePortsDto.apiPort,
      savePortsDto.webPort
    );
    return {
      success: true,
      message: 'Port configuration saved successfully',
      ports: {
        api: savePortsDto.apiPort,
        web: savePortsDto.webPort,
      },
    };
  }
}
