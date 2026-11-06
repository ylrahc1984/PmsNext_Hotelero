export interface TipoSolicitudCatalogo {
  idTipoSolicitud: number; nombre: string; descripcion: string | null; nombreEN: string | null;
  descripcionEN: string | null; area: string; icono: string | null; orden: number;
  permiteCantidad: boolean; requiereComentario: boolean; activo: boolean;
}
export interface TipoSolicitudCatalogoGuardar {
  nombre: string; descripcion: string | null; nombreEN: string | null; descripcionEN: string | null;
  area: string; icono: string | null; orden: number; permiteCantidad: boolean; requiereComentario: boolean;
}
export interface TipoSolicitudCatalogoEstado { activo: boolean; }
export interface ConciergeApiResponse<T> { success: boolean; message: string; data: T; }
