/**
 * Carga de archivos compartida: soltar, elegir, filtrar y limitar.
 * Cada tarjeta que sube archivos tiene su propia instancia.
 */
export class FileUploadSession {
  dragOver = false;

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    this.dragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    const next = event.relatedTarget as Node | null;
    const current = event.currentTarget as HTMLElement | null;
    if (next && current?.contains(next)) return;
    this.dragOver = false;
  }

  /** Archivos soltados. Lista vacía si el arrastre no traía archivos. */
  onDrop(event: DragEvent): File[] {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;
    return FileUploadSession.fromList(event.dataTransfer?.files);
  }

  static fromInput(event: Event): File[] {
    const input = event.target as HTMLInputElement;
    const files = FileUploadSession.fromList(input.files);
    input.value = '';
    return files;
  }

  static fromList(list: FileList | null | undefined): File[] {
    return list ? Array.from(list) : [];
  }

  static accepts(file: File, accept: string): boolean {
    const rules = accept
      .split(',')
      .map((rule) => rule.trim().toLowerCase())
      .filter(Boolean);
    if (!rules.length || rules.includes('*') || rules.includes('*/*')) return true;
    const name = file.name.toLowerCase();
    const type = file.type.toLowerCase();
    return rules.some((rule) => {
      if (rule.endsWith('/*')) {
        const prefix = rule.slice(0, -1);
        if (type.startsWith(prefix)) return true;
        if (rule === 'image/*') {
          return /\.(png|jpe?g|gif|webp|bmp|heic|avif)$/.test(name);
        }
        return false;
      }
      if (rule.startsWith('.')) return name.endsWith(rule);
      return type === rule;
    });
  }

  static withinLimit(
    files: File[],
    totalCount: number,
    maxFiles?: number,
  ): File[] {
    if (maxFiles === undefined) return files;
    const remaining = maxFiles - totalCount;
    if (remaining <= 0) return [];
    return files.slice(0, remaining);
  }

  static stagedId(): string {
    return `staged-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  static uploadError(err: unknown): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const body = (err as { error?: { message?: string } | string }).error;
      if (typeof body === 'string' && body.trim()) return body;
      if (body && typeof body === 'object' && 'message' in body) {
        const message = (body as { message?: string }).message;
        if (message?.trim()) return message;
      }
    }
    return 'Error al subir el archivo';
  }
}
