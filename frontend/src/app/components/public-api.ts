export * from './dashboard-form/public-api';
export * from './db-button';
export { DbIconTrashComponent } from './db-icon-trash/db-icon-trash.component';
export * from './db-data-table';
export * from './db-row-menu';
export * from './form-modal';
export * from './dynamic-lists/dynamic-list/dynamic-list.component';
export type {
  DynamicDimensionsFieldConfig,
  DynamicFieldConfig,
  DynamicInputFieldConfig,
  DynamicListConfig,
  DynamicSelectFieldConfig,
  DynamicTextareaFieldConfig,
} from './dynamic-lists/dynamic-list/dynamic-list.types';
export * from './dynamic-lists/public-api';

// Listados y UI compartida
export * from './db-state-message/db-state-message.component';
export * from './db-skeleton/db-skeleton.component';
export * from './db-pill-group/db-pill-group.component';
export type { DbPillOption, DbPillSize } from './db-pill-group/db-pill-group.component';
export * from './db-segmented-control/db-segmented-control.component';
export type { DbSegmentOption } from './db-segmented-control/db-segmented-control.component';
export * from './db-calendar-month/db-calendar-month.component';
export type { DbCalendarDayCell } from './db-calendar-month/db-calendar-month.types';
export * from './db-calendar-agenda/db-calendar-agenda.component';
export type {
  DbCalendarAgendaRow,
  DbCalendarAgendaVariant,
} from './db-calendar-agenda/db-calendar-agenda.types';
export * from './db-area-chip/db-area-chip.component';
export type { DbAreaChipKey } from './db-area-chip/db-area-chip.component';
export * from './db-service-badge/db-service-badge.component';
export type { DbServiceBadgeVariant } from './db-service-badge/db-service-badge.component';
export * from './db-service-badges/db-service-badges.component';
export * from './db-status-badge/db-status-badge.component';
export * from './db-stock-badge/db-stock-badge.component';
export * from './db-list-toolbar/db-list-toolbar.component';
export * from './product-badges/product-badges.component';
export * from './product-pricing/product-pricing.component';
export * from './product-components-table/product-components-table.component';
export * from './product-card/product-card.component';
export * from './product-image-carousel/product-image-carousel.component';
export * from './product-form-dialog/product-form-dialog.component';
export * from './category-form-dialog/category-form-dialog.component';
export * from './customer-card/customer-card.component';
export * from './print-job-card/print-job-card.component';
export * from './order-card/order-card.component';
export * from './quote-card/quote-card.component';
export * from './orders-table/orders-table.component';
export * from './sales-table/sales-table.component';
export * from './sale-stat-card/sale-stat-card.component';
export * from './sales-stats-grid/sales-stats-grid.component';
export * from './area-profit-balance/area-profit-balance.component';
export * from './dashboard-monthly-trends/dashboard-monthly-trends.component';
export * from './dashboard-notifications/dashboard-notifications.component';
export * from './sale-entry-row/sale-entry-row.component';
export * from './sale-entry-item/sale-entry-item.component';
export * from './sale-source-badge/sale-source-badge.component';
export * from './sale-cart-line/sale-cart-line.component';
export type { SaleCartLine } from './sale-cart-line/sale-cart-line.types';
export * from './sale-cart-line-card/sale-cart-line-card.component';
export * from './sale-cart-footer/sale-cart-footer.component';
export * from './sale-entry-card/sale-entry-card.component';
export * from './supplies-table/supplies-table.component';

// Composición de costo en presupuesto (order-form)
export * from '../pages/orders/order-form/linea/order-quote-3d-composition/order-quote-3d-composition.component';
export * from '../pages/orders/order-form/linea/order-quote-estampado-composition/order-quote-estampado-composition.component';
export * from '../pages/orders/order-form/linea/order-quote-design-composition/order-quote-design-composition.component';
export * from './order-quote-resin-material/order-quote-resin-material.component';
export * from './order-quote-resin-alcohol/order-quote-resin-alcohol.component';
export * from './order-quote-resin-wash/order-quote-resin-wash.component';
export * from './order-quote-resin-cure/order-quote-resin-cure.component';
export * from './order-quote-filaments/order-quote-filaments.component';
export * from './order-quote-filaments/filament-line-list.component';
export * from './order-quote-print/order-quote-print.component';
export * from './order-quote-labor/order-quote-labor.component';
export * from './order-quote-error-margin/order-quote-error-margin.component';
export * from './order-quote-estampado-prints/order-quote-estampado-prints.component';
export * from './order-quote-estampado-supplies/order-quote-estampado-supplies.component';
export * from './order-quote-estampado-press/order-quote-estampado-press.component';
export {
  formatOrderQuoteMoney,
  formatOrderQuoteNumber,
  isOrderQuoteCatalogLocked,
  resolveOrderQuoteCureMinutes,
  resolveOrderQuoteWashMinutes,
} from './order-quote-composition.util';
