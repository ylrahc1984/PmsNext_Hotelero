import { Producto } from './Producto.interface';

export interface ProductoResponse {
  datos?: Producto[];
  paginacion?: unknown[];
}
