import { Injectable } from '@nestjs/common';
import { Quote } from '../../common/interfaces';
import { StoreService } from '../store.service';

@Injectable()
export class QuoteRepository {
  constructor(private readonly store: StoreService) {}

  findAll(): Quote[] {
    return this.store.quotes;
  }

  findById(id: string): Quote | undefined {
    return this.store.getQuoteById(id);
  }

  nextId(): string {
    return this.store.nextQuoteId();
  }

  create(quote: Quote): Quote {
    this.store.quotes.push(quote);
    this.store.indexQuote(quote);
    return quote;
  }

  save(quote: Quote): Quote {
    this.store.replaceQuote(quote);
    return quote;
  }

  remove(id: string): boolean {
    return this.store.removeQuote(id);
  }
}
