import { Agency } from './agency.model';

export interface AgencyPagination {
  datos: Agency[];
  totalRegistros: number;
  paginaActual: number;
  tamanoPagina: number;
  totalPaginas: number;
}
