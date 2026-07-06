import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { EMPTY, catchError, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { WalkInAgenciaOption } from 'src/app/modules/front-desk/walk-in/models/walk-in.model';
import { WalkInService } from 'src/app/modules/front-desk/walk-in/services/walk-in.service';
import { ReservaConsulta, ReservaFiltro } from '../models/reserva-consulta.model';
import { ReservaHabitacionService } from '../services/reserva-habitacion.service';

interface ConsultaReservasFilterForm {
  fechaInicio: FormControl<string>;
  fechaFinal: FormControl<string>;
  agencia: FormControl<string>;
  estado: FormControl<string>;
}

interface EstadoReservaOption {
  valor: string;
  etiqueta: string;
}

@Component({
  selector: 'app-consulta-reservas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule, DatePipe],
  templateUrl: './consulta-reservas.component.html',
  styleUrls: ['./consulta-reservas.component.scss']
})
export class ConsultaReservasComponent implements OnInit {
  private readonly quickSearchMinLength = 4;

  readonly estados: EstadoReservaOption[] = [
    { valor: 'ABI', etiqueta: 'Abierta' },
    { valor: 'CON', etiqueta: 'Confirmada' },
    { valor: 'IN', etiqueta: 'Check In' },
    { valor: 'OUT', etiqueta: 'Check Out' },
    { valor: 'ANU', etiqueta: 'Cancelada' }
  ];

  readonly pageSizeOptions = [10, 15, 20];
  readonly pageSize = signal(10);
  readonly currentPage = signal(1);
  readonly totalRecords = signal(0);
  readonly totalPages = signal(1);
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly filtro = signal<ReservaFiltro>({
    fechaInicio: '',
    fechaFinal: '',
    agencia: '',
    estado: '',
    busqueda: ''
  });

  readonly filterForm: FormGroup<ConsultaReservasFilterForm>;
  readonly agenciaSearchControl = this.fb.control('');
  readonly quickSearchControl = this.fb.control('');
  readonly reservas = signal<ReservaConsulta[]>([]);
  readonly pagedReservas = this.reservas.asReadonly();
  agenciaSuggestions: WalkInAgenciaOption[] = [];
  agenciaSearchOpen = false;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly router: Router,
    private readonly reservaService: ReservaHabitacionService,
    private readonly catalogService: WalkInService,
    private readonly destroyRef: DestroyRef
  ) {
    const { inicio, salida } = this.defaultDateRange();
    this.filterForm = this.fb.group({
      fechaInicio: this.fb.control(inicio),
      fechaFinal: this.fb.control(salida),
      agencia: this.fb.control(''),
      estado: this.fb.control('')
    });

    this.filtro.set({
      fechaInicio: inicio,
      fechaFinal: salida,
      agencia: '',
      estado: '',
      busqueda: ''
    });
  }

  ngOnInit(): void {
    this.buscar();
    this.quickSearchControl.valueChanges.pipe(debounceTime(700), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.buscarDesdeBusquedaRapida());
    this.bindAgenciaSearch();
  }

  nuevaReserva(): void {
    void this.router.navigate(['/reservas/nueva-hospedaje']);
  }

  buscar(): void {
    const formValue = this.filterForm.getRawValue();
    this.filtro.set({
      ...formValue,
      agencia: this.getAgenciaFilterCode(),
      busqueda: this.quickSearchControl.value
    });
    this.currentPage.set(1);
    this.loadReservas();
  }

  buscarDesdeBusquedaRapida(): void {
    const term = this.quickSearchControl.value.trim();
    if (term.length > 0 && term.length < this.quickSearchMinLength) {
      return;
    }

    this.buscar();
  }

  limpiar(): void {
    const { inicio, salida } = this.defaultDateRange();
    this.filterForm.reset({ fechaInicio: inicio, fechaFinal: salida, agencia: '', estado: '' });
    this.agenciaSearchControl.setValue('', { emitEvent: false });
    this.agenciaSuggestions = [];
    this.agenciaSearchOpen = false;
    this.quickSearchControl.setValue('', { emitEvent: false });
    this.filtro.set({ fechaInicio: inicio, fechaFinal: salida, agencia: '', estado: '', busqueda: '' });
    this.currentPage.set(1);
    this.loadReservas();
  }

  actualizar(): void {
    this.loadReservas();
  }

  exportar(): void {
    const csv = this.reservas()
      .map((r) => `${r.reserva},${r.agencia},${r.ingreso},${r.salida},${r.estado},${r.total}`)
      .join('\n');
    console.info('Export reservas\n' + csv);
  }

  setPageSize(value: string): void {
    this.pageSize.set(Number(value) || 5);
    this.currentPage.set(1);
    this.loadReservas();
  }

  goToPage(page: number): void {
    const normalizedPage = Math.min(Math.max(page, 1), Math.max(this.totalPages(), 1));
    if (normalizedPage === this.currentPage()) {
      return;
    }

    this.currentPage.set(normalizedPage);
    this.loadReservas();
  }

  statusClass(estado: string): string {
    const classes: Record<string, string> = {
      ABI: 'bg-primary-subtle text-primary border-primary-subtle',
      CON: 'bg-success-subtle text-success border-success-subtle',
      IN: 'bg-primary-subtle text-primary border-primary-subtle',
      OUT: 'bg-secondary-subtle text-secondary border-secondary-subtle',
      ANU: 'bg-danger-subtle text-danger border-danger-subtle',
      Pendiente: 'bg-warning-subtle text-warning border-warning-subtle',
      Confirmada: 'bg-success-subtle text-success border-success-subtle',
      'Check In': 'bg-primary-subtle text-primary border-primary-subtle',
      'Check Out': 'bg-secondary-subtle text-secondary border-secondary-subtle',
      Cancelada: 'bg-danger-subtle text-danger border-danger-subtle'
    };

    return classes[estado] ?? 'bg-light text-dark border-light';
  }

  estadoLabel(estado: string): string {
    return this.estados.find((item) => item.valor === estado)?.etiqueta ?? estado;
  }

  openAgenciaSuggestions(): void {
    this.catalogService
      .searchAgencias(this.getCurrentAgencySearchTerm())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        this.agenciaSuggestions = items;
        this.agenciaSearchOpen = items.length > 0;
      });
  }

  selectAgencia(agencia: WalkInAgenciaOption): void {
    this.filterForm.controls.agencia.setValue(agencia.codigo, { emitEvent: false });
    this.agenciaSearchControl.setValue(this.buildAgenciaLabel(agencia), { emitEvent: false });
    this.agenciaSuggestions = [];
    this.agenciaSearchOpen = false;
  }

  trackByReserva(_: number, reserva: ReservaConsulta): string {
    return reserva.reserva;
  }

  trackByCode(_: number, item: { codigo?: string }): string {
    return item.codigo ?? '';
  }

  private loadReservas(): void {
    const filtro = this.filtro();
    const fechaInicio = this.normalizeDateForApi(filtro.fechaInicio);
    const fechaFinal = this.normalizeDateForApi(filtro.fechaFinal);

    if (!fechaInicio || !fechaFinal) {
      this.errorMessage.set('Ingrese Fecha Inicio y Fecha Final en formato dd/MM/yyyy.');
      this.reservas.set([]);
      this.totalRecords.set(0);
      this.totalPages.set(1);
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.reservaService
      .consultarReservas({
        fecIngreso: fechaInicio,
        fecSalida: fechaFinal,
        pagina: this.currentPage(),
        tamanoPagina: this.pageSize(),
        agencia: filtro.agencia,
        estado: filtro.estado,
        busqueda: filtro.busqueda
      })
      .pipe(
        catchError((error) => {
          console.error('No se pudieron consultar las reservas.', error);
          this.errorMessage.set('No se pudieron consultar las reservas.');
          this.reservas.set([]);
          this.totalRecords.set(0);
          this.totalPages.set(1);
          return EMPTY;
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe((response) => {
        this.reservas.set(response.reservas);
        this.totalRecords.set(response.totalRegistros || response.reservas.length);
        this.currentPage.set(response.paginaActual || this.currentPage());
        this.pageSize.set(response.tamanoPagina || this.pageSize());
        this.totalPages.set(Math.max(response.totalPaginas || 1, 1));
      });
  }

  private defaultDateRange(): { inicio: string; salida: string } {
    const today = new Date();
    const salida = new Date(today);
    salida.setDate(today.getDate() + 2);

    return {
      inicio: this.formatDateForInput(today),
      salida: this.formatDateForInput(salida)
    };
  }

  private normalizeDateForApi(value: string): string {
    const text = value.trim();
    if (!text) {
      return '';
    }

    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (isoMatch) {
      return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }

    const apiMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
    return apiMatch ? text : '';
  }

  private formatDateForInput(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  }

  private bindAgenciaSearch(): void {
    this.agenciaSearchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => this.catalogService.searchAgencias(term)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((items) => {
        this.clearAgencyCodeIfTypedManually();
        this.agenciaSuggestions = items;
        this.agenciaSearchOpen = items.length > 0;
      });
  }

  private clearAgencyCodeIfTypedManually(): void {
    const codigo = this.filterForm.controls.agencia.value.trim();
    const label = this.agenciaSearchControl.value.trim();
    if (codigo && !label.startsWith(`${codigo} -`)) {
      this.filterForm.controls.agencia.setValue('', { emitEvent: false });
    }
  }

  private getCurrentAgencySearchTerm(): string {
    const value = this.agenciaSearchControl.value.trim();
    const code = this.filterForm.controls.agencia.value.trim();
    return code && value.startsWith(`${code} -`) ? value.slice(`${code} -`.length).trim() : value;
  }

  private getAgenciaFilterCode(): string {
    const selectedCode = this.filterForm.controls.agencia.value.trim();
    if (selectedCode) {
      return selectedCode;
    }

    const typedValue = this.agenciaSearchControl.value.trim();
    const codeCandidate = typedValue.split(' - ')[0]?.trim() ?? '';
    return /^[a-zA-Z0-9_-]+$/.test(codeCandidate) ? codeCandidate : '';
  }

  private buildAgenciaLabel(agencia: WalkInAgenciaOption): string {
    return [agencia.codigo, agencia.descripcion].filter(Boolean).join(' - ');
  }

}
