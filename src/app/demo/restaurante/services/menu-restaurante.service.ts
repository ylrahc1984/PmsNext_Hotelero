import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CategoriaVisible, ProductoMenu } from '../interfaces/menu-restaurante.interface';

@Injectable({ providedIn: 'root' })
export class MenuRestauranteService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl || 'http://localhost:5000/api';

  obtenerCategoriasVisibles(lista: string): Observable<CategoriaVisible[]> {
    const params = new HttpParams().set('lista', lista);
    return this.http.get<CategoriaVisible[] | { datos?: CategoriaVisible[] }>(`${this.baseUrl}/categoria/visibles`, { params }).pipe(
      map((response) => this.unwrapArray(response).sort((a, b) => Number(a.MPV00_Orden ?? 0) - Number(b.MPV00_Orden ?? 0)))
    );
  }

  obtenerProductosPorCategoria(lista: string, categoria: string): Observable<ProductoMenu[]> {
    const params = new HttpParams().set('codLstPrecio', lista).set('codProducto', categoria);
    return this.http
      .get<ProductoMenu[] | { datos?: ProductoMenu[] }>(`${this.baseUrl}/detalle-lista-precio/categoria`, { params })
      .pipe(map((response) => this.unwrapArray(response)));
  }

  private unwrapArray<T>(response: T[] | { datos?: T[] } | null | undefined): T[] {
    return Array.isArray(response) ? response : response?.datos ?? [];
  }
}
