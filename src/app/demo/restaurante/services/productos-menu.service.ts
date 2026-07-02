import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ProductoMenu } from '../interfaces/producto-menu.interface';

@Injectable({ providedIn: 'root' })
export class ProductosMenuService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl || 'http://localhost:5000/api';

  obtenerProductosPorCategoria(lista: string, categoria: string): Observable<ProductoMenu[]> {
    const params = new HttpParams().set('codLstPrecio', lista).set('codProducto', categoria);
    return this.http
      .get<ProductoMenu[] | { datos?: ProductoMenu[] }>(`${this.baseUrl}/detalle-lista-precio/categoria`, { params })
      .pipe(map((response) => (Array.isArray(response) ? response : response?.datos ?? [])));
  }
}
