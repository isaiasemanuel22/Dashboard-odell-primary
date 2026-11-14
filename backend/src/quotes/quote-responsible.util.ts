/**
 * Responsable del pedido que sale de un presupuesto: el actor si existe; si no,
 * el único usuario activo (si hay varios, queda vacío y el form avisa).
 */
export async function resolveOrderResponsible(
  actorUserId: string | undefined,
  listResponsibles: () => Promise<{ firebaseUid: string }[]>,
): Promise<string | undefined> {
  const actor = actorUserId?.trim();
  if (actor) return actor;
  try {
    const users = await listResponsibles();
    return users.length === 1 ? users[0].firebaseUid : undefined;
  } catch {
    return undefined;
  }
}
