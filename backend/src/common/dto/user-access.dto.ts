import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ADMIN_PERMISSION_ACTIONS,
  PermissionAction,
  WORK_PERMISSION_ACTIONS,
} from '../enums';

const ALL_PERMISSION_ACTIONS = [
  ...WORK_PERMISSION_ACTIONS,
  ...ADMIN_PERMISSION_ACTIONS,
];

export class RolePermissionDto {
  @IsEnum(PermissionAction)
  action!: PermissionAction;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  areaId?: string | null;
}

export class CreateWorkAreaDto {
  @IsString()
  @MaxLength(128)
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  slug?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateWorkAreaDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  slug?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateAppRoleDto {
  @IsString()
  @MaxLength(128)
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionDto)
  permissions?: RolePermissionDto[];
}

export class UpdateAppRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionDto)
  permissions?: RolePermissionDto[];
}

export class UserPermissionOverrideDto {
  @IsEnum(PermissionAction)
  action!: PermissionAction;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  areaId?: string | null;

  @IsBoolean()
  granted!: boolean;
}

export class CreateAppUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(255)
  @MinLength(1)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  firebaseUid?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserPermissionOverrideDto)
  permissionOverrides?: UserPermissionOverrideDto[];
}

export class UpdateAppUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @MinLength(1)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  firebaseUid?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserPermissionOverrideDto)
  permissionOverrides?: UserPermissionOverrideDto[];
}

export { ALL_PERMISSION_ACTIONS };
