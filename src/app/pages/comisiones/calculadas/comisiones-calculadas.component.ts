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
import { Subscription, catchError, concatMap, finalize, from, map, of, toArray } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { ComisionKpiItem, ComisionKpiStripComponent } from '../components/comisiones-calculadas/comision-kpi-strip.component';
import { AgenciaComision } from '../interfaces/config-comision.interface';
import { ComisionPreviewRow, ComisionPreviewResumen } from '../interfaces/comision-preview.interface';
import { LiquidacionComisionDetalleRequest, LiquidacionComisionRequest } from '../interfaces/liquidacion-comision.interface';
import { AgenciaComisionService } from '../services/agencia-comision.service';
import { ComisionPreviewService } from '../services/comision-preview.service';
import { LiquidacionComisionService } from '../services/liquidacion-comision.service';

type GridRowType = 'detail' | 'footer';

interface ComisionPreviewFilters {
  empresaId           : number;
  fechaInicio         : string;
  fechaFin            : string;
  agencia             : string;
  servicio            : string;
  tipoPax             : string;
  tipoComision        : string;
  documento           : string;
  estadoDocumento     : string;
}

interface FinancialGridRow extends Partial<ComisionPreviewRow> {
  __type          : GridRowType;
  __key           : string;
  __label         : string;
  __count         : number;
  __documentos    : number;
  __agencias      : number;
  __servicios     : number;
}

interface LiquidacionGenerationResult {
  agencia     : string;
  nomAgencia  : string;
  ok          : boolean;
  idGenerado ?: string;
  mensaje     : string;
}

