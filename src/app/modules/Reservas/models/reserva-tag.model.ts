export interface ApiResponse<T> {
  datos: T;
  respuesta: string;
  exito: boolean;
  codigoHttp: number;
}

export interface ReservaTagCatalogo {
  idCategoria: number;
  categoria: string;
  descripcionCategoria: string | null;
  ordenCategoria: number;
  idTag: number;
  nombre: string;
  descripcion: string | null;
  color: string;
  icono: string | null;
  prioridad: number;
  esAlerta: boolean;
  permiteAsignacionManual: boolean;
  grupoExclusion: string | null;
  activo: boolean;
}

export interface ReservaTagResumen {
  idCategoria: number;
  categoria: string;
  ordenCategoria: number;
  idTag: number;
  nombre: string;
  descripcion: string | null;
  color: string;
  icono: string | null;
  prioridad: number;
  esAlerta: boolean;
  permiteAsignacionManual?: boolean;
  grupoExclusion?: string | null;
  tipoAsignacion?: 'MANUAL' | 'AUTOMATICO' | string;
  observacion?: string | null;
  idAsignacion?: number;
  codReserva?: string;
  origen?: string | null;
  fechaAsignacion?: string;
  operadorAsignacion?: string;
}

export interface ReservaTagAsignado extends ReservaTagResumen {
  idAsignacion: number;
  codReserva: string;
  tipoAsignacion: 'MANUAL' | 'AUTOMATICO' | string;
  origen: string | null;
  observacion: string | null;
  permiteAsignacionManual: boolean;
  grupoExclusion: string | null;
  fechaAsignacion: string;
  operadorAsignacion: string;
}

export interface ReservaTagBatchItem {
  idTag: number;
  observacion: string | null;
}

export interface GuardarReservaTagsBatchRequest {
  tags: ReservaTagBatchItem[];
}

export interface GuardarReservaTagsBatchResponse extends ApiResponse<ReservaTagAsignado[]> {
  tagsRecibidos: number;
  tagsInsertados: number;
}

export interface ReservaTagSeleccionado {
  tag: ReservaTagCatalogo;
  observacion: string | null;
}

export interface ReservaTagGrupo {
  idCategoria: number;
  categoria: string;
  descripcionCategoria: string | null;
  ordenCategoria: number;
  tags: ReservaTagCatalogo[];
}
