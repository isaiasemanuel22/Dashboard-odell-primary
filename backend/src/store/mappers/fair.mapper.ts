import { FairStatus } from '../../common/enums';
import { Fair } from '../../common/interfaces';

function normalizeStatus(value: string): FairStatus {
  return Object.values(FairStatus).includes(value as FairStatus)
    ? (value as FairStatus)
    : FairStatus.PLANNED;
}

export function mapFairFromDb(row: {
  id: string;
  name: string;
  date: string;
  recurring: boolean;
  calendarEntryId: string | null;
  status: string;
  openedAt: Date | null;
  openingFloat: number;
  closedAt: Date | null;
  countedCash: number | null;
  cashDifference: number | null;
  differenceReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Fair {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    recurring: row.recurring,
    calendarEntryId: row.calendarEntryId,
    status: normalizeStatus(row.status),
    openedAt: row.openedAt ? row.openedAt.toISOString() : null,
    openingFloat: row.openingFloat,
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    countedCash: row.countedCash,
    cashDifference: row.cashDifference,
    differenceReason: row.differenceReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapFairToDb(fair: Fair) {
  return {
    id: fair.id,
    name: fair.name,
    date: fair.date,
    recurring: fair.recurring,
    calendarEntryId: fair.calendarEntryId,
    status: fair.status,
    openedAt: fair.openedAt ? new Date(fair.openedAt) : null,
    openingFloat: fair.openingFloat,
    closedAt: fair.closedAt ? new Date(fair.closedAt) : null,
    countedCash: fair.countedCash,
    cashDifference: fair.cashDifference,
    differenceReason: fair.differenceReason,
    createdAt: new Date(fair.createdAt),
    updatedAt: new Date(fair.updatedAt),
  };
}
