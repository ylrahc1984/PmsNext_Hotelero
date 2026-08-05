import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule, ColDef, GridApi, GridReadyEvent, ICellRendererParams, Module,
  RowClassParams, Theme, ValueFormatterParams, themeQuartz
} from 'ag-grid-community';
import { finalize } from 'rxjs';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { ReporteComprasIvaService } from '../services/reporte-compras-iva.service';
import { ReporteComprasIvaRow } from './reporte-compras-iva.interface';

interface ReporteComprasIvaFilters {
  fechaIngreso: string;
  fechaFactura: string;
  moneda: string;
  search: string;
}

interface ReporteComprasIvaGridRow extends ReporteComprasIvaRow {
  __type: 'detail' | 'footer';
  __key: string;
}

interface ReporteComprasIvaSummary {
  totalRegistros: number; facturas: number; proveedores: number;
  subtotal0: number; subtotal1: number; impuesto1: number; subtotal4: number; impuesto4: number;
  subtotal13: number; impuesto13: number; exento: number; exonerado: number;
  subtotal: number; impuesto: number; total: number;
}

const EMPTY_SUMMARY: ReporteComprasIvaSummary = {
  totalRegistros: 0, facturas: 0, proveedores: 0, subtotal0: 0, subtotal1: 0, impuesto1: 0,
  subtotal4: 0, impuesto4: 0, subtotal13: 0, impuesto13: 0, exento: 0, exonerado: 0,
  subtotal: 0, impuesto: 0, total: 0
};

