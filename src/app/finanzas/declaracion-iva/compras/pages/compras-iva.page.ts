import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { ComprasIvaService } from '../services/compras-iva.service';
import { CompraIvaConsolidado, CompraIvaDetalle, CompraIvaFactura, ComprasIvaQuery } from '../models/compras-iva.models';
import { ComprasIvaResumenComponent } from '../components/compras-iva-resumen/compras-iva-resumen.component';

type ConsultaState = 'idle' | 'loading' | 'success' | 'empty' | 'error';
type ConsultaTab = 'facturas' | 'detalle' | 'consolidado';
type SortDirection = 'asc' | 'desc';
type ConsolidatedAmountKey = Exclude<keyof CompraIvaConsolidado, 'tipoCompra'>;

@Component({
  selector: 'app-compras-iva-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ComprasIvaResumenComponent],
  templateUrl: './compras-iva.page.html',
  styleUrl: './compras-iva.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComprasIvaPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ComprasIvaService);
  private readonly destroyRef = inject(DestroyRef);
  private currentQuery: ComprasIvaQuery | null = null;
  private detailsLoaded = false;

  readonly filters = this.fb.nonNullable.group({
    fechaInicio: [this.monthStart(), Validators.required],
    fechaFin: [this.monthEnd(), Validators.required],
    proveedor: ['', [Validators.maxLength(150)]]
  });
  readonly state = signal<ConsultaState>('idle');
  readonly detailState = signal<ConsultaState>('idle');
  readonly appliedQuery = signal<ComprasIvaQuery | null>(null);
  readonly filtersChanged = signal(false);
  readonly errorMessage = signal('');
  readonly detailError = signal('');
  readonly invoices = signal<CompraIvaFactura[]>([]);
  readonly details = signal<CompraIvaDetalle[]>([]);
  readonly consolidation = signal<CompraIvaConsolidado[]>([]);
  readonly activeTab = signal<ConsultaTab>('facturas');
  readonly invoiceSearch = signal('');
  readonly detailSearch = signal('');
  readonly detailType = signal('');
  readonly detailRate = signal('');
  readonly selectedDocument = signal<string | null>(null);
  readonly invoicePage = signal(1);
  readonly detailPage = signal(1);
  readonly pageSize = 25;
  readonly consolidatedColumns: Array<{ label: string; key: ConsolidatedAmountKey }> = [
    { label: 'Base 0%', key: 'base0' }, { label: 'Base 1%', key: 'base1' }, { label: 'Base 2%', key: 'base2' },
    { label: 'Base 4%', key: 'base4' }, { label: 'Base 13%', key: 'base13' }, { label: 'Total base', key: 'totalBase' },
    { label: 'IVA 1%', key: 'ivA1' }, { label: 'IVA 2%', key: 'ivA2' }, { label: 'IVA 4%', key: 'ivA4' },
    { label: 'IVA 13%', key: 'ivA13' }, { label: 'Total IVA', key: 'totalIVA' },
    { label: 'Exoneración', key: 'totalExoneracion' }, { label: 'Total compra', key: 'totalCompra' }
  ];
  readonly sortField = signal<keyof CompraIvaFactura>('fechaFactura');
  readonly sortDirection = signal<SortDirection>('desc');
  readonly visibleInvoices = computed(() => {
    const term = this.normalize(this.invoiceSearch());
    const field = this.sortField();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    return this.invoices()
      .filter((row) => !term || this.normalize(`${row.numFactura} ${row.numDocu} ${row.proveedor} ${row.cedulaProveedor} ${row.tipoCompra}`).includes(term))
      .slice()
      .sort((a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? ''), 'es', { numeric: true, sensitivity: 'base' }) * direction);
  });
  readonly invoicePageCount = computed(() => Math.max(1, Math.ceil(this.visibleInvoices().length / this.pageSize)));
  readonly pagedInvoices = computed(() => this.visibleInvoices().slice((this.invoicePage() - 1) * this.pageSize, this.invoicePage() * this.pageSize));
  readonly visibleDetails = computed(() => {
    const term = this.normalize(this.detailSearch());
    const type = this.normalize(this.detailType());
    const rate = this.detailRate();
    const document = this.selectedDocument();
    return this.details().filter((row) => {
      const textMatch = !term || this.normalize(`${row.numDocu} ${row.numFactura} ${row.proveedor} ${row.producto} ${row.cabys} ${row.codProducto}`).includes(term);
      const normalizedType = this.normalize(row.tipoCompra);
      const typeMatch = !type || (type === 'SIN CLASIFICAR' ? !['BIENES', 'SERVICIOS'].includes(normalizedType) : normalizedType === type);
      return textMatch && typeMatch && (!rate || Number(row.porcentajeIVA) === Number(rate)) && (!document || row.numDocu === document);
    });
  });
  readonly detailPageCount = computed(() => Math.max(1, Math.ceil(this.visibleDetails().length / this.pageSize)));
  readonly pagedDetails = computed(() => this.visibleDetails().slice((this.detailPage() - 1) * this.pageSize, this.detailPage() * this.pageSize));
  readonly hasUnclassified = computed(() => this.consolidation().some((row) => !['BIENES', 'SERVICIOS'].includes(this.normalize(row.tipoCompra))));
  readonly totalConsolidated = computed(() => this.consolidation().reduce((total, row) => ({
    tipoCompra: 'TOTAL GENERAL',
    base0: total.base0 + this.num(row.base0), base1: total.base1 + this.num(row.base1), base2: total.base2 + this.num(row.base2),
    base4: total.base4 + this.num(row.base4), base13: total.base13 + this.num(row.base13),
    ivA1: total.ivA1 + this.num(row.ivA1), ivA2: total.ivA2 + this.num(row.ivA2), ivA4: total.ivA4 + this.num(row.ivA4), ivA13: total.ivA13 + this.num(row.ivA13),
    totalBase: total.totalBase + this.num(row.totalBase), totalIVA: total.totalIVA + this.num(row.totalIVA),
    totalExoneracion: total.totalExoneracion + this.num(row.totalExoneracion), totalCompra: total.totalCompra + this.num(row.totalCompra)
  }), this.emptyConsolidated()));
  readonly exportDisabled = computed(() => this.activeTab() === 'facturas'
    ? !this.visibleInvoices().length
    : this.activeTab() === 'detalle' ? !this.visibleDetails().length : !this.consolidation().length);

  ngOnInit(): void {
    this.filters.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.filtersChanged.set(true));
    this.consultar();
  }

  consultar(): void {
    if (this.state() === 'loading') return;
    this.filters.markAllAsTouched();
    const { fechaInicio, fechaFin, proveedor } = this.filters.getRawValue();
    if (this.filters.invalid || !fechaInicio || !fechaFin || fechaInicio > fechaFin) {
      if (fechaInicio && fechaFin && fechaInicio > fechaFin) this.errorMessage.set('La fecha inicial no puede ser posterior a la fecha final.');
      else this.errorMessage.set('Indique un período válido. La fecha de inicio y la fecha final son obligatorias.');
      this.state.set('error');
      return;
    }

    const query: ComprasIvaQuery = { fechaInicio, fechaFin, ...(proveedor.trim() ? { proveedor: proveedor.trim() } : {}) };
    this.currentQuery = query;
    this.appliedQuery.set(query);
    this.filtersChanged.set(false);
    this.state.set('loading');
    this.errorMessage.set('');
    this.invoices.set([]);
    this.details.set([]);
    this.consolidation.set([]);
    this.detailsLoaded = false;
    this.detailState.set('idle');
    this.detailError.set('');
    this.selectedDocument.set(null);
    this.invoicePage.set(1);
    this.detailPage.set(1);

    forkJoin({ invoices: this.service.facturas(query), consolidation: this.service.consolidado(query) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.invoices.set(result.invoices);
          this.consolidation.set(result.consolidation);
          this.state.set(result.invoices.length || result.consolidation.length ? 'success' : 'empty');
        },
        error: (error: unknown) => {
          this.invoices.set([]);
          this.consolidation.set([]);
          this.state.set('error');
          this.errorMessage.set(this.getErrorMessage(error, 'No se pudieron consultar las compras para este período.'));
        }
      });
  }

  limpiar(): void {
    this.filters.reset({ fechaInicio: this.monthStart(), fechaFin: this.monthEnd(), proveedor: '' });
    this.filtersChanged.set(false);
    this.appliedQuery.set(null);
    this.currentQuery = null;
    this.errorMessage.set('');
    this.state.set('idle');
    this.invoices.set([]);
    this.details.set([]);
    this.consolidation.set([]);
    this.selectedDocument.set(null);
    this.detailsLoaded = false;
    this.activeTab.set('facturas');
    this.invoiceSearch.set('');
    this.detailSearch.set('');
    this.detailType.set('');
    this.detailRate.set('');
  }

  setTab(tab: ConsultaTab): void {
    this.activeTab.set(tab);
    if (tab === 'detalle' && !this.detailsLoaded && this.currentQuery) this.loadDetails();
  }

  selectInvoice(invoice: CompraIvaFactura): void {
    this.selectedDocument.set(invoice.numDocu);
    this.detailPage.set(1);
    this.setTab('detalle');
  }

  showAllDetails(): void {
    this.selectedDocument.set(null);
    this.detailPage.set(1);
  }

  loadDetails(): void {
    if (!this.currentQuery || this.detailState() === 'loading') return;
    const query = this.currentQuery;
    this.detailState.set('loading');
    this.detailError.set('');
    this.service.detalle(query).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        if (this.currentQuery !== query) return;
        this.details.set(rows);
        this.detailsLoaded = true;
        this.detailState.set(rows.length ? 'success' : 'empty');
      },
      error: (error: unknown) => {
        if (this.currentQuery !== query) return;
        this.details.set([]);
        this.detailState.set('error');
        this.detailError.set(this.getErrorMessage(error, 'No se pudo cargar el detalle de compras.'));
      }
    });
  }

  sortInvoices(field: keyof CompraIvaFactura): void {
    if (this.sortField() === field) this.sortDirection.update((current) => current === 'asc' ? 'desc' : 'asc');
    else { this.sortField.set(field); this.sortDirection.set('asc'); }
    this.invoicePage.set(1);
  }

  movePage(kind: 'invoice' | 'detail', delta: number): void {
    if (kind === 'invoice') this.invoicePage.update((page) => Math.min(Math.max(page + delta, 1), this.invoicePageCount()));
    else this.detailPage.update((page) => Math.min(Math.max(page + delta, 1), this.detailPageCount()));
  }

  typeLabel(value: string): string {
    const normalized = this.normalize(value);
    return normalized === 'BIENES' ? 'Bienes' : normalized === 'SERVICIOS' ? 'Servicios' : value || 'Sin clasificar';
  }

  typeClass(value: string): string {
    const normalized = this.normalize(value);
    return normalized === 'BIENES' ? 'type-badge--goods' : normalized === 'SERVICIOS' ? 'type-badge--services' : 'type-badge--unknown';
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
  }

  formatDate(value: string): string {
    const text = String(value ?? '').slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    const localized = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
    return localized ? text : String(value ?? '');
  }

  async exportarExcel(): Promise<void> {
    if (this.exportDisabled()) return;
    const tab = this.activeTab();
    const query = this.currentQuery;
    if (!query) return;
    try {
      const XLSX = await import('xlsx');
      const rows = tab === 'facturas' ? this.visibleInvoices() : tab === 'detalle' ? this.visibleDetails() : this.consolidation();
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      const sheetName = tab === 'detalle' ? 'Detalle' : tab === 'consolidado' ? 'Consolidado' : 'Facturas';
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      const supplier = query.proveedor ? `-${query.proveedor.replace(/[^\w-]+/g, '-')}` : '';
      XLSX.writeFile(workbook, `compras-iva-${tab}-${query.fechaInicio}-${query.fechaFin}${supplier}.xlsx`, { compression: true });
    } catch (error) {
      console.error('No se pudo exportar la consulta de compras para IVA.', error);
      this.errorMessage.set('No se pudo generar el archivo Excel. Intente nuevamente.');
    }
  }

  trackByDocument(_: number, row: CompraIvaFactura): string { return `${row.numDocu}|${row.tipoCompra}|${row.numFactura}`; }
  trackByDetail(_: number, row: CompraIvaDetalle): string { return `${row.numDocu}|${row.orden}|${row.codProducto}`; }
  trackByType(_: number, row: CompraIvaConsolidado): string { return row.tipoCompra; }

  private normalize(value: string): string {
    return (value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  }

  private num(value: number): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }

  private emptyConsolidated(): CompraIvaConsolidado {
    return { tipoCompra: 'TOTAL GENERAL', base0: 0, base1: 0, base2: 0, base4: 0, base13: 0, ivA1: 0, ivA2: 0, ivA4: 0, ivA13: 0, totalBase: 0, totalIVA: 0, totalExoneracion: 0, totalCompra: 0 };
  }

  private monthStart(): string {
    const now = new Date();
    return this.dateInput(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  private monthEnd(): string {
    const now = new Date();
    return this.dateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  }

  private dateInput(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (!error || typeof error !== 'object') return fallback;
    const source = error as { error?: { mensaje?: string; respuesta?: string; message?: string }; message?: string };
    return source.error?.mensaje || source.error?.respuesta || source.error?.message || source.message || fallback;
  }
}
