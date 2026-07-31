export type ModuleAccessStatus = 'idle' | 'loading' | 'loaded' | 'error';
export type ModuleAccessMode = 'any' | 'all';

export interface ModuleAccessApi {
  MA05_Modulo?: string;
  MA05_Usuario?: string;
  MA05_Operador?: string;
  MA03_Modulo?: string;
  MA03_Descripcion?: string;
  MA03_Orden?: number;
  MA03_Operador?: string;
}

export interface ModuleAccessState {
  status: ModuleAccessStatus;
  usuario: string;
  modules: ReadonlySet<string>;
  error: unknown | null;
}

