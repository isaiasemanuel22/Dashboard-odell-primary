import { Injectable } from '@nestjs/common';
import { Fair } from '../../common/interfaces';
import { StoreService } from '../store.service';

@Injectable()
export class FairRepository {
  constructor(private readonly store: StoreService) {}

  findAll(): Fair[] {
    return this.store.fairs;
  }

  findById(id: string): Fair | undefined {
    return this.store.getFairById(id);
  }

  nextId(): string {
    return this.store.nextFairId();
  }

  create(fair: Fair): Fair {
    this.store.fairs.push(fair);
    return fair;
  }

  save(fair: Fair): Fair {
    this.store.replaceFair(fair);
    return fair;
  }

  remove(id: string): boolean {
    return this.store.removeFair(id);
  }
}
