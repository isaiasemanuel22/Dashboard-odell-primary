import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FilamentType,
  OrderStatus,
  ProductType,
  QuoteStatus,
  ServiceType,
} from '../common/enums';
import { resolveProductColorId } from '../common/color.util';
import { BulkPriceDto } from '../common/dto';
import {
  CreateProductDto,
  Product,
  Product3D,
  ProductEstampado,
  ProductComponent,
  ProductOverview,
  ProductPricingInput,
  ProductPricingResult,
  ProductPricingFields,
  UpdateProductDto,
} from '../common/interfaces';
import { ProductPricingService } from './product-pricing.service';
import {
  PricingSyncService,
  ProductPriceChange,
} from '../pricing/pricing-sync.service';
import { resolveProfitArea } from '../sales/profit-area.util';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import {
  normalizeWholesaleDiscount,
  wholesaleUnitPrice,
} from '../settings/wholesale-discount.util';
import { ProductRepository } from '../store/repositories/product.repository';
import { StoreChangeService } from '../store/store-change.service';
import { linkProductBrands } from '../store/brand-link.util';
import { StoreService } from '../store/store.service';
import {
  normalizeEstampadoPressCycles,
  normalizeEstampadoPrints,
  normalizeEstampadoSupplies,
} from './estampado-product.util';
import {
  normalizeColorChanges,
  normalizePurgeGrams,
  resolveFdmFilaments,
  storedFdmFilaments,
  totalFdmFilamentGrams,
} from './fdm-product.util';
import {
  fdmQueuePrinters,
  resolvePreferredPrinterId,
} from '../settings/machine-profile.util';
import {
  priceForTargetMarkup,
  productMarkupPercent,
  roundPrice,
} from './product-margin.util';
import { normalizeProductComponents } from './product-component.util';
import {
  normalizeProductImages,
  validateProductImageUrls,
} from './product-image.util';
import {
  normalizeProductAttachments,
  validateProductAttachments,
} from './product-attachment.util';
import { buildProductStockOverview } from './product-stock.util';
import {
  assertPrintedProductMaterial as assertPrintedMaterial,
  rejectPrintedProductWithoutCost as rejectPrintedWithoutCost,
  validateProductComponents,
} from './product-write.rules';

import {
  sumComponentsProductionMetrics,
  withResolvedProductionMetrics,
} from './product-production.util';

export interface ProductMarginAlert {
  productId: string;
  name: string;
  price: number;
  cost: number;
  markupPercent: number;
  targetPercent: number;
  priceForTarget: number;
  fixedPrice: boolean;
}

export interface BulkPricePreviewItem {
  productId: string;
  name: string;
  currentPrice: number;
  newPrice: number;
  newWholesalePrice: number;
  cost: number;
  newMarkupPercent: number | null;
}

