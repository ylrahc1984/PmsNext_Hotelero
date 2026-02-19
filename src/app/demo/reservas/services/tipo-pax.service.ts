import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface TipoPaxDto {
  CR03_CodTipo: string;
  CR03_Descripcion: string;
  CR03_Orden: number;
  CR03_Operador: string;
}

export interface TipoPaxUI {
  code: string;
  label: string;
  orden: number;
}

@Injectable({
  providedIn: 'root'
})
export class TipoPaxService {
  private apiUrl = `${environment.apiUrl}/tipo-pax`;

  constructor(private http: HttpClient) {}

  getTiposPax(): Observable<TipoPaxUI[]> {
    return this.http.get<{ datos?: TipoPaxDto[] }>(this.apiUrl).pipe(
      map((response) => {
        const datos = response?.datos ?? [];
        return (datos ?? [])
          .map((item) => ({
            code: (item.CR03_CodTipo || '').trim().toUpperCase(),
            label: (item.CR03_Descripcion || '').trim(),
            orden: Number(item.CR03_Orden ?? 0) || 0
          }))
          .filter((item) => !!item.code)
          .sort((a, b) => a.orden - b.orden);
      })
    );
  }
}
