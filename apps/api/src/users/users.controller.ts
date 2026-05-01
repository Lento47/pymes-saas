import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  /** GET /users — todos los miembros del workspace */
  @Get()
  findAll(@CurrentUser('workspace_id') workspaceId: string) {
    return this.service.findAll(workspaceId);
  }

  /** GET /users/me — perfil propio */
  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.service.findOne(user.workspace_id, user.id);
  }

  /** PATCH /users/me — editar perfil propio */
  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateUserDto) {
    return this.service.updateMe(user, dto);
  }

  /** GET /users/:id — perfil de cualquier miembro del workspace */
  @Get(':id')
  findOne(
    @CurrentUser('workspace_id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOne(workspaceId, id);
  }

  /** PATCH /users/:id — ADMIN/OWNER pueden editar a otros */
  @Patch(':id')
  updateById(
    @CurrentUser() user: AuthUser,
    @Param('id') targetId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.service.updateById(user.workspace_id, user, targetId, dto);
  }

  /** PATCH /users/me/password — cambiar contraseña */
  @Patch('me/password')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.service.changePassword(user.id, dto);
  }

  /** POST /users/me/avatar — subir foto de perfil */
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  uploadAvatar(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo requerido.');
    return this.service.uploadAvatar(user.id, file);
  }

  /** GET /users/:id/avatar — mostrar foto de perfil */
  @Get(':id/avatar')
  async getAvatar(@Param('id') id: string, @Res() res: Response) {
    const { data, contentType } = await this.service.getAvatar(id);
    res.set({ 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' });
    res.send(data);
  }
}
