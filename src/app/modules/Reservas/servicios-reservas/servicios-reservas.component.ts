import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import Swal from 'sweetalert2';

import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { addPmsCalendarDays, normalizePmsDateDDMMYYYY, parsePmsDate, toPmsDateInputValue } from 'src/app/core/utils/pms-date.util';
import { AgenciaServicioOption, ReporteArribosResponse, ReservaServicios, ResumenMonedaServicios, ServicioReserva } from '../models/reporte-arribos.model';
import { ReporteArribosService } from '../services/reporte-arribos.service';

interface ServiciosReservasFilterForm {
  fechaIngreso: FormControl<string>;
  fechaSalida: FormControl<string>;
}

@Component({
  selector: 'app-servicios-reservas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './servicios-reservas.component.html',
  styleUrls: ['./servicios-reservas.component.scss']
})
export class ServiciosReservasComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly reporteService = inject(ReporteArribosService);
  private readonly operationalDateService = inject(OperationalDateService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly hasSearched = signal(false);
  readonly dateRangeError = signal('');
  readonly reservas = signal<ReservaServicios[]>([]);
  readonly expandedReservaIds = signal<ReadonlySet<string>>(new Set());
  readonly agenciasSeleccionadas = signal<ReadonlySet<string>>(new Set());
  readonly seleccionAgenciasActiva = signal(false);
  readonly agenciaFiltroAbierto = signal(false);
  readonly centroCostoSeleccionado = signal('');
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [10, 25, 50];

  readonly filterForm: FormGroup<ServiciosReservasFilterForm>;
  readonly agencias = computed<AgenciaServicioOption[]>(() => {
    const unique = new Map<string, string>();
    for (const reserva of this.reservas()) {
      const id = this.text(reserva.agenciaId);
      if (!id) continue;
      const name = this.text(reserva.nombreAgencia) || id;
      if (!unique.has(id)) unique.set(id, name);
    }
    return Array.from(unique, ([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  });
  readonly centrosCosto = computed<string[]>(() => {
    const unique = new Set<string>();
    for (const reserva of this.reservas()) {
      for (const servicio of reserva.servicios ?? []) {
        const code = this.normalizeCode(servicio.centroCosto);
        if (code) unique.add(code);
      }
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  });
  readonly filteredReservas = computed(() => {
    const agencyIds = this.agenciasSeleccionadas();
    const costCenter = this.normalizeCode(this.centroCostoSeleccionado());
    return this.reservas()
      .filter((reserva) => !this.seleccionAgenciasActiva() || agencyIds.has(this.text(reserva.agenciaId)))
      .filter((reserva) => !costCenter || (reserva.servicios ?? []).some((servicio) => this.normalizeCode(servicio.centroCosto) === costCenter));
  });
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredReservas().length / this.pageSize())));
  readonly pageReservas = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredReservas().slice(start, start + this.pageSize());
  });
  readonly indicadores = computed(() => {
    const reservas = this.filteredReservas();
    return {
      reservas: reservas.length,
      huespedes: reservas.reduce((total, reserva) => total + this.nonNegativeNumber(reserva.totalHuespedes), 0),
      conServicios: reservas.filter((reserva) => (reserva.servicios ?? []).length > 0).length,
      conAlimentacion: reservas.filter((reserva) => (reserva.servicios ?? []).some((servicio) => this.normalizeCode(servicio.centroCosto) === 'ALIMEN')).length
    };
  });
  resumenMonedas(reserva: ReservaServicios): ResumenMonedaServicios[] {
    const totals = new Map<string, { total: number; registros: number }>();
    for (const servicio of reserva.servicios ?? []) {
      if (servicio.total === null || servicio.total === undefined || !Number.isFinite(Number(servicio.total))) continue;
      const currency = this.text(servicio.moneda).toUpperCase() || 'Sin moneda';
      const current = totals.get(currency) ?? { total: 0, registros: 0 };
      current.total += Number(servicio.total);
      current.registros += 1;
      totals.set(currency, current);
    }
    return Array.from(totals, ([moneda, value]) => ({ moneda, total: value.total, registrosConTotal: value.registros }));
  }

  constructor() {
    const operationalDate = parsePmsDate(this.operationalDateService.operationalDate()) ?? this.todayLocal();
    const endDate = addPmsCalendarDays(operationalDate, 7) ?? operationalDate;
    this.filterForm = this.fb.group({
      fechaIngreso: this.fb.control(toPmsDateInputValue(operationalDate), Validators.required),
      fechaSalida: this.fb.control(toPmsDateInputValue(endDate), Validators.required)
    });
  }

  buscar(): void {
    if (this.loading()) return;
    this.dateRangeError.set('');
    this.filterForm.markAllAsTouched();
    if (this.filterForm.invalid) return;

    const { fechaIngreso, fechaSalida } = this.filterForm.getRawValue();
    const ingreso = normalizePmsDateDDMMYYYY(fechaIngreso);
    const salida = normalizePmsDateDDMMYYYY(fechaSalida);
    if (!ingreso || !salida) {
      this.dateRangeError.set('Ingrese fechas válidas para realizar la consulta.');
      return;
    }
    if (fechaIngreso > fechaSalida) {
      this.dateRangeError.set('La fecha de salida no puede ser anterior a la fecha de ingreso.');
      return;
    }

    this.loading.set(true);
    this.hasSearched.set(true);
    this.reservas.set([]);
    this.expandedReservaIds.set(new Set());
    this.agenciasSeleccionadas.set(new Set());
    this.seleccionAgenciasActiva.set(false);
    this.agenciaFiltroAbierto.set(false);
    this.centroCostoSeleccionado.set('');
    this.currentPage.set(1);

    this.reporteService.consultar({ fechaIngreso: ingreso, fechaSalida: salida })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response: ReporteArribosResponse) => this.handleResponse(response),
        error: (error: HttpErrorResponse) => {
          this.reservas.set([]);
          this.expandedReservaIds.set(new Set());
          void Swal.fire({
            title: 'Error de consulta',
            text: 'No se pudo consultar los servicios de reservas. Intente nuevamente.',
            icon: 'error',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#dc3545'
          });
          console.error('Error consultando reporte de arribos.', error);
        }
      });
  }

  limpiar(): void {
    const operationalDate = parsePmsDate(this.operationalDateService.operationalDate()) ?? this.todayLocal();
    const endDate = addPmsCalendarDays(operationalDate, 7) ?? operationalDate;
    this.filterForm.reset({ fechaIngreso: toPmsDateInputValue(operationalDate), fechaSalida: toPmsDateInputValue(endDate) });
    this.dateRangeError.set('');
    this.reservas.set([]);
    this.expandedReservaIds.set(new Set());
    this.agenciasSeleccionadas.set(new Set());
    this.seleccionAgenciasActiva.set(false);
    this.agenciaFiltroAbierto.set(false);
    this.centroCostoSeleccionado.set('');
    this.hasSearched.set(false);
    this.currentPage.set(1);
  }

  toggleAgencia(id: string): void {
    const selected = !this.seleccionAgenciasActiva()
      ? new Set(this.agencias().map((agencia) => agencia.id))
      : new Set(this.agenciasSeleccionadas());
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    this.agenciasSeleccionadas.set(selected);
    this.seleccionAgenciasActiva.set(true);
    this.updateExpandedReservations();
  }

  seleccionarTodasAgencias(): void {
    this.agenciasSeleccionadas.set(new Set(this.agencias().map((agencia) => agencia.id)));
    this.seleccionAgenciasActiva.set(true);
    this.updateExpandedReservations();
  }

  limpiarAgencias(): void {
    this.agenciasSeleccionadas.set(new Set());
    this.seleccionAgenciasActiva.set(true);
    this.updateExpandedReservations();
  }

  toggleFiltroAgencia(): void {
    this.agenciaFiltroAbierto.update((open) => !open);
  }

  get agenciaFiltroLabel(): string {
    const selectedCount = this.agenciasSeleccionadas().size;
    if (this.seleccionAgenciasActiva() && selectedCount === 0) return 'Ninguna agencia';
    return !this.seleccionAgenciasActiva() || selectedCount === this.agencias().length
      ? 'Todas las agencias'
      : `${selectedCount} ${selectedCount === 1 ? 'agencia seleccionada' : 'agencias seleccionadas'}`;
  }

  isAgenciaSeleccionada(id: string): boolean {
    const selected = this.agenciasSeleccionadas();
    return !this.seleccionAgenciasActiva() || selected.has(id);
  }

  get hayFiltroLocalActivo(): boolean {
    const selectedCount = this.agenciasSeleccionadas().size;
    const agencyFilterActive = this.seleccionAgenciasActiva() && selectedCount < this.agencias().length;
    return agencyFilterActive || !!this.centroCostoSeleccionado();
  }

  setAgenciaFilterOpen(value: boolean): void {
    this.agenciaFiltroAbierto.set(value);
  }

  setCentroCosto(value: string): void {
    this.centroCostoSeleccionado.set(value);
    this.updateExpandedReservations();
  }

  toggleReserva(reservaId: string): void {
    const expanded = new Set(this.expandedReservaIds());
    if (expanded.has(reservaId)) expanded.delete(reservaId);
    else expanded.add(reservaId);
    this.expandedReservaIds.set(expanded);
  }

  estaExpandida(reservaId: string): boolean {
    return this.expandedReservaIds().has(reservaId);
  }

  expandirTodo(): void {
    this.expandedReservaIds.set(new Set(this.filteredReservas().map((reserva) => reserva.reservaId)));
  }

  contraerTodo(): void {
    this.expandedReservaIds.set(new Set());
  }

  cambiarPagina(page: number): void {
    this.currentPage.set(Math.min(Math.max(page, 1), this.totalPages()));
  }

  cambiarTamanoPagina(value: string): void {
    const size = Number(value);
    if (this.pageSizeOptions.includes(size)) {
      this.pageSize.set(size);
      this.currentPage.set(1);
    }
  }

  async exportar(): Promise<void> {
    const rows = this.filteredReservas();
    if (this.exporting()) return;
    if (rows.length === 0) {
      this.toast.info('No hay reservas filtradas para exportar.', 4000, 'Exportar');
      return;
    }
    this.exporting.set(true);
    try {
      const XLSX = await import('xlsx-js-style');
      const { fechaIngreso, fechaSalida } = this.filterForm.getRawValue();
      const agencyFilter = this.seleccionAgenciasActiva()
        ? Array.from(this.agenciasSeleccionadas()).map((id) => {
            const agency = this.agencias().find((item) => item.id === id);
            return agency ? `${agency.nombre} (${agency.id})` : id;
          }).join(', ') || 'Ninguna'
        : 'Todas';
      const costCenterFilter = this.centroCostoSeleccionado() || 'Todos';
      const reportInfo = [
        ['Servicios de Reservas'],
        [`Período de ingreso: ${this.formatDate(fechaIngreso)} al ${this.formatDate(fechaSalida)}`],
        [`Agencias: ${agencyFilter}`],
        [`Centro de costo: ${costCenterFilter}`],
        [`Reservas exportadas: ${rows.length}`],
        []
      ];

      const serviceHeaders = [
        'Código de reserva', 'Descripción de reserva', 'Fecha de ingreso', 'Fecha de salida', 'Estado', 'Agencia', 'Código de agencia',
        'Código de plan', 'Noches', 'Adultos', 'Niños', 'Total de huéspedes', 'Servicios registrados', 'Tiene alimentación', 'Observaciones',
        'Código de servicio', 'Servicio', 'Cantidad', 'Moneda', 'Precio', 'Total del servicio', 'Tipo Pax', 'Centro de costo'
      ];
      const serviceRows = rows.flatMap((reserva) => {
        const services = reserva.servicios ?? [];
        const base = [
          reserva.reservaId,
          reserva.reservaDescripcion || '',
          this.formatDate(reserva.fechaIngreso),
          this.formatDate(reserva.fechaSalida),
          reserva.estadoReserva || '',
          reserva.nombreAgencia || '',
          reserva.agenciaId || '',
          reserva.codigoPlan || '',
          this.numberOrBlank(reserva.totalNoches),
          this.numberOrBlank(reserva.cantidadAdultos),
          this.numberOrBlank(reserva.cantidadNinos),
          this.numberOrBlank(reserva.totalHuespedes),
          services.length,
          this.hasAlimentacion(reserva) ? 'Sí' : 'No',
          reserva.observacionReserva || ''
        ];
        return services.length
          ? services.map((servicio) => [
              ...base,
              servicio.codigo || '',
              servicio.descripcion || '',
              this.numberOrBlank(servicio.cantidad),
              servicio.moneda || '',
              this.numberOrBlank(servicio.precio),
              this.numberOrBlank(servicio.total),
              servicio.tipoPax || '',
              servicio.centroCosto || ''
            ])
          : [[...base, '', '', '', '', '', '', '', '']];
      });
      const servicesSheet = XLSX.utils.aoa_to_sheet([
        ...reportInfo,
        serviceHeaders,
        ...serviceRows
      ]);
      this.configureExportSheet(XLSX, servicesSheet, serviceHeaders.length, serviceRows.length, [
        20, 34, 16, 16, 12, 30, 18, 15, 10, 11, 10, 18, 20, 18, 60, 18, 36, 12, 12, 15, 18, 14, 18
      ], reportInfo.length);
      const serviceHeaderRow = reportInfo.length;
      const serviceFirstDataRow = serviceHeaderRow + 1;
      let previousReservationId = '';
      for (let rowIndex = serviceFirstDataRow; rowIndex < serviceFirstDataRow + serviceRows.length; rowIndex += 1) {
        for (const columnIndex of [19, 20]) {
          const cell = servicesSheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
          if (cell?.t === 'n') cell.z = '#,##0.00';
        }
        const quantityCell = servicesSheet[XLSX.utils.encode_cell({ r: rowIndex, c: 17 })];
        if (quantityCell?.t === 'n') quantityCell.z = '#,##0.##';
        const reservationIdCell = servicesSheet[XLSX.utils.encode_cell({ r: rowIndex, c: 0 })];
        const reservationId = String(reservationIdCell?.v ?? '');
        if (reservationId !== previousReservationId) {
          for (let columnIndex = 0; columnIndex < serviceHeaders.length; columnIndex += 1) {
            const cell = servicesSheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
            if (cell) cell.s = { ...cell.s, border: { ...cell.s?.border, top: { style: 'medium', color: { rgb: 'FF8AA4BD' } } } };
          }
          if (reservationIdCell) reservationIdCell.s = { ...reservationIdCell.s, font: { name: 'Aptos', sz: 10, bold: true, color: { rgb: 'FF17365D' } } };
        }
        previousReservationId = reservationId;
        const foodFlagCell = servicesSheet[XLSX.utils.encode_cell({ r: rowIndex, c: 13 })];
        if (this.normalizeCode(foodFlagCell?.v as string) === 'SÍ' && foodFlagCell) {
          foodFlagCell.s = { ...foodFlagCell.s, font: { name: 'Aptos', sz: 10, color: { rgb: 'FF176B52' }, bold: true } };
        }
        const costCenterCell = servicesSheet[XLSX.utils.encode_cell({ r: rowIndex, c: 22 })];
        if (this.normalizeCode(costCenterCell?.v as string) === 'ALIMEN') {
          for (let columnIndex = 15; columnIndex < serviceHeaders.length; columnIndex += 1) {
            const cell = servicesSheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
            if (cell) cell.s = { ...cell.s, fill: { fgColor: { rgb: 'FFEAF6F1' } } };
          }
          if (costCenterCell) costCenterCell.s = { ...costCenterCell.s, font: { color: { rgb: 'FF176B52' }, bold: true } };
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, servicesSheet, 'Detalle');
      XLSX.writeFile(workbook, `servicios-reservas_${this.fileDate(fechaIngreso)}_${this.fileDate(fechaSalida)}.xlsx`, { compression: true });
      this.toast.success('Se exportó la hoja de detalle de Servicios de Reservas.', 4000, 'Exportación completada');
    } catch (error) {
      console.error('No se pudo exportar Servicios de Reservas.', error);
      void Swal.fire({
        title: 'No se pudo exportar',
        text: 'No fue posible generar el archivo Excel. Intente nuevamente.',
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    } finally {
      this.exporting.set(false);
    }
  }

  formatDate(value: string | null | undefined): string {
    return normalizePmsDateDDMMYYYY(value) || '—';
  }

  displayNumber(value: number | null | undefined): string {
    return value === null || value === undefined || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('es-CR');
  }

  displayMoney(value: number | null | undefined, currency: string | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
    const amount = Number(value).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const code = this.text(currency);
    return code ? `${code} ${amount}` : amount;
  }

  normalizeCode(value: string | null | undefined): string {
    return this.text(value).toUpperCase();
  }

  hasAlimentacion(reserva: ReservaServicios): boolean {
    return (reserva.servicios ?? []).some((servicio) => this.normalizeCode(servicio.centroCosto) === 'ALIMEN');
  }

  trackReserva(_: number, reserva: ReservaServicios): string {
    return reserva.reservaId;
  }

  trackServicio(index: number, servicio: ServicioReserva): string {
    return `${servicio.codigo}-${servicio.centroCosto}-${index}`;
  }

  private handleResponse(response: ReporteArribosResponse): void {
    if (!response?.success) {
      this.reservas.set([]);
      this.expandedReservaIds.set(new Set());
      void Swal.fire({
        title: 'Consulta no completada',
        text: this.text(response?.message) || 'La consulta no pudo completarse.',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }
    const unique = new Map<string, ReservaServicios>();
    for (const reserva of response.data ?? []) {
      const id = this.text(reserva.reservaId);
      if (id && !unique.has(id)) unique.set(id, { ...reserva, servicios: Array.isArray(reserva.servicios) ? reserva.servicios : [] });
    }
    const sorted = Array.from(unique.values()).sort((a, b) =>
      this.dateSortKey(a.fechaIngreso).localeCompare(this.dateSortKey(b.fechaIngreso)) ||
      this.text(a.nombreAgencia).localeCompare(this.text(b.nombreAgencia)) ||
      this.text(a.reservaId).localeCompare(this.text(b.reservaId))
    );
    this.reservas.set(sorted);
  }

  private updateExpandedReservations(): void {
    this.currentPage.set(1);
    const visibleIds = new Set(this.filteredReservas().map((reserva) => reserva.reservaId));
    this.expandedReservaIds.set(new Set(Array.from(this.expandedReservaIds()).filter((id) => visibleIds.has(id))));
  }

  private numberOrBlank(value: number | null | undefined): number | '' {
    return value === null || value === undefined || !Number.isFinite(Number(value)) ? '' : Number(value);
  }

  private configureExportSheet(
    XLSX: typeof import('xlsx-js-style'),
    worksheet: import('xlsx-js-style').WorkSheet,
    columnCount: number,
    dataRowCount: number,
    columnWidths: number[],
    headerRow: number
  ): void {
    const lastDataRow = headerRow + dataRowCount;
    worksheet['!merges'] = Array.from({ length: Math.max(headerRow - 1, 0) }, (_, row) => ({
      s: { r: row, c: 0 }, e: { r: row, c: columnCount - 1 }
    }));
    worksheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: lastDataRow, c: columnCount - 1 } })
    };
    worksheet['!cols'] = columnWidths.map((wch) => ({ wch }));
    const border = { bottom: { style: 'thin', color: { rgb: 'FFD8E1EA' } } };
    const setCellStyle = (row: number, column: number, style: Record<string, unknown>): void => {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      const cell = worksheet[address] ?? { t: 's', v: '' };
      cell.s = { ...cell.s, ...style };
      worksheet[address] = cell;
    };

    for (let row = 0; row <= headerRow; row += 1) {
      for (let column = 0; column < columnCount; column += 1) {
        if (row === 0) {
          setCellStyle(row, column, {
            fill: { fgColor: { rgb: 'FF17365D' } },
            font: { name: 'Aptos Display', sz: 16, bold: true, color: { rgb: 'FFFFFFFF' } },
            alignment: { vertical: 'center', horizontal: 'left' }
          });
        } else if (row < headerRow - 1) {
          setCellStyle(row, column, {
            fill: { fgColor: { rgb: row % 2 ? 'FFF1F5F9' : 'FFE6EEF6' } },
            font: { name: 'Aptos', sz: 10, color: { rgb: 'FF334155' }, bold: row === 1 },
            alignment: { vertical: 'center', wrapText: true },
            border
          });
        } else if (row === headerRow - 1) {
          setCellStyle(row, column, { fill: { fgColor: { rgb: 'FFFFFFFF' } } });
        } else {
          setCellStyle(row, column, {
            fill: { fgColor: { rgb: 'FF245B8F' } },
            font: { name: 'Aptos', sz: 10, bold: true, color: { rgb: 'FFFFFFFF' } },
            alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
            border: { bottom: { style: 'medium', color: { rgb: 'FF17365D' } } }
          });
        }
      }
    }
    for (let row = headerRow + 1; row <= lastDataRow; row += 1) {
      for (let column = 0; column < columnCount; column += 1) {
        setCellStyle(row, column, {
          fill: { fgColor: { rgb: row % 2 ? 'FFFFFFFF' : 'FFF7FAFC' } },
          font: { name: 'Aptos', sz: 10, color: { rgb: 'FF243447' } },
          alignment: { vertical: 'top', wrapText: [1, 14, 16, columnCount - 1].includes(column) },
          border
        });
      }
    }
    worksheet['!rows'] = [
      { hpt: 32 },
      ...Array.from({ length: Math.max(headerRow - 1, 0) }, () => ({ hpt: 21 })),
      { hpt: 34 },
      ...Array.from({ length: dataRowCount }, () => ({ hpt: 30 }))
    ];
  }

  private dateSortKey(value: string | null | undefined): string {
    const text = this.text(value);
    const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const canonical = normalizePmsDateDDMMYYYY(text);
    const match = canonical.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
  }

  private nonNegativeNumber(value: number | null | undefined): number {
    return value === null || value === undefined || !Number.isFinite(Number(value)) ? 0 : Number(value);
  }

  private text(value: unknown): string {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  private fileDate(value: string): string {
    return normalizePmsDateDDMMYYYY(value).replace(/\//g, '-') || 'fecha';
  }

  private todayLocal(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
}
