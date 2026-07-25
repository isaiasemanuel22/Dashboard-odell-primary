import { ProductAttachment } from '../../../core/models';

export interface UploadedAttachmentMeta {
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

export type DbAttachmentUploadFn = (file: File) => Promise<UploadedAttachmentMeta>;

export interface DbAttachmentUploadStagedItem {
  id: string;
  file: File;
}
