import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from 'src/app/core/services/auth.service';
import { environment } from 'src/environments/environment';
import { TarifaClienteDto, TarifaClientePost, TarifaClienteUI } from './tarifas-cliente.models';

@Injectable({
  providedIn: 'root'
})
export class TarifasClienteService {
  private apiUrl = `${environment.apiUrl}/tarifas-cliente`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getAsignaciones(codCliente?: string, codTari?: string): Observable<TarifaClienteUI[]> {
    let params = new HttpParams();
    if (codCliente) {
      params = params.set('codCliente', codCliente);
    }
    if (codTari) {
      params = params.set('codTari', codTari);
    }
    return this.http.get<TarifaClienteDto[] | { datos?: TarifaClienteDto[] }>(this.apiUrl, { params }).pipe(
      map((response) => {
        const dataArray = Array.isArray(response) ? response : (response?.datos ?? []);
        return (dataArray ?? []).map((item) => this.mapFromApi(item));
      })
    );
  }

  createAsignacion(codCliente: string, codTari: string): Observable<{ respuesta?: string }> {
    const payload = this.buildPayload(0, 0, codCliente, codTari);
    return this.http
      .post(this.apiUrl, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  updateAsignacion(id: number, codCliente: string, codTari: string): Observable<{ respuesta?: string }> {
    const payload = this.buildPayload(0, id, codCliente, codTari);
    return this.http
      .put(`${this.apiUrl}/${id}`, payload, { responseType: 'text' })
      .pipe(map((response) => this.parseTextResponse(response)));
  }

  deleteAsignacion(id: number): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/${id}`, { responseType: 'text' });
  }

  private buildPayload(accion: number, id: number, codCliente: string, codTari: string): TarifaClientePost {
    return {
      accion,
      cpV03_IdTarxCliente: id,
      cpV03_CodCliente: codCliente,
      cpV03_CodTari: codTari,
      cpV03_Usuario: this.getOperador()
    };
  }

  private mapFromApi(apiData: TarifaClienteDto): TarifaClienteUI {
    const normalized = this.normalizeRecord(apiData as Record<string, unknown>);
    return {
      id: this.normalizeNumber(normalized['cpv03_idtarxcliente'] ?? normalized['id'] ?? normalized['cpv03_id'] ?? 0),
      codCliente: this.normalizeString(normalized['cpv03_codcliente'] ?? normalized['codcliente'] ?? normalized['cod_cliente'] ?? ''),
      codTari: this.normalizeString(normalized['cpv03_codtari'] ?? normalized['codtari'] ?? normalized['cod_tari'] ?? ''),
      usuario: this.normalizeString(normalized['cpv03_usuario'] ?? normalized['usuario'] ?? '')
    };
  }

  private normalizeRecord(value: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};
    Object.entries(value ?? {}).forEach(([key, val]) => {
      normalized[key.toLowerCase()] = val;
    });
    return normalized;
  }

  private normalizeString(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
    return '';
  }

  private normalizeNumber(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private parseTextResponse(response: string): { respuesta?: string } {
    if (!response) {
      return {};
    }
    const trimmed = response.trim();
    if (!trimmed) {
      return {};
    }
    try {
      return JSON.parse(trimmed) as { respuesta?: string };
    } catch {
      return { respuesta: trimmed };
    }
  }

  private getOperador(): string {
    return this.auth.getCurrentUser()?.usuario ?? '';
  }
}
