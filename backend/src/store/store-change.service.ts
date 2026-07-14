import { Injectable } from '@nestjs/common';
import {
  RealtimeAction,
  RealtimeEntity,
  RealtimeScope,
} from '../realtime/realtime.types';
import { RealtimeService } from '../realtime/realtime.service';
import { StorePersistenceService } from './store-persistence.service';
import { ALL_STORE_COLLECTIONS, StoreCollection } from './store.collections';
import {
  actionFromHttpMethod,
  idFromMutationPath,
  normalizeApiPath,
  routeMutationMetaFromPath,
} from './route-registry';

export interface StoreChangePayload {
  collections: StoreCollection[];
  persist?: boolean;
  realtime?: {
    scopes: RealtimeScope[];
    action: RealtimeAction;
    entity?: RealtimeEntity;
    id?: string;
  };
}

@Injectable()
export class StoreChangeService {
  constructor(
    private readonly persistence: StorePersistenceService,
    private readonly realtime: RealtimeService,
  ) {}

  recordChange(payload: StoreChangePayload): void {
    if (payload.persist !== false) {
      this.persistence.schedulePersist(payload.collections);
    }

    if (payload.realtime) {
      const { scopes, action, entity, id } = payload.realtime;
      this.realtime.notify(scopes, { action, entity, id });
    }
  }

  recordHttpMutation(
    path: string,
    method: string,
    body: unknown,
  ): void {
    const meta = routeMutationMetaFromPath(path);
    const action = actionFromHttpMethod(method);
    const idFromPath = idFromMutationPath(path);
    const id =
      idFromPath ??
      (body && typeof body === 'object' && 'id' in body
        ? String((body as { id: unknown }).id)
        : undefined);

    this.recordChange({
      collections: meta.collections,
      realtime: {
        scopes: meta.scopes,
        action,
        entity: meta.entity,
        id,
      },
    });
  }

  recordHttpMutationFromRequest(
    originalUrl: string,
    method: string,
    body: unknown,
  ): void {
    this.recordHttpMutation(normalizeApiPath(originalUrl), method, body);
  }

  notifyAll(action: RealtimeAction = 'update'): void {
    this.recordChange({
      collections: [...ALL_STORE_COLLECTIONS],
      persist: false,
      realtime: { scopes: ['all'], action },
    });
  }
}
