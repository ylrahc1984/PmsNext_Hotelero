import { Producto } from './Producto.interface';

export interface ProductoPaginacion {
  TotalRegistros: number;
  PaginaActual: number;
  TotalPaginas: number;
}

export interface ProductoResponse {
  datos?: Producto[];
  paginacion?: ProductoPaginacion[];
}
