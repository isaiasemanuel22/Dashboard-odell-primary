export function upsertById<T extends { id: string }>(
  items: T[],
  entity: T,
): T[] {
  const index = items.findIndex((item) => item.id === entity.id);
  if (index === -1) {
    return [...items, entity];
  }
  const next = [...items];
  next[index] = entity;
  return next;
}

export function removeById<T extends { id: string }>(
  items: T[],
  id: string,
): T[] {
  return items.filter((item) => item.id !== id);
}

export function patchById<T extends { id: string }>(
  items: T[],
  id: string,
  patch: Partial<T>,
): T[] {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return items;
  const next = [...items];
  next[index] = { ...next[index], ...patch };
  return next;
}
