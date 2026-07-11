import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { EMPTY, catchError, debounceTime, distinctUntilChanged, finalize, firstValueFrom, switchMap } from 'rxjs';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { WalkInAgenciaOption } from 'src/app/modules/front-desk/walk-in/models/walk-in.model';
import { WalkInService } from 'src/app/modules/front-desk/walk-in/services/walk-in.service';
import { ReservaConsulta, ReservaFiltro } from '../models/reserva-consulta.model';
import { ReservationPrepaymentsComponent } from '../reservation-prepayments/reservation-prepayments.component';
import { ReservationPrepaymentSummary, buildReservationPrepaymentSummary } from '../reservation-prepayments/models/reservation-prepayment.model';
import { ReservaHabitacionService } from '../services/reserva-habitacion.service';

interface ConsultaReservasFilterForm {
  fechaInicio: FormControl<string>;
  fechaFinal: FormControl<string>;
  agencia: FormControl<string>;
  estado: FormControl<string>;
}

interface EstadoReservaOption {
  valor: string;
  etiqueta: string;
}

type EstadoCambioReserva = 'WLT' | 'CCR';

@Component({
  selector: 'app-consulta-reservas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule, DatePipe, ReservationPrepaymentsComponent],
  templateUrl: './consulta-reservas.component.html',
  styleUrls: ['./consulta-reservas.component.scss']
})
export class ConsultaReservasComponent implements OnInit {
  private readonly quickSearchMinLength = 4;

  readonly estados: EstadoReservaOption[] = [
    { valor: 'ABI', etiqueta: 'Abierta' },
    { valor: 'CCR', etiqueta: 'Confirmada' },
    { valor: 'CHK', etiqueta: 'Check In' },
    { valor: 'WLT', etiqueta: 'Lista de espera' },
    { valor: 'ANU', etiqueta: 'Cancelada' }
  ];

  readonly pageSizeOptions = [10, 15, 20];
  readonly pageSize = signal(10);
  readonly currentPage = signal(1);
  readonly totalRecords = signal(0);
  readonly totalPages = signal(1);
  readonly loading = signal(false);
  readonly cancellingReserva = signal('');
  readonly changingEstadoReserva = signal('');
  readonly changingEstadoDestino = signal<EstadoCambioReserva | ''>('');
  readonly printingReserva = signal('');
  readonly prepaymentsOpen = signal(false);
  readonly selectedPrepaymentReserva = signal<ReservationPrepaymentSummary | null>(null);
  readonly errorMessage = signal('');
  readonly filtro = signal<ReservaFiltro>({
    fechaInicio: '',
    fechaFinal: '',
    agencia: '',
    estado: '',
    busqueda: ''
  });

