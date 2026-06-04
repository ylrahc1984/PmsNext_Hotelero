import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { ClienteService } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.service';
import { ClienteUI } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.models';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ForecastActividadesService } from './forecast-actividades.service';
import {
  ForecastActividadesResponse,
  ForecastBloqueOperativo,
  ForecastCapacidadProyectada,
  ForecastKpis,
  ForecastMatrizActividad,
  ForecastMatrizCelda,
  ForecastMatrizResultado,
  ForecastOperacionDetalle,
  ForecastSemaforoSaturacion
} from './models/forecast-actividades.model';

type ForecastVistaRango = 'semana' | 'quincena' | 'mes';

interface ForecastVistaOption {
  key: ForecastVistaRango;
  label: string;
  days: number;
}

@Component({
  selector: 'app-forecast-actividades',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SharedModule],
  templateUrl: './forecast-actividades.component.html',
  styleUrls: ['./forecast-actividades.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForecastActividadesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly forecastService = inject(ForecastActividadesService);
  private readonly clienteService = inject(ClienteService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  private readonly capacidadBaseDefault = 15;
  private readonly agenciaSearchMinLength = 2;
  private readonly ordenServiciosForecast = new Map<string, number>([
    ['00001', 1],
    ['00036', 2],
    ['00038', 3],
    ['00026', 4],
    ['00027', 5],
    ['00002', 6],
    ['00035', 7],
    ['00033', 8],
    ['00041', 9],
    ['00004', 10],
    ['00032', 11],
    ['00030', 12],
    ['00018', 13],
    ['00031', 14],
    ['00028', 15],
    ['00000', 16],
    ['00037', 17],
    ['00003', 18],
    ['00034', 19],
    ['00013', 20],
    ['00039', 21],
    ['00014', 22]
  ]);

  readonly today = this.toDateInput(new Date());
  readonly vistaOptions: ForecastVistaOption[] = [
    { key: 'semana', label: 'Semana', days: 7 },
    { key: 'quincena', label: 'Quincena', days: 15 },
    { key: 'mes', label: 'Mes', days: 30 }
  ];

  readonly form = this.fb.nonNullable.group({
    fechaInicio: [this.today, Validators.required],
    fechaFin: [this.toDateInput(this.addDays(new Date(), 6)), Validators.required],
    vista: ['semana' as ForecastVistaRango],
    busquedaActividad: [''],
    agenciaId: [''],
    bloqueHora: [''],
    soloNoProcesados: [false],
    soloAltaSaturacion: [false],
    vistaCompacta: [false]
  });

  loading = false;
  hasLoaded = false;
  error: string | null = null;
  lastUpdatedAt: Date | null = null;

  agenciaSearchTerm = '';
  agenciaSearchResults: ClienteUI[] = [];
  agenciaSearchOpen = false;
  agenciaSearchLoading = false;
  agenciaSearchError: string | null = null;
  selectedAgencia: ClienteUI | null = null;

  bloquesHoraDisponibles: string[] = [];
  fechasVisibles: string[] = [];
  filasVisibles: ForecastMatrizActividad[] = [];

  kpis: ForecastKpis = this.emptyKpis();
  gridTemplateColumns = 'minmax(230px, 230px) repeat(1, minmax(190px, 1fr))';
  matrixMinWidthPx = 680;

  private matrizBase: ForecastMatrizResultado = this.emptyMatrix();
  private agenciaSearchRequestId = 0;
  private agenciaSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private agenciaSearchBlurTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.form.valueChanges.pipe(debounceTime(120), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.applyLocalFilters();
    });

    this.form.controls.busquedaActividad.valueChanges
      .pipe(debounceTime(320), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.consultar();
      });

    this.destroyRef.onDestroy(() => {
      this.clearAgenciaSearchBlurTimer();
      this.cancelAgenciaSearchRequests();
    });

    this.consultar();
  }

  consultar(): void {
    if (this.form.controls.fechaInicio.invalid || this.form.controls.fechaFin.invalid) {
      this.form.controls.fechaInicio.markAsTouched();
      this.form.controls.fechaFin.markAsTouched();
      return;
    }

    const fechaInicio = this.form.controls.fechaInicio.value;
    const fechaFin = this.form.controls.fechaFin.value;

    if (fechaInicio > fechaFin) {
      this.error = 'El rango de fechas no es válido. La fecha inicio debe ser menor o igual a la fecha fin.';
      this.hasLoaded = true;
      this.matrizBase = this.emptyMatrix();
      this.applyLocalFilters();
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.forecastService
      .getForecastActividades({
        fechaInicio,
        fechaFin,
        busqueda: this.textValue(this.form.controls.busquedaActividad.value),
        agenciaId: this.textValue(this.form.controls.agenciaId.value),
        page: 1,
        pageSize: 500
      })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (response) => {
          this.hasLoaded = true;
          this.lastUpdatedAt = new Date();
          this.matrizBase = this.transformarRespuestaAMatriz(response, fechaInicio, fechaFin);
          this.bloquesHoraDisponibles = [...this.matrizBase.bloquesHora];
          this.ensureSelectedFilters();
          this.applyLocalFilters();
        },
        error: () => {
          this.hasLoaded = true;
          this.error = 'No se pudo cargar el forecast de actividades.';
          this.matrizBase = this.emptyMatrix();
          this.applyLocalFilters();
        }
      });
  }

  setHoy(): void {
    this.form.patchValue(
      {
        fechaInicio: this.today,
        fechaFin: this.today
      },
      { emitEvent: false }
    );

    this.consultar();
  }

  seleccionarVista(vista: ForecastVistaRango): void {
    const option = this.vistaOptions.find((item) => item.key === vista);
    const days = option?.days ?? 7;
    const start = new Date();
    const end = this.addDays(start, days - 1);

    this.form.patchValue(
      {
        vista,
        fechaInicio: this.toDateInput(start),
        fechaFin: this.toDateInput(end)
      },
      { emitEvent: false }
    );

    this.consultar();
  }

  isVistaActiva(vista: ForecastVistaRango): boolean {
    return this.form.controls.vista.value === vista;
  }

  get vistaCompacta(): boolean {
    return this.form.controls.vistaCompacta.value;
  }

  onAgenciaSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.agenciaSearchTerm = this.textValue(input?.value);
    this.clearAgenciaSearchBlurTimer();

    if (this.shouldClearSelectedAgencia(this.agenciaSearchTerm)) {
      this.clearSelectedAgenciaState();
      this.consultar();
    }

    const term = this.agenciaSearchTerm.trim();
    if (this.agenciaSearchDebounceTimer) {
      clearTimeout(this.agenciaSearchDebounceTimer);
      this.agenciaSearchDebounceTimer = null;
    }

    if (term.length < this.agenciaSearchMinLength) {
      this.cancelAgenciaSearchRequests();
      this.agenciaSearchResults = [];
      this.agenciaSearchOpen = false;
      this.agenciaSearchError = null;
      return;
    }

    this.agenciaSearchDebounceTimer = setTimeout(() => {
      this.buscarAgenciasDirecto(term);
    }, 280);
  }

  onAgenciaSearchFocus(): void {
    this.clearAgenciaSearchBlurTimer();
    if (this.agenciaSearchResults.length && this.agenciaSearchTerm.trim().length >= this.agenciaSearchMinLength) {
      this.agenciaSearchOpen = true;
    }
  }

  onAgenciaSearchBlur(): void {
    this.clearAgenciaSearchBlurTimer();
    this.agenciaSearchBlurTimer = setTimeout(() => {
      this.agenciaSearchOpen = false;
      this.cdr.markForCheck();
    }, 180);
  }

  onAgenciaSearchEnter(event: Event): void {
    event.preventDefault();
    this.clearAgenciaSearchBlurTimer();
    if (this.agenciaSearchResults.length) {
      this.seleccionarAgenciaBusqueda(this.agenciaSearchResults[0]);
      return;
    }

    const term = this.agenciaSearchTerm.trim();
    if (term.length >= this.agenciaSearchMinLength) {
      this.buscarAgenciasDirecto(term);
    }
  }

  onAgenciaSuggestionMouseDown(cliente: ClienteUI, event: MouseEvent): void {
    event.preventDefault();
    this.seleccionarAgenciaBusqueda(cliente);
  }

  limpiarAgenciaSeleccionada(): void {
    this.agenciaSearchTerm = '';
    this.cancelAgenciaSearchRequests();
    this.agenciaSearchResults = [];
    this.agenciaSearchOpen = false;
    this.agenciaSearchError = null;
    this.clearSelectedAgenciaState();
    this.consultar();
  }

  trackByAgencia(_: number, cliente: ClienteUI): string {
    return cliente.codigo;
  }

  formatAgenciaLabel(cliente: ClienteUI | null): string {
    if (!cliente) return '';

    const codigo = this.textValue(cliente.codigo);
    const nombre = this.textValue(cliente.nombre || cliente.contacto, 'Agencia sin nombre');
    return [codigo, nombre].filter(Boolean).join(' - ');
  }

  getAgenciaDisplayName(cliente: ClienteUI): string {
    return this.textValue(cliente.contacto || cliente.nombre, 'Agencia sin nombre');
  }

  get hasRows(): boolean {
    return this.filasVisibles.length > 0;
  }

  get occupancyLegendValue(): number {
    return this.capacidadBaseDefault;
  }

  getSemaforoClass(semaforo: ForecastSemaforoSaturacion): string {
    return `is-${semaforo}`;
  }

  getEstadoProcesoClass(estadoProceso: ForecastBloqueOperativo['estadoProceso']): string {
    if (estadoProceso === 'procesado') return 'estado--procesado';
    if (estadoProceso === 'parcial') return 'estado--parcial';
    return 'estado--pendiente';
  }

  getOcupacionWidth(porcentaje: number): number {
    const normalized = Number.isFinite(porcentaje) ? porcentaje : 0;
    return Math.max(6, Math.min(100, normalized));
  }

  getFormattedDatetime(fecha: string, hora: string): string {
    return `${this.formatFechaLarga(fecha)} ${hora}`;
  }

  formatFechaHeader(fecha: string): string {
    const date = this.parseDateOnly(fecha);
    return this.formatDateDDMMYYYY(date);
  }

  formatFechaLarga(fecha: string): string {
    const date = this.parseDateOnly(fecha);
    return this.formatDateDDMMYYYY(date);
  }

  formatLista(values: string[], max = 3): string {
    if (!values.length) return 'Sin registro';

    const visible = values.slice(0, max);
    const restantes = values.length - visible.length;
    const base = visible.join(', ');

    return restantes > 0 ? `${base} +${restantes}` : base;
  }

  trackByFecha(index: number, fecha: string): string {
    return `${index}-${fecha}`;
  }

  trackByFila(_: number, fila: ForecastMatrizActividad): string {
    return `${fila.codServicio}::${fila.nomServicio}`;
  }

  trackByCelda(_: number, celda: ForecastMatrizCelda): string {
    return celda.fecha;
  }

  trackByBloque(_: number, bloque: ForecastBloqueOperativo): string {
    return bloque.key;
  }

  private buscarAgenciasDirecto(term: string): void {
    const normalized = this.textValue(term);
    if (normalized.length < this.agenciaSearchMinLength) {
      this.agenciaSearchResults = [];
      this.agenciaSearchOpen = false;
      this.agenciaSearchLoading = false;
      this.agenciaSearchError = null;
      return;
    }

    const currentRequest = ++this.agenciaSearchRequestId;
    this.agenciaSearchLoading = true;
    this.agenciaSearchError = null;
    this.cdr.markForCheck();

    this.clienteService
      .getClientes(1, 8, normalized)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (currentRequest !== this.agenciaSearchRequestId || this.agenciaSearchTerm.trim() !== normalized) {
            return;
          }

          this.agenciaSearchResults = response.data ?? [];
          this.agenciaSearchOpen = true;
          this.agenciaSearchLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          if (currentRequest !== this.agenciaSearchRequestId) {
            return;
          }

          this.agenciaSearchResults = [];
          this.agenciaSearchOpen = true;
          this.agenciaSearchLoading = false;
          this.agenciaSearchError = 'No se pudo buscar agencias.';
          this.cdr.markForCheck();
        }
      });
  }

  private seleccionarAgenciaBusqueda(cliente: ClienteUI): void {
    const agenciaId = this.textValue(cliente.codigo);
    if (!agenciaId) return;

    this.clearAgenciaSearchBlurTimer();
    this.cancelAgenciaSearchRequests();
    this.selectedAgencia = cliente;
    this.agenciaSearchTerm = this.formatAgenciaLabel(cliente);
    this.agenciaSearchResults = [];
    this.agenciaSearchOpen = false;
    this.agenciaSearchError = null;
    this.form.controls.agenciaId.setValue(agenciaId, { emitEvent: false });
    this.consultar();
  }

  private shouldClearSelectedAgencia(nextTerm: string): boolean {
    if (!this.selectedAgencia && !this.form.controls.agenciaId.value) {
      return false;
    }

    const normalizedTerm = this.textValue(nextTerm);
    const selectedLabel = this.formatAgenciaLabel(this.selectedAgencia);
    const selectedCode = this.textValue(this.selectedAgencia?.codigo || this.form.controls.agenciaId.value);
    return normalizedTerm !== selectedLabel && normalizedTerm !== selectedCode;
  }

  private clearSelectedAgenciaState(): void {
    this.selectedAgencia = null;
    this.form.controls.agenciaId.setValue('', { emitEvent: false });
  }

  private clearAgenciaSearchBlurTimer(): void {
    if (this.agenciaSearchBlurTimer) {
      clearTimeout(this.agenciaSearchBlurTimer);
      this.agenciaSearchBlurTimer = null;
    }
  }

  private cancelAgenciaSearchRequests(): void {
    if (this.agenciaSearchDebounceTimer) {
      clearTimeout(this.agenciaSearchDebounceTimer);
      this.agenciaSearchDebounceTimer = null;
    }

    this.agenciaSearchRequestId += 1;
    this.agenciaSearchLoading = false;
  }

  private applyLocalFilters(): void {
    const filtros = {
      bloqueHora: this.textValue(this.form.controls.bloqueHora.value),
      soloNoProcesados: this.form.controls.soloNoProcesados.value,
      soloAltaSaturacion: this.form.controls.soloAltaSaturacion.value
    };

    const filasBase = this.matrizBase.filas;
    const rows: ForecastMatrizActividad[] = [];

    for (const fila of filasBase) {
      const fechas = fila.fechas.map((celda) => {
        const bloquesFiltrados = celda.bloques.filter((bloque) => this.matchBloqueFilters(bloque, filtros));
        const totalPax = this.sumBy(bloquesFiltrados, (item) => item.totalPax);
        const totalServicios = this.sumBy(bloquesFiltrados, (item) => item.cantidadServicios);
        const totalMonetario = this.sumBy(bloquesFiltrados, (item) => item.totalMonetario);

        return {
          ...celda,
          bloques: bloquesFiltrados,
          totalPax,
          totalServicios,
          totalMonetario
        };
      });

      const hasBloques = fechas.some((item) => item.bloques.length > 0);
      if (!hasBloques) {
        continue;
      }

      rows.push({
        ...fila,
        fechas,
        totalPax: this.sumBy(fechas, (item) => item.totalPax),
        totalServicios: this.sumBy(fechas, (item) => item.totalServicios),
        totalMonetario: this.sumBy(fechas, (item) => item.totalMonetario)
      });
    }

    rows.sort((a, b) => this.compareActividadByNombre(a, b));

    this.fechasVisibles = [...this.matrizBase.fechas];
    this.filasVisibles = rows;
    this.kpis = this.buildKpis(rows);
    this.updateMatrixDimensions(this.fechasVisibles.length);
    this.cdr.markForCheck();
  }

  private matchBloqueFilters(
    bloque: ForecastBloqueOperativo,
    filters: {
      bloqueHora: string;
      soloNoProcesados: boolean;
      soloAltaSaturacion: boolean;
    }
  ): boolean {
    if (filters.bloqueHora && bloque.hora !== filters.bloqueHora) {
      return false;
    }

    if (filters.soloNoProcesados && bloque.noProcesados === 0) {
      return false;
    }

    if (filters.soloAltaSaturacion && !['alta', 'critica'].includes(bloque.semaforoSaturacion)) {
      return false;
    }

    return true;
  }

  private ensureSelectedFilters(): void {
    const patch: Partial<{
      bloqueHora: string;
    }> = {};

    const bloqueHora = this.form.controls.bloqueHora.value;

    if (bloqueHora && !this.bloquesHoraDisponibles.includes(bloqueHora)) {
      patch.bloqueHora = '';
    }

    if (Object.keys(patch).length) {
      this.form.patchValue(patch, { emitEvent: false });
    }
  }

  private transformarRespuestaAMatriz(
    response: ForecastActividadesResponse | null | undefined,
    fechaInicio: string,
    fechaFin: string
  ): ForecastMatrizResultado {
    const agenciaSet = new Set<string>();
    const horaSet = new Set<string>();

    const actividadMap = new Map<
      string,
      {
        codServicio: string;
        nomServicio: string;
        porFecha: Map<string, Map<string, ForecastOperacionDetalle[]>>;
      }
    >();

    for (const bloque of response?.bloques ?? []) {
      const horaBloque = this.normalizeHour(bloque?.bloqueHora);

      for (const detalle of bloque?.detalles ?? []) {
        if (this.isReservaCancelada(detalle)) {
          continue;
        }

        const fecha = this.normalizeDate(detalle.prV02_FecServicio);
        const hora = this.normalizeHour(detalle.prV02_HoraServicio || detalle.bloqueHora || horaBloque);
        const codServicio = this.textValue(detalle.codServicio, 'SIN-COD');
        const nomServicio = this.textValue(detalle.nomServicio, 'Actividad sin nombre');
        const agencia = this.textValue(detalle.agencia || detalle.codAgencia);

        horaSet.add(hora);
        if (agencia) agenciaSet.add(agencia);

        const key = `${codServicio}::${nomServicio.toUpperCase()}`;
        if (!actividadMap.has(key)) {
          actividadMap.set(key, {
            codServicio,
            nomServicio,
            porFecha: new Map<string, Map<string, ForecastOperacionDetalle[]>>()
          });
        }

        const actividad = actividadMap.get(key);
        if (!actividad) continue;

        if (!actividad.porFecha.has(fecha)) {
          actividad.porFecha.set(fecha, new Map<string, ForecastOperacionDetalle[]>());
        }

        const porHora = actividad.porFecha.get(fecha);
        if (!porHora) continue;

        if (!porHora.has(hora)) {
          porHora.set(hora, []);
        }

        porHora.get(hora)?.push(detalle);
      }
    }

    const fechas = this.buildDateRange(fechaInicio, fechaFin);
    const filas: ForecastMatrizActividad[] = [];
    const bloquesFlat: ForecastBloqueOperativo[] = [];

    for (const actividad of actividadMap.values()) {
      const celdas: ForecastMatrizCelda[] = [];

      for (const fecha of fechas) {
        const porHora = actividad.porFecha.get(fecha);
        const bloques = [...(porHora?.entries() ?? [])]
          .map(([hora, detalles]) => this.buildBloqueOperativo(actividad.codServicio, actividad.nomServicio, fecha, hora, detalles))
          .sort((a, b) => this.compareHora(a.hora, b.hora));

        if (bloques.length) {
          bloquesFlat.push(...bloques);
        }

        celdas.push({
          fecha,
          bloques,
          totalPax: this.sumBy(bloques, (item) => item.totalPax),
          totalServicios: this.sumBy(bloques, (item) => item.cantidadServicios),
          totalMonetario: this.sumBy(bloques, (item) => item.totalMonetario)
        });
      }

      filas.push({
        codServicio: actividad.codServicio,
        nomServicio: actividad.nomServicio,
        fechas: celdas,
        totalPax: this.sumBy(celdas, (item) => item.totalPax),
        totalServicios: this.sumBy(celdas, (item) => item.totalServicios),
        totalMonetario: this.sumBy(celdas, (item) => item.totalMonetario)
      });
    }

    filas.sort((a, b) => this.compareActividadByNombre(a, b));

    return {
      fechas,
      filas,
      agencias: [...agenciaSet].sort((a, b) => a.localeCompare(b, 'es')),
      bloquesHora: [...horaSet].sort((a, b) => this.compareHora(a, b)),
      bloquesFlat
    };
  }

  private buildBloqueOperativo(
    codServicio: string,
    nomServicio: string,
    fecha: string,
    hora: string,
    detalles: ForecastOperacionDetalle[]
  ): ForecastBloqueOperativo {
    const totalPax = this.sumBy(detalles, (item) => Number(item.totalPax) || 0);
    const cantidadServicios = detalles.length;
    const totalMonetario = this.sumBy(detalles, (item) => Number(item.totalServicio) || 0);
    const procesados = detalles.filter((item) => this.isProcesado(item.procesado)).length;
    const noProcesados = Math.max(cantidadServicios - procesados, 0);
    const estadoProceso: ForecastBloqueOperativo['estadoProceso'] =
      procesados === cantidadServicios ? 'procesado' : procesados > 0 ? 'parcial' : 'pendiente';

    const agencias = this.uniqueText(
      detalles.map((item) => {
        const agency = this.textValue(item.agencia);
        return agency || this.textValue(item.codAgencia);
      })
    );
    const clientes = this.uniqueText(detalles.map((item) => item.cliente));
    const pickups = this.uniqueText(detalles.map((item) => item.lugarPickup));
    const choferes = this.uniqueText(detalles.map((item) => item.chofer ?? ''));
    const estados = this.uniqueText(detalles.map((item) => item.estado));
    const observaciones = this.uniqueText(detalles.map((item) => item.observacion));
    const observacionesOperacion = this.uniqueText(detalles.map((item) => item.observacionOperacion ?? ''));
    const capacidad = this.calcularCapacidadTemporal(totalPax);

    return {
      key: `${codServicio}|${fecha}|${hora}`,
      fecha,
      hora,
      codServicio,
      nomServicio,
      totalPax,
      cantidadServicios,
      totalMonetario,
      procesados,
      noProcesados,
      estadoProceso,
      agencias,
      clientes,
      pickups,
      choferes,
      estados,
      observaciones,
      observacionesOperacion,
      tieneObservacion: observaciones.length > 0 || observacionesOperacion.length > 0,
      tieneChofer: choferes.length > 0,
      detalles,
      ...capacidad
    };
  }

  private calcularCapacidadTemporal(totalPax: number): ForecastCapacidadProyectada {
    const capacidadMaxima = this.capacidadBaseDefault;
    const cuposOcupados = Math.max(0, Number(totalPax) || 0);
    const cuposDisponibles = capacidadMaxima - cuposOcupados;
    const porcentajeOcupacion = capacidadMaxima > 0 ? (cuposOcupados / capacidadMaxima) * 100 : 0;

    return {
      capacidadMaxima,
      cuposOcupados,
      cuposDisponibles,
      porcentajeOcupacion,
      semaforoSaturacion: this.resolveSemaforo(porcentajeOcupacion),
      disponibilidadReal: cuposDisponibles > 0,
      capacidadVendibleFutura: Math.max(cuposDisponibles, 0)
    };
  }

  private resolveSemaforo(porcentaje: number): ForecastSemaforoSaturacion {
    if (porcentaje >= 90) return 'critica';
    if (porcentaje >= 70) return 'alta';
    if (porcentaje >= 40) return 'media';
    return 'baja';
  }

  private buildKpis(rows: ForecastMatrizActividad[]): ForecastKpis {
    const bloques = rows.flatMap((row) => row.fechas.flatMap((fecha) => fecha.bloques));
    const totalServicios = this.sumBy(bloques, (item) => item.cantidadServicios);
    const totalPasajeros = this.sumBy(bloques, (item) => item.totalPax);
    const totalMonetario = this.sumBy(bloques, (item) => item.totalMonetario);
    const actividadesActivas = rows.length;

    const bloqueMasCargado = [...bloques].sort((a, b) => b.totalPax - a.totalPax || b.cantidadServicios - a.cantidadServicios)[0];
    const actividadMasDemandada = [...rows].sort((a, b) => b.totalPax - a.totalPax || b.totalServicios - a.totalServicios)[0];

    return {
      totalServicios,
      totalPasajeros,
      totalMonetario,
      bloqueMasCargado: bloqueMasCargado
        ? `${bloqueMasCargado.hora} · ${this.formatFechaHeader(bloqueMasCargado.fecha)} · ${bloqueMasCargado.totalPax} pax`
        : 'Sin datos',
      actividadMasDemandada: actividadMasDemandada
        ? `${actividadMasDemandada.nomServicio} · ${actividadMasDemandada.totalPax} pax`
        : 'Sin datos',
      actividadesActivas
    };
  }

  private updateMatrixDimensions(dateColumns: number): void {
    const columns = Math.max(dateColumns, 1);
    this.gridTemplateColumns = `minmax(230px, 230px) repeat(${columns}, minmax(190px, 1fr))`;
    this.matrixMinWidthPx = 230 + columns * 190;
  }

  private normalizeDate(value: string | null | undefined): string {
    const raw = this.textValue(value);
    if (!raw) return this.today;

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }

    const extracted = raw.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(extracted)) {
      return extracted;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return this.today;
    }

    return this.toDateInput(parsed);
  }

  private normalizeHour(value: string | null | undefined): string {
    const raw = this.textValue(value);
    if (!raw) return '00:00';

    const match = raw.match(/(\d{1,2}):(\d{2})/);
    if (!match) return raw.toUpperCase();

    const hour = Math.min(23, Math.max(0, Number(match[1]) || 0));
    const minute = Math.min(59, Math.max(0, Number(match[2]) || 0));

    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  private compareHora(a: string, b: string): number {
    const aMinutes = this.parseHourToMinutes(a);
    const bMinutes = this.parseHourToMinutes(b);
    return aMinutes - bMinutes || a.localeCompare(b);
  }

  private compareActividadByNombre(a: ForecastMatrizActividad, b: ForecastMatrizActividad): number {
    const ordenA = this.getOrdenServicioForecast(a.codServicio);
    const ordenB = this.getOrdenServicioForecast(b.codServicio);

    if (ordenA !== ordenB) {
      return ordenA - ordenB;
    }

    return (
      a.nomServicio.localeCompare(b.nomServicio, 'es', { sensitivity: 'base' }) ||
      a.codServicio.localeCompare(b.codServicio, 'es', { sensitivity: 'base' })
    );
  }

  private getOrdenServicioForecast(codServicio: string): number {
    const normalizedCode = this.normalizeServicioCode(codServicio);
    return this.ordenServiciosForecast.get(normalizedCode) ?? Number.MAX_SAFE_INTEGER;
  }

  private normalizeServicioCode(codServicio: string): string {
    const normalized = this.textValue(codServicio);
    return /^\d+$/.test(normalized) ? normalized.padStart(5, '0') : normalized;
  }

  private parseHourToMinutes(value: string): number {
    const match = value.match(/^(\d{2}):(\d{2})$/);
    if (!match) return Number.MAX_SAFE_INTEGER;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  private parseDateOnly(value: string): Date {
    const normalized = this.normalizeDate(value);
    return new Date(`${normalized}T00:00:00`);
  }

  private buildDateRange(fechaInicio: string, fechaFin: string): string[] {
    const start = this.parseDateOnly(fechaInicio);
    const end = this.parseDateOnly(fechaFin);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return [];
    }

    const fechas: string[] = [];
    const cursor = new Date(start);

    while (cursor <= end) {
      fechas.push(this.toDateInput(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return fechas;
  }

  private formatDateDDMMYYYY(date: Date): string {
    const day = `${date.getDate()}`.padStart(2, '0');
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private addDays(date: Date, days: number): Date {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  private toDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private isProcesado(value: number | boolean | null | undefined): boolean {
    if (value === true) return true;
    if (value === false || value === null || value === undefined) return false;
    return Number(value) === 1;
  }

  private isReservaCancelada(detalle: ForecastOperacionDetalle): boolean {
    const estado = this.textValue(detalle.estado).toUpperCase();
    return ['CAN', 'CANCELADO', 'CANCELADA', 'ANULADO', 'ANULADA'].includes(estado);
  }

  private normalizeSearchValue(value: string | null | undefined): string {
    return this.textValue(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private uniqueText(values: Array<string | null | undefined>): string[] {
    return [...new Set(values.map((item) => this.textValue(item)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  }

  private sumBy<T>(items: T[], accessor: (item: T) => number): number {
    return items.reduce((acc, item) => acc + (Number(accessor(item)) || 0), 0);
  }

  private textValue(value: unknown, fallback = ''): string {
    const normalized = (value ?? '').toString().trim();
    return normalized || fallback;
  }

  private emptyMatrix(): ForecastMatrizResultado {
    return {
      fechas: [],
      filas: [],
      agencias: [],
      bloquesHora: [],
      bloquesFlat: []
    };
  }

  private emptyKpis(): ForecastKpis {
    return {
      totalServicios: 0,
      totalPasajeros: 0,
      totalMonetario: 0,
      bloqueMasCargado: 'Sin datos',
      actividadMasDemandada: 'Sin datos',
      actividadesActivas: 0
    };
  }
}
