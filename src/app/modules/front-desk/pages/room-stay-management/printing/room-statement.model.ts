export type RoomStatementBucket = 'lodging' | 'extras';

export interface RoomStatementLine {
  order: number;
  quantity: number;
  code: string;
  description: string;
  subtotal: number;
  discount: number;
  net: number;
  taxes: number;
  total: number;
  currency: string;
  comment: string;
}

export interface RoomStatementCharge {
  bucket: RoomStatementBucket;
  type: string;
  number: string;
  date: string;
  time: string;
  pointOfSale: string;
  guestName: string;
  currency: string;
  total: number;
  lines: RoomStatementLine[];
}

export interface RoomStatementTotals {
  subtotal: number;
  discount: number;
  net: number;
  taxes: number;
  total: number;
}

export interface RoomStatementData {
  roomNumber: string;
  reservationNumber: string;
  masterFolio: string;
  agency: string;
  plan: string;
  checkIn: string;
  checkOut: string;
  guests: string[];
  currency: 'USD';
  operationalDate: string;
  generatedAt: Date;
  operator: string;
  charges: RoomStatementCharge[];
  lodgingTotals: RoomStatementTotals;
  extraTotals: RoomStatementTotals;
  totals: RoomStatementTotals;
}
