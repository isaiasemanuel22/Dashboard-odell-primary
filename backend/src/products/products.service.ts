import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductType } from '../common/enums';
import {
  CreateProductDto,
  Product,
  Product3D,
  ProductEstampado,
  ProductComponent,
  ProductCombo,
  ProductOverview,
  ProductPricingInput,
  ProductPricingResult,
  UpdateProductDto,
} from '../common/interfaces';
import { ProductPricingService } from './product-pricing.service';
import { ProductRepository } from '../store/repositories/product.repository';
import { StoreService } from '../store/store.service';
import {
  normalizeEstampadoPressCycles,
  normalizeEstampadoPrints,
  normalizeEstampadoSupplies,
} from './estampado-product.util';
import { normalizeProductComponents } from './product-component.util';
import {
  normalizeProductImages,
  validateProductImageUrls,
} from './product-image.util';

@Injectable()
export class ProductsService {
  constructor(
    private readonly store: StoreService,
    private readonly products: ProductRepository,
    private readonly pricing: ProductPricingService,
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
    if (!type) return products;
    return products.filter((p) => p.type === type);
  }

  findOne(id: string): Product {
    const product = this.store.getProductById(id);
    if (!product) {
      throw new NotFoundException(`Producto ${id} no encontrado`);
    }
    return {
      ...product,
      components: normalizeProductComponents(
        product.components,
        this.store.products,
      ),
    };
  }

  getOverview(id: string): ProductOverview {
    const product = this.findOne(id);
    return {
      product,
      categories: [...this.store.categories],
      catalogProducts: [...this.store.products],
    };
  }

  create(data: CreateProductDto): Product {
    this.validateProductData(data);
    const pricing = this.pricing.resolvePricing(
      this.pricing.toPricingInput(data),
    );
    const now = new Date().toISOString();
    const components = normalizeProductComponents(data.components ?? []);
    const assemblyTimeHours = Number(data.assemblyTimeHours) || 0;
    const includesPieces =
      data.type === ProductType.COMBO ||
      data.includesPieces === true ||
      components.length > 0;
    const base = {
      id: this.store.nextId('prod', this.store.products),
      name: data.name.trim(),
      images: normalizeProductImages(data.images ?? []),
      updatedAt: now,
      price: pricing.price,
      cost: pricing.cost,
      profit: pricing.profit,
      categoryIds: data.categoryIds ?? [],
      size: (data.size ?? '').trim() || (data.type === ProductType.COMBO ? 'Combo' : ''),
      published: data.published !== false,
      includesPieces,
      components,
      assemblyTimeHours,
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
      product = {
        ...base,
        type: dto.type as ProductType.FDM | ProductType.RESINA,
        grams: Number(dto.grams) || 0,
        printTimeHours: Number(dto.printTimeHours) || 0,
        workTimeHours: Number(dto.workTimeHours) || 0,
        brand: dto.brand?.trim(),
        filamentType:
          dto.type === ProductType.FDM ? dto.filamentType : undefined,
        resinType:
          dto.type === ProductType.RESINA ? dto.resinType : undefined,
        washMinutes:
          dto.type === ProductType.RESINA && dto.washMinutes !== undefined
            ? Number(dto.washMinutes) || undefined
            : undefined,
        cureMinutes:
          dto.type === ProductType.RESINA && dto.cureMinutes !== undefined
            ? Number(dto.cureMinutes) || undefined
            : undefined,
      };
    }

    this.products.create(product);
    return product;
  }

