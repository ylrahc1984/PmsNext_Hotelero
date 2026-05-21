import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  Module,
  RowClassParams,
  RowSelectionOptions,
  Theme,
  ValueFormatterParams,
  themeQuartz
} from 'ag-grid-community';
import { Subscription, catchError, finalize, of } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { ComisionKpiItem, ComisionKpiStripComponent } from '../components/comisiones-calculadas/comision-kpi-strip.component';
import { AgenciaComision } from '../interfaces/config-comision.interface';
import { ComisionPreviewRow, ComisionPreviewResumen } from '../interfaces/comision-preview.interface';
import { AgenciaComisionService } from '../services/agencia-comision.service';
import { ComisionPreviewService } from '../services/comision-preview.service';

type GridRowType = 'detail' | 'footer';

interface ComisionPreviewFilters {
  empresaId: number;
  fechaInicio: string;
  fechaFin: string;
  agencia: string;
  servicio: string;
  tipoPax: string;
  tipoComision: string;
  documento: string;
  estadoDocumento: string;
}

interface FinancialGridRow extends Partial<ComisionPreviewRow> {
  __type: GridRowType;
  __key: string;
  __label: string;
  __count: number;
  __documentos: number;
  __agencias: number;
  __servicios: number;
}

const EMPTY_RESUMEN: ComisionPreviewResumen = {
  totalRegistros: 0,
  totalMontoBase: 0,
  totalMontoComision: 0
};

