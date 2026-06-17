export interface PuntoVentaUsuario {
  MPV12_CodUsuario: string;
  MPV12_PntVenta: string;
  MPV12_DesPntventa: string;
  MPV12_Activo: number;
}

export interface SelectedPointOfSale {
  codigo: string;
  descripcion: string;
}

export interface UbicacionMesasResponse {
  datos: UbicacionMesa[];
}

export interface UbicacionMesa {
  MPV09_CodUbicacion: string;
  MPV09_CodPntVenta: string;
  MPV09_Descripcion: string;
  MPV09_TotMesas: number;
  MPV09_Activo: string;
  MPV09_Orden: number;
  MPV09_Operador: string;
}

export type MesaEstado = 'LIBRE' | 'OCUPADA' | 'CUENTA' | 'RESERVADA' | 'LIMPIEZA';

export interface MesaVisual {
  numero: number;
  nombre: string;
  estado: MesaEstado;
  personas?: number;
  consumo?: number;
  horaReserva?: string;
}
