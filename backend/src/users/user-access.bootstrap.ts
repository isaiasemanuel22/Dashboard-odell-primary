import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  ADMIN_PERMISSION_ACTIONS,
  PermissionAction,
  WORK_PERMISSION_ACTIONS,
} from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import { slugifyAreaName } from './user-access.util';

export const ADMIN_ROLE_ID = 'role-admin';

export const DEFAULT_WORK_AREAS = [
  { id: 'area-sublimacion', name: 'Sublimación', slug: 'sublimacion', sortOrder: 1 },
  { id: 'area-3d', name: '3D', slug: '3d', sortOrder: 2 },
  { id: 'area-grabado', name: 'Grabado', slug: 'grabado', sortOrder: 3 },
  { id: 'area-diseno', name: 'Diseño', slug: 'diseno', sortOrder: 4 },
  { id: 'area-modelado', name: 'Modelado', slug: 'modelado', sortOrder: 5 },
  { id: 'area-ventas', name: 'Ventas', slug: 'ventas', sortOrder: 6 },
] as const;

@Injectable()
export class UserAccessBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(UserAccessBootstrapService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.syncDefaults();
  }

  async syncDefaults(): Promise<void> {
    if (!this.prismaService.isConfigured()) return;

    try {
      await this.ensureDefaults();
    } catch (error) {
      if (this.isMissingSchemaError(error)) {
        this.logger.warn(
          'Tablas de usuarios/roles/áreas pendientes. Ejecutá `npm run db:push` en backend/.',
        );
        return;
      }
      this.logger.warn(
        `No se pudieron inicializar usuarios/roles/áreas: ${this.errorMessage(error)}`,
      );
    }
  }

  private isMissingSchemaError(error: unknown): boolean {
    const message = this.errorMessage(error);
    return message.includes('does not exist');
  }

  private async ensureDefaults(): Promise<void> {
    const db = this.prismaService.prisma;
    const areaCount = await db.workArea.count();
    if (areaCount === 0) {
      const now = new Date();
      await db.workArea.createMany({
        data: DEFAULT_WORK_AREAS.map((area) => ({
          ...area,
          active: true,
          createdAt: now,
          updatedAt: now,
        })),
      });
      this.logger.log('Áreas de trabajo iniciales creadas');
    }

    const roleCount = await db.appRole.count();
    if (roleCount === 0) {
      const now = new Date();
      const areas = await db.workArea.findMany({ select: { id: true } });
      const permissions = [
        ...areas.flatMap((area) =>
          WORK_PERMISSION_ACTIONS.map((action) => ({
            id: `perm-admin-${area.id}-${action}`,
            areaId: area.id,
            action,
          })),
        ),
        ...ADMIN_PERMISSION_ACTIONS.map((action) => ({
          id: `perm-admin-global-${action}`,
          areaId: null,
          action,
        })),
      ];

      await db.appRole.create({
        data: {
          id: ADMIN_ROLE_ID,
          name: 'Administrador',
          description: 'Acceso total al sistema',
          isSystem: true,
          createdAt: now,
          updatedAt: now,
          permissions: { create: permissions },
        },
      });
      this.logger.log('Rol Administrador inicial creado');
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

export function buildUniqueAreaSlug(
  name: string,
  taken: Set<string>,
): string {
  const base = slugifyAreaName(name) || 'area';
  if (!taken.has(base)) return base;

  let index = 2;
  while (taken.has(`${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
}
