import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

import { ClienteService, SelectOption } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.service';
import { ClienteUI } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.models';
import { ListaPrecioService } from 'src/app/demo/catalogos/listas-precios/lista-precio.service';
import { PlanesTarifasService } from 'src/app/demo/catalogos/listas-precios/planes-tarifas.service';
import { Nationality } from '../../settings/nationalities/models/nationality.model';
import { NationalitiesService } from '../../settings/nationalities/services/nationalities.service';
import { PaxType } from '../../settings/pax-types/models/pax-type.model';
import { PaxTypesService } from '../../settings/pax-types/services/pax-types.service';
import { WalkInAgenciaOption, WalkInOption, WalkInRequest, WalkInTarifaOption } from '../models/walk-in.model';

@Injectable({ providedIn: 'root' })
export class WalkInService {
  private readonly clienteService = inject(ClienteService);
  private readonly nationalitiesService = inject(NationalitiesService);
  private readonly paxTypesService = inject(PaxTypesService);
  private readonly planesTarifasService = inject(PlanesTarifasService);
  private readonly listaPrecioService = inject(ListaPrecioService);

  private readonly demoAgencias: WalkInAgenciaOption[] = [
    { codigo: 'DIR', descripcion: 'Directos en Recepcion', email: '' },
    { codigo: 'WEB', descripcion: 'Web PMSNext', email: 'reservas@pmsnext.demo' },
    { codigo: 'EXP', descripcion: 'Expedia', email: '' },
    { codigo: 'BKG', descripcion: 'Booking.com', email: '' },
    { codigo: 'CORP', descripcion: 'Convenio Corporativo', email: 'corporativo@pmsnext.demo' }
  ];

  private readonly demoPlanes: WalkInOption[] = [
    { codigo: 'SIN', descripcion: 'Sin Plan de alimentacion' },
    { codigo: 'DES', descripcion: 'Desayuno incluido' },
    { codigo: 'MP', descripcion: 'Media Pension' },
    { codigo: 'PC', descripcion: 'Pension completa' }
  ];

  private readonly demoTarifas: WalkInTarifaOption[] = [
    { codigo: 'BAR-STD', descripcion: 'Tarifa Rack Standard', moneda: 'USD', tarifaNoche: 95 },
    { codigo: 'BAR-FLEX', descripcion: 'Tarifa Flexible Recepcion', moneda: 'USD', tarifaNoche: 120 },
    { codigo: 'CORP-CRC', descripcion: 'Tarifa Corporativa Local', moneda: 'CRC', tarifaNoche: 58000 }
  ];

  createWalkIn(request: WalkInRequest): Observable<{ respuesta?: string }> {
    console.log('[WalkInService] createWalkIn preparado', request);
    return of({ respuesta: 'Walk In preparado localmente.' });
  }

  getTiposDocumento(): Observable<WalkInOption[]> {
    return this.clienteService
      .getTipoIdentificacionOptions()
      .pipe(map((options: SelectOption[]) => options.map((item) => ({ codigo: String(item.value), descripcion: item.label }))));
  }

  getNacionalidades(): Observable<Nationality[]> {
    return this.nationalitiesService.getNationalities();
  }

  getTiposPax(): Observable<PaxType[]> {
    return this.paxTypesService.getPaxTypes();
  }

  getPlanes(): Observable<WalkInOption[]> {
    return this.planesTarifasService
      .getPlanesTarifas(1, 100)
      .pipe(
        map((planes) => {
          const mappedPlanes = planes.map((plan) => ({ codigo: String(plan.planId), descripcion: plan.nombrePlan }));
          return mappedPlanes.length > 0 ? mappedPlanes : this.demoPlanes;
        }),
        catchError(() => of(this.demoPlanes))
      );
  }

  searchAgencias(term: string): Observable<WalkInAgenciaOption[]> {
    const sanitizedTerm = term.trim();
    if (sanitizedTerm.length < 2) {
      return of(this.demoAgencias);
    }

    return this.clienteService.getClientes(1, 10, sanitizedTerm).pipe(
      map((response) =>
        this.mergeAgenciasDemo(
          response.data.map((cliente: ClienteUI) => ({
          codigo: cliente.codigo,
          descripcion: cliente.contacto || cliente.nombre || cliente.codigo,
          email: cliente.email || cliente.emailPrincipal
          })),
          sanitizedTerm
        )
      ),
      catchError(() => of(this.filterAgenciasDemo(sanitizedTerm)))
    );
  }

  searchTarifas(term: string): Observable<WalkInTarifaOption[]> {
    const sanitizedTerm = term.trim();
    if (sanitizedTerm.length < 2) {
      return of(this.demoTarifas);
    }

    return this.listaPrecioService.getListas({ descripcion: sanitizedTerm, pageNumber: 1, pageSize: 10 }).pipe(
      map((response) =>
        this.mergeTarifasDemo(
          response.data.map((tarifa) => ({
          codigo: tarifa.codigo,
          descripcion: tarifa.descripcion || tarifa.codigo,
          moneda: tarifa.moneda || 'USD',
          tarifaNoche: 0
          })),
          sanitizedTerm
        )
      ),
      catchError(() => of(this.filterTarifasDemo(sanitizedTerm)))
    );
  }

  getDemoAgenciaPrincipal(): WalkInAgenciaOption {
    return this.demoAgencias[0];
  }

  getDemoTarifas(): WalkInTarifaOption[] {
    return this.demoTarifas;
  }

  private mergeAgenciasDemo(items: WalkInAgenciaOption[], term: string): WalkInAgenciaOption[] {
    const merged = [...this.filterAgenciasDemo(term), ...items];
    return merged.filter((item, index, list) => list.findIndex((candidate) => candidate.codigo === item.codigo) === index).slice(0, 8);
  }

  private mergeTarifasDemo(items: WalkInTarifaOption[], term: string): WalkInTarifaOption[] {
    const remoteWithPrice = items.filter((item) => item.tarifaNoche > 0);
    const merged = [...this.filterTarifasDemo(term), ...remoteWithPrice];
    return merged.filter((item, index, list) => list.findIndex((candidate) => candidate.codigo === item.codigo) === index).slice(0, 8);
  }

  private filterAgenciasDemo(term: string): WalkInAgenciaOption[] {
    const normalizedTerm = term.toLowerCase();
    return this.demoAgencias.filter((item) => `${item.codigo} ${item.descripcion}`.toLowerCase().includes(normalizedTerm));
  }

  private filterTarifasDemo(term: string): WalkInTarifaOption[] {
    const normalizedTerm = term.toLowerCase();
    return this.demoTarifas.filter((item) => `${item.codigo} ${item.descripcion}`.toLowerCase().includes(normalizedTerm));
  }
}
