export interface TagCategory {
  idCategoria: number;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activo: boolean;
}

export interface TagCategoryRequest {
  nombre: string;
  descripcion: string | null;
  orden: number;
}
