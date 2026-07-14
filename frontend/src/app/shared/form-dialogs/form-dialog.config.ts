import { ModalSize } from './modal-size';

export const FORM_DIALOG_BACKDROP_CLASS = 'form-dialog-backdrop';
export const FORM_DIALOG_PANEL_CLASS = 'form-dialog-panel';

const SIZE_MAX_WIDTH: Record<ModalSize, string> = {
  sm: '420px',
  md: '480px',
  lg: '640px',
};

export function formDialogConfig(size: ModalSize) {
  return {
    hasBackdrop: true,
    backdropClass: FORM_DIALOG_BACKDROP_CLASS,
    panelClass: [FORM_DIALOG_PANEL_CLASS, `${FORM_DIALOG_PANEL_CLASS}--${size}`],
    maxWidth: SIZE_MAX_WIDTH[size],
    width: '100%',
    maxHeight: '90vh',
    autoFocus: 'first-tabbable' as const,
    restoreFocus: true,
  };
}
