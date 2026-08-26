import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { catchError, debounceTime, distinctUntilChanged, finalize, of } from 'rxjs';

import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { normalizePmsDateDDMMYYYY, parsePmsDate, toPmsDateInputValue } from 'src/app/core/utils/pms-date.util';
import {
  buildContactCounts,
  buildGuestExportRows,
  buildGuestKpis,
  buildNationalityChart,
  classifyGuestContact,
  filterGuestRows,
  firstDayOfMonthInput,
  guestDateRangeValidator,
  guestIdentityKey,
  normalizeGuestText
} from './analisis-huespedes.helpers';
import {
  GuestContactCategory,
  GuestLocalFilters,
  GuestReportKpis,
  GuestSortColumn,
  NationalityChartItem,
  ReporteHuespedMercadeo,
  SortDirection
} from './analisis-huespedes.models';
import { AnalisisHuespedesService } from './analisis-huespedes.service';

interface ContactSummaryItem {
  key: GuestContactCategory;
  label: string;
  count: number;
  percentage: number;
  tone: 'green' | 'blue' | 'orange' | 'gray';
}

@Component({
  selector: 'app-analisis-huespedes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgApexchartsModule],
  templateUrl: './analisis-huespedes.component.html',
  styleUrls: ['./analisis-huespedes.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnalisisHuespedesComponent implements OnInit {
  private readonly service = inject(AnalisisHuespedesService);
  private readonly operationalDateService = inject(OperationalDateService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly pageSizes = [10, 20, 50];
  readonly contactCategoryOrder: GuestContactCategory[] = ['CORREO DIRECTO', 'CORREO OTA', 'SOLO TELÉFONO', 'SIN CONTACTO'];
  readonly filtersForm = this.fb.nonNullable.group(
    {
      fechaDesde: this.fb.nonNullable.control(firstDayOfMonthInput(new Date()), Validators.required),
      fechaHasta: this.fb.nonNullable.control(toPmsDateInputValue(new Date()), Validators.required),
      nacionalidad: '',
      agencia: '',
      search: '',
      estadoContacto: '',
      tipoEmail: '',
      origenReserva: '',
      estadoReserva: '',
      tipoPax: ''
    },
    { validators: guestDateRangeValidator }
  );

  sourceRows: ReporteHuespedMercadeo[] = [];
  filteredRows: ReporteHuespedMercadeo[] = [];
  pagedRows: ReporteHuespedMercadeo[] = [];
  selectedGuest: ReporteHuespedMercadeo | null = null;
  matchingStays: ReporteHuespedMercadeo[] = [];
  nationalityOptions: string[] = [];
  agencyOptions: string[] = [];
  contactStatusOptions: string[] = [];
  emailTypeOptions: string[] = [];
  reservationStatusOptions: string[] = [];
  paxTypeOptions: string[] = [];
  nationalityItems: NationalityChartItem[] = [];
  contactItems: ContactSummaryItem[] = [];
  kpis: GuestReportKpis = buildGuestKpis([]);
  nationalityChartOptions: Partial<ApexOptions> = this.buildNationalityChartOptions([]);

  loading = false;
  loadedOnce = false;
  errorMessage = '';
  moreFiltersOpen = false;
  detailOpen = false;
  exporting = false;
  page = 1;
  pageSize = 20;
  sortColumn: GuestSortColumn = 'fechaIngreso';
  sortDirection: SortDirection = 'desc';
  private detailTrigger: HTMLElement | null = null;

  ngOnInit(): void {
    this.bindLocalFilters();
    this.operationalDateService
      .ensureLoaded()
      .pipe(
        catchError(() => of(normalizePmsDateDDMMYYYY(new Date()))),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((operationalDate) => {
        const dateInput = toPmsDateInputValue(operationalDate) || toPmsDateInputValue(new Date());
        this.filtersForm.patchValue(
          { fechaDesde: firstDayOfMonthInput(operationalDate || new Date()), fechaHasta: dateInput },
          { emitEvent: false }
        );
        this.consultar();
      });
  }

  consultar(): void {
    this.filtersForm.markAllAsTouched();
    if (this.filtersForm.invalid || this.loading) return;

    const { fechaDesde, fechaHasta } = this.filtersForm.getRawValue();
    this.loading = true;
    this.errorMessage = '';
    this.service
      .getReporteHuespedesMercadeo(fechaDesde, fechaHasta)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (rows) => {
          this.sourceRows = Array.isArray(rows) ? [...rows] : [];
          this.loadedOnce = true;
          this.closeDetail();
          this.buildFilterOptions();
          this.page = 1;
          this.refreshDerivedData();
        },
        error: () => {
          this.errorMessage = 'No fue posible consultar el análisis de huéspedes. Intente nuevamente.';
          this.toast.error(this.errorMessage);
        }
      });
  }

  limpiar(): void {
    const operational = this.operationalDateService.operationalDate() || new Date();
    this.filtersForm.reset({
      fechaDesde: firstDayOfMonthInput(operational),
      fechaHasta: toPmsDateInputValue(operational),
      nacionalidad: '',
      agencia: '',
      search: '',
      estadoContacto: '',
      tipoEmail: '',
      origenReserva: '',
      estadoReserva: '',
      tipoPax: ''
    });
    this.moreFiltersOpen = false;
    this.page = 1;
    this.consultar();
  }

  limpiarFiltrosLocales(): void {
    this.filtersForm.patchValue({
      nacionalidad: '',
      agencia: '',
      search: '',
      estadoContacto: '',
      tipoEmail: '',
      origenReserva: '',
      estadoReserva: '',
      tipoPax: ''
    });
  }

  toggleMoreFilters(): void {
    this.moreFiltersOpen = !this.moreFiltersOpen;
  }

  sortBy(column: GuestSortColumn): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.refreshDerivedData(false);
  }

  sortIcon(column: GuestSortColumn): string {
    if (this.sortColumn !== column) return 'unfold_more';
    return this.sortDirection === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
  }

  onPageSizeChange(value: string): void {
    this.pageSize = Number(value) || 20;
    this.page = 1;
    this.refreshPage();
  }

  previousPage(): void {
    if (this.page > 1) {
      this.page -= 1;
      this.refreshPage();
    }
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page += 1;
      this.refreshPage();
    }
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredRows.length / this.pageSize));
  }

  get paginationLabel(): string {
    if (!this.filteredRows.length) return '0 de 0';
    const start = (this.page - 1) * this.pageSize + 1;
    return `${start}-${Math.min(this.page * this.pageSize, this.filteredRows.length)} de ${this.filteredRows.length}`;
  }

  get narrative(): string {
    if (!this.loadedOnce) return '';
    const { fechaDesde, fechaHasta } = this.filtersForm.getRawValue();
    const paxLabel = this.kpis.paxAlojados === 1 ? '1 huésped' : `${this.kpis.paxAlojados} huéspedes`;
    const nationalityLabel = this.kpis.nacionalidades === 1 ? '1 nacionalidad' : `${this.kpis.nacionalidades} nacionalidades`;
    const stayVerb = this.kpis.paxAlojados === 1 ? 'se alojó' : 'se alojaron';
    return `${this.formatNarrativeRange(fechaDesde, fechaHasta)} ${stayVerb} ${paxLabel} de ${nationalityLabel}. El ${this.kpis.contactablesPercentage}% cuenta con información de contacto disponible.`;
  }

  get hasActiveLocalFilters(): boolean {
    const value = this.filtersForm.getRawValue();
    return Boolean(
      value.search ||
        value.nacionalidad ||
        value.agencia ||
        value.estadoContacto ||
        value.tipoEmail ||
        value.origenReserva ||
        value.estadoReserva ||
        value.tipoPax
    );
  }

  get dateRangeError(): boolean {
    return this.filtersForm.hasError('invalidDateRange') && (this.filtersForm.touched || this.filtersForm.dirty);
  }

  openDetail(guest: ReporteHuespedMercadeo, event?: Event): void {
    this.selectedGuest = guest;
    const identity = guestIdentityKey(guest);
    this.matchingStays = this.sourceRows.filter((row) => guestIdentityKey(row) === identity);
    this.detailTrigger = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.detailOpen = true;
    queueMicrotask(() => (document.querySelector('.guest-drawer .drawer-close') as HTMLElement | null)?.focus());
  }

  @HostListener('document:keydown.escape')
  closeDetailWithEscape(): void {
    if (this.detailOpen) this.closeDetail();
  }

  closeDetail(): void {
    const shouldRestoreFocus = this.detailOpen;
    this.detailOpen = false;
    this.selectedGuest = null;
    this.matchingStays = [];
    if (shouldRestoreFocus) queueMicrotask(() => this.detailTrigger?.focus());
  }

  async copyValue(value: string | null, label: string): Promise<void> {
    if (!value?.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
      this.toast.success(`${label} copiado al portapapeles.`, 2500);
    } catch {
      this.toast.warning(`No fue posible copiar ${label.toLowerCase()}.`);
    }
  }

  async exportReport(): Promise<void> {
    if (!this.filteredRows.length || this.exporting) return;
    this.exporting = true;
    try {
      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.json_to_sheet(buildGuestExportRows(this.filteredRows));
      worksheet['!cols'] = [
        { wch: 16 },
        { wch: 30 },
        { wch: 18 },
        { wch: 20 },
        { wch: 18 },
        { wch: 30 },
        { wch: 18 },
        { wch: 20 },
        { wch: 22 },
        { wch: 16 },
        { wch: 16 },
        { wch: 9 },
        { wch: 25 },
        { wch: 12 },
        { wch: 10 },
        { wch: 18 },
        { wch: 16 }
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Huéspedes');
      const { fechaDesde, fechaHasta } = this.filtersForm.getRawValue();
      XLSX.writeFile(workbook, `analisis-huespedes-${fechaDesde}-${fechaHasta}.xlsx`, { compression: true });
      this.toast.success('Reporte exportado correctamente.');
    } catch {
      this.toast.error('No fue posible exportar el análisis de huéspedes.');
    } finally {
      this.exporting = false;
      this.cdr.markForCheck();
    }
  }

  formatStay(guest: ReporteHuespedMercadeo): string {
    const from = parsePmsDate(guest.fechaIngreso);
    const to = parsePmsDate(guest.fechaSalida);
    if (!from || !to) return 'Fechas no disponibles';
    const fromText = new Intl.DateTimeFormat('es-CR', { day: '2-digit' }).format(from);
    const toText = new Intl.DateTimeFormat('es-CR', { day: '2-digit', month: 'short', year: 'numeric' }).format(to).replace('.', '');
    return `${fromText}–${toText}`;
  }

  formatDate(value: string): string {
    return normalizePmsDateDDMMYYYY(value) || 'Sin fecha';
  }

  nightsLabel(value: number): string {
    return `${value} ${value === 1 ? 'noche' : 'noches'}`;
  }

  contactBadgeClass(status: string): string {
    const normalized = normalizeGuestText(status);
    if (normalized === 'CORREO Y TELEFONO') return 'contact-badge--complete';
    if (normalized === 'SOLO CORREO') return 'contact-badge--email';
    if (normalized === 'SOLO TELEFONO') return 'contact-badge--phone';
    return 'contact-badge--empty';
  }

  emailTypeLabel(type: string): string {
    const normalized = normalizeGuestText(type);
    if (normalized === 'CORREO DIRECTO') return 'Directo';
    if (normalized === 'OTA BOOKING') return 'Booking';
    if (normalized === 'OTA EXPEDIA') return 'Expedia';
    return 'Sin correo';
  }

  directReservationLabel(value: string): string {
    return normalizeGuestText(value) === 'S' ? 'Directa' : 'Agencia';
  }

  consolidatedLabel(value: boolean): string {
    return value ? 'Sí' : 'No';
  }

  trackGuest(_: number, guest: ReporteHuespedMercadeo): string {
    return `${guest.idRooming}-${guest.codReserva}`;
  }

  trackOption(_: number, value: string): string {
    return value;
  }

  trackNationality(_: number, item: NationalityChartItem): string {
    return item.label;
  }

  trackContact(_: number, item: ContactSummaryItem): string {
    return item.key;
  }

  contactCategory(guest: ReporteHuespedMercadeo): GuestContactCategory {
    return classifyGuestContact(guest);
  }

  private bindLocalFilters(): void {
    this.filtersForm.controls.search.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.onLocalFiltersChanged());

    [
      this.filtersForm.controls.nacionalidad,
      this.filtersForm.controls.agencia,
      this.filtersForm.controls.estadoContacto,
      this.filtersForm.controls.tipoEmail,
      this.filtersForm.controls.origenReserva,
      this.filtersForm.controls.estadoReserva,
      this.filtersForm.controls.tipoPax
    ].forEach((control) => control.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.onLocalFiltersChanged()));
  }

  private onLocalFiltersChanged(): void {
    this.page = 1;
    this.refreshDerivedData();
  }

  private refreshDerivedData(resetPage = false): void {
    if (resetPage) this.page = 1;
    const value = this.filtersForm.getRawValue();
    const localFilters: GuestLocalFilters = {
      search: value.search,
      nacionalidad: value.nacionalidad,
      agencia: value.agencia,
      estadoContacto: value.estadoContacto,
      tipoEmail: value.tipoEmail,
      origenReserva: value.origenReserva,
      estadoReserva: value.estadoReserva,
      tipoPax: value.tipoPax
    };
    this.filteredRows = this.sortRows(filterGuestRows(this.sourceRows, localFilters));
    this.kpis = buildGuestKpis(this.filteredRows);
    this.nationalityItems = buildNationalityChart(this.filteredRows);
    this.contactItems = this.buildContactItems(this.filteredRows);
    this.nationalityChartOptions = this.buildNationalityChartOptions(this.nationalityItems);
    this.page = Math.min(this.page, this.totalPages);
    this.refreshPage();
    this.cdr.markForCheck();
  }

  private refreshPage(): void {
    const start = (this.page - 1) * this.pageSize;
    this.pagedRows = this.filteredRows.slice(start, start + this.pageSize);
    this.cdr.markForCheck();
  }

  private sortRows(rows: readonly ReporteHuespedMercadeo[]): ReporteHuespedMercadeo[] {
    return [...rows].sort((left, right) => {
      const leftValue = this.sortValue(left, this.sortColumn);
      const rightValue = this.sortValue(right, this.sortColumn);
      const result = leftValue.localeCompare(rightValue, 'es', { numeric: true, sensitivity: 'base' });
      return this.sortDirection === 'asc' ? result : -result;
    });
  }

  private sortValue(guest: ReporteHuespedMercadeo, column: GuestSortColumn): string {
    if (column === 'fechaIngreso' || column === 'fechaSalida') return toPmsDateInputValue(guest[column]);
    if (column === 'noches') return String(Number(guest.noches) || 0).padStart(8, '0');
    return String(guest[column] ?? '');
  }

  private buildFilterOptions(): void {
    this.nationalityOptions = this.uniqueSorted(this.sourceRows.map((row) => row.nacionalidad));
    this.agencyOptions = this.uniqueSorted(this.sourceRows.map((row) => row.nomAgencia));
    this.contactStatusOptions = this.uniqueSorted(this.sourceRows.map((row) => row.estadoContacto));
    this.emailTypeOptions = this.uniqueSorted(this.sourceRows.map((row) => row.tipoEmail));
    this.reservationStatusOptions = this.uniqueSorted(this.sourceRows.map((row) => row.estadoReserva));
    this.paxTypeOptions = this.uniqueSorted(this.sourceRows.map((row) => row.tipoPax ?? ''));
  }

  private uniqueSorted(values: readonly string[]): string[] {
    return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
  }

  private buildContactItems(rows: readonly ReporteHuespedMercadeo[]): ContactSummaryItem[] {
    const counts = buildContactCounts(rows);
    const labels: Record<GuestContactCategory, string> = {
      'CORREO DIRECTO': 'Correo directo',
      'CORREO OTA': 'Correo OTA',
      'SOLO TELÉFONO': 'Solo teléfono',
      'SIN CONTACTO': 'Sin contacto'
    };
    const tones: Record<GuestContactCategory, ContactSummaryItem['tone']> = {
      'CORREO DIRECTO': 'green',
      'CORREO OTA': 'blue',
      'SOLO TELÉFONO': 'orange',
      'SIN CONTACTO': 'gray'
    };
    return this.contactCategoryOrder.map((key) => ({
      key,
      label: labels[key],
      count: counts[key],
      percentage: rows.length ? Math.round((counts[key] / rows.length) * 100) : 0,
      tone: tones[key]
    }));
  }

  private buildNationalityChartOptions(items: readonly NationalityChartItem[]): Partial<ApexOptions> {
    return {
      series: [{ name: 'Huéspedes', data: items.map((item) => item.count) }],
      chart: { type: 'bar', height: Math.max(260, items.length * 34), toolbar: { show: false }, fontFamily: 'inherit' },
      colors: ['#18a8b5'],
      plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '58%' } },
      dataLabels: {
        enabled: true,
        formatter: (value, options) => `${Math.round(Number(value))} · ${items[options.dataPointIndex]?.percentage ?? 0}%`,
        style: { colors: ['#17324d'], fontSize: '11px', fontWeight: 700 },
        offsetX: 24
      },
      xaxis: { categories: items.map((item) => item.label), labels: { formatter: (value) => String(Math.round(Number(value))) } },
      grid: { borderColor: '#e8eef4', strokeDashArray: 4, padding: { right: 42 } },
      tooltip: { y: { formatter: (value, options) => `${value} huéspedes (${items[options.dataPointIndex]?.percentage ?? 0}%)` } },
      legend: { show: false }
    };
  }

  private formatNarrativeRange(fromValue: string, toValue: string): string {
    const from = parsePmsDate(fromValue);
    const to = parsePmsDate(toValue);
    if (!from || !to) return 'En el periodo consultado';
    const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
    const fromLabel = new Intl.DateTimeFormat('es-CR', {
      day: 'numeric',
      ...(sameMonth ? {} : { month: 'long' as const, year: from.getFullYear() === to.getFullYear() ? undefined : ('numeric' as const) })
    }).format(from);
    const toFull = new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'long', year: 'numeric' }).format(to);
    return `Entre el ${fromLabel} y el ${toFull}`;
  }
}