export interface BulkPricePreviewResult {
  items: BulkPricePreviewItem[];
  count: number;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly store: StoreService,
    private readonly products: ProductRepository,
    private readonly pricing: ProductPricingService,
    private readonly pricingSync: PricingSyncService,
    private readonly storeChange: StoreChangeService,
    private readonly costCalculator: CostCalculatorService,
  ) {}

  findAll(type?: ProductType, includeUnpublished = false): Product[] {
    let products = [...this.store.products];
    if (!includeUnpublished) {
      products = products.filter((p) => p.published !== false);
    }
    products.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    const visible = type ? products.filter((p) => p.type === type) : products;
    return visible.map((product) =>
      this.withCurrentCost(this.withStockOverview(product)),
    );
  }

  private withStockOverview(product: Product): Product {
    return {
      ...this.withResolvedPreferredPrinter(
        withResolvedProductionMetrics(this.store, product),
      ),
      stockOverview: buildProductStockOverview(this.store, product.id),
    };
  }

  /** Impresora preferida inválida/borrada se lee como «Cualquiera» (null). */
  private withResolvedPreferredPrinter(product: Product): Product {
    if (product.type !== ProductType.FDM) return product;
    const resolved = resolvePreferredPrinterId(
      product.preferredPrinterId,
      this.store.generalSettings,
    );
    if (resolved === (product.preferredPrinterId ?? null)) return product;
    return { ...product, preferredPrinterId: resolved };
  }

  /** Costo de catálogo con la calculadora vigente. El precio de venta no se toca. */
  private withCurrentCost(product: Product): Product {
    try {
      const result = this.pricing.resolvePricing(
        this.pricing.productToPricingInput(product),
      );
      if (!Number.isFinite(result.cost) || result.cost < 0) return product;
      return {
        ...product,
        cost: result.cost,
        profit: product.price - result.cost,
      };
    } catch {
      return product;
    }
  }

  findOne(id: string): Product {
    const product = this.store.getProductById(id);
    if (!product) {
      throw new NotFoundException(`Producto ${id} no encontrado`);
    }
    return this.withCurrentCost({
      ...this.withResolvedPreferredPrinter(
        withResolvedProductionMetrics(this.store, {
          ...product,
          components: normalizeProductComponents(
            product.components,
            this.store.products,
          ),
        }),
      ),
      stockOverview: buildProductStockOverview(this.store, product.id),
    });
  }

  /**
   * Piezas que se pueden agregar a un combo: excluye el propio producto y los
   * que lo contienen (generarían un ciclo). Costo vigente, igual que en lista y detalle.
   */
  getComponentCandidates(productId?: string): Product[] {
    const blocked = new Set<string>();
    if (productId) {
      blocked.add(productId);
      for (const product of this.store.products) {
        if (this.containsComponent(product.id, productId, new Set())) {
          blocked.add(product.id);
        }
      }
    }
    return this.store.products
      .filter((product) => !blocked.has(product.id))
      .map((product) => this.withCurrentCost(product));
  }

  private containsComponent(
    currentId: string,
    targetId: string,
    visited: Set<string>,
  ): boolean {
    if (visited.has(currentId)) return false;
    visited.add(currentId);
    const product = this.store.getProductById(currentId);
    for (const child of product?.components ?? []) {
      if (child.productId === targetId) return true;
      if (this.containsComponent(child.productId, targetId, visited)) {
        return true;
      }
    }
    return false;
  }

  getOverview(id: string): ProductOverview {
    const product = this.findOne(id);
    return {
      product,
      categories: [...this.store.categories],
      catalogProducts: this.store.products.map((p) => this.withCurrentCost(p)),
      stock: buildProductStockOverview(this.store, id),
    };
  }

  create(data: CreateProductDto): Product {
    this.validateProductData(data);
    this.assertUniqueName(data.name);
    const pricing = this.pricing.resolvePricing(
      this.pricing.toPricingInput(data),
    );
    const clientPrice = this.respectClientPrice(
      pricing,
      data.price,
      data.suggestedPrice,
    );
    this.rejectPrintedProductWithoutCost(data, pricing.cost);
    const now = new Date().toISOString();
    const components = normalizeProductComponents(data.components ?? []);
    const assemblyTimeHours = Number(data.assemblyTimeHours) || 0;
    const includesPieces =
      data.type === ProductType.COMBO ||
      data.includesPieces === true ||
      components.length > 0;
    const suggestedPrice = this.normalizeSuggestedPrice(data.suggestedPrice);
    const base = {
      id: this.store.nextId('prod', this.store.products),
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
      images: normalizeProductImages(data.images ?? []),
      attachments: normalizeProductAttachments(data.attachments ?? []),
      updatedAt: now,
      price: clientPrice.price,
      cost: pricing.cost,
      profit: clientPrice.profit,
      suggestedPrice,
      categoryIds: data.categoryIds ?? [],
      size:
        (data.size ?? '').trim() ||
        (data.type === ProductType.COMBO ? 'Combo' : ''),
      published: data.published !== false,
      includesPieces,
      components,
      assemblyTimeHours,
      stock: Math.max(0, Math.trunc(Number(data.stock) || 0)),
    };

    let product: Product;
    if (data.type === ProductType.COMBO) {
      product = {
        ...base,
        type: ProductType.COMBO,
        includesPieces: true,
      };
    } else if (data.type === ProductType.ESTAMPADO) {
      const prints = normalizeEstampadoPrints(
        data.estampadoPrints ?? data.prints,
        {
          paperType: data.paperType,
          impresoId: data.impresoId,
          widthCm: data.widthCm,
          heightCm: data.heightCm,
        },
      );
      const pressCycles = normalizeEstampadoPressCycles(
        data.estampadoPressCycles ?? data.pressCycles,
        data.pressMinutes,
      );
      const supplies = normalizeEstampadoSupplies(
        data.estampadoSupplies ?? data.supplies,
      );
      product = {
        ...base,
        type: ProductType.ESTAMPADO,
        workTimeHours: Number(data.workTimeHours) || 0,
        prints,
        pressCycles,
        supplies,
      };
    } else {
      const dto = data;
      const fdmFields =
        dto.type === ProductType.FDM ? this.resolveFdmProductFields(dto) : null;
      product = {
        ...base,
        type: dto.type as ProductType.FDM | ProductType.RESINA,
        grams: fdmFields?.grams ?? (Number(dto.grams) || 0),
        printTimeHours: Number(dto.printTimeHours) || 0,
        workTimeHours: Number(dto.workTimeHours) || 0,
        brand: dto.brand?.trim(),
        filamentType:
          dto.type === ProductType.FDM ? fdmFields?.filamentType : undefined,
        filaments:
          dto.type === ProductType.FDM ? fdmFields?.filaments : undefined,
        resinType: dto.type === ProductType.RESINA ? dto.resinType : undefined,
        colorId:
          dto.type === ProductType.RESINA
            ? resolveProductColorId(
                this.store.generalSettings.colors ?? [],
                dto.colorId,
              )
            : undefined,
        washMinutes:
          dto.type === ProductType.RESINA && dto.washMinutes !== undefined
            ? Number(dto.washMinutes) || undefined
            : undefined,
        cureMinutes:
          dto.type === ProductType.RESINA && dto.cureMinutes !== undefined
            ? Number(dto.cureMinutes) || undefined
            : undefined,
        purgeGrams:
          dto.type === ProductType.FDM
            ? normalizePurgeGrams(dto.purgeGrams)
            : undefined,
        colorChanges:
          dto.type === ProductType.FDM
            ? normalizeColorChanges(dto.colorChanges)
            : undefined,
        preferredPrinterId:
          dto.type === ProductType.FDM
            ? this.normalizePreferredPrinterId(dto.preferredPrinterId)
            : undefined,
        supplies: normalizeEstampadoSupplies(
          dto.estampadoSupplies ?? dto.supplies,
        ),
      };
    }

    const created = this.applyCompositeProductionMetrics(product, components);
    linkProductBrands(this.store, created);
    this.products.create(created);
    this.pricingSync.syncAfterProductSave(product.id, product.price);
    return this.findOne(product.id);
  }

  update(id: string, data: UpdateProductDto): Product {
    const existing = this.findOne(id);
    const previousPrice = existing.price;
    const mergedType = data.type ?? existing.type;
    let mergedComponents = normalizeProductComponents(
      data.components !== undefined
        ? data.components
        : (existing.components ?? []),
    );
    if (
      mergedComponents.length === 0 &&
      (existing.components ?? []).length > 0 &&
      data.includesPieces !== false
    ) {
      mergedComponents = normalizeProductComponents(existing.components ?? []);
    }
    const mergedAssembly =
      data.assemblyTimeHours !== undefined
        ? Number(data.assemblyTimeHours) || 0
        : (existing.assemblyTimeHours ?? 0);

    const mergedSuggestedPrice =
      data.suggestedPrice !== undefined
        ? this.normalizeSuggestedPrice(data.suggestedPrice)
        : this.normalizeSuggestedPrice(existing.suggestedPrice);

    const mergedForValidation = {
      name: data.name ?? existing.name,
      type: mergedType,
      price:
        data.price != null && Number(data.price) > 0
          ? Number(data.price)
          : existing.price,
      cost:
        data.cost != null && Number(data.cost) > 0
          ? Number(data.cost)
          : existing.cost,
      size: data.size ?? existing.size,
      categoryIds: data.categoryIds ?? existing.categoryIds,
      components: mergedComponents,
      assemblyTimeHours: mergedAssembly,
      suggestedPrice: mergedSuggestedPrice,
      ...(mergedType !== ProductType.ESTAMPADO
        ? {
            grams:
              'grams' in data && data.grams !== undefined
                ? data.grams
                : (existing as Product3D).grams,
            printTimeHours:
              'printTimeHours' in data && data.printTimeHours !== undefined
                ? data.printTimeHours
                : (existing as Product3D).printTimeHours,
            workTimeHours:
              'workTimeHours' in data && data.workTimeHours !== undefined
                ? data.workTimeHours
                : (existing as Product3D).workTimeHours,
            brand:
              'brand' in data && data.brand !== undefined
                ? data.brand
                : (existing as Product3D).brand,
            filamentType:
              'filamentType' in data && data.filamentType !== undefined
                ? data.filamentType
                : (existing as Product3D).filamentType,
            filaments:
              'filaments' in data && data.filaments !== undefined
                ? data.filaments
                : (existing as Product3D).filaments,
            purgeGrams:
              'purgeGrams' in data && data.purgeGrams !== undefined
                ? data.purgeGrams
                : (existing as Product3D).purgeGrams,
            colorChanges:
              'colorChanges' in data && data.colorChanges !== undefined
                ? data.colorChanges
                : (existing as Product3D).colorChanges,
            preferredPrinterId:
              'preferredPrinterId' in data &&
              data.preferredPrinterId !== undefined
                ? data.preferredPrinterId
                : (existing as Product3D).preferredPrinterId,
            resinType:
              'resinType' in data && data.resinType !== undefined
                ? data.resinType
                : (existing as Product3D).resinType,
            washMinutes:
              'washMinutes' in data && data.washMinutes !== undefined
                ? data.washMinutes
                : (existing as Product3D).washMinutes,
            cureMinutes:
              'cureMinutes' in data && data.cureMinutes !== undefined
                ? data.cureMinutes
                : (existing as Product3D).cureMinutes,
            colorId:
              'colorId' in data && data.colorId !== undefined
                ? data.colorId
                : (existing as Product3D).colorId,
            supplies:
              'estampadoSupplies' in data &&
              data.estampadoSupplies !== undefined
                ? data.estampadoSupplies
                : 'supplies' in data && data.supplies !== undefined
                  ? data.supplies
                  : (existing as Product3D).supplies,
          }
        : {
            workTimeHours:
              'workTimeHours' in data && data.workTimeHours !== undefined
                ? data.workTimeHours
                : (existing as ProductEstampado).workTimeHours,
            estampadoPrints:
              'estampadoPrints' in data && data.estampadoPrints !== undefined
                ? data.estampadoPrints
                : 'prints' in data && data.prints !== undefined
                  ? data.prints
                  : (existing as ProductEstampado).prints,
            estampadoPressCycles:
              'estampadoPressCycles' in data &&
              data.estampadoPressCycles !== undefined
                ? data.estampadoPressCycles
                : 'pressCycles' in data && data.pressCycles !== undefined
                  ? data.pressCycles
                  : (existing as ProductEstampado).pressCycles,
          }),
    } as CreateProductDto;
    this.validateProductData(mergedForValidation, true, id, data);
    if (
      data.name !== undefined &&
      this.normalizeName(data.name) !== this.normalizeName(existing.name)
    ) {
      this.assertUniqueName(data.name, id);
    }

    const pricingInput = this.pricing.toPricingInput(mergedForValidation);
    const pricing = this.pricing.resolvePricing(pricingInput);
    this.rejectPrintedProductWithoutCost(
      mergedForValidation,
      pricing.cost,
      true,
      data,
    );
    // El precio guardado no cambia solo: se respeta el que manda el cliente;
    // sin precio nuevo queda el actual (salvo precio fijo o cambio de tipo).
    const typeChanged = data.type !== undefined && data.type !== existing.type;
    const clientPrice = this.respectClientPrice(
      pricing,
      data.price,
      mergedSuggestedPrice,
      typeChanged || !(existing.price > 0) ? undefined : existing.price,
    );

    const updated: Product = {
      ...existing,
      ...data,
      name: data.name?.trim() ?? existing.name,
      description:
        data.description !== undefined
          ? data.description.trim() || undefined
          : existing.description,
      size: data.size?.trim() ?? existing.size,
      price: clientPrice.price,
      cost: pricing.cost,
      profit: clientPrice.profit,
      suggestedPrice: mergedSuggestedPrice,
      updatedAt: new Date().toISOString(),
      categoryIds: data.categoryIds ?? existing.categoryIds,
      images: normalizeProductImages(data.images ?? existing.images),
      attachments: normalizeProductAttachments(
        data.attachments !== undefined
          ? data.attachments
          : (existing.attachments ?? []),
      ),
      published:
        data.published !== undefined
          ? data.published !== false
          : existing.published !== false,
      includesPieces:
        mergedType === ProductType.COMBO ||
        data.includesPieces === true ||
        mergedComponents.length > 0,
      components: mergedComponents,
      assemblyTimeHours: mergedAssembly,
      stock:
        data.stock !== undefined
          ? Math.max(0, Math.trunc(Number(data.stock) || 0))
          : (existing.stock ?? 0),
    } as Product;

    if (
      mergedType === ProductType.COMBO ||
      existing.type === ProductType.COMBO
    ) {
      updated.type = ProductType.COMBO;
      updated.includesPieces = true;
    } else if (existing.type === ProductType.ESTAMPADO) {
      const current = updated as ProductEstampado;
      if ('workTimeHours' in data && data.workTimeHours !== undefined) {
        current.workTimeHours = Number(data.workTimeHours) || 0;
      }
      if ('estampadoPrints' in data && data.estampadoPrints !== undefined) {
        current.prints = normalizeEstampadoPrints(data.estampadoPrints);
      } else if ('prints' in data && data.prints !== undefined) {
        current.prints = normalizeEstampadoPrints(data.prints);
      }
      if (
        'estampadoPressCycles' in data &&
        data.estampadoPressCycles !== undefined
      ) {
        current.pressCycles = normalizeEstampadoPressCycles(
          data.estampadoPressCycles,
        );
      } else if ('pressCycles' in data && data.pressCycles !== undefined) {
        current.pressCycles = normalizeEstampadoPressCycles(data.pressCycles);
      }
      if ('estampadoSupplies' in data && data.estampadoSupplies !== undefined) {
        current.supplies = normalizeEstampadoSupplies(data.estampadoSupplies);
      } else if ('supplies' in data && data.supplies !== undefined) {
        current.supplies = normalizeEstampadoSupplies(data.supplies);
      }
    } else {
      const current = updated as Product3D;
      if (data.type && data.type !== existing.type) {
        current.type = data.type as ProductType.FDM | ProductType.RESINA;
      }
      if ('grams' in data && data.grams !== undefined) {
        current.grams = Number(data.grams);
      }
      if ('printTimeHours' in data && data.printTimeHours !== undefined) {
        current.printTimeHours = Number(data.printTimeHours);
      }
      if ('workTimeHours' in data && data.workTimeHours !== undefined) {
        current.workTimeHours = Number(data.workTimeHours);
      }
      if ('brand' in data) {
        current.brand = data.brand?.trim();
      }
      if ('filamentType' in data && data.filamentType !== undefined) {
        current.filamentType = data.filamentType;
      }
      if ('filaments' in data && data.filaments !== undefined) {
        const fdmFields = this.resolveFdmProductFields(data, current);
        current.filaments = fdmFields.filaments;
        current.grams = fdmFields.grams;
        current.filamentType = fdmFields.filamentType;
      }
      if ('purgeGrams' in data && data.purgeGrams !== undefined) {
        current.purgeGrams = normalizePurgeGrams(data.purgeGrams);
      }
      if ('colorChanges' in data && data.colorChanges !== undefined) {
        current.colorChanges = normalizeColorChanges(data.colorChanges);
      }
      if (
        'preferredPrinterId' in data &&
        data.preferredPrinterId !== undefined
      ) {
        current.preferredPrinterId = this.normalizePreferredPrinterId(
          data.preferredPrinterId,
        );
      }
      if ('resinType' in data && data.resinType !== undefined) {
        current.resinType = data.resinType;
      }
      if ('colorId' in data && data.colorId !== undefined) {
        current.colorId = resolveProductColorId(
          this.store.generalSettings.colors ?? [],
          typeof data.colorId === 'string' ? data.colorId : undefined,
        );
      }
      if ('washMinutes' in data && data.washMinutes !== undefined) {
        current.washMinutes = Number(data.washMinutes) || undefined;
      }
      if ('estampadoSupplies' in data && data.estampadoSupplies !== undefined) {
        current.supplies = normalizeEstampadoSupplies(data.estampadoSupplies);
      } else if ('supplies' in data && data.supplies !== undefined) {
        current.supplies = normalizeEstampadoSupplies(data.supplies);
      }
      if ('cureMinutes' in data && data.cureMinutes !== undefined) {
        current.cureMinutes = Number(data.cureMinutes) || undefined;
      }
    }

    const index = this.store.products.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new NotFoundException(`Producto ${id} no encontrado`);
    }
    const saved = this.applyCompositeProductionMetrics(
      updated,
      mergedComponents,
    );
    linkProductBrands(this.store, saved);
    this.products.save(saved);
    this.pricingSync.syncAfterProductSave(id, previousPrice);
    return this.findOne(id);
  }

  remove(id: string): void {
    const usedBy = this.products.findUsedAsComponent(id);
    if (usedBy.length) {
      const names = usedBy.map((p) => `"${p.name}"`).join(', ');
      throw new BadRequestException(
        `No se puede eliminar: el producto está incluido en ${names}`,
      );
    }

    this.assertNotInOpenDocuments(id);
    this.products.remove(id);
  }

  /** 409 si el producto figura en pedidos sin cerrar o presupuestos abiertos. */
  private assertNotInOpenDocuments(id: string): void {
    const orderIds = this.store.orders
      .filter(
        (order) =>
          order.status !== OrderStatus.ENTREGADO &&
          order.status !== OrderStatus.CANCELADO &&
          (order.items ?? []).some((item) => item.productId === id),
      )
      .map((order) => order.id);
    const quoteIds = this.store.quotes
      .filter(
        (quote) =>
          (quote.status === QuoteStatus.BORRADOR ||
            quote.status === QuoteStatus.ENVIADO) &&
          (quote.items ?? []).some((item) => item.productId === id),
      )
      .map((quote) => quote.id);
    if (!orderIds.length && !quoteIds.length) return;

    const parts: string[] = [];
    if (orderIds.length)
      parts.push(`pedidos sin cerrar (${orderIds.join(', ')})`);
    if (quoteIds.length) {
      parts.push(`presupuestos abiertos (${quoteIds.join(', ')})`);
    }
    throw new ConflictException(
      `No se puede eliminar: el producto está en ${parts.join(' y ')}. Cerrá o editá esos documentos, o despublicá el producto para sacarlo del catálogo.`,
    );
  }

  private normalizeName(value: string | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /** 409 si ya existe otro producto con el mismo nombre (sin mayúsculas, tildes ni espacios extremos). */
  private assertUniqueName(name: string | undefined, selfId?: string): void {
    const wanted = this.normalizeName(name);
    if (!wanted) return;
    const clash = this.store.products.find(
      (p) => p.id !== selfId && this.normalizeName(p.name) === wanted,
    );
    if (clash) {
      throw new ConflictException(
        `Ya existe un producto llamado "${clash.name}". Usá otro nombre.`,
      );
    }
  }

  /**
   * Precio a guardar: precio fijo > precio que manda el cliente > precio
   * actual (si se pasa) > el calculado. Nunca recalcula solo.
   */
  private respectClientPrice(
    pricing: ProductPricingResult,
    clientPrice: number | undefined | null,
    suggestedPrice: number | null | undefined,
    fallbackPrice?: number,
  ): { price: number; profit: number } {
    let price = pricing.price;
    const fixed = this.normalizeSuggestedPrice(suggestedPrice);
    if (fixed == null) {
      const sent = Number(clientPrice);
      if (Number.isFinite(sent) && sent > 0) price = sent;
      else if (fallbackPrice != null) price = fallbackPrice;
    }
    return { price, profit: price - pricing.cost };
  }

  previewPricing(input: ProductPricingInput): ProductPricingResult {
    if (input.components?.length) {
      this.validateComponents(null, input.components);
    }
    return this.pricing.resolvePricing(input);
  }

  getPricingFields(): ProductPricingFields[] {
    return this.store.products.map((product) => ({
      id: product.id,
      price: product.price,
      cost: product.cost,
      profit: product.profit,
      updatedAt: product.updatedAt,
    }));
  }

  /** Recalcula y persiste precios de todo el catálogo y pedidos abiertos (bajo demanda). */
  syncPricingToDatabase(): ProductPricingFields[] {
    this.pricingSync.syncAllProductsAndOrders('settings', {
      updatePrices: true,
    });
    this.storeChange.recordChange({
      collections: ['products', 'orders'],
      realtime: {
        scopes: ['products', 'orders', 'dashboard', 'sales'],
        action: 'update',
        entity: 'product',
      },
    });
    return this.getPricingFields();
  }

  getMarginAlerts(): ProductMarginAlert[] {
    const alerts: ProductMarginAlert[] = [];

    for (const raw of this.store.products) {
      if (raw.published === false) continue;

      const product = this.withCurrentCost(raw);
      const cost = Number(product.cost) || 0;
      const price = Number(product.price) || 0;
      const markupPercent = productMarkupPercent(price, cost);
      if (markupPercent == null) continue;

      const targetPercent = this.costCalculator.getMarginForProductType(
        product.type,
      );
      if (markupPercent >= targetPercent) continue;

      alerts.push({
        productId: product.id,
        name: product.name,
        price,
        cost,
        markupPercent,
        targetPercent,
        priceForTarget: priceForTargetMarkup(cost, targetPercent),
        fixedPrice: this.hasFixedPrice(product),
      });
    }

    return alerts.sort((a, b) => a.markupPercent - b.markupPercent);
  }

  /** Precio fijo de catálogo (suggestedPrice > 0), misma regla que alertas de margen. */
  isFixedPrice(productId: string): boolean {
    const product = this.store.getProductById(productId);
    return product ? this.hasFixedPrice(product) : false;
  }

  previewBulkPrice(data: BulkPriceDto): BulkPricePreviewResult {
    const items = this.buildBulkPriceItems(data);
    return { items, count: items.length };
  }

  applyBulkPrice(data: BulkPriceDto): BulkPricePreviewResult {
    const items = this.buildBulkPriceItems(data);
    const priceChanges = new Map<string, ProductPriceChange>();
    const now = new Date().toISOString();

    for (const item of items) {
      const current = this.store.getProductById(item.productId);
      if (!current) continue;

      priceChanges.set(item.productId, {
        oldPrice: item.currentPrice,
        newPrice: item.newPrice,
      });

      this.products.save({
        ...current,
        suggestedPrice: item.newPrice,
        price: item.newPrice,
        profit: item.newPrice - item.cost,
        updatedAt: now,
      });
    }

    this.pricingSync.syncCatalogPriceChanges(priceChanges, 'bulk_price');
    return { items, count: items.length };
  }

  private buildBulkPriceItems(data: BulkPriceDto): BulkPricePreviewItem[] {
    this.assertBulkPriceInput(data);
    const wholesale = normalizeWholesaleDiscount(
      this.store.generalSettings.wholesaleDiscount,
    );
    const targets = this.selectFixedPriceProducts(data);
    const items: BulkPricePreviewItem[] = [];

    for (const raw of targets) {
      const product = this.withCurrentCost(raw);
      const currentPrice = Number(product.price) || 0;
      const cost = Number(product.cost) || 0;
      const newPrice = roundPrice(
        currentPrice * (1 + Number(data.percent) / 100),
        data.roundTo,
      );
      const area = resolveProfitArea(product) ?? ServiceType.IMPRESION_3D;
      items.push({
        productId: product.id,
        name: product.name,
        currentPrice,
        newPrice,
        newWholesalePrice: wholesaleUnitPrice(newPrice, wholesale, area),
        cost,
        newMarkupPercent: productMarkupPercent(newPrice, cost),
      });
    }

    return items;
  }

  private assertBulkPriceInput(data: BulkPriceDto): void {
    const percent = Number(data.percent);
    if (!Number.isFinite(percent) || percent === 0) {
      throw new BadRequestException('El porcentaje debe ser distinto de 0');
    }
    if (percent < -50 || percent > 200) {
      throw new BadRequestException('El porcentaje debe estar entre -50 y 200');
    }
    if (![0, 100, 500].includes(Number(data.roundTo))) {
      throw new BadRequestException('roundTo debe ser 0, 100 o 500');
    }

    if (data.scope === 'category') {
      const categoryId = data.categoryId?.trim();
      if (!categoryId) {
        throw new BadRequestException('Indicá la categoría');
      }
      if (
        !this.store.categories.some((category) => category.id === categoryId)
      ) {
        throw new BadRequestException(`Categoría ${categoryId} no encontrada`);
      }
    }

    if (data.scope === 'filament_type') {
      if (
        !data.filamentType ||
        !Object.values(FilamentType).includes(data.filamentType)
      ) {
        throw new BadRequestException('Indicá un tipo de filamento válido');
      }
    }
  }

  private selectFixedPriceProducts(data: BulkPriceDto): Product[] {
    return this.store.products.filter((product) => {
      if (!this.hasFixedPrice(product)) return false;

      if (data.scope === 'category') {
        return (product.categoryIds ?? []).includes(data.categoryId!);
      }

      if (data.scope === 'filament_type') {
        return this.productUsesFilamentType(product, data.filamentType!);
      }

      return true;
    });
  }

  private productUsesFilamentType(
    product: Product,
    filamentType: FilamentType,
  ): boolean {
    if (product.type !== ProductType.FDM) return false;
    const filaments = resolveFdmFilaments({
      filaments: product.filaments,
      grams: product.grams,
      filamentType: product.filamentType,
      brand: product.brand,
    });
    if (filaments.length) {
      return filaments.some((line) => line.filamentType === filamentType);
    }
    return product.filamentType === filamentType;
  }

  private hasFixedPrice(product: Product): boolean {
    return product.suggestedPrice != null && Number(product.suggestedPrice) > 0;
  }

  private validateProductData(
    data: CreateProductDto,
    isUpdate = false,
    productId: string | null = null,
    incoming?: UpdateProductDto,
  ): void {
    if (!isUpdate || data.name !== undefined) {
      if (!data.name?.trim()) {
        throw new BadRequestException('El nombre es obligatorio');
      }
    }

    if (!isUpdate || data.type !== undefined) {
      if (!Object.values(ProductType).includes(data.type)) {
        throw new BadRequestException('Tipo de producto inválido');
      }
    }

    if (!isUpdate || data.price !== undefined) {
      if (data.price === undefined || Number(data.price) < 0) {
        throw new BadRequestException('El precio debe ser mayor o igual a 0');
      }
    }

    if (!isUpdate || data.cost !== undefined) {
      if (data.cost === undefined || Number(data.cost) < 0) {
        throw new BadRequestException('El costo debe ser mayor o igual a 0');
      }
    }

    if (!isUpdate || data.images !== undefined) {
      validateProductImageUrls(data.images);
    }

    if (!isUpdate || data.attachments !== undefined) {
      validateProductAttachments(
        data.attachments !== undefined
          ? normalizeProductAttachments(data.attachments)
          : undefined,
      );
    }

    if (data.type === ProductType.COMBO) {
      const components = data.components ?? [];
      if (!components.length) {
        throw new BadRequestException(
          'Un combo debe incluir al menos una pieza',
        );
      }
    }

    if (!isUpdate || data.categoryIds !== undefined) {
      const ids = data.categoryIds ?? [];
      if (ids.length < 1 || ids.length > 5) {
        throw new BadRequestException('Seleccioná entre 1 y 5 categorías');
      }
      for (const catId of ids) {
        const category = this.store.categories.find((c) => c.id === catId);
        if (!category) {
          throw new BadRequestException(`Categoría ${catId} no encontrada`);
        }
        // Un combo arma piezas de cualquier tipo: acepta cualquier categoría.
        if (
          data.type !== ProductType.COMBO &&
          !category.productTypes.includes(data.type)
        ) {
          throw new BadRequestException(
            `La categoría "${category.name}" no aplica al tipo ${data.type}`,
          );
        }
      }
    }

    const components = data.components ?? [];
    if (!isUpdate || data.components !== undefined) {
      this.validateComponents(productId, components);
    }

    const includesPieces =
      data.type === ProductType.COMBO ||
      data.includesPieces === true ||
      components.length > 0;
    const hasComponents = includesPieces && components.length > 0;

    if (data.type === ProductType.FDM || data.type === ProductType.RESINA) {
      const dto = data as Partial<Product3D>;
      if (!hasComponents) {
        if (!isUpdate || dto.grams !== undefined) {
          if (dto.grams === undefined || Number(dto.grams) <= 0) {
            throw new BadRequestException('Los gramos deben ser mayores a 0');
          }
        }
        if (!isUpdate || dto.printTimeHours !== undefined) {
          if (
            dto.printTimeHours === undefined ||
            Number(dto.printTimeHours) < 0
          ) {
            throw new BadRequestException(
              'El tiempo de impresión debe ser mayor o igual a 0',
            );
          }
        }
        if (!isUpdate || dto.workTimeHours !== undefined) {
          if (
            dto.workTimeHours === undefined ||
            Number(dto.workTimeHours) < 0
          ) {
            throw new BadRequestException(
              'El tiempo de trabajo debe ser mayor o igual a 0',
            );
          }
        }
      } else if (
        data.assemblyTimeHours !== undefined &&
        Number(data.assemblyTimeHours) < 0
      ) {
        throw new BadRequestException(
          'El tiempo de armado debe ser mayor o igual a 0',
        );
      }
    }

    const colors = this.store.generalSettings.colors ?? [];
    this.assertPrintedProductMaterial(data, isUpdate, incoming);

    if (data.type === ProductType.FDM) {
      const filaments = resolveFdmFilaments({
        filaments: data.filaments,
        grams: data.grams,
        filamentType: data.filamentType,
        brand: data.brand,
      });
      for (const line of filaments) {
        resolveProductColorId(colors, line.colorId);
      }
      if (!isUpdate || incoming?.preferredPrinterId !== undefined) {
        this.assertPreferredPrinter(
          isUpdate ? incoming?.preferredPrinterId : data.preferredPrinterId,
        );
      }
      const purgeIncoming = isUpdate ? incoming?.purgeGrams : data.purgeGrams;
      if (
        purgeIncoming !== undefined &&
        purgeIncoming !== null &&
        (Number(purgeIncoming) < 0 || !Number.isFinite(Number(purgeIncoming)))
      ) {
        throw new BadRequestException('La purga no puede ser negativa');
      }
      const colorIncoming = isUpdate
        ? incoming?.colorChanges
        : data.colorChanges;
      if (
        colorIncoming !== undefined &&
        colorIncoming !== null &&
        (!Number.isInteger(Number(colorIncoming)) || Number(colorIncoming) < 0)
      ) {
        throw new BadRequestException(
          'Los cambios de color deben ser un entero mayor o igual a 0',
        );
      }
    }
    if (data.type === ProductType.RESINA && data.colorId !== undefined) {
      resolveProductColorId(colors, data.colorId);
    }
    if (
      data.type === ProductType.ESTAMPADO ||
      data.type === ProductType.FDM ||
      data.type === ProductType.RESINA
    ) {
      const supplyLines = normalizeEstampadoSupplies(
        data.estampadoSupplies ?? data.supplies,
      );
      for (const line of supplyLines) {
        resolveProductColorId(colors, line.colorId);
      }
    }
  }

  private normalizePreferredPrinterId(
    value: string | null | undefined,
  ): string | null {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim();
    return trimmed || null;
  }

  private assertPreferredPrinter(
    preferredPrinterId: string | null | undefined,
  ): void {
    if (preferredPrinterId === undefined) return;
    const normalized = this.normalizePreferredPrinterId(preferredPrinterId);
    if (!normalized) return;
    const exists = fdmQueuePrinters(this.store.generalSettings).some(
      (profile) => profile.id === normalized,
    );
    if (!exists) {
      throw new BadRequestException('La impresora elegida no existe');
    }
  }

  private resolveFdmProductFields(
    data: Partial<CreateProductDto>,
    fallback?: Product3D,
  ) {
    const filaments = storedFdmFilaments(
      resolveFdmFilaments({
        filaments: data.filaments ?? fallback?.filaments,
        grams: data.grams ?? fallback?.grams,
        filamentType: data.filamentType ?? fallback?.filamentType,
        brand: data.brand ?? fallback?.brand,
      }),
    );
    const grams = filaments.length
      ? totalFdmFilamentGrams(filaments)
      : Number(data.grams ?? fallback?.grams) || 0;
    const filamentType =
      filaments.length === 1
        ? filaments[0].filamentType
        : (data.filamentType ?? fallback?.filamentType);

    return { filaments, grams, filamentType };
  }

  private assertPrintedProductMaterial(
    data: CreateProductDto,
    isUpdate: boolean,
    incoming?: UpdateProductDto,
  ): void {
    assertPrintedMaterial(data, isUpdate, incoming);
  }

  private rejectPrintedProductWithoutCost(
    data: CreateProductDto,
    cost: number,
    isUpdate = false,
    incoming?: UpdateProductDto,
  ): void {
    rejectPrintedWithoutCost(data, cost, isUpdate, incoming);
  }

  private validateComponents(
    productId: string | null,
    components: ProductComponent[],
  ): void {
    validateProductComponents(
      productId,
      components,
      this.store.products,
      this.store.generalSettings.colors ?? [],
    );
  }

  private applyCompositeProductionMetrics(
    product: Product,
    components: ProductComponent[],
  ): Product {
    if (
      components.length === 0 ||
      (product.type !== ProductType.FDM && product.type !== ProductType.RESINA)
    ) {
      return product;
    }

    const metrics = sumComponentsProductionMetrics(this.store, components, {
      assemblyTimeHours: product.assemblyTimeHours,
    });
    return {
      ...product,
      grams: metrics.grams,
      printTimeHours: metrics.printTimeHours,
      workTimeHours: metrics.workTimeHours,
    };
  }

  private normalizeSuggestedPrice(
    value: number | null | undefined,
  ): number | null {
    if (value == null) return null;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return amount;
  }
}
