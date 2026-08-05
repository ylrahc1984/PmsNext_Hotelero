import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  ColDef,
  ICellRendererParams,
  Module,
  RowClassParams,
  Theme,
  ValueFormatterParams,
  themeQuartz
} from 'ag-grid-community';
import { finalize } from 'rxjs';

import { PuntoVentaUI } from 'src/app/demo/administracion/usuarios/usuario.models';
import { UsuarioService } from 'src/app/demo/administracion/usuarios/usuario.service';
import { ReporteVentasIvaService } from '../services/reporte-ventas-iva.service';
import {
  EMPTY_REPORTE_VENTAS_IVA_RESUMEN,
  ReporteVentasIvaRow,
  ReporteVentasIvaResumen
} from './reporte-ventas-iva.interface';

type GridRowType = 'detail' | 'footer';

interface ReporteVentasIvaFilters {
  fechaInicial : string;
  fechaFinal   : string;
  moneda       : string;
  pntVenta     : string;
  tipoDoc      : string;
  search       : string;
}

interface ReporteVentasIvaGridRow extends ReporteVentasIvaRow {
  __type : GridRowType;
  __key  : string;
}

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
  private readonly usuarioService = inject(UsuarioService);
  private readonly destroyRef = inject(DestroyRef);

  readonly gridModules: Module[] = [AllCommunityModule];
  readonly gridTheme: Theme = themeQuartz.withParams({
    accentColor: '#4f6f8f',
    backgroundColor: '#ffffff',
    borderColor: '#e1e7ef',
    browserColorScheme: 'light',
    fontFamily: 'Inter, Segoe UI, system-ui, sans-serif',
    fontSize: 12,
    foregroundColor: '#1f2937',
    headerBackgroundColor: '#f8fafc',
    headerTextColor: '#344054',
    oddRowBackgroundColor: '#fbfcfe',
    rowHoverColor: '#f1f5f9'
  });

  readonly loading = signal(false);
  readonly puntosVentaLoading = signal(false);
  readonly errorMessage = signal('');
  readonly puntosVenta = signal<PuntoVentaUI[]>([]);
  readonly rows = signal<ReporteVentasIvaRow[]>([]);
  readonly serverSummary = signal<ReporteVentasIvaResumen>({ ...EMPTY_REPORTE_VENTAS_IVA_RESUMEN });
  readonly filters = signal<ReporteVentasIvaFilters>({
    fechaInicial: this.toDateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    fechaFinal: this.toDateInputValue(new Date()),
    moneda: 'COL',
    pntVenta: '',
    tipoDoc: '',
    search: ''
  });

  readonly defaultColDef: ColDef<ReporteVentasIvaGridRow> = {
    filter: true,
    resizable: true,
    sortable: true,
    suppressHeaderMenuButton: false
  };

  readonly columnDefs: ColDef<ReporteVentasIvaGridRow>[] = [
    {
      colId: 'documento',
      headerName: 'Documento',
      minWidth: 220,
      pinned: 'left',
      lockPinned: true,
      valueGetter: ({ data }) => this.documentLabel(data),
      cellRenderer: (params: ICellRendererParams<ReporteVentasIvaGridRow>) => this.renderDocumentCell(params.data),
      cellClass: 'document-cell'
    },
    {
      headerName: 'Fecha',
      field: 'fecha',
      width: 118,
      cellClass: 'date-cell',
      valueFormatter: (params) => this.formatDate(params.value)
    },
    {
      colId: 'cliente',
      headerName: 'Cliente',
      minWidth: 240,
      valueGetter: ({ data }) => data?.nomClien ?? '',
      cellRenderer: (params: ICellRendererParams<ReporteVentasIvaGridRow>) => this.renderClientCell(params.data)
    },
    this.moneyColumn('Exento', 'exento'),
    this.moneyColumn('Subtotal', 'subtotal'),
    this.moneyColumn('IVA', 'imP_IVA', 'number-cell tax-cell'),
    this.moneyColumn('Servicio', 'imP_SRV'),
    this.moneyColumn('Exoneración', 'exoneracion'),
    this.moneyColumn('Total', 'total', 'number-cell total-cell'),
    {
      headerName: 'T.C.',
      field: 'tcambio',
      width: 96,
      type: 'numericColumn',
      cellClass: 'number-cell',
      valueFormatter: (params) => this.formatNumber(params.value, 2)
    },
    { headerName: 'Moneda', field: 'moneda', width: 96, cellClass: 'center-cell' }
  ];

  readonly filteredRows = computed(() => {
    const filters = this.filters();
    return this.rows().filter((row) => {
      const tipoMatches = !filters.tipoDoc || this.normalize(row.tDoc) === this.normalize(filters.tipoDoc);
      const searchText = `${row.tDoc} ${row.nDocumento} ${row.codCliente} ${row.nomClien}`;
      return tipoMatches && this.includes(searchText, filters.search);
    });
  });

  readonly hasLocalFilters = computed(() => Boolean(this.filters().tipoDoc || this.filters().search.trim()));
  readonly summary = computed<ReporteVentasIvaResumen>(() =>
    this.hasLocalFilters() ? this.buildSummary(this.filteredRows()) : this.serverSummary()
  );
  readonly visibleGridRows = computed<ReporteVentasIvaGridRow[]>(() =>
    this.filteredRows().map((row, index) => this.detailRow(row, index))
  );
  readonly tipoDocumentoOptions = computed(() =>
    [...new Set(this.rows().map((row) => row.tDoc).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  );
  readonly puntoVentaSeleccionado = computed(() =>
    this.puntosVenta().find((item) => item.codigo === this.filters().pntVenta)
  );

  readonly kpis = computed(() => {
    const summary = this.summary();
    const notasCredito = this.filteredRows().filter((row) => this.isNotaCredito(row.tDoc)).length;
    return [
      { label: 'Documentos', value: this.formatNumber(summary.cantidadDocumentos, 0), detail: `${notasCredito} notas de crédito` },
      { label: 'Total general', value: this.formatMoney(summary.totalGeneral), detail: this.filters().moneda },
      { label: 'Subtotal', value: this.formatMoney(summary.totalSubtotal), detail: 'Base de venta' },
      { label: 'IVA', value: this.formatMoney(summary.totalIVA), detail: 'Impuesto al valor agregado' },
      { label: 'Servicio', value: this.formatMoney(summary.totalSRV), detail: 'Impuesto de servicio' },
      { label: 'Exoneración', value: this.formatMoney(summary.totalExoneracion), detail: `Exento ${this.formatMoney(summary.totalExento)}` }
    ];
  });

  readonly pinnedBottomRowData = computed<ReporteVentasIvaGridRow[]>(() => {
    const summary = this.summary();
    return [{
      __type: 'footer',
      __key: 'footer',
      fecha: '',
      tDoc: '',
      nDocumento: `${summary.cantidadDocumentos} registros`,
      codCliente: '',
      nomClien: 'Total vista',
      exento: summary.totalExento,
      subtotal: summary.totalSubtotal,
      imP_IVA: summary.totalIVA,
      imP_SRV: summary.totalSRV,
      exoneracion: summary.totalExoneracion,
      total: summary.totalGeneral,
      tcambio: 0,
      moneda: this.filters().moneda
    }];
  });

  ngOnInit(): void {
    this.cargarPuntosVenta();
  }

  updateFilter<K extends keyof ReporteVentasIvaFilters>(key: K, value: ReporteVentasIvaFilters[K]): void {
    this.filters.update((current) => ({ ...current, [key]: value }));
  }

  buscar(): void {
    const filters = this.filters();
    this.errorMessage.set('');

    if (!filters.fechaInicial || !filters.fechaFinal || !filters.moneda || !filters.pntVenta) {
      this.errorMessage.set('Complete las fechas, la moneda y el punto de venta.');
      return;
    }
    if (filters.fechaInicial > filters.fechaFinal) {
      this.errorMessage.set('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }

    this.loading.set(true);
    this.reporteService
      .obtenerDetalle({
        fechaInicial: this.toApiDate(filters.fechaInicial),
        fechaFinal: this.toApiDate(filters.fechaFinal),
        moneda: filters.moneda,
        pntVenta: filters.pntVenta
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          this.rows.set(response.detalle);
          this.serverSummary.set(response.resumen);
        },
        error: (error: unknown) => {
          this.rows.set([]);
          this.serverSummary.set({ ...EMPTY_REPORTE_VENTAS_IVA_RESUMEN });
          this.errorMessage.set(this.getErrorMessage(error));
        }
      });
  }

  rowClass = (params: RowClassParams<ReporteVentasIvaGridRow>): string =>
    `grid-row-${params.data?.__type ?? 'detail'}`;

  formatMoney(value: unknown): string {
    return new Intl.NumberFormat('es-CR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value ?? 0));
  }

  private cargarPuntosVenta(): void {
    this.puntosVentaLoading.set(true);
    this.usuarioService
      .getPuntosVenta()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.puntosVentaLoading.set(false))
      )
      .subscribe({
        next: (response) => {
          const puntos = (response ?? [])
            .filter((item) => Boolean(item.codigo))
            .sort((a, b) => a.orden - b.orden || a.descripcion.localeCompare(b.descripcion));
          this.puntosVenta.set(puntos);
          if (!puntos.length) {
            this.errorMessage.set('No hay puntos de venta disponibles para consultar el reporte.');
            return;
          }
          this.updateFilter('pntVenta', puntos[0].codigo);
          this.buscar();
        },
        error: () => {
          this.puntosVenta.set([]);
          this.errorMessage.set('No se pudo cargar el catálogo de puntos de venta.');
        }
      });
  }

  private moneyColumn(
    headerName: string,
    field: 'exento' | 'subtotal' | 'imP_IVA' | 'imP_SRV' | 'exoneracion' | 'total',
    cellClass = 'number-cell'
  ): ColDef<ReporteVentasIvaGridRow> {
    return {
      headerName,
      field,
      width: 132,
      type: 'numericColumn',
      cellClass,
      valueFormatter: (params) => this.formatMoneyValue(params)
    };
  }

  private detailRow(row: ReporteVentasIvaRow, index: number): ReporteVentasIvaGridRow {
    return { ...row, __type: 'detail', __key: `${row.tDoc}|${row.nDocumento}|${index}` };
  }

  private buildSummary(rows: ReporteVentasIvaRow[]): ReporteVentasIvaResumen {
    return {
      totalExento: this.sum(rows, 'exento'),
      totalSubtotal: this.sum(rows, 'subtotal'),
      totalIVA: this.sum(rows, 'imP_IVA'),
      totalSRV: this.sum(rows, 'imP_SRV'),
      totalExoneracion: this.sum(rows, 'exoneracion'),
      totalGeneral: this.sum(rows, 'total'),
      cantidadDocumentos: rows.length
    };
  }

  private sum(rows: ReporteVentasIvaRow[], key: keyof ReporteVentasIvaRow): number {
    return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  }

  private renderDocumentCell(row: ReporteVentasIvaGridRow | undefined): string {
    if (!row) return '';
    if (row.__type === 'footer') {
      return `<strong>Total vista</strong><span>${this.escapeHtml(row.nDocumento)}</span>`;
    }
    return `<strong>${this.escapeHtml(row.nDocumento)}</strong><span>${this.renderDocBadge(row.tDoc)}</span>`;
  }

  private renderClientCell(row: ReporteVentasIvaGridRow | undefined): string {
    if (!row) return '';
    if (row.__type === 'footer') return `<strong>${this.escapeHtml(row.nomClien)}</strong>`;
    return `<strong>${this.escapeHtml(row.nomClien ?? '')}</strong><span>${this.escapeHtml(row.codCliente ?? '')}</span>`;
  }

  private renderDocBadge(value: string): string {
    const type = this.isNotaCredito(value) ? 'credit-note' : 'document';
    return `<span class="soft-badge soft-badge-${type}">${this.escapeHtml(value)}</span>`;
  }

  private isNotaCredito(value: string): boolean {
    return this.normalize(value).startsWith('NC');
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
    if (!text) return '';
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return text;
    return new Intl.DateTimeFormat('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
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
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Ocurrió un error al consultar los documentos y notas de crédito.';
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
