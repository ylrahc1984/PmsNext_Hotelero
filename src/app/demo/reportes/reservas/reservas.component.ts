// angular import
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbTypeaheadModule, NgbTypeaheadSelectItemEvent } from '@ng-bootstrap/ng-bootstrap';
import { OperatorFunction } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ReporteOperacionItem, ReservasReporteService } from './reservas-reporte.service';

type EstadoReserva = 'confirmada' | 'pendiente' | 'cancelada';

interface ReservaReporte {
  codigo: string;
  fecha: string;
  cliente: string;
  servicio: string;
  origen: string;
  destino: string;
  hora: string;
  pax: number;
  agencia: string;
  estado: EstadoReserva;
  total: number;
}

interface FiltrosReservaReporte {
  buscar: string;
  estado: 'todos' | EstadoReserva;
  agencia: string;
  desde: string;
  hasta: string;
}

@Component({
  selector: 'app-reservas-reporte',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule, NgbTypeaheadModule],
  templateUrl: './reservas.component.html',
  styleUrls: ['./reservas.component.scss']
})
export class ReservasComponent implements OnInit {
  private readonly reservasReporteService = inject(ReservasReporteService);

  reservas: ReservaReporte[] = [];

  filtros: FiltrosReservaReporte = {
    buscar: '',
    estado: 'todos',
    agencia: 'todos',
    desde: '',
    hasta: ''
  };

  agencias: string[] = [];
  agenciaSearchValue = '';

  page = 1;
  pageSize = 5;
  pageSizes = [5, 10, 20];

