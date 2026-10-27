import { Injectable } from '@angular/core';

/**
 * Antes recalculaba price/cost/profit del catálogo en el store al cargar
 * productos/ajustes o al cambiar insumos, y despachaba applyPricingFields.
 *
 * Eso hacía que /productos y el carrito mostraran montos distintos a
 * GET /api/products (§16: la fuente de verdad es el producto persistido).
 * Los costos dinámicos (§17) los aplica el backend (PricingSyncService) y
 * llegan al cliente por reload/realtime.
 *
 * Se deja la clase registrada como no-op por si vuelve a hacer falta un
 * efecto de catálogo; no reactivar el recálculo local de display.
 */
@Injectable()
export class CatalogPricingEffects {}
