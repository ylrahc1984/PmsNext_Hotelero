import { CompraFactura } from './CompraFactura.interface';

export interface CompraFacturaResponse {
  data: CompraFactura[];
  pageNumber: number;
  pageSize: number;
  totalRecords: number;
}
