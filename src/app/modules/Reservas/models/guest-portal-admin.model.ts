export interface GuestPortalStay {
  idPreCheckIn: number;
  idDesglose: string;
  orden: number;
  categoriaHabitacion: string;
  tipoHabitacion: string;
  fechaIngreso: string;
  fechaSalida: string;
  numPax: number;
  numChild: number;
  estado: string;
  fechaInicio: string | null;
  fechaCompletado: string | null;
  fechaExpiracion: string | null;
}

export interface GuestPortal {
  idPortal: number;
  estado: string;
  fechaHabilitacion: string;
  fechaExpiracion: string;
  fechaPrimerAcceso: string | null;
  fechaUltimoAcceso: string | null;
  cantidadAccesos: number | null;
  fechaCreacion: string;
}

export interface GuestPortalStatusResponse {
  success: boolean;
  message: string;
  data: {
    hasPortal: boolean;
    portal: GuestPortal | null;
    stays: GuestPortalStay[];
  };
}

export interface GuestPortalEnableResponse {
  success: boolean;
  message: string;
  data: {
    portal: GuestPortal;
    access: {
      url: string;
    };
  };
}

export interface GuestPortalRegenerateResponse {
  success: boolean;
  message: string;
  data: {
    access: {
      url: string;
    };
  };
}
