import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, Subject, catchError, debounceTime, filter, finalize, map, merge, of, shareReplay, startWith, switchMap } from 'rxjs';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { OperacionDiariaService, OperacionDiariaParams } from './operacion-diaria.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { environment } from 'src/environments/environment';
import {
  ActualizarObservacionOperacionPayload,
  BloqueHoraAgrupado,
  OperacionDetalle,
  OperacionDiariaResponse,
  ReservaOperacionAgrupada,
  ResumenActividadHora
} from './models/operacion-diaria.model';

interface ChoferOption {
  code: string;
  name: string;
}

interface ChoferApiResponse {
  datos: Array<{
    MRV12_CodChofer: string;
    MRV12_NombreCompleto: string;
  }>;
}

interface OperacionDiariaViewState {
  loading   : boolean;
  error     : string | null;
  data      : OperacionDiariaResponse | null;
  bloques   : BloqueHoraAgrupado[];
}

interface PrintVoucherPayload {
  empresa           : string;
  fechaActividad    : string;
  servicio          : string;
  numeroTicket      : number;
  numeroReserva     : number;
  totalPax          : number;
}

@Component({
  selector: 'app-operacion-diaria',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SharedModule, RouterLink],
  templateUrl: './operacion-diaria.component.html',
  styleUrls: ['./operacion-diaria.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OperacionDiariaComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly operacionDiariaService = inject(OperacionDiariaService);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly empresaContext = inject(EmpresaContextService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  readonly today = this.toDateInput(new Date());

  readonly form = this.fb.group({
    fechaInicio: this.fb.control(this.today, { validators: [Validators.required], nonNullable: true }),
    fechaFin: this.fb.control(this.today, { validators: [Validators.required], nonNullable: true }),
    busqueda: this.fb.control('', { nonNullable: true }),
    agenciaId: this.fb.control<string | null>(null),
    choferId: this.fb.control<string | null>(null)
  });

  readonly autoRefresh = false;
  readonly observacionMaxLength = 500;
  readonly servicePreviewLimit = 3;
  readonly pageSizes = [25, 50, 100];
  selectedBloqueHora = '';
  page = 1;
  pageSize = 50;
  totalRegistros = 0;
  expandedReservas = new Set<string>();
  checkingIn = new Set<number | string>();
  printingVouchers = new Set<number | string>();
  observacionModalOpen = false;
  savingObservacion = false;
  observacionDetalleSeleccionado: OperacionDetalle | null = null;
  private observacionOriginal = '';
  choferes: ChoferOption[] = [];
  choferesLoading = false;
  choferesError = '';
  private choferCodes = new Set<string>();

  private readonly manualRefresh$ = new Subject<void>();
  private readonly autoRefresh$ = this.form.valueChanges.pipe(
    debounceTime(350),
    filter(() => this.autoRefresh),
    filter(() => this.form.valid),
    map(() => {
      this.page = 1;
      return void 0;
    })
  );

  private readonly refresh$ = merge(this.manualRefresh$, this.autoRefresh$).pipe(startWith(void 0));
  private resumenPorHora = new Map<string, ResumenActividadHora[]>();
  readonly observacionForm = this.fb.group({
    nuevaObservacion: this.fb.control('', {
      validators: [Validators.required, Validators.maxLength(this.observacionMaxLength)],
      nonNullable: true
    })
  });

  readonly vm$: Observable<OperacionDiariaViewState> = this.refresh$.pipe(
    map(() => this.buildParams()),
    switchMap((params) =>
      this.operacionDiariaService.getOperacionDiaria(params).pipe(
        map((data) => {
          this.totalRegistros = data?.totalRegistros ?? 0;
          const totalPages = this.totalPaginas(this.totalRegistros);
          if (this.page > totalPages && totalPages > 0) {
            this.page = totalPages;
            this.manualRefresh$.next();
          }
          this.resumenPorHora = this.buildResumenMap(data?.resumenActividadPorHora ?? []);
          const bloques = this.buildBloquesAgrupados(data?.bloques ?? []);
          this.syncSelectedBloqueHora(bloques);
          this.syncExpandedReservas(bloques);
          return { loading: false, error: null, data, bloques };
        }),
        startWith({ loading: true, error: null, data: null, bloques: [] }),
        catchError(() => of({ loading: false, error: 'No se pudo cargar la operacion diaria.', data: null, bloques: [] }))
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  ngOnInit(): void {
    this.loadChoferes();
  }

  buscar(): void {
    this.ensureChoferSelection();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.page = 1;
    this.manualRefresh$.next();
  }

  setHoy(): void {
    this.form.patchValue({
      fechaInicio: this.today,
      fechaFin: this.today
    });
    this.buscar();
  }

  changePage(delta: number): void {
    const next = this.page + delta;
    const totalPages = this.totalPaginas(this.totalRegistros);
    if (next < 1 || next > totalPages) {
      return;
    }
    this.page = next;
    this.manualRefresh$.next();
  }

  onPageSizeChange(size: number): void {
    const nextSize = Number(size) || this.pageSize;
    if (nextSize === this.pageSize) {
      return;
    }
    this.pageSize = nextSize;
    this.page = 1;
    this.manualRefresh$.next();
  }

  totalPaginas(totalRegistros: number): number {
    const total = totalRegistros ?? 0;
    return Math.max(1, Math.ceil(total / this.pageSize));
  }

  get pageStart(): number {
    return this.totalRegistros ? this.pageSize * (this.page - 1) + 1 : 0;
  }

  get pageEnd(): number {
    return Math.min(this.page * this.pageSize, this.totalRegistros);
  }

  getResumenPorHora(hora: string): ResumenActividadHora[] {
    return this.resumenPorHora.get(hora) ?? [];
  }

  getBloquesHoraDisponibles(bloques: BloqueHoraAgrupado[] | null | undefined): string[] {
    return (bloques ?? [])
      .map((bloque) => (bloque.bloqueHora ?? '').toString().trim())
      .filter((hora, index, arr) => !!hora && arr.indexOf(hora) === index);
  }

  getBloquesFiltrados(bloques: BloqueHoraAgrupado[] | null | undefined): BloqueHoraAgrupado[] {
    const source = bloques ?? [];
    if (!this.selectedBloqueHora) {
      return source;
    }

    return source.filter((bloque) => (bloque.bloqueHora ?? '').toString().trim() === this.selectedBloqueHora);
  }

  setBloqueHoraFilter(hora: string): void {
    const next = (hora ?? '').toString().trim();
    if (this.selectedBloqueHora === next) {
      return;
    }

    this.selectedBloqueHora = next;
    this.cdr.markForCheck();
  }

  isBloqueHoraSelected(hora: string): boolean {
    return this.selectedBloqueHora === (hora ?? '').toString().trim();
  }

  toggleReservaExpansion(reserva: ReservaOperacionAgrupada): void {
    const key = (reserva?.reservaKey ?? '').toString().trim();
    if (!key) {
      return;
    }

    if (this.expandedReservas.has(key)) {
      this.expandedReservas.delete(key);
    } else {
      this.expandedReservas.add(key);
    }
    this.cdr.markForCheck();
  }

  isReservaExpanded(reserva: ReservaOperacionAgrupada): boolean {
    const key = (reserva?.reservaKey ?? '').toString().trim();
    return key ? this.expandedReservas.has(key) : false;
  }

  get observacionControl() {
    return this.observacionForm.controls.nuevaObservacion;
  }

  get observacionSinCambios(): boolean {
    return this.observacionControl.value.trim() === this.observacionOriginal;
  }

  getEstadoBadge(estado: string): string {
    const code = (estado ?? '').toString().trim().toUpperCase();
    if (code === 'CHK') return 'bg-info';
    if (code === 'CON') return 'bg-success';
    if (code === 'PEN') return 'bg-warning text-dark';
    if (code === 'CAN') return 'bg-danger';
    return 'bg-secondary';
  }

  isTransporteAsignado(detalle: OperacionDetalle): boolean {
    const raw = (detalle?.procesado ?? 0) as unknown;
    if (raw === true) return true;
    if (raw === false || raw === null || raw === undefined) return false;
    return Number(raw) === 1;
  }

  getEstadoTransporte(detalle: OperacionDetalle): string {
    return this.isTransporteAsignado(detalle) ? 'Asignado' : 'Sin asignar';
  }

  getTransporteBadge(detalle: OperacionDetalle): string {
    return this.isTransporteAsignado(detalle) ? 'bg-success' : 'bg-secondary';
  }

  isCheckInRealizado(detalle: OperacionDetalle): boolean {
    const estado = (detalle?.estado ?? '').toString().trim().toUpperCase();
    return estado === 'CHK';
  }

  isReservaFacturada(detalle: OperacionDetalle | null | undefined): boolean {
    const raw = detalle?.facturado as unknown;
    if (raw === true) return true;
    if (raw === false || raw === null || raw === undefined) return false;
    return Number(raw) === 1;
  }

  isCheckingIn(detalle: OperacionDetalle): boolean {
    return this.checkingIn.has(this.getDetalleKey(detalle));
  }

  onCheckIn(detalle: OperacionDetalle): void {
    if (!detalle?.prV02_CodReserva || this.isCheckInRealizado(detalle)) {
      return;
    }
    Swal.fire({
      title: 'Confirmar Check In',
      text: `Desea marcar la reserva ${detalle.prV02_CodReserva} como Check In?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Si, continuar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }
      this.executeCheckIn(detalle);
    });
  }

  private executeCheckIn(detalle: OperacionDetalle): void {
    const key = this.getDetalleKey(detalle);
    const operador = this.getOperador();
    const baseApiUrl = (environment.apiUrl ?? '').toString().replace(/\/+$/, '');
    const url = `${baseApiUrl}/reserva/checkin`;

    this.checkingIn.add(key);
    this.http
      .post(url, {
        codReserva: detalle.prV02_CodReserva,
        operador
      })
      .pipe(finalize(() => this.checkingIn.delete(key)))
      .subscribe({
        next: () => {
          detalle.estado = 'CHK';
          Swal.fire({
            title: 'Check In realizado',
            text: `Reserva ${detalle.prV02_CodReserva} actualizada.`,
            icon: 'success',
            timer: 1800,
            showConfirmButton: false
          });
          this.buscar();
        },
        error: (error) => {
          console.error('Error haciendo check in:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo hacer Check In de la reserva.',
            icon: 'error'
          });
        }
      });
  }

  onPrintVoucher(detalle: OperacionDetalle): void {
    const payload = this.buildVoucherPayload(detalle);
    if (!payload) {
      return;
    }

    const key = this.getDetalleKey(detalle);
    if (this.printingVouchers.has(key)) {
      return;
    }

    this.printingVouchers.add(key);
    this.cdr.markForCheck();

    const baseApiUrl = (environment.apiUrl ?? '').toString().replace(/\/+$/, '');
    const url = `${baseApiUrl}/vouchers/print-reserva`;

    this.http
      .post(url, payload, { responseType: 'blob' as const })
      .pipe(
        finalize(() => {
          this.printingVouchers.delete(key);
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (data) => {
          const reserva = payload.numeroReserva ? payload.numeroReserva.toString() : 'Reserva';
          this.openPdfBlob(data, `Voucher_Reserva_${reserva}.pdf`);
        },
        error: (error) => {
          console.error('Error imprimiendo voucher:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo imprimir el voucher.',
            icon: 'error'
          });
        }
      });
  }

  onFacturarReserva(detalle: OperacionDetalle): void {
    if (this.isReservaFacturada(detalle)) {
      Swal.fire({
        title: 'Reserva ya facturada',
        text: 'La reserva ya está facturada y no puede volver a enviarse a facturación.',
        icon: 'info'
      });
      return;
    }

    const codReserva = (detalle?.prV02_CodReserva ?? '').toString().trim();
    const codAgencia = (detalle?.codAgencia ?? '').toString().trim();

    if (!codReserva) {
      Swal.fire({
        title: 'Reserva inválida',
        text: 'No se pudo determinar el número de reserva para facturar.',
        icon: 'warning'
      });
      return;
    }

    if (!codAgencia) {
      Swal.fire({
        title: 'Agencia inválida',
        text: 'No se pudo determinar el código de agencia para facturar.',
        icon: 'warning'
      });
      return;
    }

    this.router.navigate(['/finanzas/nueva-factura'], {
      queryParams: {
        codReserva,
        codAgencia
      }
    });
  }

  onVerDetalleReserva(detalle: OperacionDetalle): void {
    const codReserva = (detalle?.prV02_CodReserva ?? '').toString().trim();

    if (!codReserva) {
      Swal.fire({
        title: 'Reserva inválida',
        text: 'No se pudo determinar el código de la reserva para abrir el detalle.',
        icon: 'warning'
      });
      return;
    }

    this.router.navigate(['/operaciones/reservas', codReserva, 'detalle'], {
      queryParams: {
        facturado: this.isReservaFacturada(detalle) ? '1' : '0',
        origen: 'operacion-diaria'
      }
    });
  }

  canEditarReserva(reserva: ReservaOperacionAgrupada | null | undefined): boolean {
    const detalles = reserva?.detalles ?? [];
    if (!detalles.length) {
      return false;
    }

    const codReserva = (reserva?.numeroReserva ?? '').toString().trim();
    if (!codReserva) {
      return false;
    }

    const hasFacturada = detalles.some((detalle) => this.isReservaFacturada(detalle));
    const hasChk = detalles.some((detalle) => this.isCheckInRealizado(detalle));
    return !hasFacturada && !hasChk;
  }

  onEditarReserva(reserva: ReservaOperacionAgrupada): void {
    const codReserva = (reserva?.numeroReserva ?? '').toString().trim();
    if (!codReserva) {
      Swal.fire({
        title: 'Reserva inválida',
        text: 'No se pudo determinar el código de la reserva para editar.',
        icon: 'warning'
      });
      return;
    }

    if (!this.canEditarReserva(reserva)) {
      Swal.fire({
        title: 'Edición no permitida',
        text: 'La reserva no se puede editar porque está facturada o tiene estado CHK.',
        icon: 'info'
      });
      return;
    }

    this.router.navigate(['/operaciones/reservas', codReserva, 'editar-v2'], {
      queryParams: {
        origen: 'operacion-diaria'
      }
    });
  }

  isPrintingVoucher(detalle: OperacionDetalle): boolean {
    return this.printingVouchers.has(this.getDetalleKey(detalle));
  }

  hasObservacion(detalle: OperacionDetalle | null | undefined): boolean {
    return this.hasTexto(detalle?.observacion);
  }

  hasObservacionOperacion(detalle: OperacionDetalle | null | undefined): boolean {
    return this.hasTexto(detalle?.observacionOperacion);
  }

  onEditarObservacion(detalle: OperacionDetalle): void {
    const codReserva = (detalle?.prV02_CodReserva ?? '').toString().trim();
    if (!codReserva) {
      Swal.fire({
        title: 'Reserva inválida',
        text: 'No se pudo determinar el código de la reserva para registrar el comentario.',
        icon: 'warning'
      });
      return;
    }

    this.observacionOriginal = (detalle?.observacionOperacion ?? '').toString().trim();
    this.observacionDetalleSeleccionado = detalle;
    this.observacionForm.reset({
      nuevaObservacion: this.observacionOriginal
    });
    this.observacionForm.markAsPristine();
    this.observacionForm.markAsUntouched();
    this.observacionModalOpen = true;
    this.cdr.markForCheck();
  }

  closeObservacionModal(force = false): void {
    if (this.savingObservacion && !force) {
      return;
    }

    this.observacionModalOpen = false;
    this.observacionDetalleSeleccionado = null;
    this.observacionOriginal = '';
    this.observacionForm.reset({
      nuevaObservacion: ''
    });
    this.observacionForm.enable({ emitEvent: false });
    this.cdr.markForCheck();
  }

  guardarObservacionOperacion(): void {
    if (this.savingObservacion) {
      return;
    }

    const detalle = this.observacionDetalleSeleccionado;
    const codReserva = (detalle?.prV02_CodReserva ?? '').toString().trim();
    const nuevaObservacion = this.observacionControl.value.trim();

    if (!codReserva) {
      Swal.fire({
        title: 'Reserva inválida',
        text: 'No se pudo determinar el código de la reserva para guardar el comentario.',
        icon: 'warning'
      });
      return;
    }

    if (!nuevaObservacion) {
      this.observacionControl.markAsTouched();
      this.observacionControl.setErrors({ required: true });
      return;
    }

    if (this.observacionSinCambios) {
      this.closeObservacionModal();
      return;
    }

    const payload: ActualizarObservacionOperacionPayload = {
      codReserva,
      nuevaObservacion,
      usuario: this.getOperador(),
      resultado: 'string'
    };

    this.savingObservacion = true;
    this.observacionForm.disable({ emitEvent: false });
    this.cdr.markForCheck();

    this.operacionDiariaService
      .actualizarObservacionOperacion(payload)
      .pipe(
        finalize(() => {
          this.savingObservacion = false;
          if (this.observacionModalOpen) {
            this.observacionForm.enable({ emitEvent: false });
          }
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (response) => {
          if (detalle) {
            detalle.observacionOperacion = nuevaObservacion;
          }

          this.closeObservacionModal(true);
          Swal.fire({
            title: 'Comentario actualizado',
            text: response?.mensaje || `Observación actualizada exitosamente para la reserva ${codReserva}.`,
            icon: response?.exito === false ? 'info' : 'success',
            timer: 1900,
            showConfirmButton: false
          });
          this.buscar();
        },
        error: (error) => {
          console.error('Error actualizando observación de operación:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo guardar el comentario de recepción.',
            icon: 'error'
          });
        }
      });
  }

  getServiceColor(codServicio: string): string {
    const code = (codServicio ?? '').toString().trim().toUpperCase();
    if (code.startsWith('TOU') || code.startsWith('TUR') || code.startsWith('TOUR')) return 'chip--tours';
    if (code.startsWith('TR') || code.startsWith('TRA') || code.startsWith('TRANS')) return 'chip--transporte';
    if (code.startsWith('EX') || code.startsWith('EXT') || code.startsWith('ADV')) return 'chip--extremo';
    return 'chip--otro';
  }

  trackByBloque(index: number, bloque: BloqueHoraAgrupado): string {
    return bloque.bloqueHora || `bloque-${index}`;
  }

  trackByReserva(index: number, reserva: ReservaOperacionAgrupada): string {
    return reserva.reservaKey || `reserva-${index}`;
  }

  trackByDetalle(index: number, detalle: OperacionDetalle): number | string {
    return detalle.prV02_ID ?? `${detalle.prV02_CodReserva}-${index}`;
  }

  trackByResumen(index: number, resumen: ResumenActividadHora): string {
    return `${resumen.bloqueHora}-${resumen.codServicio}-${index}`;
  }

  private getDetalleKey(detalle: OperacionDetalle): number | string {
    return detalle.prV02_ID ?? detalle.prV02_CodReserva ?? 'detalle';
  }

  private hasTexto(value: string | null | undefined): boolean {
    return (value ?? '').toString().trim().length > 0;
  }

  private getOperador(): string {
    const user = this.authService.getCurrentUser();
    return user?.usuario || user?.nombre || 'Admin';
  }

  private buildParams(): OperacionDiariaParams {
    const value = this.form.getRawValue();
    return {
      fechaInicio: this.formatDateForApi(value.fechaInicio),
      fechaFin: this.formatDateForApi(value.fechaFin),
      busqueda: this.normalizeOptional(value.busqueda),
      agenciaId: this.normalizeOptional(value.agenciaId),
      choferId: this.normalizeChoferId(value.choferId),
      page: this.page,
      pageSize: this.pageSize
    };
  }

  private ensureChoferSelection(): void {
    const control = this.form.controls.choferId;
    const selected = (control.value ?? '').toString().trim();
    if (!selected || this.choferCodes.has(selected)) {
      return;
    }
    control.setValue(null, { emitEvent: false });
  }

  private normalizeChoferId(value: string | null | undefined): string | undefined {
    const normalized = (value ?? '').toString().trim();
    return normalized && this.choferCodes.has(normalized) ? normalized : undefined;
  }

  private normalizeOptional(value: string | null | undefined): string | undefined {
    const normalized = (value ?? '').toString().trim();
    return normalized ? normalized : undefined;
  }

  private formatDateForApi(value: string): string {
    const normalized = (value ?? '').toString().trim();
    if (!normalized) {
      return '';
    }
    if (normalized.includes('/')) {
      return normalized;
    }
    const parts = normalized.split('-');
    if (parts.length === 3) {
      const [yyyy, mm, dd] = parts;
      if (yyyy && mm && dd) {
        return `${dd}/${mm}/${yyyy}`;
      }
    }
    return normalized;
  }

  private buildResumenMap(items: ResumenActividadHora[]): Map<string, ResumenActividadHora[]> {
    const mapByHora = new Map<string, ResumenActividadHora[]>();
    items.forEach((item) => {
      const key = item.bloqueHora || '';
      if (!mapByHora.has(key)) {
        mapByHora.set(key, []);
      }
      mapByHora.get(key)!.push(item);
    });
    return mapByHora;
  }

  private buildBloquesAgrupados(rawBloques: OperacionDiariaResponse['bloques']): BloqueHoraAgrupado[] {
    return (rawBloques ?? []).map((bloque) => {
      const reservas = this.groupDetallesByReserva(bloque?.detalles ?? []);
      return {
        bloqueHora: bloque?.bloqueHora ?? '',
        totalesHora: bloque?.totalesHora ?? { totalHora: 0, paxHora: 0, cantidadServicios: 0 },
        reservas,
        cantidadReservas: reservas.length
      };
    });
  }

  private groupDetallesByReserva(detalles: OperacionDetalle[]): ReservaOperacionAgrupada[] {
    const grouped = new Map<string, OperacionDetalle[]>();

    (detalles ?? []).forEach((detalle) => {
      const key = this.buildReservaKey(detalle);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(detalle);
    });

    return Array.from(grouped.entries()).map(([reservaKey, reservaDetalles]) =>
      this.buildReservaAgrupada(reservaKey, reservaDetalles)
    );
  }

  private buildReservaKey(detalle: OperacionDetalle): string {
    const codReserva = (detalle?.prV02_CodReserva ?? '').toString().trim();
    const fechaServicio = (detalle?.prV02_FecServicio ?? '').toString().trim();
    const cliente = (detalle?.cliente ?? '').toString().trim();
    const fallback = detalle?.prV02_ID ?? `${fechaServicio}-${cliente}`;
    return codReserva || `${fallback}`;
  }

  private buildReservaAgrupada(reservaKey: string, detalles: OperacionDetalle[]): ReservaOperacionAgrupada {
    const sortedDetalles = [...detalles].sort((a, b) => this.toNumber(a?.prV02_ID) - this.toNumber(b?.prV02_ID));
    const principal = sortedDetalles[0];

    const servicesByCode = new Map<string, { codServicio: string; nomServicio: string }>();
    sortedDetalles.forEach((detalle) => {
      const codServicio = (detalle?.codServicio ?? '').toString().trim();
      const nomServicio = (detalle?.nomServicio ?? '').toString().trim();
      const key = `${codServicio}-${nomServicio}`;
      if (!servicesByCode.has(key)) {
        servicesByCode.set(key, { codServicio, nomServicio });
      }
    });
    const servicios = Array.from(servicesByCode.values());
    const serviciosPreview = servicios.slice(0, this.servicePreviewLimit);
    const serviciosExtraCount = Math.max(0, servicios.length - serviciosPreview.length);

    const paxTotal = sortedDetalles.reduce((acc, item) => acc + this.toNumber(item?.totalPax), 0);
    const totalReserva = sortedDetalles.reduce((acc, item) => acc + this.toNumber(item?.totalServicio), 0);

    const estados = sortedDetalles.map((item) => (item?.estado ?? '').toString().trim().toUpperCase()).filter(Boolean);
    const hasAllFacturado = sortedDetalles.length > 0 && sortedDetalles.every((item) => this.isReservaFacturada(item));
    const hasAnyFacturado = sortedDetalles.some((item) => this.isReservaFacturada(item));
    const hasAllTransporte = sortedDetalles.length > 0 && sortedDetalles.every((item) => this.isTransporteAsignado(item));
    const hasAnyTransporte = sortedDetalles.some((item) => this.isTransporteAsignado(item));

    const estadoOperacion = this.resolveEstadoOperacionConsolidado(estados);
    const estadoFacturacion = this.resolveEstadoFacturacionConsolidado(hasAllFacturado, hasAnyFacturado);
    const estadoTransporte = this.resolveEstadoTransporteConsolidado(hasAllTransporte, hasAnyTransporte);

    return {
      reservaKey,
      numeroReserva: (principal?.prV02_CodReserva ?? '').toString().trim(),
      fechaServicio: (principal?.prV02_FecServicio ?? '').toString().trim(),
      cliente: (principal?.cliente ?? '').toString().trim(),
      agencia: (principal?.agencia ?? '').toString().trim(),
      codAgencia: (principal?.codAgencia ?? '').toString().trim(),
      pickupPrincipal: (principal?.lugarPickup ?? '').toString().trim(),
      pickupReferencia: (principal?.formaPago ?? '').toString().trim(),
      usuarioResponsable: (principal?.usuario ?? '').toString().trim(),
      servicios,
      serviciosPreview,
      serviciosExtraCount,
      cantidadServicios: sortedDetalles.length,
      paxTotal,
      totalReserva,
      estadoOperacionLabel: estadoOperacion.label,
      estadoOperacionBadge: estadoOperacion.badge,
      estadoFacturacionLabel: estadoFacturacion.label,
      estadoFacturacionBadge: estadoFacturacion.badge,
      estadoTransporteLabel: estadoTransporte.label,
      estadoTransporteBadge: estadoTransporte.badge,
      indicadorConChofer: sortedDetalles.some((item) => this.hasTexto(item?.chofer)),
      indicadorObservacionCliente: sortedDetalles.some((item) => this.hasObservacion(item)),
      indicadorObservacionOperacion: sortedDetalles.some((item) => this.hasObservacionOperacion(item)),
      detallePrincipal: principal,
      detalles: sortedDetalles
    };
  }

  private resolveEstadoOperacionConsolidado(estados: string[]): { label: string; badge: string } {
    const unique = Array.from(new Set(estados));
    if (!unique.length) {
      return { label: 'Sin estado', badge: 'bg-secondary' };
    }
    if (unique.length === 1) {
      const estado = unique[0];
      return { label: estado, badge: this.getEstadoBadge(estado) };
    }
    return { label: 'Mixto', badge: 'bg-secondary' };
  }

  private resolveEstadoFacturacionConsolidado(allFacturado: boolean, anyFacturado: boolean): { label: string; badge: string } {
    if (allFacturado) {
      return { label: 'Facturado', badge: 'bg-success' };
    }
    if (anyFacturado) {
      return { label: 'Parcial', badge: 'bg-info' };
    }
    return { label: 'Pendiente', badge: 'bg-warning text-dark' };
  }

  private resolveEstadoTransporteConsolidado(allTransporte: boolean, anyTransporte: boolean): { label: string; badge: string } {
    if (allTransporte) {
      return { label: 'Asignado', badge: 'bg-success' };
    }
    if (anyTransporte) {
      return { label: 'Parcial', badge: 'bg-info' };
    }
    return { label: 'Sin asignar', badge: 'bg-secondary' };
  }

  private syncSelectedBloqueHora(bloques: BloqueHoraAgrupado[]): void {
    if (!this.selectedBloqueHora) {
      return;
    }

    const exists = bloques.some((bloque) => (bloque.bloqueHora ?? '').toString().trim() === this.selectedBloqueHora);
    if (!exists) {
      this.selectedBloqueHora = '';
      this.cdr.markForCheck();
    }
  }

  private syncExpandedReservas(bloques: BloqueHoraAgrupado[]): void {
    if (!this.expandedReservas.size) {
      return;
    }

    const availableKeys = new Set<string>();
    bloques.forEach((bloque) => {
      bloque.reservas.forEach((reserva) => {
        availableKeys.add(reserva.reservaKey);
      });
    });

    this.expandedReservas.forEach((key) => {
      if (!availableKeys.has(key)) {
        this.expandedReservas.delete(key);
      }
    });
  }

  private loadChoferes(): void {
    this.choferesLoading = true;
    this.choferesError = '';
    const params = new HttpParams().set('pageNumber', '1').set('pageSize', '50');
    this.http
      .get<ChoferApiResponse>(`${environment.apiUrl}/chofer-suplidor`, { params })
      .pipe(
        map((response) => response?.datos ?? []),
        catchError((error) => {
          console.error('Error cargando choferes:', error);
          this.choferesError = 'No se pudo cargar los choferes disponibles.';
          return of([] as Array<ChoferApiResponse['datos'][number]>);
        }),
        finalize(() => {
          this.choferesLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe((datos) => {
        this.choferes = datos
          .filter((item) => !!item?.MRV12_CodChofer)
          .map((item) => ({
            code: item.MRV12_CodChofer,
            name: item.MRV12_NombreCompleto ?? ''
          }));
        this.choferCodes = new Set(this.choferes.map((chofer) => chofer.code));
      });
  }

  private toDateInput(date: Date): string {
    const yyyy = date.getFullYear().toString().padStart(4, '0');
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private buildVoucherPayload(detalle: OperacionDetalle): PrintVoucherPayload | null {
    const empresa = this.getEmpresaCodigo();
    if (!empresa) {
      Swal.fire({
        title: 'Empresa no definida',
        text: 'No se pudo determinar la empresa activa para imprimir el voucher.',
        icon: 'warning'
      });
      return null;
    }

    const numeroTicket = Number(detalle?.prV02_ID);
    if (!Number.isFinite(numeroTicket)) {
      Swal.fire({
        title: 'Ticket inválido',
        text: 'No se pudo determinar el número de ticket para imprimir el voucher.',
        icon: 'warning'
      });
      return null;
    }

    const rawReserva = (detalle?.prV02_CodReserva ?? '').toString().trim();
    if (!rawReserva) {
      Swal.fire({
        title: 'Reserva inválida',
        text: 'No se pudo determinar el número de reserva para imprimir el voucher.',
        icon: 'warning'
      });
      return null;
    }

    const numeroReserva = Number(rawReserva);
    if (!Number.isFinite(numeroReserva)) {
      Swal.fire({
        title: 'Reserva inválida',
        text: 'El número de reserva no es numérico.',
        icon: 'warning'
      });
      return null;
    }

    const fechaActividad = this.buildFechaActividad(detalle);
    if (!fechaActividad) {
      Swal.fire({
        title: 'Fecha inválida',
        text: 'No se pudo determinar la fecha de actividad para imprimir el voucher.',
        icon: 'warning'
      });
      return null;
    }

    return {
      empresa,
      fechaActividad,
      servicio: (detalle?.nomServicio ?? detalle?.codServicio ?? '').toString().trim(),
      numeroTicket,
      numeroReserva,
      totalPax: this.toNumber(detalle?.totalPax)
    };
  }

  private getEmpresaCodigo(): string {
    const empresa = this.empresaContext.getSnapshot();
    return (empresa?.MA04_Unidad ?? '').toString().trim();
  }

  private buildFechaActividad(detalle: OperacionDetalle): string | null {
    const baseDate = this.parseFechaServicio(detalle?.prV02_FecServicio);
    if (!baseDate) {
      return null;
    }
    const dateWithTime = this.applyHoraServicio(baseDate, detalle?.prV02_HoraServicio);
    return dateWithTime.toISOString();
  }

  private parseFechaServicio(value: string | null | undefined): Date | null {
    const raw = (value ?? '').toString().trim();
    if (!raw) {
      return null;
    }

    if (raw.includes('T')) {
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (raw.includes('/')) {
      const [dd, mm, yyyy] = raw.split('/');
      const day = Number(dd);
      const month = Number(mm);
      const year = Number(yyyy);
      if (!day || !month || !year) {
        return null;
      }
      const parsed = new Date(year, month - 1, day);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (raw.includes('-')) {
      const [part1, part2, part3] = raw.split('-');
      if (part1?.length === 4) {
        const year = Number(part1);
        const month = Number(part2);
        const day = Number(part3);
        if (!day || !month || !year) {
          return null;
        }
        const parsed = new Date(year, month - 1, day);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }

      if (part3?.length === 4) {
        const day = Number(part1);
        const month = Number(part2);
        const year = Number(part3);
        if (!day || !month || !year) {
          return null;
        }
        const parsed = new Date(year, month - 1, day);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }
    }

    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  private applyHoraServicio(base: Date, hora: string | null | undefined): Date {
    const raw = (hora ?? '').toString().trim();
    if (!raw) {
      return base;
    }

    const parts = raw.split(':');
    if (parts.length < 2) {
      return base;
    }

    const hh = Number(parts[0]);
    const mm = Number(parts[1]);
    const ss = Number(parts[2] ?? 0);

    if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) {
      return base;
    }

    const next = new Date(base);
    next.setHours(hh, mm, ss, 0);
    return next;
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private openPdfBlob(blob: Blob, filename: string): void {
    try {
      const pdfBlob = new Blob([blob], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(pdfBlob);
      const opened = window.open(objectUrl, '_blank', 'noopener');

      if (!opened) {
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (err) {
      console.error('Error abriendo voucher PDF', err);
      Swal.fire({
        title: 'Error',
        text: 'No se pudo abrir el voucher en PDF.',
        icon: 'error'
      });
    }
  }
}
