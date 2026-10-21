export interface Tag {
  idTag: number;
  idCategoria: number;
  nombre: string;
  descripcion: string | null;
  color: string;
  icono: string | null;
  prioridad: number;
  esAlerta: boolean;
  permiteManual: boolean;
  activo: boolean;
  grupoExclusion: string | null;
  categoria?: string | null;
}

export interface TagRequest {
  idCategoria: number;
  nombre: string;
  descripcion: string | null;
  color: string;
  icono: string | null;
  prioridad: number;
  esAlerta: boolean;
  permiteManual: boolean;
  grupoExclusion: string | null;
  activo: boolean;
}
