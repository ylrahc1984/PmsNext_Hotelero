import { Producto } from '../../producto-list/interfaces/Producto.interface';

export interface ProductoResponse {
  datos?: Producto[];
  paginacion?: unknown[];
  respuesta?: string;
}