  readonly searchAgencias: OperatorFunction<string, readonly string[]> = (text$) =>
    text$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      map((term) => this.filterAgencias(term))
    );

  ngOnInit() {
    this.cargarReservas();
  }

  filteredReservas() {
    const texto = this.filtros.buscar.trim().toLowerCase();
    const estado = this.filtros.estado;
    const agencia = this.filtros.agencia;
    const desde = this.filtros.desde ? new Date(this.filtros.desde) : null;
    const hasta = this.filtros.hasta ? new Date(this.filtros.hasta) : null;

    return this.reservas.filter((r) => {
      const coincideTexto =
        !texto ||
        (r.codigo || '').toLowerCase().includes(texto) ||
        (r.cliente || '').toLowerCase().includes(texto) ||
        (r.servicio || '').toLowerCase().includes(texto);
      const coincideEstado = estado === 'todos' || r.estado === estado;
      const coincideAgencia = agencia === 'todos' || r.agencia === agencia;
      const fecha = new Date(r.fecha);
      const coincideDesde = !desde || fecha >= desde;
      const coincideHasta = !hasta || fecha <= hasta;
      return coincideTexto && coincideEstado && coincideAgencia && coincideDesde && coincideHasta;
    });
  }

  pagedReservas() {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredReservas().slice(start, start + this.pageSize);
  }

  totalPaginas() {
    return Math.max(1, Math.ceil(this.filteredReservas().length / this.pageSize));
  }

  totalFiltrado() {
    return this.filteredReservas().reduce((sum, r) => sum + r.total, 0);
  }

  changePage(delta: number) {
    const next = this.page + delta;
    this.page = Math.min(Math.max(next, 1), this.totalPaginas());
  }

  onPageSizeChange(size: number | string) {
    this.pageSize = Number(size) || 5;
    this.page = 1;
  }

  resetFiltros() {
    this.filtros = { buscar: '', estado: 'todos', agencia: 'todos', desde: '', hasta: '' };
    this.agenciaSearchValue = '';
    this.page = 1;
  }

  resetPagina() {
    this.page = 1;
  }

  getEstadoClase(estado: EstadoReserva) {
    switch (estado) {
      case 'confirmada':
        return 'estado-confirmada';
      case 'cancelada':
        return 'estado-cancelada';
      default:
        return 'estado-pendiente';
    }
  }

  exportarExcel() {
    console.log('Exportar reservas', this.filteredReservas());
  }

  imprimir() {
    window.print();
  }

  onAgenciaSelected(event: NgbTypeaheadSelectItemEvent): void {
    const agencia = (event.item ?? '').toString().trim();
    this.filtros.agencia = agencia || 'todos';
    this.agenciaSearchValue = agencia;
    this.resetPagina();
  }

  onAgenciaInputChange(value: string): void {
    const term = (value ?? '').toString();
    this.agenciaSearchValue = term;

    if (!term.trim()) {
      if (this.filtros.agencia !== 'todos') {
        this.filtros.agencia = 'todos';
        this.resetPagina();
      }
      return;
    }

    const exactMatch = this.findAgenciaExacta(term);
    if (exactMatch && this.filtros.agencia !== exactMatch) {
      this.filtros.agencia = exactMatch;
      this.resetPagina();
    }
  }

  onAgenciaBlur(): void {
    const term = this.agenciaSearchValue.trim();
    if (!term) {
      this.agenciaSearchValue = '';
      this.filtros.agencia = 'todos';
      return;
    }

    const exactMatch = this.findAgenciaExacta(term);
    if (exactMatch) {
      this.agenciaSearchValue = exactMatch;
      this.filtros.agencia = exactMatch;
      return;
    }

    this.syncAgenciaSearchValue();
  }

  private cargarReservas() {
    this.reservasReporteService.getTodasLasOperaciones().subscribe({
      next: (response) => {
        this.reservas = (response.datos ?? []).map((item) => this.mapReserva(item));
        this.agencias = this.getAgencias(this.reservas);
        if (!this.agencias.includes(this.filtros.agencia)) {
          this.filtros.agencia = 'todos';
        }
        this.syncAgenciaSearchValue();
        this.page = 1;
      },
      error: (error) => {
        console.error('No se pudo cargar el reporte de reservas.', error);
        this.reservas = [];
        this.agencias = [];
        this.agenciaSearchValue = '';
        this.page = 1;
      }
    });
  }

  private mapReserva(item: ReporteOperacionItem): ReservaReporte {
    return {
      codigo: (item.numeroReserva ?? '').toString().trim(),
      fecha: item.fecha,
      cliente: (item.cliente ?? '').toString().trim(),
      servicio: (item.servicio ?? '').toString().trim(),
      origen: (item.origen ?? '').toString().trim(),
      destino: (item.destino ?? '').toString().trim(),
      hora: (item.hora ?? '').toString().trim(),
      pax: Number(item.pax ?? 0),
      agencia: (item.agenciaOCliente ?? '').toString().trim(),
      estado: this.normalizarEstado(item.estado),
      total: Number(item.total ?? 0)
    };
  }

  private normalizarEstado(estado: string | null | undefined): EstadoReserva {
    const valor = (estado ?? '').toString().trim().toUpperCase();

    if (['CAN', 'ANU', 'CANCELADA', 'CANCELADO'].includes(valor)) {
      return 'cancelada';
    }

    if (['CON', 'CONF', 'CONFIRMADA', 'COM', 'COMPLETADA', 'ASI', 'ASIGNADA'].includes(valor)) {
      return 'confirmada';
    }

    return 'pendiente';
  }

  private getAgencias(reservas: ReservaReporte[]): string[] {
    return [...new Set(reservas.map((reserva) => reserva.agencia).filter((agencia) => !!agencia))]
      .sort((a, b) => a.localeCompare(b));
  }

  private filterAgencias(term: string): string[] {
    const query = this.normalizeText(term);
    const agencias = this.agencias ?? [];

    if (!query) {
      return agencias.slice(0, 20);
    }

    return agencias
      .filter((agencia) => this.normalizeText(agencia).includes(query))
      .slice(0, 20);
  }

  private findAgenciaExacta(value: string): string | null {
    const query = this.normalizeText(value);
    if (!query) return null;
    return this.agencias.find((agencia) => this.normalizeText(agencia) === query) ?? null;
  }

  private syncAgenciaSearchValue(): void {
    this.agenciaSearchValue = this.filtros.agencia === 'todos' ? '' : this.filtros.agencia;
  }

  private normalizeText(value: string | null | undefined): string {
    return (value ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
