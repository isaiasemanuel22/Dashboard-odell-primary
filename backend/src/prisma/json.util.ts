import { Prisma } from '@prisma/client';

export function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function fromJson<T>(value: Prisma.JsonValue): T {
  return value as unknown as T;
}
