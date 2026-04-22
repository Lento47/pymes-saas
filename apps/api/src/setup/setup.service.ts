import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAdminDto } from './setup.dto';
import * as bcrypt from 'bcrypt';

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
}
