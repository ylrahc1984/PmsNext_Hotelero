// Models para autenticación

export interface LoginRequest {
  usuario: string;
  clave: string;
  modulo: string;
  unidad: string;
  respuesta?: string;
}

export interface UsuarioInfo {
  usuario: string;
  nombre: string;
  modulo: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
  usuario: UsuarioInfo[];
}

export interface AuthToken {
  token: string;
  expiresAt?: number;
}