  readonly filterForm: FormGroup<ConsultaReservasFilterForm>;
  readonly agenciaSearchControl = this.fb.control('');
  readonly quickSearchControl = this.fb.control('');
  readonly reservas = signal<ReservaConsulta[]>([]);
  readonly pagedReservas = this.reservas.asReadonly();
  agenciaSuggestions: WalkInAgenciaOption[] = [];
  agenciaSearchOpen = false;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly router: Router,
    private readonly reservaService: ReservaHabitacionService,
    private readonly catalogService: WalkInService,
    private readonly auth: AuthService,
    private readonly destroyRef: DestroyRef
  ) {
    const { inicio, salida } = this.defaultDateRange();
    this.filterForm = this.fb.group({
      fechaInicio: this.fb.control(inicio),
      fechaFinal: this.fb.control(salida),
      agencia: this.fb.control(''),
      estado: this.fb.control('')
    });

    this.filtro.set({
      fechaInicio: inicio,
      fechaFinal: salida,
      agencia: '',
      estado: '',
      busqueda: ''
    });
  }

  ngOnInit(): void {
    this.buscar();
    this.quickSearchControl.valueChanges.pipe(debounceTime(700), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.buscarDesdeBusquedaRapida());
    this.bindAgenciaSearch();
  }

  nuevaReserva(): void {
    void this.router.navigate(['/reservas/nueva-hospedaje']);
  }

  editarReserva(reserva: ReservaConsulta): void {
    if (!this.puedeEditarReserva(reserva)) {
      return;
    }

    const codReserva = reserva.reserva.trim();
    void this.router.navigate(['/reservas/editar-hospedaje', codReserva]);
  }

  puedeEditarReserva(reserva: ReservaConsulta): boolean {
    return !!reserva.reserva.trim() && this.normalizeEstadoCode(reserva.estado) !== 'CHK';
  }

  consultarReserva(reserva: ReservaConsulta): void {
    const codReserva = reserva.reserva.trim();
    if (!codReserva) {
      return;
    }

    void this.router.navigate(['/reservas/detalle-hospedaje', codReserva]);
  }

  async anularReserva(reserva: ReservaConsulta): Promise<void> {
    const codReserva = reserva.reserva.trim();
    if (!codReserva || !this.puedeAnularReserva(reserva)) {
      return;
    }

    const result = await Swal.fire({
      title: 'Anular reserva',
      html: `¿Está seguro de anular la reserva <strong>${this.escapeHtml(codReserva)}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'No, volver',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d'
    });

    if (!result.isConfirmed) {
      return;
    }

    const operador = this.auth.getCurrentUser()?.usuario?.trim() || reserva.operador?.trim() || 'admin';
    const fecAnulada = this.formatDateForApi(new Date());
    this.cancellingReserva.set(codReserva);

    void Swal.fire({
      title: 'Anulando reserva',
      text: 'Enviando la anulación al servidor...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const response = await firstValueFrom(
        this.reservaService.anularReserva(codReserva, fecAnulada, operador, 1).pipe(
          finalize(() => {
            this.cancellingReserva.set('');
            Swal.close();
          })
        )
      );

      if (response?.ok === false) {
        await Swal.fire({
          title: 'No se pudo anular',
          text: response.respuesta || response.mensaje || 'El endpoint no confirmó la anulación.',
          icon: 'error',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#dc3545'
        });
        return;
      }

      await Swal.fire({
        title: 'Reserva anulada',
        text: response?.respuesta || response?.mensaje || `La reserva ${codReserva} fue anulada correctamente.`,
        icon: 'success',
        timer: 1800,
        showConfirmButton: false
      });
      this.loadReservas();
    } catch (error) {
      console.error('No se pudo anular la reserva.', error);
      this.cancellingReserva.set('');
      Swal.close();
      await Swal.fire({
        title: 'Error al anular la reserva',
        text: this.getAnulacionErrorMessage(error),
        icon: 'error',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#dc3545'
      });
    }
  }

  puedeAnularReserva(reserva: ReservaConsulta): boolean {
    const estado = this.normalizeEstadoCode(reserva.estado);
    return !!reserva.reserva.trim() && estado !== 'CHK' && estado !== 'ANU';
  }

  puedeCambiarEstadoReserva(reserva: ReservaConsulta, estadoDestino: EstadoCambioReserva): boolean {
    const estadoActual = this.normalizeEstadoCode(reserva.estado);
    return !!reserva.reserva.trim() && estadoActual !== estadoDestino && estadoActual !== 'CHK' && estadoActual !== 'ANU';
  }

  async cambiarEstadoReserva(reserva: ReservaConsulta, estadoDestino: EstadoCambioReserva): Promise<void> {
    const codReserva = reserva.reserva.trim();
    if (!codReserva || !this.puedeCambiarEstadoReserva(reserva, estadoDestino)) {
      return;
    }

    const operador = this.auth.getCurrentUser()?.usuario?.trim();
    if (!operador) {
      await Swal.fire({
        title: 'Usuario requerido',
        text: 'No se pudo identificar el usuario autenticado para enviar el operador.',
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#0d6efd'
      });
      return;
    }

    const etiquetaDestino = this.estadoLabel(estadoDestino);
    const result = await Swal.fire({
      title: `Cambiar a ${etiquetaDestino}`,
      html: `¿Desea cambiar la reserva <strong>${this.escapeHtml(codReserva)}</strong> a <strong>${this.escapeHtml(etiquetaDestino)}</strong>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cambiar',
      cancelButtonText: 'No, volver',
      confirmButtonColor: estadoDestino === 'CCR' ? '#198754' : '#f59e0b',
      cancelButtonColor: '#6c757d'
    });

    if (!result.isConfirmed) {
      return;
    }

    this.changingEstadoReserva.set(codReserva);
    this.changingEstadoDestino.set(estadoDestino);

    void Swal.fire({
      title: 'Actualizando reserva',
      text: 'Enviando el cambio de estado al servidor...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const response = await firstValueFrom(
        this.reservaService.cambiarEstadoReserva(codReserva, estadoDestino, operador).pipe(
          finalize(() => {
            this.changingEstadoReserva.set('');
            this.changingEstadoDestino.set('');
            Swal.close();
          })
        )
      );

      if (response?.ok === false) {
        await Swal.fire({
          title: 'No se pudo actualizar',
          text: response.respuesta || response.mensaje || 'El endpoint no confirmó el cambio de estado.',
          icon: 'error',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#dc3545'
        });
        return;
      }

      await Swal.fire({
        title: 'Reserva actualizada',
        text: response?.respuesta || response?.mensaje || `La reserva ${codReserva} fue cambiada a ${etiquetaDestino}.`,
        icon: 'success',
        timer: 1800,
        showConfirmButton: false
      });
      this.loadReservas();
    } catch (error) {
      console.error('No se pudo cambiar el estado de la reserva.', error);
      this.changingEstadoReserva.set('');
      this.changingEstadoDestino.set('');
      Swal.close();
      await Swal.fire({
        title: 'Error al cambiar estado',
        text: this.getOperacionReservaErrorMessage(error, 'No se pudo cambiar el estado de la reserva. Revise la conexión con el API o la respuesta del servidor.'),
        icon: 'error',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#dc3545'
      });
    }
  }

  imprimirConfirmacion(reserva: ReservaConsulta): void {
    const codReserva = reserva.reserva.trim();
    if (!codReserva || this.printingReserva()) {
      return;
    }

    this.printingReserva.set(codReserva);
    this.reservaService
      .getConfirmacionPdf(codReserva)
      .pipe(finalize(() => this.printingReserva.set('')))
      .subscribe({
        next: (blob) => this.openPdfBlob(blob, `Confirmacion_Reserva_${codReserva}.pdf`),
        error: (error) => {
          console.error('No se pudo obtener la confirmación PDF.', error);
          void Swal.fire({
            title: 'Error',
            text: 'No se pudo obtener la confirmación en PDF.',
            icon: 'error',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#dc3545'
          });
        }
      });
  }

  abrirPrepagos(reserva: ReservaConsulta): void {
    const codReserva = reserva.reserva.trim();
    if (!codReserva) {
      return;
    }

    this.selectedPrepaymentReserva.set(buildReservationPrepaymentSummary(reserva));
    this.prepaymentsOpen.set(true);
  }

  cerrarPrepagos(): void {
    this.prepaymentsOpen.set(false);
    this.selectedPrepaymentReserva.set(null);
  }

  onPrepagosChanged(): void {
    this.loadReservas();
  }

  buscar(): void {
    const formValue = this.filterForm.getRawValue();
    this.filtro.set({
      ...formValue,
      agencia: this.getAgenciaFilterCode(),
      busqueda: this.quickSearchControl.value
    });
    this.currentPage.set(1);
    this.loadReservas();
  }

  buscarDesdeBusquedaRapida(): void {
    const term = this.quickSearchControl.value.trim();
    if (term.length > 0 && term.length < this.quickSearchMinLength) {
      return;
    }

    this.buscar();
  }

  limpiar(): void {
    const { inicio, salida } = this.defaultDateRange();
    this.filterForm.reset({ fechaInicio: inicio, fechaFinal: salida, agencia: '', estado: '' });
    this.agenciaSearchControl.setValue('', { emitEvent: false });
    this.agenciaSuggestions = [];
    this.agenciaSearchOpen = false;
    this.quickSearchControl.setValue('', { emitEvent: false });
    this.filtro.set({ fechaInicio: inicio, fechaFinal: salida, agencia: '', estado: '', busqueda: '' });
    this.currentPage.set(1);
    this.loadReservas();
  }

  actualizar(): void {
    this.loadReservas();
  }

  exportar(): void {
    const csv = this.reservas()
      .map((r) => `${r.reserva},${r.agencia},${r.ingreso},${r.salida},${r.estado},${r.total}`)
      .join('\n');
    console.info('Export reservas\n' + csv);
  }

  setPageSize(value: string): void {
    this.pageSize.set(Number(value) || 5);
    this.currentPage.set(1);
    this.loadReservas();
  }

  goToPage(page: number): void {
    const normalizedPage = Math.min(Math.max(page, 1), Math.max(this.totalPages(), 1));
    if (normalizedPage === this.currentPage()) {
      return;
    }

    this.currentPage.set(normalizedPage);
    this.loadReservas();
  }

  statusClass(estado: string): string {
    const normalizedEstado = this.normalizeEstadoCode(estado);
    const classes: Record<string, string> = {
      ABI: 'bg-primary-subtle text-primary border-primary-subtle',
      CCR: 'bg-success-subtle text-success border-success-subtle',
      CHK: 'bg-info-subtle text-info border-info-subtle',
      WLT: 'bg-warning-subtle text-warning border-warning-subtle',
      ANU: 'bg-danger-subtle text-danger border-danger-subtle'
    };

    return classes[normalizedEstado] ?? 'bg-light text-dark border-light';
  }

  estadoLabel(estado: string): string {
    const normalizedEstado = this.normalizeEstadoCode(estado);
    return this.estados.find((item) => item.valor === normalizedEstado)?.etiqueta ?? estado;
  }

  openAgenciaSuggestions(): void {
    this.catalogService
      .searchAgencias(this.getCurrentAgencySearchTerm())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((items) => {
        this.agenciaSuggestions = items;
        this.agenciaSearchOpen = items.length > 0;
      });
  }

  selectAgencia(agencia: WalkInAgenciaOption): void {
    this.filterForm.controls.agencia.setValue(agencia.codigo, { emitEvent: false });
    this.agenciaSearchControl.setValue(this.buildAgenciaLabel(agencia), { emitEvent: false });
    this.agenciaSuggestions = [];
    this.agenciaSearchOpen = false;
  }

  trackByReserva(_: number, reserva: ReservaConsulta): string {
    return reserva.reserva;
  }

  trackByCode(_: number, item: { codigo?: string }): string {
    return item.codigo ?? '';
  }

  private loadReservas(): void {
    const filtro = this.filtro();
    const fechaInicio = this.normalizeDateForApi(filtro.fechaInicio);
    const fechaFinal = this.normalizeDateForApi(filtro.fechaFinal);

    if (!fechaInicio || !fechaFinal) {
      this.errorMessage.set('Ingrese Fecha Inicio y Fecha Final en formato dd/MM/yyyy.');
      this.reservas.set([]);
      this.totalRecords.set(0);
      this.totalPages.set(1);
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.reservaService
      .consultarReservas({
        fecIngreso: fechaInicio,
        fecSalida: fechaFinal,
        pagina: this.currentPage(),
        tamanoPagina: this.pageSize(),
        agencia: filtro.agencia,
        estado: filtro.estado,
        busqueda: filtro.busqueda
      })
      .pipe(
        catchError((error) => {
          console.error('No se pudieron consultar las reservas.', error);
          this.errorMessage.set('No se pudieron consultar las reservas.');
          this.reservas.set([]);
          this.totalRecords.set(0);
          this.totalPages.set(1);
          return EMPTY;
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe((response) => {
        this.reservas.set(response.reservas);
        this.totalRecords.set(response.totalRegistros || response.reservas.length);
        this.currentPage.set(response.paginaActual || this.currentPage());
        this.pageSize.set(response.tamanoPagina || this.pageSize());
        this.totalPages.set(Math.max(response.totalPaginas || 1, 1));
      });
  }

  private defaultDateRange(): { inicio: string; salida: string } {
    const today = new Date();
    const salida = new Date(today);
    salida.setDate(today.getDate() + 2);

    return {
      inicio: this.formatDateForInput(today),
      salida: this.formatDateForInput(salida)
    };
  }

  private normalizeDateForApi(value: string): string {
    const text = value.trim();
    if (!text) {
      return '';
    }

    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (isoMatch) {
      return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }

    const apiMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
    return apiMatch ? text : '';
  }

  private formatDateForInput(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  }

  private formatDateForApi(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private normalizeEstadoCode(estado: string | null | undefined): string {
    const code = (estado ?? '').trim().toUpperCase();
    const aliases: Record<string, string> = {
      ABIERTO: 'ABI',
      ABIERTA: 'ABI',
      CON: 'CCR',
      CONFIRMADA: 'CCR',
      CONFIRMADO: 'CCR',
      IN: 'CHK',
      'CHECK IN': 'CHK',
      CHECKIN: 'CHK',
      WAITLIST: 'WLT',
      'LISTA DE ESPERA': 'WLT',
      CANCELADA: 'ANU',
      CANCELADO: 'ANU',
      ANULADA: 'ANU',
      ANULADO: 'ANU'
    };

    return aliases[code] ?? code;
  }

  private getAnulacionErrorMessage(error: unknown): string {
    return this.getOperacionReservaErrorMessage(error, 'No se pudo anular la reserva. Revise la conexión con el API o la respuesta del servidor.');
  }

  private getOperacionReservaErrorMessage(error: unknown, fallback: string): string {
    if (!error || typeof error !== 'object') {
      return fallback;
    }

    const httpError = error as { error?: unknown; message?: string; status?: number; statusText?: string };
    const statusDetail = httpError.status ? ` Código HTTP ${httpError.status}${httpError.statusText ? `: ${httpError.statusText}` : ''}.` : '';
    if (typeof httpError.error === 'string' && httpError.error.trim()) {
      return `${httpError.error}${statusDetail}`;
    }

    if (httpError.error && typeof httpError.error === 'object') {
      const apiError = httpError.error as { respuesta?: string; mensaje?: string; message?: string };
      const apiMessage = apiError.respuesta || apiError.mensaje || apiError.message;
      return apiMessage ? `${apiMessage}${statusDetail}` : `${fallback}${statusDetail}`;
    }

    return httpError.message ? `${httpError.message}${statusDetail}` : `${fallback}${statusDetail}`;
  }

  private openPdfBlob(blob: Blob, filename: string): void {
    try {
      const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(pdfBlob);
      const openedWindow = window.open(objectUrl, '_blank', 'noopener');

      if (!openedWindow) {
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    } catch (error) {
      console.error('No se pudo abrir la confirmación PDF.', error);
      void Swal.fire({
        title: 'Error',
        text: 'No se pudo abrir la confirmación en PDF.',
        icon: 'error',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#dc3545'
      });
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private bindAgenciaSearch(): void {
    this.agenciaSearchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => this.catalogService.searchAgencias(term)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((items) => {
        this.clearAgencyCodeIfTypedManually();
        this.agenciaSuggestions = items;
        this.agenciaSearchOpen = items.length > 0;
      });
  }

  private clearAgencyCodeIfTypedManually(): void {
    const codigo = this.filterForm.controls.agencia.value.trim();
    const label = this.agenciaSearchControl.value.trim();
    if (codigo && !label.startsWith(`${codigo} -`)) {
      this.filterForm.controls.agencia.setValue('', { emitEvent: false });
    }
  }

  private getCurrentAgencySearchTerm(): string {
    const value = this.agenciaSearchControl.value.trim();
    const code = this.filterForm.controls.agencia.value.trim();
    return code && value.startsWith(`${code} -`) ? value.slice(`${code} -`.length).trim() : value;
  }

  private getAgenciaFilterCode(): string {
    const selectedCode = this.filterForm.controls.agencia.value.trim();
    if (selectedCode) {
      return selectedCode;
    }

    const typedValue = this.agenciaSearchControl.value.trim();
    const codeCandidate = typedValue.split(' - ')[0]?.trim() ?? '';
    return /^[a-zA-Z0-9_-]+$/.test(codeCandidate) ? codeCandidate : '';
  }

  private buildAgenciaLabel(agencia: WalkInAgenciaOption): string {
    return [agencia.codigo, agencia.descripcion].filter(Boolean).join(' - ');
  }

}