@Component({
  selector: 'app-reporte-compras-iva',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular],
  templateUrl: './reporte-compras-iva.component.html',
  styleUrl: './reporte-compras-iva.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReporteComprasIvaComponent {
  private readonly reporteService = inject(ReporteComprasIvaService);
  private readonly empresaContext = inject(EmpresaContextService);
  private gridApi?: GridApi<ReporteComprasIvaGridRow>;

  readonly rucProveedor = input('');
  private readonly rucProveedorConsulta = computed(
    () => this.rucProveedor().trim() || String(this.empresaContext.empresa()?.MA04_Ruc ?? '').trim()
  );
  private readonly consultarAlCambiarEmpresa = effect(() => {
    if (this.rucProveedorConsulta()) {
      untracked(() => this.buscar());
    }
  });

  readonly gridModules: Module[] = [AllCommunityModule];
  readonly gridTheme: Theme = themeQuartz.withParams({
    accentColor: '#4f6f8f', backgroundColor: '#ffffff', borderColor: '#e1e7ef', browserColorScheme: 'light',
    fontFamily: 'Inter, Segoe UI, system-ui, sans-serif', fontSize: 12, foregroundColor: '#1f2937',
    headerBackgroundColor: '#f8fafc', headerTextColor: '#344054', oddRowBackgroundColor: '#fbfcfe', rowHoverColor: '#f1f5f9'
  });

  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly rows = signal<ReporteComprasIvaRow[]>([]);
  readonly filters = signal<ReporteComprasIvaFilters>({
    fechaIngreso: this.toDateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    fechaFactura: this.toDateInputValue(new Date()),
    moneda: '',
    search: ''
  });

  readonly defaultColDef: ColDef<ReporteComprasIvaGridRow> = { filter: true, resizable: true, sortable: true };
  readonly columnDefs: ColDef<ReporteComprasIvaGridRow>[] = [
    {
      headerName: 'Factura', field: 'PAC40_NumFactura', minWidth: 230, pinned: 'left', lockPinned: true,
      cellClass: 'document-cell', cellRenderer: (params: ICellRendererParams<ReporteComprasIvaGridRow>) => this.renderInvoiceCell(params.data)
    },
    { headerName: 'Fecha', field: 'PAC40_Fecha', width: 118, cellClass: 'date-cell', valueFormatter: ({ value }) => this.formatDate(value) },
    {
      colId: 'proveedor', headerName: 'Proveedor', minWidth: 250,
      valueGetter: ({ data }) => data?.PAC40_NomProve ?? '',
      cellRenderer: (params: ICellRendererParams<ReporteComprasIvaGridRow>) => this.renderProviderCell(params.data)
    },
    { headerName: 'Exento', field: 'SubTotal_Exento', width: 126, type: 'numericColumn', cellClass: 'number-cell', valueFormatter: (p) => this.formatMoneyValue(p) },
    { headerName: 'Base 0%', field: 'SubTotal_Gravado_0', width: 126, type: 'numericColumn', cellClass: 'number-cell', valueFormatter: (p) => this.formatMoneyValue(p) },
    ...this.moneyColumns('1%', 'SubTotal_Gravado_1', 'Impuesto_1'),
    ...this.moneyColumns('4%', 'SubTotal_Gravado_4', 'Impuesto_4'),
    ...this.moneyColumns('13%', 'SubTotal_Gravado_13', 'Impuesto_13'),
    { headerName: 'Exonerado', field: 'Monto_Exonerado', width: 132, type: 'numericColumn', cellClass: 'number-cell', valueFormatter: (p) => this.formatMoneyValue(p) },
    { headerName: 'Subtotal', field: 'Total_SubTotal_Factura', width: 132, type: 'numericColumn', cellClass: 'number-cell', valueFormatter: (p) => this.formatMoneyValue(p) },
    { headerName: 'Impuesto', field: 'Total_Impuesto_Factura', width: 132, type: 'numericColumn', cellClass: 'number-cell tax-cell', valueFormatter: (p) => this.formatMoneyValue(p) },
    { headerName: 'Total', field: 'Total_Factura', width: 136, type: 'numericColumn', cellClass: 'number-cell total-cell', valueFormatter: (p) => this.formatMoneyValue(p) },
    { headerName: 'T.C.', field: 'PAC40_TCambio', width: 96, type: 'numericColumn', cellClass: 'number-cell', valueFormatter: ({ value }) => this.formatNumber(value, 2) },
    { headerName: 'Moneda', field: 'PAC40_Moneda', width: 96, cellClass: 'center-cell' }
  ];

  readonly filteredRows = computed(() => {
    const filters = this.filters();
    return this.rows().filter((row) => {
      const matchesCurrency = !filters.moneda || this.normalize(row.PAC40_Moneda) === this.normalize(filters.moneda);
      const text = `${row.PAC40_NumFactura} ${row.PAC40_RucProve} ${row.PAC40_NomProve} ${this.activityLabel(row.PAC40_CodActividad)}`;
      return matchesCurrency && (!filters.search || this.normalize(text).includes(this.normalize(filters.search)));
    });
  });

  readonly summary = computed(() => this.buildSummary(this.filteredRows()));
  readonly visibleGridRows = computed<ReporteComprasIvaGridRow[]>(() => this.filteredRows().map((row, index) => ({ ...row, __type: 'detail', __key: `${row.PAC40_NumFactura}|${index}` })));
  readonly kpis = computed(() => {
    const summary = this.summary();
    return [
      { label: 'Total facturas', value: this.formatNumber(summary.facturas, 0), detail: `${summary.totalRegistros} registros` },
      { label: 'Total compras', value: this.formatMoney(summary.total), detail: 'Convertido a CRC' },
      { label: 'IVA total', value: this.formatMoney(summary.impuesto), detail: `Base ${this.formatMoney(summary.subtotal)}` },
      { label: 'IVA 13%', value: this.formatMoney(summary.impuesto13), detail: `Base ${this.formatMoney(summary.subtotal13)}` },
      { label: 'Exento', value: this.formatMoney(summary.exento), detail: 'Compras exentas' },
      { label: 'Proveedores', value: this.formatNumber(summary.proveedores, 0), detail: 'Con movimiento' }
    ];
  });

  readonly pinnedBottomRowData = computed<ReporteComprasIvaGridRow[]>(() => {
    const s = this.summary();
    return [{
      __type: 'footer', __key: 'footer', PAC40_CodActividad: null, PAC40_RucProve: '', PAC40_NomProve: 'Total vista',
      PAC40_NumFactura: `${s.totalRegistros} registros`, PAC40_Fecha: '', PAC40_Moneda: this.filters().moneda,
      PAC40_TCambio: 0, SubTotal_Gravado_13: s.subtotal13, Impuesto_13: s.impuesto13,
      SubTotal_Gravado_4: s.subtotal4, Impuesto_4: s.impuesto4, SubTotal_Gravado_1: s.subtotal1,
      Impuesto_1: s.impuesto1, SubTotal_Gravado_0: s.subtotal0, SubTotal_Exento: s.exento,
      Monto_Exonerado: s.exonerado, Total_SubTotal_Factura: s.subtotal,
      Total_Impuesto_Factura: s.impuesto, Total_Factura: s.total
    }];
  });

  onGridReady(event: GridReadyEvent<ReporteComprasIvaGridRow>): void { this.gridApi = event.api; }
  updateFilter<K extends keyof ReporteComprasIvaFilters>(key: K, value: ReporteComprasIvaFilters[K]): void {
    this.filters.update((current) => ({ ...current, [key]: value }));
  }

  buscar(): void {
    const { fechaIngreso, fechaFactura } = this.filters();
    const rucProveedor = this.rucProveedorConsulta();
    if (!rucProveedor) {
      this.rows.set([]);
      this.errorMessage.set('No fue posible determinar la cedula de la empresa para consultar el reporte.');
      return;
    }

    console.log('Consultando reporte de compras por IVA', { fechaIngreso, fechaFactura, rucProveedor });
    this.loading.set(true);
    this.errorMessage.set('');
    this.reporteService.obtenerDetalle({
      fechaIngreso: this.toApiDate(fechaIngreso),
      fechaFactura: this.toApiDate(fechaFactura),
      codProveedor: '',
      nomProveedor: '',
      rucProveedor
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (rows) => { this.rows.set(rows); this.gridApi?.paginationGoToFirstPage(); },
        error: (error: unknown) => { this.rows.set([]); this.errorMessage.set(error instanceof Error ? error.message : 'Ocurrio un error inesperado al consultar el reporte de compras por IVA'); }
      });
  }

  exportCsv(): void {
    this.gridApi?.exportDataAsCsv({ fileName: `compras-iva-${this.filters().fechaIngreso}-${this.filters().fechaFactura}.csv` });
  }

  rowClass = (params: RowClassParams<ReporteComprasIvaGridRow>): string => `grid-row-${params.data?.__type ?? 'detail'}`;
  formatMoney(value: unknown): string { return this.formatNumber(value, 2); }

  private moneyColumns(label: string, subtotal: keyof ReporteComprasIvaRow, impuesto: keyof ReporteComprasIvaRow): ColDef<ReporteComprasIvaGridRow>[] {
    return [
      { headerName: `Base ${label}`, field: subtotal, width: 128, type: 'numericColumn', cellClass: 'number-cell', valueFormatter: (p) => this.formatMoneyValue(p) },
      { headerName: `IVA ${label}`, field: impuesto, width: 124, type: 'numericColumn', cellClass: 'number-cell tax-cell', valueFormatter: (p) => this.formatMoneyValue(p) }
    ];
  }

  private buildSummary(rows: ReporteComprasIvaRow[]): ReporteComprasIvaSummary {
    if (!rows.length) return EMPTY_SUMMARY;
    return {
      totalRegistros: rows.length, facturas: new Set(rows.map((r) => r.PAC40_NumFactura).filter(Boolean)).size,
      proveedores: new Set(rows.map((r) => r.PAC40_RucProve).filter(Boolean)).size,
      subtotal0: this.sum(rows, 'SubTotal_Gravado_0'), subtotal1: this.sum(rows, 'SubTotal_Gravado_1'),
      impuesto1: this.sum(rows, 'Impuesto_1'), subtotal4: this.sum(rows, 'SubTotal_Gravado_4'),
      impuesto4: this.sum(rows, 'Impuesto_4'), subtotal13: this.sum(rows, 'SubTotal_Gravado_13'),
      impuesto13: this.sum(rows, 'Impuesto_13'), exento: this.sum(rows, 'SubTotal_Exento'),
      exonerado: this.sum(rows, 'Monto_Exonerado'), subtotal: this.sum(rows, 'Total_SubTotal_Factura'),
      impuesto: this.sum(rows, 'Total_Impuesto_Factura'), total: this.sum(rows, 'Total_Factura')
    };
  }

  private sum(rows: ReporteComprasIvaRow[], key: keyof ReporteComprasIvaRow): number {
    return rows.reduce((total, row) => total + this.toColones(row[key], row), 0);
  }
  private formatMoneyValue(params: ValueFormatterParams<ReporteComprasIvaGridRow>): string {
    if (params.data?.__type === 'footer') {
      return this.formatMoney(params.value);
    }
    return this.formatMoney(this.toColones(params.value, params.data));
  }
  private toColones(value: unknown, row: Partial<ReporteComprasIvaRow> | undefined): number {
    const amount = Number(value ?? 0);
    const exchangeRate = Number(row?.PAC40_TCambio ?? 0);
    return this.normalize(row?.PAC40_Moneda) === 'USD' ? amount * exchangeRate : amount;
  }
  private formatNumber(value: unknown, decimals: number): string { return new Intl.NumberFormat('es-CR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number(value ?? 0)); }
  private formatDate(value: unknown): string {
    const text = String(value ?? '').trim(); if (!text) return '';
    const date = new Date(text); return Number.isNaN(date.getTime()) ? text : new Intl.DateTimeFormat('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  }
  private renderInvoiceCell(row?: ReporteComprasIvaGridRow): string {
    if (!row) return '';
    return row.__type === 'footer'
      ? `<strong>Total vista</strong><span>${this.escapeHtml(row.PAC40_NumFactura)}</span>`
      : `<strong>${this.escapeHtml(row.PAC40_NumFactura)}</strong><span class="soft-badge soft-badge-document">Compra</span>`;
  }
  private renderProviderCell(row?: ReporteComprasIvaGridRow): string {
    if (!row) return '';
    return `<strong>${this.escapeHtml(row.PAC40_NomProve)}</strong><span>${this.escapeHtml(row.PAC40_RucProve)}</span>`;
  }
  private activityLabel(value: unknown): string { return typeof value === 'object' ? JSON.stringify(value ?? '') : String(value ?? ''); }
  private normalize(value: unknown): string { return String(value ?? '').trim().toUpperCase(); }
  private toApiDate(value: string): string { const [year, month, day] = value.split('-'); return year && month && day ? `${day}/${month}/${year}` : value; }
  private toDateInputValue(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  private escapeHtml(value: string): string {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
  }
}
