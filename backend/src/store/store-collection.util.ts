export function replaceInCollection<T extends { id: string }>(
  collection: T[],
  id: string,
  entity: T,
): number {
  const index = collection.findIndex((item) => item.id === id);
  if (index === -1) {
    collection.push(entity);
    return collection.length - 1;
  }
  collection[index] = entity;
  return index;
}

export function removeFromCollection<T extends { id: string }>(
  collection: T[],
  id: string,
): boolean {
  const index = collection.findIndex((item) => item.id === id);
  if (index === -1) return false;
  collection.splice(index, 1);
  return true;
}
