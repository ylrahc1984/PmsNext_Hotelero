import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpResponse } from '@angular/common/http';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  Module,
  RowClassParams,
  Theme,
  ValueFormatterParams,
  themeQuartz
} from 'ag-grid-community';
import { finalize } from 'rxjs';
import { ReporteVentasIvaService } from '../services/reporte-ventas-iva.service';
import { ReporteVentasIvaRow } from './reporte-ventas-iva.interface';

type GridRowType = 'detail' | 'footer';

interface ReporteVentasIvaFilters {
  proceso         : number;
  fechaInicial    : string;
  fechaFinal      : string;
  moneda          : string;
  tipoDoc         : string;
  search          : string;
}

interface ReporteVentasIvaGridRow extends ReporteVentasIvaRow {
  __type  : GridRowType;
  __key   : string;
}

interface ReporteVentasIvaSummary {
  totalRegistros    : number;
  documentos        : number;
  clientes          : number;
  notasCredito      : number;
  exento            : number;
  subtotal1         : number;
  imp1              : number;
  subtotal2         : number;
  imp2              : number;
  subtotal4         : number;
  imp4              : number;
  subtotal13        : number;
  imp13             : number;
  exoneracion       : number;
  total             : number;
}

const EMPTY_SUMMARY: ReporteVentasIvaSummary = {
  totalRegistros    : 0,
  documentos        : 0,
  clientes          : 0,
  notasCredito      : 0,
  exento            : 0,
  subtotal1         : 0,
  imp1              : 0,
  subtotal2         : 0,
  imp2              : 0,
  subtotal4         : 0,
  imp4              : 0,
  subtotal13        : 0,
  imp13             : 0,
  exoneracion       : 0,
  total             : 0
};