  update(id: string, data: UpdateProductDto): Product {
    const existing = this.findOne(id);
    const mergedType = (data.type ?? existing.type) as ProductType;
    const mergedComponents = normalizeProductComponents(
      data.components !== undefined ? data.components : existing.components ?? [],
    );
    const mergedAssembly =
      data.assemblyTimeHours !== undefined
        ? Number(data.assemblyTimeHours) || 0
        : existing.assemblyTimeHours ?? 0;

    const mergedForValidation = {
      name: data.name ?? existing.name,
      type: mergedType,
      price: data.price ?? existing.price,
      cost: data.cost ?? existing.cost,
      size: data.size ?? existing.size,
      categoryIds: data.categoryIds ?? existing.categoryIds,
      components: mergedComponents,
      assemblyTimeHours: mergedAssembly,
      suggestedPrice: data.suggestedPrice,
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
    this.validateProductData(mergedForValidation, true, id);

    const pricingInput = this.pricing.toPricingInput(mergedForValidation);
    const pricing = this.pricing.resolvePricing(pricingInput);

    const updated: Product = {
      ...existing,
      ...data,
      name: data.name?.trim() ?? existing.name,
      size: data.size?.trim() ?? existing.size,
      price: pricing.price,
      cost: pricing.cost,
      profit: pricing.profit,
      updatedAt: new Date().toISOString(),
      categoryIds: data.categoryIds ?? existing.categoryIds,
      images: normalizeProductImages(data.images ?? existing.images),
      published:
        data.published !== undefined ? data.published !== false : existing.published !== false,
      includesPieces:
        mergedType === ProductType.COMBO ||
        data.includesPieces === true ||
        mergedComponents.length > 0,
      components: mergedComponents,
      assemblyTimeHours: mergedAssembly,
    } as Product;

    if (mergedType === ProductType.COMBO || existing.type === ProductType.COMBO) {
      (updated as Product).type = ProductType.COMBO;
      (updated as Product).includesPieces = true;
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
      if ('resinType' in data && data.resinType !== undefined) {
        current.resinType = data.resinType;
      }
      if ('washMinutes' in data && data.washMinutes !== undefined) {
        current.washMinutes =
          Number(data.washMinutes) || undefined;
      }
      if ('cureMinutes' in data && data.cureMinutes !== undefined) {
        current.cureMinutes =
          Number(data.cureMinutes) || undefined;
      }
    }

    const index = this.store.products.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new NotFoundException(`Producto ${id} no encontrado`);
    }
    this.products.save(updated);
    return updated;
  }

  remove(id: string): void {
    const usedBy = this.products.findUsedAsComponent(id);
    if (usedBy.length) {
      const names = usedBy.map((p) => `"${p.name}"`).join(', ');
      throw new BadRequestException(
        `No se puede eliminar: el producto está incluido en ${names}`,
      );
    }

    this.products.remove(id);
  }

  previewPricing(input: ProductPricingInput): ProductPricingResult {
    if (input.components?.length) {
      this.validateComponents(null, input.components);
    }
    return this.pricing.resolvePricing(input);
  }

  private validateProductData(
    data: CreateProductDto,
    isUpdate = false,
    productId: string | null = null,
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
        throw new BadRequestException(
          'Seleccioná entre 1 y 5 categorías',
        );
      }
      for (const catId of ids) {
        const category = this.store.categories.find((c) => c.id === catId);
        if (!category) {
          throw new BadRequestException(`Categoría ${catId} no encontrada`);
        }
        if (!category.productTypes.includes(data.type)) {
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
  }

  private validateComponents(
    productId: string | null,
    components: ProductComponent[],
  ): void {
    const seen = new Set<string>();

    for (const component of components) {
      if (!component.productId) {
        throw new BadRequestException('Cada pieza debe referenciar un producto');
      }
      if (Number(component.quantity) < 1) {
        throw new BadRequestException(
          'La cantidad de cada pieza debe ser al menos 1',
        );
      }
      if (productId && component.productId === productId) {
        throw new BadRequestException(
          'Un producto no puede incluirse a sí mismo como pieza',
        );
      }
      if (seen.has(component.productId)) {
        throw new BadRequestException(
          'Cada pieza solo puede aparecer una vez en la lista',
        );
      }
      seen.add(component.productId);

      const part = this.store.products.find((p) => p.id === component.productId);
      if (!part) {
        throw new BadRequestException(
          `Producto pieza ${component.productId} no encontrado`,
        );
      }

      this.assertNoComponentCycle(
        component.productId,
        productId,
        new Set<string>(),
      );
    }
  }

  private assertNoComponentCycle(
    currentId: string,
    rootId: string | null,
    visited: Set<string>,
  ): void {
    if (rootId && currentId === rootId) {
      throw new BadRequestException(
        'Referencia circular entre productos compuestos',
      );
    }
    if (visited.has(currentId)) {
      return;
    }
    visited.add(currentId);

    const product = this.store.products.find((p) => p.id === currentId);
    if (!product?.components?.length) {
      return;
    }

    for (const child of product.components) {
      this.assertNoComponentCycle(child.productId, rootId, visited);
    }
  }
}
