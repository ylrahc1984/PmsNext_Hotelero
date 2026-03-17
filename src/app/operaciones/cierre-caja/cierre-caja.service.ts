import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import {
  CierreCajaEstado,
  CierreCajaLinea,
  CierreCajaListFilters,
  CierreCajaRecord,
  CierreCajaUpsertInput
} from './models/cierre-caja.model';

@Injectable({ providedIn: 'root' })
export class CierreCajaService {
  private readonly storageKey = 'ope_cierre_caja_records_v1';

  list(filters?: CierreCajaListFilters): Observable<CierreCajaRecord[]> {
    const normalized = this.readAll()
      .filter((item) => this.matchesFilters(item, filters))
      .sort((a, b) => `${b.fecha} ${b.horaApertura}`.localeCompare(`${a.fecha} ${a.horaApertura}`));

    return of(normalized);
  }

  getById(id: string): Observable<CierreCajaRecord | null> {
    const match = this.readAll().find((item) => item.id === id) ?? null;
    return of(match);
  }

  findOpenByUsuario(usuario: string): Observable<CierreCajaRecord | null> {
    const normalizedUsuario = this.cleanText(usuario).toUpperCase();
    const match =
      this.readAll().find(
        (item) => item.estado === 'ABIERTO' && this.cleanText(item.usuario).toUpperCase() === normalizedUsuario
      ) ?? null;
    return of(match);
  }

  create(input: CierreCajaUpsertInput): Observable<CierreCajaRecord> {
    const records = this.readAll();
    const now = new Date().toISOString();
    const record = this.normalizeRecord({
      id: this.buildId(),
      usuario: input.usuario,
      operador: input.operador,
      pntVenta: input.pntVenta,
      caja: input.caja,
      turno: input.turno,
      fecha: input.fecha,
      horaApertura: input.horaApertura,
      horaCierre: input.horaCierre ?? '',
      montoApertura: input.montoApertura,
      estado: input.estado ?? 'ABIERTO',
      observaciones: input.observaciones ?? '',
      lineas: input.lineas ?? [],
      totalSistema: 0,
      totalDeclarado: 0,
      diferenciaTotal: 0,
      createdAt: now,
      updatedAt: now
    });

    records.push(record);
    this.writeAll(records);
    return of(record);
  }

  update(id: string, input: CierreCajaUpsertInput): Observable<CierreCajaRecord> {
    const records = this.readAll();
    const index = records.findIndex((item) => item.id === id);
    if (index < 0) {
      throw new Error('No se encontró el cierre de caja.');
    }

    const current = records[index];
    const record = this.normalizeRecord({
      ...current,
      usuario: input.usuario,
      operador: input.operador,
      pntVenta: input.pntVenta,
      caja: input.caja,
      turno: input.turno,
      fecha: input.fecha,
      horaApertura: input.horaApertura,
      horaCierre: input.horaCierre ?? current.horaCierre,
      montoApertura: input.montoApertura,
      estado: input.estado ?? current.estado,
      observaciones: input.observaciones ?? '',
      lineas: input.lineas ?? [],
      updatedAt: new Date().toISOString()
    });

    records[index] = record;
    this.writeAll(records);
    return of(record);
  }

  close(id: string, input: CierreCajaUpsertInput): Observable<CierreCajaRecord> {
    return this.update(id, { ...input, estado: 'CERRADO' satisfies CierreCajaEstado });
  }

  private matchesFilters(item: CierreCajaRecord, filters?: CierreCajaListFilters): boolean {
    if (!filters) {
      return true;
    }

    const fecha = this.cleanText(filters.fecha);
    const estado = this.cleanText(filters.estado).toUpperCase();
    const pntVenta = this.cleanText(filters.pntVenta).toUpperCase();
    const usuario = this.cleanText(filters.usuario).toUpperCase();

    if (fecha && item.fecha !== fecha) {
      return false;
    }
    if (estado && item.estado !== estado) {
      return false;
    }
    if (pntVenta && this.cleanText(item.pntVenta).toUpperCase() !== pntVenta) {
      return false;
    }
    if (usuario && this.cleanText(item.usuario).toUpperCase() !== usuario) {
      return false;
    }
    return true;
  }

  private normalizeRecord(record: CierreCajaRecord): CierreCajaRecord {
    const lineas = (record.lineas ?? []).map((item, index) => this.normalizeLinea(item, index + 1));
    const totalSistema = this.round(lineas.reduce((sum, item) => sum + item.montoSistema, 0));
    const totalDeclarado = this.round(lineas.reduce((sum, item) => sum + item.montoDeclarado, 0));

    return {
      ...record,
      usuario: this.cleanText(record.usuario),
      operador: this.cleanText(record.operador),
      pntVenta: this.cleanText(record.pntVenta),
      caja: this.cleanText(record.caja),
      turno: this.cleanText(record.turno),
      fecha: this.cleanText(record.fecha),
      horaApertura: this.cleanText(record.horaApertura),
      horaCierre: this.cleanText(record.horaCierre),
      observaciones: this.cleanText(record.observaciones),
      montoApertura: this.toNumber(record.montoApertura),
      lineas,
      totalSistema,
      totalDeclarado,
      diferenciaTotal: this.round(totalDeclarado - totalSistema)
    };
  }

  private normalizeLinea(linea: CierreCajaLinea, orden: number): CierreCajaLinea {
    const montoSistema = this.toNumber(linea.montoSistema);
    const montoDeclarado = this.toNumber(linea.montoDeclarado);
    return {
      orden,
      frmPago: this.cleanText(linea.frmPago),
      descripcion: this.cleanText(linea.descripcion),
      tipoPago: this.cleanText(linea.tipoPago),
      montoSistema,
      montoDeclarado,
      diferencia: this.round(montoDeclarado - montoSistema)
    };
  }

  private readAll(): CierreCajaRecord[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as CierreCajaRecord[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map((item) => this.normalizeRecord(item));
    } catch {
      return [];
    }
  }

  private writeAll(records: CierreCajaRecord[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(this.storageKey, JSON.stringify(records.map((item) => this.normalizeRecord(item))));
  }

  private buildId(): string {
    return `CC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  private cleanText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private round(value: number): number {
    return Math.round((this.toNumber(value) + Number.EPSILON) * 100) / 100;
  }
}