@Component({
  selector: 'app-reporte-ventas-iva',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular],
  templateUrl: './reporte-ventas-iva.component.html',
  styleUrl: './reporte-ventas-iva.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReporteVentasIvaComponent implements OnInit {
  private readonly reporteService = inject(ReporteVentasIvaService);
  private gridApi?: GridApi<ReporteVentasIvaGridRow>;

  readonly gridModules: Module[] = [AllCommunityModule];
  readonly gridTheme: Theme = themeQuartz.withParams({
    accentColor                 : '#4f6f8f',
    backgroundColor             : '#ffffff',
    borderColor                 : '#e1e7ef',
    browserColorScheme          : 'light',
    fontFamily                  : 'Inter, Segoe UI, system-ui, sans-serif',
    fontSize                    : 12,
    foregroundColor             : '#1f2937',
    headerBackgroundColor       : '#f8fafc',
    headerTextColor             : '#344054',
    oddRowBackgroundColor       : '#fbfcfe',
    rowHoverColor               : '#f1f5f9'
  });

  readonly loading = signal(false);
  readonly exportingExcel = signal(false);
  readonly errorMessage = signal('');
  readonly actionMessage = signal('');
  readonly rows = signal<ReporteVentasIvaRow[]>([]);
  readonly filters = signal<ReporteVentasIvaFilters>({
    proceso         : 7,
    fechaInicial    : this.toDateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    fechaFinal      : this.toDateInputValue(new Date()),
    moneda          : 'USD',
    tipoDoc         : '',
    search          : ''
  });

  readonly defaultColDef: ColDef<ReporteVentasIvaGridRow> = {
    filter                    : true,
    resizable                 : true,
    sortable                  : true,
    suppressHeaderMenuButton  : false
  };

  readonly columnDefs: ColDef<ReporteVentasIvaGridRow>[] = [
    {
      colId           : 'documento',
      headerName      : 'Documento',
      minWidth        : 220,
      pinned          : 'left',
      lockPinned      : true,
      valueGetter     : ({ data }) => this.documentLabel(data),
      cellRenderer    : (params: ICellRendererParams<ReporteVentasIvaGridRow>) => this.renderDocumentCell(params.data),
      cellClass       : 'document-cell'
    },
    {
      headerName      : 'Fecha',
      field           : 'fecha',
      width           : 118,
      cellClass       : 'date-cell',
      valueFormatter  : (params) => this.formatDate(params.value)
    },
    {
      colId           : 'cliente',
      headerName      : 'Cliente',
      minWidth        : 240,
      valueGetter     : ({ data }) => data?.nomClien ?? '',
      cellRenderer    : (params: ICellRendererParams<ReporteVentasIvaGridRow>) => this.renderClientCell(params.data)
    },
    {
      headerName      : 'Exento',
      field           : 'exento',
      width           : 126,
      type            : 'numericColumn',
      cellClass       : 'number-cell',
      valueFormatter  : (params) => this.formatMoneyValue(params)
    },
    ...this.moneyColumns('1%', 'subtotaL_1', 'imP_1'),
    ...this.moneyColumns('2%', 'subtotaL_2', 'imP_2'),
    ...this.moneyColumns('4%', 'subtotaL_4', 'imP_4'),
    ...this.moneyColumns('13%', 'subtotaL_13', 'imP_13'),
    {
      headerName      : 'Exoneracion',
      field           : 'exoneracion',
      width           : 138,
      type            : 'numericColumn',
      cellClass       : 'number-cell',
      valueFormatter  : (params) => this.formatMoneyValue(params)
    },
    {
      headerName      : 'Total',
      field           : 'total',
      width           : 136,
      type            : 'numericColumn',
      cellClass       : 'number-cell total-cell',
      valueFormatter  : (params) => this.formatMoneyValue(params)
    },
    {
      headerName      : 'T.C.',
      field           : 'tcambio',
      width           : 96,
      type            : 'numericColumn',
      cellClass       : 'number-cell',
      valueFormatter  : (params) => this.formatNumber(params.value, 2)
    },
    { headerName      : 'Moneda', field           : 'moneda', width           : 96, cellClass       : 'center-cell' }
  ];

  readonly filteredRows = computed(() => {
    const filters = this.filters();
    return this.rows().filter((row) => {
      const tipoMatches = !filters.tipoDoc || this.normalize(row.tDoc) === this.normalize(filters.tipoDoc);
      const searchText = `${row.tDoc} ${row.nDocumento} ${row.codCliente} ${row.nomClien}`;
      return tipoMatches && this.includes(searchText, filters.search);
    });
  });

  readonly summary = computed<ReporteVentasIvaSummary>(() => this.buildSummary(this.filteredRows()));
  readonly visibleGridRows = computed<ReporteVentasIvaGridRow[]>(() => this.filteredRows().map((row, index) => this.detailRow(row, index)));
  readonly tipoDocumentoOptions = computed(() => [...new Set(this.rows().map((row) => row.tDoc).filter(Boolean))].sort((a, b) => a.localeCompare(b)));

  readonly kpis = computed(() => {
    const summary = this.summary();
    return [
      { label: 'Total documentos', value: this.formatNumber(summary.totalRegistros, 0), detail: `${summary.documentos} consecutivos` },
      { label: 'Total neto', value: this.formatMoney(summary.total), detail: this.filters().moneda },
      { label: 'IVA 13%', value: this.formatMoney(summary.imp13), detail: `Base ${this.formatMoney(summary.subtotal13)}` },
      { label: 'IVA otros', value: this.formatMoney(summary.imp1 + summary.imp2 + summary.imp4), detail: 'Tarifas 1%, 2% y 4%' },
      { label: 'Notas credito', value: this.formatNumber(summary.notasCredito, 0), detail: 'Documentos NCC' },
      { label: 'Clientes', value: this.formatNumber(summary.clientes, 0), detail: 'Con movimiento' }
    ];
  });

  readonly pinnedBottomRowData = computed<ReporteVentasIvaGridRow[]>(() => {
    const summary = this.summary();
    return [
      {
        __type          : 'footer',
        __key           : 'footer',
        fecha           : '',
        tDoc            : '',
        nDocumento      : `${summary.totalRegistros} registros`,
        codCliente      : '',
        nomClien        : 'Total vista',
        exento          : summary.exento,
        subtotaL_1      : summary.subtotal1,
        imP_1           : summary.imp1,
        subtotaL_2      : summary.subtotal2,
        imP_2           : summary.imp2,
        subtotaL_4      : summary.subtotal4,
        imP_4           : summary.imp4,
        subtotaL_13     : summary.subtotal13,
        imP_13          : summary.imp13,
        exoneracion     : summary.exoneracion,
        total           : summary.total,
        tcambio         : 0,
        moneda          : this.filters().moneda
      }
    ];
  });

  ngOnInit(): void {
    this.buscar();
  }

  onGridReady(event: GridReadyEvent<ReporteVentasIvaGridRow>): void {
    this.gridApi = event.api;
  }

  updateFilter<K extends keyof ReporteVentasIvaFilters>(key: K, value: ReporteVentasIvaFilters[K]): void {
    this.filters.update((current) => ({
      ...current,
      [key]: value
    }));
  }

  buscar(): void {
    const filters = this.filters();
    this.loading.set(true);
    this.errorMessage.set('');
    this.actionMessage.set('');

    this.reporteService
      .obtenerDetalle({
        Proceso: filters.proceso,
        FechaInicial: this.toApiDate(filters.fechaInicial),
        FechaFinal: this.toApiDate(filters.fechaFinal),
        Moneda: filters.moneda
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.gridApi?.deselectAll();
        },
        error: (error: unknown) => {
          this.rows.set([]);
          this.errorMessage.set(this.getErrorMessage(error));
        }
      });
  }

  exportExcel(): void {
    if (this.exportingExcel()) {
      return;
    }

    const filters = this.filters();
    this.exportingExcel.set(true);
    this.errorMessage.set('');
    this.actionMessage.set('');

    this.reporteService
      .exportarExcel({
        Proceso: filters.proceso,
        FechaInicial: this.toApiDate(filters.fechaInicial),
        FechaFinal: this.toApiDate(filters.fechaFinal),
        Moneda: filters.moneda
      })
      .pipe(finalize(() => this.exportingExcel.set(false)))
      .subscribe({
        next: (response) => {
          this.downloadExcelResponse(response);
          this.actionMessage.set('Archivo Excel generado correctamente.');
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.getErrorMessage(error));
        }
      });
  }

  rowClass = (params: RowClassParams<ReporteVentasIvaGridRow>): string => {
    const type = params.data?.__type ?? 'detail';
    return `grid-row-${type}`;
  };

  formatMoney(value: unknown): string {
    return new Intl.NumberFormat('es-CR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value ?? 0));
  }

  private moneyColumns(label: string, subtotalField: keyof ReporteVentasIvaRow, ivaField: keyof ReporteVentasIvaRow): ColDef<ReporteVentasIvaGridRow>[] {
    return [
      {
        headerName: `Base ${label}`,
        field: subtotalField,
        width: 128,
        type: 'numericColumn',
        cellClass: 'number-cell',
        valueFormatter: (params) => this.formatMoneyValue(params)
      },
      {
        headerName: `IVA ${label}`,
        field: ivaField,
        width: 124,
        type: 'numericColumn',
        cellClass: 'number-cell tax-cell',
        valueFormatter: (params) => this.formatMoneyValue(params)
      }
    ];
  }

  private detailRow(row: ReporteVentasIvaRow, index: number): ReporteVentasIvaGridRow {
    return {
      ...row,
      __type: 'detail',
      __key: `${row.tDoc}|${row.nDocumento}|${index}`
    };
  }

  private buildSummary(rows: ReporteVentasIvaRow[]): ReporteVentasIvaSummary {
    if (!rows.length) {
      return EMPTY_SUMMARY;
    }

    return {
      totalRegistros    : rows.length,
      documentos        : new Set(rows.map((row) => this.documentLabel(row))).size,
      clientes          : new Set(rows.map((row) => row.codCliente).filter(Boolean)).size,
      notasCredito      : rows.filter((row) => this.normalize(row.tDoc) === 'NCC').length,
      exento            : this.sum(rows, 'exento'),
      subtotal1         : this.sum(rows, 'subtotaL_1'),
      imp1              : this.sum(rows, 'imP_1'),
      subtotal2         : this.sum(rows, 'subtotaL_2'),
      imp2              : this.sum(rows, 'imP_2'),
      subtotal4         : this.sum(rows, 'subtotaL_4'),
      imp4              : this.sum(rows, 'imP_4'),
      subtotal13        : this.sum(rows, 'subtotaL_13'),
      imp13             : this.sum(rows, 'imP_13'),
      exoneracion       : this.sum(rows, 'exoneracion'),
      total             : this.sum(rows, 'total')
    };
  }

  private sum(rows: ReporteVentasIvaRow[], key: keyof ReporteVentasIvaRow): number {
    return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  }

  private renderDocumentCell(row: ReporteVentasIvaGridRow | undefined): string {
    if (!row) {
      return '';
    }

    if (row.__type === 'footer') {
      return `<strong>Total vista</strong><span>${this.escapeHtml(row.nDocumento)}</span>`;
    }

    return `<strong>${this.escapeHtml(row.nDocumento)}</strong><span>${this.renderDocBadge(row.tDoc)}</span>`;
  }

  private renderClientCell(row: ReporteVentasIvaGridRow | undefined): string {
    if (!row) {
      return '';
    }

    if (row.__type === 'footer') {
      return `<strong>${this.escapeHtml(row.nomClien)}</strong>`;
    }

    return `<strong>${this.escapeHtml(row.nomClien ?? '')}</strong><span>${this.escapeHtml(row.codCliente ?? '')}</span>`;
  }

  private renderDocBadge(value: string): string {
    const type = this.normalize(value) === 'NCC' ? 'credit-note' : 'document';
    return `<span class="soft-badge soft-badge-${type}">${this.escapeHtml(value)}</span>`;
  }

  private documentLabel(row: Partial<ReporteVentasIvaRow> | undefined): string {
    return [row?.tDoc, row?.nDocumento].filter(Boolean).join('-');
  }

  private formatMoneyValue(params: ValueFormatterParams<ReporteVentasIvaGridRow>): string {
    return this.formatMoney(params.value);
  }

  private formatNumber(value: unknown, decimals = 2): string {
    return new Intl.NumberFormat('es-CR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(Number(value ?? 0));
  }

  private formatDate(value: unknown): string {
    const text = String(value ?? '').trim();
    if (!text) {
      return '';
    }
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
      return text;
    }
    return new Intl.DateTimeFormat('es-CR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  private toApiDate(value: string): string {
    const [year, month, day] = value.split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private includes(value: string, search: string): boolean {
    return !search || this.normalize(value).includes(this.normalize(search));
  }

  private normalize(value: unknown): string {
    return String(value ?? '').trim().toUpperCase();
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Ocurrio un error inesperado al consultar el reporte de ventas por IVA';
  }

  private downloadExcelResponse(response: HttpResponse<Blob>): void {
    const body = response.body;
    if (!body) {
      throw new Error('No fue posible descargar el archivo Excel');
    }

    const fallbackFilename = this.buildExcelFilename();
    const filename = this.getFilenameFromContentDisposition(response.headers.get('content-disposition')) || fallbackFilename;
    const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const blob = body.type ? body : new Blob([body], { type: mimeType });
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(objectUrl), 100);
  }

  private buildExcelFilename(): string {
    const filters = this.filters();
    return `ventas-iva-${filters.fechaInicial}-${filters.fechaFinal}-${filters.moneda}.xlsx`;
  }

  private getFilenameFromContentDisposition(contentDisposition: string | null): string | null {
    if (!contentDisposition) {
      return null;
    }

    const encodedMatch = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
    if (encodedMatch?.[1]) {
      return decodeURIComponent(encodedMatch[1].trim().replace(/^"|"$/g, ''));
    }

    const filenameMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
    return filenameMatch?.[1]?.trim() || null;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return entities[char] ?? char;
    });
  }
}