const EMPTY_RESUMEN: ComisionPreviewResumen = {
  totalRegistros        : 0,
  totalMontoBase        : 0,
  totalMontoComision    : 0
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
  private readonly liquidacionComisionService = inject(LiquidacionComisionService);
  private readonly authService = inject(AuthService);
  private gridApi?: GridApi<FinancialGridRow>;
  private previewRequest?: Subscription;

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
    rowHoverColor               : '#f1f5f9',
    selectedRowBackgroundColor  : '#edf4ff'
  });
  readonly loading = signal(false);
  readonly generandoComisiones = signal(false);
  readonly errorMessage = signal('');
  readonly actionMessage = signal('');
  readonly resultadosLiquidacion = signal<LiquidacionGenerationResult[]>([]);
  readonly agencias = signal<AgenciaComision[]>([]);
  readonly rows = signal<ComisionPreviewRow[]>([]);
  readonly selectedRows = signal<ComisionPreviewRow[]>([]);
  readonly resumen = signal<ComisionPreviewResumen>(EMPTY_RESUMEN);
  readonly filters = signal<ComisionPreviewFilters>({
    empresaId         : 1,
    fechaInicio       : this.toDateInputValue(this.addDays(new Date(), -7)),
    fechaFin          : this.toDateInputValue(new Date()),
    agencia           : '',
    servicio          : '',
    tipoPax           : '',
    tipoComision      : '',
    documento         : '',
    estadoDocumento   : ''
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
    },
    {
      headerName: 'Forma Pago',
      field: 'FormaPago',
      width: 150,
      cellClass: 'document-cell'
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
  readonly liquidacionValidationMessage = computed(() => this.getPreviewLiquidacionValidationMessage(this.rows()));

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
    this.resultadosLiquidacion.set([]);

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
    if (this.generandoComisiones()) {
      return;
    }

    const registros = this.rows();
    if (!this.validarPreviewParaLiquidacion(registros)) {
      this.errorMessage.set(this.getPreviewLiquidacionValidationMessage(registros));
      this.actionMessage.set('');
      this.resultadosLiquidacion.set([]);
      return;
    }

    const grupos = Array.from(this.agruparPreviewPorAgencia(registros).entries());
    const confirmed = window.confirm(
      'Se generaran liquidaciones de comision agrupadas por agencia. Si existen registros de varias agencias, se creara una liquidacion independiente para cada una. Desea continuar?'
    );
    if (!confirmed) {
      return;
    }

    const requests = grupos.map(([codAgencia, groupRows]) => this.crearRequestLiquidacionPorAgencia(codAgencia, groupRows));
    this.generandoComisiones.set(true);
    this.errorMessage.set('');
    this.actionMessage.set(`Generando ${requests.length} liquidaciones de comision...`);
    this.resultadosLiquidacion.set([]);

    from(requests)
      .pipe(
        concatMap((request) =>
          this.liquidacionComisionService.crearLiquidacion(request).pipe(
            map((response) => this.toLiquidacionResult(request, response)),
            catchError((error) => of(this.toLiquidacionErrorResult(request, error)))
          )
        ),
        toArray(),
        finalize(() => this.generandoComisiones.set(false))
      )
      .subscribe((results) => {
        const exitosas = results.filter((result) => result.ok).length;
        const fallidas = results.length - exitosas;
        this.resultadosLiquidacion.set(results);

        if (fallidas === 0) {
          this.actionMessage.set(`Se generaron correctamente ${exitosas} liquidaciones de comision.`);
          return;
        }

        const message = `Se generaron ${exitosas} liquidaciones correctamente y ${fallidas} presentaron errores.`;
        if (exitosas === 0) {
          this.errorMessage.set(message);
          this.actionMessage.set('');
          return;
        }

        this.errorMessage.set('');
        this.actionMessage.set(message);
      });
  }

  onSelectionChanged(): void {
    this.syncSelectedRows();
  }

  rowClass = (params: RowClassParams<FinancialGridRow>): string => {
    const type = params.data?.__type ?? 'detail';
    return `grid-row-${type}`;
  };

  private validarPreviewParaLiquidacion(registros: ComisionPreviewRow[]): boolean {
    return !this.getPreviewLiquidacionValidationMessage(registros);
  }

  private getPreviewLiquidacionValidationMessage(registros: ComisionPreviewRow[]): string {
    if (!registros.length) {
      return 'No hay comisiones calculadas para generar liquidaciones.';
    }

    if (registros.some((row) => !this.cleanText(row.CodAgencia))) {
      return 'Existen registros sin agencia asociada. Revise el preview antes de generar las liquidaciones.';
    }

    const incompleteRows = registros
      .map((row, index) => ({
        index,
        row,
        missingFields: this.getMissingLiquidacionFields(row)
      }))
      .filter((item) => item.missingFields.length);

    if (!incompleteRows.length) {
      return '';
    }

    console.groupCollapsed('[Comisiones] Registros con datos obligatorios incompletos');
    incompleteRows.forEach(({ index, row, missingFields }) => {
      console.warn('Registro incompleto para liquidacion', {
        index,
        documento: this.documentLabel(row),
        codAgencia: row.CodAgencia,
        nomAgencia: row.NomAgencia,
        missingFields,
        row
      });
    });
    console.groupEnd();

    return 'Existen registros con datos obligatorios incompletos. Revise el preview antes de generar las liquidaciones.';
  }

  private getMissingLiquidacionFields(row: ComisionPreviewRow): string[] {
    return [
      ['NomAgencia', row.NomAgencia],
      ['TipoDocumento', row.TipoDocumento],
      ['NumeroDocumento', row.NumeroDocumento],
      ['FechaDocumento', row.FechaDocumento],
      ['CodServicio', row.CodServicio],
      ['MontoBase', row.MontoBase],
      ['MontoComision', row.MontoComision]
    ]
      .filter(([, value]) => !this.hasValue(value))
      .map(([field]) => String(field));
  }

  private agruparPreviewPorAgencia(registros: ComisionPreviewRow[]): Map<string, ComisionPreviewRow[]> {
    return registros.reduce((groups, row) => {
      const codAgencia = this.cleanText(row.CodAgencia);
      const current = groups.get(codAgencia) ?? [];
      current.push(row);
      groups.set(codAgencia, current);
      return groups;
    }, new Map<string, ComisionPreviewRow[]>());
  }

  private crearRequestLiquidacionPorAgencia(codAgencia: string, registros: ComisionPreviewRow[]): LiquidacionComisionRequest {
    const first = registros[0];
    const filters = this.filters();
    const fechaInicio = this.formatearFechaParaBackend(filters.fechaInicio);
    const fechaFin = this.formatearFechaParaBackend(filters.fechaFin);

    return {
      proceso: 0,
      aD19_Id: null,
      aD19_EmpresaId: Number(filters.empresaId),
      aD19_CodAgencia: codAgencia,
      aD19_NomAgencia: this.cleanText(first?.NomAgencia),
      aD19_FechaInicio: fechaInicio,
      aD19_FechaFin: fechaFin,
      aD19_TotalFacturado: this.calcularTotalFacturado(registros),
      aD19_TotalComision: this.calcularTotalComision(registros),
      aD19_MonedaBase: this.resolverMonedaBase(registros),
      aD19_Estado: 'BORRADOR',
      aD19_Observaciones: `Liquidacion generada desde preview de comisiones. Periodo: ${fechaInicio} - ${fechaFin}.`,
      aD19_Operador: this.getOperador(),
      detalle: registros.map((row) => this.mapearDetalleLiquidacion(row))
    };
  }

  private mapearDetalleLiquidacion(registro: ComisionPreviewRow): LiquidacionComisionDetalleRequest {
    return {
      tipoDocumento: this.cleanText(registro.TipoDocumento),
      serieDocumento: this.cleanText(registro.SerieDocumento),
      numeroDocumento: this.cleanText(registro.NumeroDocumento),
      fechaDocumento: this.formatearFechaParaBackend(registro.FechaDocumento),
      codReserva: this.cleanText(registro.CodReserva),
      codServicio: this.cleanText(registro.CodServicio),
      nomServicio: this.cleanText(registro.NomServicio),
      tipoPax: this.cleanText(registro.TipoPax),
      cantidadPax: this.toNumber(registro.CantidadPax),
      montoBase: this.toNumber(registro.MontoBase),
      tipoComision: this.cleanText(registro.TipoComision),
      valorComision: this.toNumber(registro.ValorComision),
      porcentajeAplicado: this.toNumber(registro.PorcentajeAplicado),
      montoComision: this.toNumber(registro.MontoComision),
      estado: this.cleanText(registro.EstadoDocumento) || 'ACTIVO',
      formaPago: this.cleanText(registro.FormaPago)
    };
  }

  private calcularTotalFacturado(registros: ComisionPreviewRow[]): number {
    return this.sum(registros, 'MontoBase');
  }

  private calcularTotalComision(registros: ComisionPreviewRow[]): number {
    return this.sum(registros, 'MontoComision');
  }

  private formatearFechaParaBackend(fecha: string | Date): string {
    if (fecha instanceof Date) {
      return this.formatDateParts(fecha.getFullYear(), fecha.getMonth() + 1, fecha.getDate());
    }

    const text = this.cleanText(fecha);
    if (!text) {
      return '';
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
      return text;
    }

    const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDate) {
      return this.formatDateParts(Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3]));
    }

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
      return text;
    }
    return this.formatDateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }

  private resolverMonedaBase(registros: ComisionPreviewRow[]): string {
    const monedas = [...new Set(registros.map((row) => this.cleanText(row.Moneda)).filter(Boolean))];
    if (monedas.length <= 1) {
      return monedas[0] ?? '';
    }

    // TODO: reemplazar por la moneda base oficial del sistema cuando este disponible en contexto.
    return monedas[0];
  }

  private toLiquidacionResult(request: LiquidacionComisionRequest, response: unknown): LiquidacionGenerationResult {
    return {
      agencia: request.aD19_CodAgencia,
      nomAgencia: request.aD19_NomAgencia,
      ok: true,
      idGenerado: this.extractResponseText(response, ['aD19_Id', 'AD19_Id', 'idGenerado', 'numeroLiquidacion', 'AD22_NumeroLiquidacion']),
      mensaje: this.extractResponseText(response, ['mensaje', 'respuesta', 'message']) || 'Liquidacion registrada correctamente.'
    };
  }

  private toLiquidacionErrorResult(request: LiquidacionComisionRequest, error: unknown): LiquidacionGenerationResult {
    return {
      agencia: request.aD19_CodAgencia,
      nomAgencia: request.aD19_NomAgencia,
      ok: false,
      mensaje: this.extractErrorMessage(error)
    };
  }

  private extractResponseText(response: unknown, keys: string[]): string {
    if (typeof response === 'string') {
      return response;
    }
    if (!response || typeof response !== 'object') {
      return '';
    }

    const record = response as Record<string, unknown>;
    const nested = [record, record['data'], record['datos']].filter((value): value is Record<string, unknown> => !!value && typeof value === 'object');
    for (const item of nested) {
      for (const key of keys) {
        const value = this.cleanText(item[key]);
        if (value) {
          return value;
        }
      }
    }
    return '';
  }

  private extractErrorMessage(error: unknown): string {
    if (!error || typeof error !== 'object') {
      return 'Error al registrar liquidacion.';
    }
    const record = error as Record<string, unknown>;
    const payload = record['error'];
    if (typeof payload === 'string') {
      return payload;
    }
    const payloadRecord = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : record;
    return this.extractResponseText(payloadRecord, ['mensaje', 'respuesta', 'message', 'title']) || 'Error al registrar liquidacion.';
  }

  private hasValue(value: unknown): boolean {
    return value !== null && value !== undefined && String(value).trim() !== '';
  }

  private cleanText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private toNumber(value: unknown): number {
    return Number(value ?? 0) || 0;
  }

  private formatDateParts(year: number, month: number, day: number): string {
    return `${this.pad2(day)}/${this.pad2(month)}/${year}`;
  }

  private pad2(value: number): string {
    return String(value).padStart(2, '0');
  }

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
