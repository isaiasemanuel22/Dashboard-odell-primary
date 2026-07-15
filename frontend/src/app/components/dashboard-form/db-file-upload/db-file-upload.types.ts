export type DbFileUploadFn = (file: File) => Promise<string>;

export interface DbFileUploadStagedItem {
  id: string;
  file: File;
  previewUrl: string;
}
