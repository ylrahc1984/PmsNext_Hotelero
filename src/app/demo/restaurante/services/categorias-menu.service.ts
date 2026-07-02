import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CategoriaVisible } from '../interfaces/categoria-visible.interface';

@Injectable({ providedIn: 'root' })
export class CategoriasMenuService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl || 'http://localhost:5000/api';

  obtenerCategoriasVisibles(lista: string): Observable<CategoriaVisible[]> {
    const params = new HttpParams().set('lista', lista);
    return this.http.get<CategoriaVisible[] | { datos?: CategoriaVisible[] }>(`${this.baseUrl}/categoria/visibles`, { params }).pipe(
      map((response) => {
        const categorias = Array.isArray(response) ? response : response?.datos ?? [];
        return categorias.sort((a, b) => Number(a.MPV00_Orden ?? 0) - Number(b.MPV00_Orden ?? 0));
      })
    );
  }
}
