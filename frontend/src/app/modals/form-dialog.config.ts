import { Overlay } from '@angular/cdk/overlay';
import { ModalSize } from './modal-size';

export const FORM_DIALOG_BACKDROP_CLASS = 'form-dialog-backdrop';
export const FORM_DIALOG_PANEL_CLASS = 'form-dialog-panel';

const SIZE_MAX_WIDTH: Record<ModalSize, string> = {
  sm: '420px',
  md: '480px',
  ml: '560px',
  lg: '640px',
  xl: '1040px',
  wide: '960px',
};

export function formDialogConfig(
  size: ModalSize,
  options?: {
    isMobile?: boolean;
    overlay?: Overlay;
  },
) {
  const isMobile = options?.isMobile === true;
  const positionStrategy =
    isMobile && options?.overlay
      ? options.overlay.position().global().centerHorizontally().bottom('0')
      : undefined;

  return {
    hasBackdrop: true,
    backdropClass: FORM_DIALOG_BACKDROP_CLASS,
    panelClass: [FORM_DIALOG_PANEL_CLASS, `${FORM_DIALOG_PANEL_CLASS}--${size}`],
    maxWidth: isMobile ? '100%' : SIZE_MAX_WIDTH[size],
    width: '100%',
    maxHeight: isMobile ? '92vh' : '90vh',
    autoFocus: 'first-tabbable' as const,
    restoreFocus: true,
    ...(positionStrategy ? { positionStrategy } : {}),
  };
}
