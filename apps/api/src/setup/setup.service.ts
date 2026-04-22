import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAdminDto } from './setup.dto';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async isSetupComplete(): Promise<boolean> {
    try {
      // Check if there are any admin users
      const adminCount = await this.prisma.user.count({
        where: { role: 'ADMIN' },
      });
      return adminCount > 0;
    } catch (e) {
      this.logger.warn('Error checking setup status:', e);
      return false;
    }
  }

  async createAdminUser(createAdminDto: CreateAdminDto) {
    const { email, password, name, companyName } = createAdminDto;

    // Check if admin already exists
    const existingAdmin = await this.prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (existingAdmin) {
      throw new BadRequestException('Admin user already exists. Setup is already complete.');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create default workspace
    const workspace = await this.prisma.workspace.create({
      data: {
        name: companyName || 'Default Workspace',
        slug: 'default',
        plan: 'ENTERPRISE',
        settings: {},
      },
    });

    this.logger.log(`Created workspace: ${workspace.id}`);

    // Create admin user
    const adminUser = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'ADMIN',
        workspaceId: workspace.id,
        verified: true,
        settings: {
          language: 'es',
          timezone: 'America/Mexico_City',
        },
      },
    });

    this.logger.log(`Created admin user: ${adminUser.email}`);

    return adminUser;
  }

  async markSetupComplete(): Promise<void> {
    try {
      // Get the config directory from environment or use default
      const configDir = process.env.PYMESHUB_CONFIG_DIR ||
        (process.env.PROGRAMDATA
          ? path.join(process.env.PROGRAMDATA, 'Pymeshub', 'config')
          : path.join(process.env.APPDATA || '', 'Pymeshub', 'config'));

      // Ensure directory exists
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Create setup complete flag file
      const setupFlagPath = path.join(configDir, '.setup-complete');
      fs.writeFileSync(setupFlagPath, JSON.stringify({
        completedAt: new Date().toISOString(),
        version: '0.1.0',
      }));

      this.logger.log(`Setup marked as complete: ${setupFlagPath}`);
    } catch (error) {
      this.logger.error('Error marking setup as complete:', error);
      // Don't throw, just log - setup should still be considered complete
    }
  }

  async savePortConfiguration(apiPort: number, webPort: number): Promise<void> {
    try {
      const configDir = process.env.PYMESHUB_CONFIG_DIR ||
        (process.env.PROGRAMDATA
          ? path.join(process.env.PROGRAMDATA, 'Pymeshub', 'config')
          : path.join(process.env.APPDATA || '', 'Pymeshub', 'config'));

      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const portsConfigPath = path.join(configDir, 'ports.env');
      const portConfig = `CUSTOM_API_PORT=${apiPort}\nCUSTOM_WEB_PORT=${webPort}\n`;

      fs.writeFileSync(portsConfigPath, portConfig, 'utf-8');
      this.logger.log(`Port configuration saved: API=${apiPort}, Web=${webPort}`);
    } catch (error) {
      this.logger.error('Error saving port configuration:', error);
      throw error;
    }
  }
}
