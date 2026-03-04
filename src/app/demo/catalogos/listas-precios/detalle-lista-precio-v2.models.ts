export type TipoPax = 'PAx' | 'CHL' | 'NAC';

export type Moneda = 'USD' | 'CRC';

export interface ReglaPrecioListItemDto {
  ReglaPrecioID: number;
  CodLstPrecio: string;
  DesLstPrecio: string;
  CodServicio: string;
  NomReceta?: string;
  TipoTarifa: string | number;
  CantMinPax: number;
  CantMaxPax: number;
  HoraDesde: string;
  HoraHasta: string;
  Moneda: string;
  Observaciones?: string;
  Activo: boolean | number | string;
  Operador?: string;
  FechaRegistro?: string;
  TotalRegistros?: number;
}

export interface PrecioTipoPaxDto {
  TipoPax: TipoPax;
  Precio: number;
  PaxExtra: number;
  CantPaxMax: number;
  PorcentajeComision?: number | null;
  MontoComision?: number | null;
}

export interface PrecioTipoPaxCreateDto {
  tipoPax: string;
  precio: number;
  paxExtra: number;
  cantPaxMax: number;
  porcentajeComision?: number | null;
  montoComision?: number | null;
}

export interface ReglaPrecioCreateDto {
  codLstPrecio: string;
  codServicio: string;
  tipoTarifa: string;
  cantMinPax: number;
  cantMaxPax: number;
  horaDesde: string;
  horaHasta: string;
  moneda: string;
  observaciones: string;
  operador?: string;
  precios: PrecioTipoPaxCreateDto[];
}

export interface PrecioTipoPaxUpdateDto {
  tipoPax: string;
  precio: number;
  paxExtra: number;
  cantPaxMax: number;
  porcentajeComision?: number | null;
  montoComision?: number | null;
}

export interface ReglaPrecioPreciosUpdateDto {
  reglaPrecioId: number;
  precios: PrecioTipoPaxUpdateDto[];
  operador?: string;
}

export interface TipoPaxDto {
  CR03_CodTipo: string;
  CR03_Descripcion: string;
  CR03_Orden: number;
  CR03_Operador: string;
}

export interface ReglaPrecioDetalleDto extends ReglaPrecioListItemDto {
  Precios: PrecioTipoPaxDto[];
}

export interface PaginacionDto {
  totalRegistros: number;
  paginaActual: number;
  pageSize: number;
}

export interface PagedResponseDto<T> {
  datos: T[];
  paginacion: PaginacionDto;
}

export interface EditableField<T> {
  value: T;
  original: T;
  dirty: boolean;
  error?: string;
}

export interface PrecioTipoPaxVm {
  tipoPax: TipoPax;
  tipoPaxCodigo: string;
  precio: EditableField<number>;
  paxExtra: EditableField<number>;
  cantPaxMax: EditableField<number>;
  porcentajeComision: EditableField<number | null>;
  montoComision: EditableField<number | null>;
}

export interface ReglaPrecioVm {
  id: number;
  codLstPrecio: string;
  desLstPrecio: string;
  codServicio: string;
  nomReceta: string;
  tipoTarifa: EditableField<string>;
  cantMinPax: EditableField<number>;
  cantMaxPax: EditableField<number>;
  horaDesde: EditableField<string>;
  horaHasta: EditableField<string>;
  moneda: EditableField<Moneda>;
  observaciones: EditableField<string>;
  activo: EditableField<boolean>;
  operador?: string;
  fechaRegistro?: string;
  precios: PrecioTipoPaxVm[];
  expanded: boolean;
  loadingDetalle: boolean;
  detalleLoaded: boolean;
  saving: boolean;
  savingPrecios: boolean;
  error?: string;
  preciosError?: string;
  dirty: boolean;
}

export interface ReglasFiltroVm {
  codLstPrecio: string;
  codServicio?: string;
  tipoTarifa?: string | number;
  soloActivos?: boolean;
  pageNumber: number;
  pageSize: number;
}

export interface DetalleListaPrecioV2State {
  reglas: ReglaPrecioVm[];
  paginacion: PaginacionDto;
  loading: boolean;
  error?: string;
}

export interface ServicioResumenDto {
  CodServicio?: string;
  NomServicio?: string;
  DesServicio?: string;
  CodReceta?: string;
  NomReceta?: string;
  Descripcion?: string;
}
