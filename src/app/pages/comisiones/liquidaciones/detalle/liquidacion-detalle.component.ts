import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, from, map, of, switchMap } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import Swal from 'sweetalert2';
import { ComisionPreviewRow } from '../../interfaces/comision-preview.interface';
import {
  LiquidacionCabecera,
  LiquidacionComisionDetalleRequest,
  LiquidacionComisionRequest,
  LiquidacionDetalleLinea,
  LiquidacionDetalleResponse
} from '../../interfaces/liquidacion-comision.interface';
import { ComisionPreviewService } from '../../services/comision-preview.service';
import { LiquidacionComisionService } from '../../services/liquidacion-comision.service';

type DetailAction = 'cerrar' | 'pagar' | 'anular';

interface TimelineItem {
  label: string;
  detail: string;
  active: boolean;
  action?: DetailAction;
}

@Component({
  selector: 'app-liquidacion-detalle',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './liquidacion-detalle.component.html',
  styleUrl: './liquidacion-detalle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LiquidacionDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(LiquidacionComisionService);
  private readonly previewService = inject(ComisionPreviewService);
  private readonly authService = inject(AuthService);

  readonly response = signal<LiquidacionDetalleResponse | null>(null);
  readonly loading = signal(false);
  readonly actionLoading = signal('');
  readonly refreshLoading = signal(false);
  readonly printing = signal(false);
  readonly errorMessage = signal('');
  readonly actionMessage = signal('');
  readonly skeletonRows = Array.from({ length: 5 });
  readonly cabecera = computed(() => this.response()?.cabecera ?? null);
  readonly detalle = computed(() => this.response()?.detalle ?? []);
  readonly metrics = computed(() => {
    const cabecera = this.cabecera();
    const detalle = this.detalle();
    return {
      facturado: Number(cabecera?.AD19_TotalFacturado ?? this.sum(detalle, 'AD20_MontoBase')),
      comision: Number(cabecera?.AD19_TotalComision ?? this.sum(detalle, 'AD20_MontoComision')),
      documentos: new Set(detalle.map((item) => this.documentLabel(item)).filter(Boolean)).size,
      reservas: new Set(detalle.map((item) => item.AD20_CodReserva).filter(Boolean)).size,
      pax: this.sum(detalle, 'AD20_CantidadPax')
    };
  });
  readonly timeline = computed<TimelineItem[]>(() => {
    const cabecera = this.cabecera();
    const estado = this.normalize(cabecera?.AD19_Estado ?? 'BORRADOR');
    return [
      { label: 'Creada', detail: this.formatDateTime(cabecera?.AD19_FechaLiquidacion), active: true },
      { label: 'Cerrada', detail: 'Aprobacion financiera', active: ['CERRADO', 'PAGADO'].includes(estado), action: 'cerrar' },
      { label: 'Pagada', detail: 'Salida bancaria aplicada', active: estado === 'PAGADO', action: 'pagar' },
      { label: 'Anulada', detail: 'Reversion administrativa', active: estado.includes('ANUL'), action: 'anular' }
    ];
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const id = params.get('id') ?? '';
          this.loading.set(true);
          this.errorMessage.set('');
          this.actionMessage.set('');
          return this.service.obtenerLiquidacion(id).pipe(
            catchError(() => {
              this.errorMessage.set('No se pudo cargar el detalle de la liquidacion.');
              return of(null);
            }),
            finalize(() => this.loading.set(false))
          );
        })
      )
      .subscribe((data) => this.response.set(data));
  }

  actualizarDesdePreview(): void {
    const cabecera = this.cabecera();
    if (!cabecera || this.refreshLoading() || this.actionLoading()) {
      return;
    }

    const confirmed = window.confirm(
      `Se volveran a consultar los documentos comisionables y se actualizara la liquidacion ${cabecera.AD19_Id}. Desea continuar?`
    );
    if (!confirmed) {
      return;
    }

    this.refreshLoading.set(true);
    this.errorMessage.set('');
    this.actionMessage.set('Consultando documentos comisionables actualizados...');

    this.previewService
      .obtenerPreview({
        empresaId: Number(cabecera.AD19_EmpresaId),
        fechaInicio: this.formatearFechaParaBackend(cabecera.AD19_FechaInicio),
        fechaFin: this.formatearFechaParaBackend(cabecera.AD19_FechaFin),
        operador: this.getOperador(),
        codAgencia: this.cleanText(cabecera.AD19_CodAgencia)
      })
      .pipe(
        switchMap((preview) => {
          const registros = preview.datos;
          const validationMessage = this.getPreviewLiquidacionValidationMessage(registros);
          if (validationMessage) {
            this.errorMessage.set(validationMessage);
            this.actionMessage.set('');
            return of(false);
          }

          const request = this.crearRequestActualizacion(cabecera, registros);
          this.actionMessage.set(`Actualizando liquidacion ${cabecera.AD19_Id} con ${registros.length} lineas...`);
          return this.service.actualizarLiquidacion(cabecera.AD19_Id, request).pipe(map(() => true));
        }),
        catchError(() => {
          this.errorMessage.set(`No se pudo actualizar la liquidacion ${cabecera.AD19_Id} desde el preview.`);
          this.actionMessage.set('');
          return of(false);
        }),
        finalize(() => this.refreshLoading.set(false))
      )
      .subscribe((success) => {
        if (!success) {
          return;
        }
        this.actionMessage.set(`Liquidacion ${cabecera.AD19_Id} actualizada con informacion fresca.`);
        this.reload(cabecera.AD19_Id);
      });
  }

  async ejecutarAccion(action: DetailAction): Promise<void> {
    const cabecera = this.cabecera();
    const id = cabecera?.AD19_Id;
    if (!id || this.actionLoading()) {
      return;
    }

    if (action === 'cerrar' && !this.canCerrarLiquidacion(cabecera)) {
      return;
    }

    if (action === 'pagar' && !this.canPagarLiquidacion(cabecera)) {
      return;
    }

    if (action === 'anular' && !this.canAnularLiquidacion(cabecera)) {
      return;
    }

    if (action === 'cerrar') {
      const confirmed = await this.confirmarCierre(id);
      if (!confirmed) {
        return;
      }
    }

    if (action === 'pagar') {
      const confirmed = await this.confirmarPago(id);
      if (!confirmed) {
        return;
      }
    }

    if (action === 'anular') {
      const confirmed = await this.confirmarAnulacion(id);
      if (!confirmed) {
        return;
      }
    }

    this.actionLoading.set(action);
    this.errorMessage.set('');
    this.actionMessage.set('');

    const request =
      action === 'cerrar'
        ? this.service.cerrarLiquidacion(id, this.getOperador())
        : action === 'pagar'
          ? this.service.pagarLiquidacion(id, this.getOperador())
          : this.service.anularLiquidacion(id, {}, this.getOperador());

    request
      .pipe(
        map(() => true),
        catchError(() => {
          this.errorMessage.set(`No se pudo ${this.actionLabel(action).toLowerCase()} la liquidacion ${id}.`);
          return of(false);
        }),
        finalize(() => this.actionLoading.set(''))
      )
      .subscribe((success) => {
        if (!success) {
          return;
        }
        this.actionMessage.set(`Liquidacion ${id} actualizada correctamente.`);
        this.reload(id);
      });
  }

  ejecutarAccionTimeline(step: TimelineItem): void {
    if (!step.action || step.active || this.actionLoading() || this.refreshLoading()) {
      return;
    }

    void this.ejecutarAccion(step.action);
  }

  imprimir(): void {
    const id = this.cabecera()?.AD19_Id ?? '';
    if (!id || this.printing()) {
      return;
    }

    const voucherWindow = window.open('', '_blank');
    if (!voucherWindow) {
      this.errorMessage.set('El navegador bloqueo la apertura del voucher. Permita ventanas emergentes para esta pagina.');
      return;
    }

    voucherWindow.opener = null;
    voucherWindow.document.write('<!doctype html><html><head><title>Generando voucher...</title></head><body>Generando voucher...</body></html>');

    this.printing.set(true);
    this.errorMessage.set('');
    this.actionMessage.set('');

    this.service
      .obtenerVoucher(id)
      .pipe(
        catchError((error) =>
          from(this.resolveVoucherError(error)).pipe(
            map((message) => {
              this.errorMessage.set(`No se pudo generar el voucher de la liquidacion ${id}. ${message}`);
              voucherWindow.close();
              return null;
            })
          )
        ),
        finalize(() => this.printing.set(false))
      )
      .subscribe((voucher) => {
        if (!voucher) {
          return;
        }

        const pdfBlob = voucher.type === 'application/pdf' ? voucher : new Blob([voucher], { type: 'application/pdf' });
        const url = URL.createObjectURL(pdfBlob);
        voucherWindow.location.href = url;

        this.actionMessage.set(`Voucher de ${id} generado correctamente.`);
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      });
  }

  documentLabel(item: LiquidacionDetalleLinea): string {
    return [item.AD20_TipoDocumento, item.AD20_SerieDocumento, item.AD20_NumeroDocumento].filter(Boolean).join('-');
  }

  statusClass(estado: string | undefined): string {
    const value = this.normalize(estado ?? '');
    if (value.includes('PAG')) return 'paid';
    if (value.includes('CERR')) return 'closed';
    if (value.includes('ANUL')) return 'void';
    return 'draft';
  }

  commissionClass(tipo: string): string {
    return this.normalize(tipo).includes('PORC') ? 'percentage' : 'fixed';
  }

  actionLabel(action: DetailAction): string {
    return action === 'cerrar' ? 'Cerrar' : action === 'pagar' ? 'Pagar' : 'Anular';
  }

  canActualizarDesdePreview(item: LiquidacionCabecera): boolean {
    const estado = this.normalize(item.AD19_Estado ?? 'BORRADOR');
    return !estado.includes('PAG') && !estado.includes('ANUL');
  }

  canCerrarLiquidacion(item: LiquidacionCabecera | null): boolean {
    const estado = this.normalize(item?.AD19_Estado ?? 'BORRADOR');
    return !estado.includes('CERR') && !estado.includes('PAG') && !estado.includes('ANUL');
  }

  canPagarLiquidacion(item: LiquidacionCabecera | null): boolean {
    const estado = this.normalize(item?.AD19_Estado ?? 'BORRADOR');
    return estado.includes('CERR') && !estado.includes('PAG') && !estado.includes('ANUL');
  }

  canAnularLiquidacion(item: LiquidacionCabecera | null): boolean {
    const estado = this.normalize(item?.AD19_Estado ?? 'BORRADOR');
    return !estado.includes('PAG') && !estado.includes('ANUL');
  }

  formatMoney(value: unknown): string {
    return new Intl.NumberFormat('es-CR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value ?? 0));
  }

  formatNumber(value: unknown): string {
    return new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 }).format(Number(value ?? 0));
  }

  formatDate(value: unknown): string {
    const text = String(value ?? '').trim();
    if (!text) return 'N/D';
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return text;
    return new Intl.DateTimeFormat('es-CR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  formatDateTime(value: unknown): string {
    const text = String(value ?? '').trim();
    if (!text) return 'Pendiente';
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return text;
    return new Intl.DateTimeFormat('es-CR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  private reload(id: string): void {
    this.service
      .obtenerLiquidacion(id)
      .pipe(catchError(() => of(null)))
      .subscribe((data) => this.response.set(data));
  }

  private crearRequestActualizacion(cabecera: LiquidacionCabecera, registros: ComisionPreviewRow[]): LiquidacionComisionRequest {
    const fechaInicio = this.formatearFechaParaBackend(cabecera.AD19_FechaInicio);
    const fechaFin = this.formatearFechaParaBackend(cabecera.AD19_FechaFin);

    return {
      proceso: 0,
      aD19_Id: cabecera.AD19_Id,
      aD19_EmpresaId: Number(cabecera.AD19_EmpresaId),
      aD19_CodAgencia: this.cleanText(cabecera.AD19_CodAgencia),
      aD19_NomAgencia: this.cleanText(registros[0]?.NomAgencia) || this.cleanText(cabecera.AD19_NomAgencia),
      aD19_FechaInicio: fechaInicio,
      aD19_FechaFin: fechaFin,
      aD19_TotalFacturado: this.calcularTotalFacturado(registros),
      aD19_TotalComision: this.calcularTotalComision(registros),
      aD19_MonedaBase: this.resolverMonedaBase(registros),
      aD19_Estado: this.cleanText(cabecera.AD19_Estado) || 'BORRADOR',
      aD19_Observaciones:
        this.cleanText(cabecera.AD19_Observaciones) || `Liquidacion actualizada desde preview de comisiones. Periodo: ${fechaInicio} - ${fechaFin}.`,
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

  private getPreviewLiquidacionValidationMessage(registros: ComisionPreviewRow[]): string {
    if (!registros.length) {
      return 'No hay documentos comisionables para actualizar esta liquidacion.';
    }

    const codAgencia = this.normalize(this.cabecera()?.AD19_CodAgencia ?? '');
    if (registros.some((row) => this.normalize(row.CodAgencia ?? '') !== codAgencia)) {
      return 'El preview devolvio documentos de una agencia distinta. Revise la liquidacion antes de actualizar.';
    }

    const incompleteRows = registros.filter((row) => this.getMissingLiquidacionFields(row).length);
    if (!incompleteRows.length) {
      return '';
    }

    console.warn('[Comisiones] Registros incompletos para actualizar liquidacion', incompleteRows);
    return 'Existen registros con datos obligatorios incompletos. Revise el preview antes de actualizar la liquidacion.';
  }

  private getMissingLiquidacionFields(row: ComisionPreviewRow): string[] {
    return [
      ['CodAgencia', row.CodAgencia],
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

  private calcularTotalFacturado(registros: ComisionPreviewRow[]): number {
    return registros.reduce((total, row) => total + this.toNumber(row.MontoBase), 0);
  }

  private calcularTotalComision(registros: ComisionPreviewRow[]): number {
    return registros.reduce((total, row) => total + this.toNumber(row.MontoComision), 0);
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
    return monedas[0] ?? '';
  }

  private sum(rows: LiquidacionDetalleLinea[], key: keyof Pick<LiquidacionDetalleLinea, 'AD20_MontoBase' | 'AD20_MontoComision' | 'AD20_CantidadPax'>): number {
    return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
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

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? 'CHARLY';
  }

  private async confirmarCierre(id: string): Promise<boolean> {
    const result = await Swal.fire({
      title: 'Cerrar liquidacion',
      text: `Desea cerrar la liquidacion ${id}? Esta accion aplicara el cierre financiero.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, cerrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1d4ed8',
      cancelButtonColor: '#667085',
      reverseButtons: true
    });

    return result.isConfirmed;
  }

  private async confirmarPago(id: string): Promise<boolean> {
    const result = await Swal.fire({
      title: 'Pagar liquidacion',
      text: `Desea marcar como pagada la liquidacion ${id}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, pagar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#166534',
      cancelButtonColor: '#667085',
      reverseButtons: true
    });

    return result.isConfirmed;
  }

  private async confirmarAnulacion(id: string): Promise<boolean> {
    const result = await Swal.fire({
      title: 'Anular liquidacion',
      text: `Desea anular la liquidacion ${id}? Esta accion aplicara la reversion administrativa.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, anular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#9f1239',
      cancelButtonColor: '#667085',
      reverseButtons: true
    });

    return result.isConfirmed;
  }

  private normalize(value: string): string {
    return value.toString().trim().toUpperCase();
  }

  private async resolveVoucherError(error: unknown): Promise<string> {
    if (error instanceof HttpErrorResponse && error.error instanceof Blob) {
      const text = (await error.error.text()).trim();
      return text || `HTTP ${error.status}`;
    }

    if (error instanceof HttpErrorResponse) {
      const backendMessage =
        typeof error.error === 'string'
          ? error.error
          : typeof error.error?.message === 'string'
            ? error.error.message
            : '';
      return backendMessage.trim() || `HTTP ${error.status}`;
    }

    return 'Intente nuevamente o contacte al administrador.';
  }
}
