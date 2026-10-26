export {
  DbDataTableComponent,
  OdlCellDef,
  OdlRowDetailDef,
} from './db-data-table.component';
export type {
  OdlActionEvent,
  OdlArea,
  OdlBadge,
  OdlColumn,
  OdlColumnType,
  OdlFilter,
  OdlFilterState,
  OdlNote,
  OdlRowAction,
  OdlRowContext,
  OdlSort,
  OdlTag,
  OdlTone,
} from './db-data-table.component';
export {
  isOrderOverdue,
  orderStatusBadge,
  quoteStatusBadge,
  serviceTag,
} from './db-data-table.component';

import { OdlCellDef, OdlRowDetailDef, DbDataTableComponent } from './db-data-table.component';

/** Importá esto en el `imports` del componente de la pantalla. */
export const DB_DATA_TABLE = [DbDataTableComponent, OdlCellDef, OdlRowDetailDef] as const;
