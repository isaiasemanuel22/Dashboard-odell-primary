import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaperType } from '../common/enums';
import {
  CreateImpresoDto,
  Impreso,
  ImpresoCostPreview,
  ImpresoWithCost,
  UpdateImpresoDto,
} from '../common/interfaces';
import { CostCalculatorService } from '../settings/cost-calculator.service';
import { StoreService } from '../store/store.service';

@Injectable()
export class ImpresosService {
  constructor(
    private readonly store: StoreService,
    private readonly costCalculator: CostCalculatorService,
  ) {}

  findAll(paperType?: PaperType): ImpresoWithCost[] {
    let items = [...this.store.impresos];
    if (paperType) {
      items = items.filter((i) => i.paperType === paperType);
    }
    return items
      .map((item) => this.enrich(item))
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }

  findOne(id: string): ImpresoWithCost {
    const impreso = this.store.impresos.find((i) => i.id === id);
    if (!impreso) {
      throw new NotFoundException(`Impreso ${id} no encontrado`);
    }
    return this.enrich(impreso);
  }

  previewCost(
    paperType: PaperType,
    widthCm: number,
    heightCm: number,
  ): ImpresoCostPreview {
    return this.costCalculator.calculateImpresoPaperCost(
      paperType,
      widthCm,
      heightCm,
    );
  }

  create(data: CreateImpresoDto): ImpresoWithCost {
    this.validate(data);
    const impreso: Impreso = {
      id: this.store.nextId('imp', this.store.impresos),
      name: data.name.trim(),
      paperType: data.paperType,
      widthCm: Number(data.widthCm),
      heightCm: Number(data.heightCm),
      updatedAt: new Date().toISOString(),
    };
    this.store.impresos.push(impreso);
    return this.enrich(impreso);
  }

  update(id: string, data: UpdateImpresoDto): ImpresoWithCost {
    const existing = this.store.impresos.find((i) => i.id === id);
    if (!existing) {
      throw new NotFoundException(`Impreso ${id} no encontrado`);
    }
    const merged: CreateImpresoDto = {
      name: data.name ?? existing.name,
      paperType: data.paperType ?? existing.paperType,
      widthCm: data.widthCm ?? existing.widthCm,
      heightCm: data.heightCm ?? existing.heightCm,
    };
    this.validate(merged);

    const updated: Impreso = {
      ...existing,
      name: merged.name.trim(),
      paperType: merged.paperType,
      widthCm: Number(merged.widthCm),
      heightCm: Number(merged.heightCm),
      updatedAt: new Date().toISOString(),
    };

    const index = this.store.impresos.findIndex((i) => i.id === id);
    this.store.impresos[index] = updated;
    return this.enrich(updated);
  }

  remove(id: string): void {
    const index = this.store.impresos.findIndex((i) => i.id === id);
    if (index === -1) {
      throw new NotFoundException(`Impreso ${id} no encontrado`);
    }
    this.store.impresos.splice(index, 1);
  }

  private validate(data: CreateImpresoDto): void {
    if (!data.name?.trim()) {
      throw new BadRequestException('El nombre es obligatorio');
    }
    if (!Object.values(PaperType).includes(data.paperType)) {
      throw new BadRequestException('Tipo de papel inválido');
    }
    if (Number(data.widthCm) <= 0 || Number(data.heightCm) <= 0) {
      throw new BadRequestException(
        'Ancho y alto deben ser mayores a 0',
      );
    }
  }

  private enrich(impreso: Impreso): ImpresoWithCost {
    const { areaSqm, paperCost } = this.costCalculator.calculateImpresoPaperCost(
      impreso.paperType,
      impreso.widthCm,
      impreso.heightCm,
    );

    return {
      ...impreso,
      areaSqm,
      paperCost,
    };
  }
}
