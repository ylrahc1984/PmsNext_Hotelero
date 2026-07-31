export interface UsuarioUI {
  usuario: string;
  nombreUsu: string;
  departamento: number;
  telefono: string;
  correo: string;
  clave?: string;
  pntVenta?: number;
  passPntVenta?: string;
  operador?: string;
}

export interface UsuarioListado {
  usuario: string;
  nombre: string;
  departamento: string;
  telefono: string;
  correo: string;
}

export interface UsuarioFiltros {
  usuario?: string;
  departamento?: number | null;
}

export interface UsuarioApi {
  MA01_Usuario: string;
  MA01_NomPersonal: string;
  MA01_CodDepa: number;
  MA01_Telefono: string;
  MA01_Correo: string;
  MA01_Clave: string;
  MA01_Operador: string;
}

export interface UsuarioPaginationApi {
  totalRegistros: number;
  paginaActual: number;
  pageSize: number;
}

export interface Paginacion {
  totalRegistros: number;
  paginaActual: number;
  pageSize: number;
}

export interface UsuarioListResponse {
  datos: UsuarioApi[];
  paginacion: UsuarioPaginationApi;
}

export interface UsuarioDetalleResponse {
  datos: UsuarioApi[];
  paginacion: UsuarioPaginationApi;
}

export interface UsuarioPayload {
  tipo: number;
  usuario: string;
  nombreUsu: string;
  departamento: number;
  telefono: string;
  correo: string;
  clave: string;
  pntVenta: number;
  passPntVenta: string;
  operador: string;
  respuesta: string;
  pageNumber: number;
  pageSize: number;
}

export interface UsuarioResponse {
  respuesta?: string;
}

export interface CambioClavePayload {
  tipo: number;
  usuario: string;
  clave: string;
  operador: string;
  respuesta: string;
}

export interface ModuloCatalogo {
  MA03_Modulo: string;
  MA03_Descripcion: string;
  MA03_Orden: number;
  MA03_Operador: string;
}

export interface ModuloCatalogoUI {
  codigo: string;
  descripcion: string;
  orden: number;
  operador: string;
}

export interface ModuloUsuarioPayload {
  tipo: number;
  modulo: string;
  usuario: string;
  operador: string;
  respuesta: string;
}

export interface PrivilegioCatalogo {
  CA08_CodParametro: string;
  CA08_Tipo: string;
  CA08_Descripcion: string;
  CA08_Modulo: string;
  CA08_Valor: string;
  CA08_Orden: number;
}

export interface PrivilegioCatalogoUI {
  id: string;
  descripcion: string;
  modulo: string;
  valor: string;
  orden: number;
  tipo: string;
}

export interface PuntoVenta {
  MPV07_CodPntVenta?: string;
  MPV07_NomPntVenta?: string;
  MPV07_CodComanda?: string;
  MPV07_CodDocumento?: unknown;
  MPV07_CodLstPrecio?: unknown;
  MPV07_NumMesas?: number;
  MPV07_PntTouch?: number;
  MPV07_Orden?: number;
  MPV07_Operador?: string;
  MPV07_ImpresoraA?: unknown;
  MPV07_ImpresoraB?: unknown;
  MPV08_CodPntVenta?: string;
  MPV08_NomPntVenta?: string;
  MPV08_Orden?: number;
  codPntVenta?: string;
  nomPntVenta?: string;
}

export interface PuntoVentaUI {
  codigo: string;
  descripcion: string;
  codComanda: string;
  codDocumento: string;
  codLstPrecio: string;
  numMesas: number;
  pntTouch: number;
  orden: number;
  operador: string;
  impresoraA: string;
  impresoraB: string;
}

export interface DescuentoNivel {
  id: number;
  descripcion: string;
  porcentaje: number;
}

export interface DescuentoUsuario {
  id: number;
  puntoVenta: string;
  nivelId: number;
}
