import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  CreateAppRoleDto,
  CreateAppUserDto,
  CreateWorkAreaDto,
  UpdateAppRoleDto,
  UpdateAppUserDto,
  UpdateWorkAreaDto,
} from '../common/dto';
import { PermissionAction } from '../common/enums';
import { CurrentUserProfile } from '../common/interfaces';
import { AppConfigService } from '../config/app-config.service';
import { FirebaseAdminService } from '../auth/firebase-admin.service';
import { UserAccessService } from './user-access.service';

@Controller('user-access')
export class UserAccessController {
  constructor(
    private readonly userAccess: UserAccessService,
    private readonly config: AppConfigService,
    private readonly firebaseAdmin: FirebaseAdminService,
  ) {}

  @Get('me')
  async currentUser(@Req() request: Request) {
    const profile = await this.userAccess.resolveCurrentUser(request.user);
    return profile ?? { authenticated: false };
  }

  @Get('work-areas')
  async listWorkAreas(@Req() request: Request) {
    await this.requirePermission(request, PermissionAction.MANAGE_AREAS);
    return this.userAccess.listWorkAreas();
  }

  @Get('work-areas/:id')
  async findWorkArea(@Req() request: Request, @Param('id') id: string) {
    await this.requirePermission(request, PermissionAction.MANAGE_AREAS);
    return this.userAccess.findWorkArea(id);
  }

  @Post('work-areas')
  async createWorkArea(
    @Req() request: Request,
    @Body() data: CreateWorkAreaDto,
  ) {
    await this.requirePermission(request, PermissionAction.MANAGE_AREAS);
    return this.userAccess.createWorkArea(data);
  }

  @Patch('work-areas/:id')
  async updateWorkArea(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() data: UpdateWorkAreaDto,
  ) {
    await this.requirePermission(request, PermissionAction.MANAGE_AREAS);
    return this.userAccess.updateWorkArea(id, data);
  }

  @Delete('work-areas/:id')
  async removeWorkArea(@Req() request: Request, @Param('id') id: string) {
    await this.requirePermission(request, PermissionAction.MANAGE_AREAS);
    await this.userAccess.removeWorkArea(id);
    return { deleted: true };
  }

  @Get('roles')
  async listRoles(@Req() request: Request) {
    await this.requirePermission(request, PermissionAction.MANAGE_ROLES);
    return this.userAccess.listRoles();
  }

  @Get('roles/:id')
  async findRole(@Req() request: Request, @Param('id') id: string) {
    await this.requirePermission(request, PermissionAction.MANAGE_ROLES);
    return this.userAccess.findRole(id);
  }

  @Post('roles')
  async createRole(@Req() request: Request, @Body() data: CreateAppRoleDto) {
    await this.requirePermission(request, PermissionAction.MANAGE_ROLES);
    return this.userAccess.createRole(data);
  }

  @Patch('roles/:id')
  async updateRole(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() data: UpdateAppRoleDto,
  ) {
    await this.requirePermission(request, PermissionAction.MANAGE_ROLES);
    return this.userAccess.updateRole(id, data);
  }

  @Delete('roles/:id')
  async removeRole(@Req() request: Request, @Param('id') id: string) {
    await this.requirePermission(request, PermissionAction.MANAGE_ROLES);
    await this.userAccess.removeRole(id);
    return { deleted: true };
  }

  @Get('users')
  async listUsers(@Req() request: Request) {
    await this.requirePermission(request, PermissionAction.MANAGE_USERS);
    return this.userAccess.listUsers();
  }

  @Get('users/:id')
  async findUser(@Req() request: Request, @Param('id') id: string) {
    await this.requirePermission(request, PermissionAction.MANAGE_USERS);
    return this.userAccess.findUser(id);
  }

  @Post('users')
  async createUser(@Req() request: Request, @Body() data: CreateAppUserDto) {
    await this.requirePermission(request, PermissionAction.MANAGE_USERS);
    return this.userAccess.createUser(data);
  }

  @Patch('users/:id')
  async updateUser(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() data: UpdateAppUserDto,
  ) {
    await this.requirePermission(request, PermissionAction.MANAGE_USERS);
    return this.userAccess.updateUser(id, data);
  }

  @Delete('users/:id')
  async removeUser(@Req() request: Request, @Param('id') id: string) {
    await this.requirePermission(request, PermissionAction.MANAGE_USERS);
    await this.userAccess.removeUser(id);
    return { deleted: true };
  }

  private async requirePermission(
    request: Request,
    action: PermissionAction,
  ): Promise<CurrentUserProfile | null> {
    const profile = await this.userAccess.resolveCurrentUser(request.user);
    if (profile) {
      await this.userAccess.assertActorCanManage(profile, action);
      return profile;
    }

    if (!this.config.requireAuth && !this.firebaseAdmin.isEnabled()) {
      return null;
    }

    await this.userAccess.assertActorCanManage(null, action);
    return null;
  }
}