@Component({
  selector: 'app-comisiones-calculadas',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, ComisionKpiStripComponent],
  templateUrl: './comisiones-calculadas.component.html',
  styleUrl: './comisiones-calculadas.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComisionesCalculadasComponent implements OnInit {
  private readonly agenciaComisionService = inject(AgenciaComisionService);
  private readonly previewService = inject(ComisionPreviewService);
  private readonly authService = inject(AuthService);
  private gridApi?: GridApi<FinancialGridRow>;
  private previewRequest?: Subscription;

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
    rowHoverColor: '#f1f5f9',
    selectedRowBackgroundColor: '#edf4ff'
  });
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly actionMessage = signal('');
  readonly agencias = signal<AgenciaComision[]>([]);
  readonly rows = signal<ComisionPreviewRow[]>([]);
  readonly selectedRows = signal<ComisionPreviewRow[]>([]);
  readonly resumen = signal<ComisionPreviewResumen>(EMPTY_RESUMEN);
  readonly filters = signal<ComisionPreviewFilters>({
    empresaId: 1,
    fechaInicio: this.toDateInputValue(this.addDays(new Date(), -7)),
    fechaFin: this.toDateInputValue(new Date()),
    agencia: '',
    servicio: '',
    tipoPax: '',
    tipoComision: '',
    documento: '',
    estadoDocumento: ''
  });

  readonly defaultColDef: ColDef<FinancialGridRow> = {
    filter: true,
    resizable: true,
    sortable: true,
    suppressHeaderMenuButton: false
  };

  readonly rowSelection: RowSelectionOptions<FinancialGridRow> = {
    mode: 'multiRow',
    checkboxes: true,
    headerCheckbox: false,
    enableClickSelection: false,
    isRowSelectable: (row) => row.data?.__type === 'detail'
  };

  readonly columnDefs: ColDef<FinancialGridRow>[] = [
    {
      colId: 'agencia',
      headerName: 'Agencia',
      minWidth: 230,
      pinned: 'left',
      lockPinned: true,
      valueGetter: ({ data }) => data?.NomAgencia ?? '',
      cellRenderer: (params: ICellRendererParams<FinancialGridRow>) => this.renderAgencyCell(params.data),
      cellClass: 'agency-cell'
    },
    {
      colId: 'documento',
      headerName: 'Documento',
      minWidth: 180,
      pinned: 'left',
      lockPinned: true,
      valueGetter: ({ data }) => this.documentLabel(data),
      cellRenderer: (params: ICellRendererParams<FinancialGridRow>) => this.renderDocumentCell(params.data),
      cellClass: 'document-cell'
    },
    {
      headerName: 'Fecha',
      field: 'FechaDocumento',
      width: 118,
      cellClass: 'date-cell',
      valueFormatter: (params) => this.formatDate(params.value)
    },
    {
      headerName: 'Reserva',
      field: 'CodReserva',
      width: 118,
      cellClass: 'document-cell'
    },
    {
      headerName: 'Servicio',
      colId: 'servicio',
      minWidth: 230,
      valueGetter: ({ data }) => data?.NomServicio ?? '',
      cellRenderer: (params: ICellRendererParams<FinancialGridRow>) => this.renderServiceCell(params.data)
    },
    { headerName: 'Tipo Pax', field: 'TipoPax', width: 110, cellClass: 'center-cell' },
    {
      headerName: 'Pax',
      field: 'CantidadPax',
      width: 88,
      type: 'numericColumn',
      cellClass: 'number-cell',
      valueFormatter: (params) => this.formatNumber(params.value, 0)
    },
    {
      headerName: 'Monto Base',
      field: 'MontoBase',
      width: 150,
      type: 'numericColumn',
      cellClass: 'number-cell money-cell',
      valueFormatter: (params) => this.formatMoneyValue(params)
    },
    {
      headerName: 'Tipo Comision',
      field: 'TipoComision',
      width: 138,
      cellRenderer: (params: ICellRendererParams<FinancialGridRow>) => this.renderTypeBadge(params.value)
    },
    {
      headerName: 'Valor',
      field: 'ValorComision',
      width: 120,
      type: 'numericColumn',
      cellClass: 'number-cell money-cell',
      valueFormatter: (params) => this.formatCommissionValue(params)
    },
    {
      headerName: 'Monto Comision',
      field: 'MontoComision',
      width: 165,
      type: 'numericColumn',
      cellClass: 'number-cell commission-cell',
      valueFormatter: (params) => this.formatMoneyValue(params)
    },
    {
      headerName: 'Estado',
      field: 'EstadoDocumento',
      width: 136,
      cellRenderer: (params: ICellRendererParams<FinancialGridRow>) => this.renderStatusBadge(params.value)
    }
  ];

  readonly filteredRows = computed(() => {
    const filters = this.filters();
    const codAgencia = this.extractAgencyCode(filters.agencia);
    return this.rows().filter((row) => {
      const documentText = this.normalize(`${row.TipoDocumento} ${row.SerieDocumento} ${row.NumeroDocumento}`);
      return (
        this.matchesAgency(row, filters.agencia, codAgencia) &&
        this.includes(`${row.CodServicio} ${row.NomServicio}`, filters.servicio) &&
        this.matches(row.TipoPax, filters.tipoPax) &&
        this.matches(row.TipoComision, filters.tipoComision) &&
        this.includes(documentText, filters.documento) &&
        this.matches(row.EstadoDocumento, filters.estadoDocumento)
      );
    });
  });

  readonly financialSummary = computed(() => {
    const rows = this.filteredRows();
    return {
      totalRegistros: rows.length,
      totalMontoBase: this.sum(rows, 'MontoBase'),
      totalMontoComision: this.sum(rows, 'MontoComision'),
      agencias: new Set(rows.map((row) => row.CodAgencia).filter(Boolean)).size,
      servicios: new Set(rows.map((row) => row.CodServicio).filter(Boolean)).size,
      documentos: new Set(rows.map((row) => this.documentLabel(row)).filter(Boolean)).size
    };
  });

  readonly selectedSummary = computed(() => {
    const rows = this.selectedRows();
    return {
      totalRegistros: rows.length,
      totalMontoBase: this.sum(rows, 'MontoBase'),
      totalMontoComision: this.sum(rows, 'MontoComision'),
      agencias: new Set(rows.map((row) => row.CodAgencia).filter(Boolean)).size,
      documentos: new Set(rows.map((row) => this.documentLabel(row)).filter(Boolean)).size
    };
  });

  readonly kpis = computed<ComisionKpiItem[]>(() => {
    const summary = this.financialSummary();
    const apiSummary = this.resumen();
    return [
      { label: 'Total registros', value: this.formatNumber(summary.totalRegistros, 0), detail: `${apiSummary.totalRegistros} desde API` },
      { label: 'Total monto base', value: this.formatMoney(summary.totalMontoBase), detail: 'Base comisionable' },
      { label: 'Total comision', value: this.formatMoney(summary.totalMontoComision), detail: 'Preview calculado' },
      { label: 'Agencias', value: this.formatNumber(summary.agencias, 0), detail: 'Con movimiento' },
      { label: 'Servicios', value: this.formatNumber(summary.servicios, 0), detail: 'Comisionables' },
      { label: 'Documentos', value: this.formatNumber(summary.documentos, 0), detail: 'Agrupados' }
    ];
  });

  readonly visibleGridRows = computed<FinancialGridRow[]>(() => this.buildFinancialGridRows(this.filteredRows()));

  readonly pinnedBottomRowData = computed<FinancialGridRow[]>(() => {
    const selected = this.selectedSummary();
    const summary = selected.totalRegistros ? selected : this.financialSummary();
    return [
      {
        __type: 'footer',
        __key: 'footer',
        __label: selected.totalRegistros ? 'Total seleccion' : 'Total vista',
        __count: summary.totalRegistros,
        __documentos: summary.documentos,
        __agencias: summary.agencias,
        __servicios: this.financialSummary().servicios,
        NomAgencia: selected.totalRegistros ? 'Total seleccion' : 'Total vista',
        NumeroDocumento: `${summary.totalRegistros} registros`,
        MontoBase: summary.totalMontoBase,
        MontoComision: summary.totalMontoComision
      }
    ];
  });

  readonly agenciaOptions = computed(() =>
    this.agencias()
      .filter((agencia) => agencia.aD15_Activo && agencia.aD15_Comisiona)
      .map((agencia) => this.agenciaOptionLabel(agencia))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  );
  readonly servicioOptions = computed(() => this.uniqueOptions(this.rows(), (row) => `${row.CodServicio} - ${row.NomServicio}`));
  readonly tipoPaxOptions = computed(() => this.uniqueOptions(this.rows(), (row) => row.TipoPax));
  readonly tipoComisionOptions = computed(() => this.uniqueOptions(this.rows(), (row) => row.TipoComision));
  readonly estadoDocumentoOptions = computed(() => this.uniqueOptions(this.rows(), (row) => row.EstadoDocumento));

  ngOnInit(): void {
    this.loadAgencias();
  }

  onGridReady(event: GridReadyEvent<FinancialGridRow>): void {
    this.gridApi = event.api;
  }

  updateFilter<K extends keyof ComisionPreviewFilters>(key: K, value: ComisionPreviewFilters[K]): void {
    this.filters.update((current) => ({
      ...current,
      [key]: value,
      ...(key === 'empresaId' ? { agencia: '' } : {})
    }));
    this.gridApi?.deselectAll();
    if (key === 'empresaId') {
      this.loadAgencias();
    }
  }

  generarPreview(): void {
    const filters = this.filters();
    const codAgencia = this.extractAgencyCode(filters.agencia);
    this.previewRequest?.unsubscribe();
    this.loading.set(true);
    this.errorMessage.set('');
    this.actionMessage.set('');

    this.previewRequest = this.previewService
      .obtenerPreview({
        empresaId: Number(filters.empresaId),
        fechaInicio: this.toApiDate(filters.fechaInicio),
        fechaFin: this.toApiDate(filters.fechaFin),
        operador: this.getOperador(),
        codAgencia
      })
      .pipe(
        catchError(() => {
          this.errorMessage.set('No se pudo generar el preview de comisiones.');
          return of({ datos: [], resumen: EMPTY_RESUMEN });
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe((response) => {
        this.rows.set(response.datos);
        this.resumen.set(response.resumen);
        this.selectedRows.set([]);
        this.gridApi?.deselectAll();
      });
  }

  private loadAgencias(): void {
    this.agenciaComisionService
      .list(this.filters().empresaId)
      .pipe(catchError(() => of([] as AgenciaComision[])))
      .subscribe((agencias) => this.agencias.set(agencias));
  }

  recalcular(): void {
    this.generarPreview();
  }

  selectAll(): void {
    this.gridApi?.selectAll();
    this.syncSelectedRows();
  }

  clearSelection(): void {
    this.gridApi?.deselectAll();
    this.selectedRows.set([]);
  }

  exportExcel(): void {
    this.gridApi?.exportDataAsCsv({
      fileName: `preview-comisiones-${this.toDateInputValue(new Date())}.csv`,
      onlySelected: this.selectedRows().length > 0
    });
  }

  generarComisiones(): void {
    const selected = this.selectedRows().length;
    this.actionMessage.set(
      selected
        ? `${selected} lineas listas para generar comisiones cuando se conecte el endpoint de liquidacion.`
        : 'Seleccione lineas del preview para generar comisiones.'
    );
  }

  onSelectionChanged(): void {
    this.syncSelectedRows();
  }

  rowClass = (params: RowClassParams<FinancialGridRow>): string => {
    const type = params.data?.__type ?? 'detail';
    return `grid-row-${type}`;
  };

  private buildFinancialGridRows(rows: ComisionPreviewRow[]): FinancialGridRow[] {
    return [...rows]
      .sort((a, b) =>
      `${a.NomAgencia}|${this.documentLabel(a)}|${a.NomServicio}|${a.TipoPax}`.localeCompare(
        `${b.NomAgencia}|${this.documentLabel(b)}|${b.NomServicio}|${b.TipoPax}`
      )
      )
      .map((row, index) => this.detailRow(row, `${row.CodAgencia}|${this.documentLabel(row)}|${row.CodServicio}|${index}`));
  }

  private detailRow(row: ComisionPreviewRow, key: string): FinancialGridRow {
    return {
      ...row,
      __type: 'detail',
      __key: key,
      __label: this.documentLabel(row),
      __count: 1,
      __documentos: 1,
      __agencias: 1,
      __servicios: 1
    };
  }

  private syncSelectedRows(): void {
    const selected = this.gridApi?.getSelectedRows().filter((row) => row.__type === 'detail') ?? [];
    this.selectedRows.set(selected as ComisionPreviewRow[]);
  }

  private renderAgencyCell(row: FinancialGridRow | undefined): string {
    if (!row) {
      return '';
    }

    if (row.__type === 'footer') {
      return `<strong>${this.escapeHtml(row.__label)}</strong><span>${row.__agencias} agencias | ${row.__documentos} documentos</span>`;
    }

    return `<strong>${this.escapeHtml(row.NomAgencia ?? '')}</strong>`;
  }

  private renderDocumentCell(row: FinancialGridRow | undefined): string {
    if (!row) {
      return '';
    }
    if (row.__type === 'footer') {
      return `<strong>${row.__count} registros</strong><span>${row.__documentos} documentos</span>`;
    }
    return `<strong>${this.escapeHtml(this.documentLabel(row))}</strong>`;
  }

  private renderServiceCell(row: FinancialGridRow | undefined): string {
    if (!row || row.__type === 'footer') {
      return '';
    }
    return `<strong>${this.escapeHtml(row.NomServicio ?? '')}</strong>`;
  }

  private renderTypeBadge(value: unknown): string {
    const text = String(value ?? '').trim();
    if (!text) {
      return '';
    }
    const type = this.normalize(text).includes('PORC') ? 'percentage' : 'fixed';
    return this.renderBadge(text, type);
  }

  private renderStatusBadge(value: unknown): string {
    const text = String(value ?? '').trim() || 'PENDIENTE';
    const status = this.normalize(text).includes('PEND') ? 'pending' : 'document';
    return this.renderBadge(text, status);
  }

  private renderBadge(value: unknown, type: string): string {
    const text = String(value ?? '').trim();
    return text ? `<span class="soft-badge soft-badge-${type}">${this.escapeHtml(text)}</span>` : '';
  }

  private ruleTooltip(row: FinancialGridRow | undefined): string {
    if (!row || row.__type !== 'detail') {
      return '';
    }
    return [
      `Regla: ${row.ReglaId ?? ''}`,
      `Agencia: ${this.agencyLabel(row)}`,
      `Servicio: ${this.serviceLabel(row)}`,
      `Tipo Pax: ${row.TipoPax ?? ''}`,
      `Tipo Comision: ${row.TipoComision ?? ''}`,
      `Valor: ${row.ValorComision ?? 0}`,
      `Prioridad: ${row.PrioridadRegla ?? ''}`
    ].join('\n');
  }

  private documentLabel(row: Partial<ComisionPreviewRow> | undefined): string {
    if (!row) {
      return '';
    }
    return [row.TipoDocumento, row.SerieDocumento, row.NumeroDocumento].filter(Boolean).join('-');
  }

  private agencyLabel(row: Partial<ComisionPreviewRow> | undefined): string {
    return [row?.CodAgencia, row?.NomAgencia].filter(Boolean).join(' - ');
  }

  private serviceLabel(row: Partial<ComisionPreviewRow> | undefined): string {
    const service = [row?.CodServicio, row?.NomServicio].filter(Boolean).join(' - ');
    return [service, row?.TipoPax].filter(Boolean).join(' / ');
  }

  private uniqueOptions(rows: ComisionPreviewRow[], selector: (row: ComisionPreviewRow) => string): string[] {
    return [...new Set(rows.map(selector).map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  private extractAgencyCode(value: string): string | undefined {
    const text = value.trim();
    if (!text) {
      return undefined;
    }
    const [code] = text.split(' - ');
    return code.trim() || undefined;
  }

  private agenciaOptionLabel(agencia: AgenciaComision): string {
    return [agencia.aD15_CodAgencia, agencia.MPV00_NomClien].filter(Boolean).join(' - ');
  }

  private sum<T extends Partial<ComisionPreviewRow>>(rows: T[], key: 'MontoBase' | 'MontoComision'): number {
    return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  }

  private includes(value: string, search: string): boolean {
    return !search || this.normalize(value).includes(this.normalize(search));
  }

  private matchesAgency(row: ComisionPreviewRow, search: string, codAgencia: string | undefined): boolean {
    if (!search) {
      return true;
    }

    if (codAgencia && this.normalize(row.CodAgencia ?? '') === this.normalize(codAgencia)) {
      return true;
    }

    return this.includes(`${row.CodAgencia} ${row.NomAgencia}`, search);
  }

  private matches(value: string | undefined, search: string): boolean {
    return !search || this.normalize(value ?? '') === this.normalize(search);
  }

  private normalize(value: string): string {
    return value.toString().trim().toUpperCase();
  }

  private formatMoneyValue(params: ValueFormatterParams<FinancialGridRow>): string {
    const value = Number(params.value ?? 0);
    return this.formatMoney(value);
  }

  private formatCommissionValue(params: ValueFormatterParams<FinancialGridRow>): string {
    if (params.data?.__type !== 'detail') {
      return '';
    }
    const type = this.normalize(params.data.TipoComision ?? '');
    const value = Number(params.value ?? 0);
    return type.includes('PORC') ? `${this.formatNumber(value, 2)}%` : this.formatMoney(value);
  }

  private formatMoney(value: number): string {
    return new Intl.NumberFormat('es-CR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value ?? 0));
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
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
      return text;
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
    return date.toISOString().slice(0, 10);
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? 'CHARLY';
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
