import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { RoomChargeAnnulPayload } from '../../../../shared/room-charges/room-charge-mutation.model';
import { RoomChargeMutationService } from '../../../../shared/room-charges/room-charge-mutation.service';
import { buildRoomChargeUpdatePayload } from '../../../../shared/room-charges/room-charge-payload.util';
import { calculateRoomChargeLineAmounts, ROOM_CHARGE_VAT_RATE } from '../../../../shared/room-charges/room-charge-calculation.util';
import { FolioMasterChargeDetail, FolioMasterChargeHeader, FolioMasterChargeLine } from '../../models/folio-master-charge.model';
import { FolioMasterChargeService } from '../../services/folio-master-charge.service';

export interface FolioChargeChangedEvent {
  tipCrgHab: string;
  numCrgHab: string;
  mtoTotal: number;
  basePrice: number | null;
}

@Component({
  selector: 'app-folio-charge-detail-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './folio-charge-detail-modal.component.html',
  styleUrls: ['./folio-charge-detail-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FolioChargeDetailModalComponent implements OnInit {
  @Input({ required: true }) charge!: FolioMasterChargeHeader;
  @Output() closeModal = new EventEmitter<void>();
  @Output() chargeChanged = new EventEmitter<FolioChargeChangedEvent>();

  private readonly chargeService = inject(FolioMasterChargeService);
  private readonly mutationService = inject(RoomChargeMutationService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  detail: FolioMasterChargeDetail | null = null;
  private originalDetail: FolioMasterChargeDetail | null = null;
  loading = false;
  errorMessage = '';
  pendingChanges = false;
  submitting = false;
  private pendingBasePrice: number | null = null;

  ngOnInit(): void {
    this.loadDetail();
  }

  get header(): FolioMasterChargeHeader {
    return this.detail?.encabezado ?? this.charge;
  }

  get total(): number {
    const lineTotal = this.detail?.detalles.reduce((sum, line) => sum + Number(line.total ?? 0), 0) ?? 0;
    return lineTotal || Number(this.header.mtoTot ?? 0);
  }

  loadDetail(): void {
    this.loading = true;
    this.errorMessage = '';
    this.pendingChanges = false;
    this.pendingBasePrice = null;

    this.chargeService
      .getDetail(this.charge.tipCrgHab, this.charge.numCrgHab)
      .pipe(
        catchError((error) => {
          console.error(`No se pudo consultar el detalle del cargo ${this.charge.numCrgHab}.`, error);
          this.errorMessage = 'No se pudo consultar el encabezado y las partidas del cargo.';
          return of(null);
        }),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((detail) => {
        if (!detail) return;
        this.originalDetail = this.cloneDetail(detail);
        this.detail = this.cloneDetail(detail);
        this.cdr.markForCheck();
      });
  }

  async refreshDetail(): Promise<void> {
    if (this.submitting) return;

    if (this.pendingChanges) {
      const confirmation = await Swal.fire({
        title: 'Descartar cambios y actualizar',
        text: 'Se consultará nuevamente el cargo y se perderán los cambios locales.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Actualizar y descartar',
        cancelButtonText: 'Continuar editando',
        reverseButtons: true,
        focusCancel: true,
        customClass: { container: 'next-confirm-container' }
      });
      if (!confirmation.isConfirmed) return;
    }

    this.loadDetail();
  }

  canMutate(line: FolioMasterChargeLine): boolean {
    const lineState = this.clean(line.estado).toUpperCase();
    const closeState = this.clean(this.header.cierre).toUpperCase();
    return lineState !== '1' && lineState !== 'ANU' && closeState !== '1' && closeState !== 'S';
  }

  get canMutateCharge(): boolean {
    const chargeState = this.clean(this.header.estado).toUpperCase();
    const closeState = this.clean(this.header.cierre).toUpperCase();
    return chargeState !== '1' && chargeState !== 'ANU' && closeState !== '1' && closeState !== 'S';
  }

  async editLine(line: FolioMasterChargeLine): Promise<void> {
    if (!this.canMutate(line)) {
      await this.showLockedMessage();
      return;
    }

    const currency = this.clean(line.moneda || this.header.moneda || this.charge.moneda) || 'USD';
    const updateAmountsPreview = (): void => {
      const quantity = Number((document.getElementById('folio-line-quantity') as HTMLInputElement | null)?.value);
      const price = Number((document.getElementById('folio-line-price') as HTMLInputElement | null)?.value);
      const amounts = calculateRoomChargeLineAmounts(quantity, price);
      this.setEditorAmount('folio-line-subtotal', amounts.subtotal, currency);
      this.setEditorAmount('folio-line-tax', amounts.tax, currency);
      this.setEditorAmount('folio-line-total', amounts.total, currency);
    };

    const result = await Swal.fire({
      title: 'Modificar partida',
      html: `
        <div class="folio-charge-editor">
          <label class="folio-charge-editor__field">Descripción<input id="folio-line-name" class="swal2-input" value="${this.escapeHtml(line.nomConsumo)}"></label>
          <div class="folio-charge-editor__inputs">
            <label class="folio-charge-editor__field">Cantidad<input id="folio-line-quantity" type="number" min="0.01" step="0.01" class="swal2-input" value="${Number(line.cantidad)}"></label>
            <label class="folio-charge-editor__field">Precio base<input id="folio-line-price" type="number" min="0" step="0.01" class="swal2-input" value="${Number(line.precio)}"><small>Este es el precio que se enviará al backend.</small></label>
          </div>
          <section class="folio-charge-totals" aria-label="Desglose del precio">
            <header><div><small>Resumen del cargo</small><strong>Detalle de importes</strong></div><span>IVA ${ROOM_CHARGE_VAT_RATE * 100}%</span></header>
            <div class="folio-charge-totals__row"><span>Subtotal</span><strong id="folio-line-subtotal"></strong></div>
            <div class="folio-charge-totals__row"><span>IVA (${ROOM_CHARGE_VAT_RATE * 100}%)</span><strong id="folio-line-tax"></strong></div>
            <div class="folio-charge-totals__grand"><span>Total con IVA</span><strong id="folio-line-total"></strong></div>
          </section>
          <label class="folio-charge-editor__field folio-charge-editor__field--observations">Observaciones<textarea id="folio-line-comment" class="swal2-textarea" rows="2" placeholder="Observación opcional">${this.escapeHtml(line.comentario)}</textarea></label>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Aplicar al borrador',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      buttonsStyling: false,
      customClass: {
        container: 'next-confirm-container',
        popup: 'folio-charge-editor-popup',
        title: 'folio-charge-editor-popup__title',
        htmlContainer: 'folio-charge-editor-popup__body',
        actions: 'folio-charge-editor-popup__actions',
        confirmButton: 'folio-charge-editor-popup__confirm',
        cancelButton: 'folio-charge-editor-popup__cancel'
      },
      didOpen: () => {
        document.getElementById('folio-line-quantity')?.addEventListener('input', updateAmountsPreview);
        document.getElementById('folio-line-price')?.addEventListener('input', updateAmountsPreview);
        updateAmountsPreview();
      },
      preConfirm: () => {
        const name = this.clean((document.getElementById('folio-line-name') as HTMLInputElement | null)?.value);
        const quantity = Number((document.getElementById('folio-line-quantity') as HTMLInputElement | null)?.value);
        const price = Number((document.getElementById('folio-line-price') as HTMLInputElement | null)?.value);
        const comment = this.clean((document.getElementById('folio-line-comment') as HTMLTextAreaElement | null)?.value);

        if (!name) {
          Swal.showValidationMessage('La descripción es requerida.');
          return null;
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
          Swal.showValidationMessage('La cantidad debe ser mayor que cero.');
          return null;
        }
        if (!Number.isFinite(price) || price < 0) {
          Swal.showValidationMessage('El precio no es válido.');
          return null;
        }
        return { name, quantity, price, comment, ...calculateRoomChargeLineAmounts(quantity, price) };
      }
    });

    if (!result.isConfirmed || !result.value) return;

    this.updateLine(line, {
      nomConsumo: result.value.name,
      cantidad: result.value.quantity,
      precio: result.value.price,
      subTotal: result.value.subtotal,
      precioSinImpNeto: result.value.price,
      impuestos: result.value.tax,
      total: result.value.total,
      comentario: result.value.comment
    });
    this.pendingBasePrice = result.value.price;
  }

  async removeLine(line: FolioMasterChargeLine): Promise<void> {
    if (!this.canMutate(line)) {
      await this.showLockedMessage();
      return;
    }

    if ((this.detail?.detalles.length ?? 0) <= 1) {
      await Swal.fire({
        title: 'No se puede retirar la partida',
        text: 'El cargo debe conservar al menos una partida. Para eliminarlo utilice Anular cargo completo.',
        icon: 'info',
        customClass: { container: 'next-confirm-container' }
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Anular partida',
      text: `¿Desea quitar "${line.nomConsumo || line.codConsumo}" del cargo ${line.numCrgHab}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, retirar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      focusCancel: true,
      customClass: { container: 'next-confirm-container' }
    });

    if (!result.isConfirmed || !this.detail) return;

    this.detail = {
      ...this.detail,
      detalles: this.detail.detalles.filter((item) => !this.isSameLine(item, line))
    };
    this.pendingChanges = true;
    this.cdr.markForCheck();
  }

  async transferLine(line: FolioMasterChargeLine): Promise<void> {
    if (!this.canMutate(line)) {
      await this.showLockedMessage();
      return;
    }

    const result = await Swal.fire({
      title: 'Trasladar partida',
      input: 'text',
      inputLabel: 'Habitación o folio destino',
      inputPlaceholder: 'Ej. 711',
      showCancelButton: true,
      confirmButtonText: 'Aplicar al borrador',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      customClass: { container: 'next-confirm-container' },
      inputValidator: (value) => {
        const destination = this.clean(value);
        if (!destination) return 'Indique el destino.';
        if (destination === this.clean(line.numHab)) return 'El destino debe ser distinto al actual.';
        return null;
      }
    });

    if (!result.isConfirmed) return;

    const destination = this.clean(result.value);
    this.updateLine(line, {
      numHab: destination,
      comentario: [line.comentario, `Traslado preparado hacia ${destination}.`].filter(Boolean).join(' | ')
    });
  }

  async discardChanges(): Promise<void> {
    if (!this.pendingChanges || !this.originalDetail) return;

    const result = await Swal.fire({
      title: 'Descartar cambios',
      text: 'Se restaurará el detalle recibido originalmente desde el backend.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Descartar',
      cancelButtonText: 'Continuar editando',
      reverseButtons: true,
      customClass: { container: 'next-confirm-container' }
    });

    if (!result.isConfirmed) return;
    this.detail = this.cloneDetail(this.originalDetail);
    this.pendingChanges = false;
    this.pendingBasePrice = null;
    this.cdr.markForCheck();
  }

  async saveChanges(): Promise<void> {
    if (!this.pendingChanges || !this.detail?.encabezado || this.submitting) return;

    const payload = buildRoomChargeUpdatePayload(
      {
        ...this.detail.encabezado,
        numHab: this.charge.folio || this.detail.encabezado.numHab
      },
      this.detail.detalles,
      this.getOperator(),
      {
        tipCrgHab: this.charge.tipCrgHab,
        numCrgHab: this.charge.numCrgHab,
        codRsv: this.charge.codReserva,
        numHab: this.charge.folio || this.charge.numHab,
        moneda: this.charge.moneda
      }
    );

    if (!payload) {
      await Swal.fire({
        title: 'No se pudo preparar la actualización',
        text: 'Verifique el encabezado, las partidas y el operador autenticado.',
        icon: 'warning',
        customClass: { container: 'next-confirm-container' }
      });
      return;
    }

    const confirmation = await Swal.fire({
      title: 'Guardar cambios del cargo',
      text: `Se actualizará el cargo ${payload.numCrgHab} con ${payload.detalle.length} partida(s) por ${payload.moneda} ${payload.mtoTotal.toFixed(2)}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, actualizar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      focusCancel: true,
      customClass: { container: 'next-confirm-container' }
    });

    if (!confirmation.isConfirmed) return;

    this.submitting = true;
    this.cdr.markForCheck();
    this.mutationService.update(payload)
      .pipe(
        finalize(() => {
          this.submitting = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          if (this.isFailedResponse(response)) {
            this.errorMessage = response.message || response.mensaje || 'No se pudo actualizar el cargo de habitación.';
            return;
          }

          void Swal.fire({
            title: 'Cargo actualizado',
            text: 'Los cambios fueron guardados correctamente.',
            icon: 'success',
            timer: 2200,
            showConfirmButton: false,
            customClass: { container: 'next-confirm-container' }
          });
          this.chargeChanged.emit({
            tipCrgHab: payload.tipCrgHab,
            numCrgHab: payload.numCrgHab,
            mtoTotal: payload.mtoTotal,
            basePrice: this.pendingBasePrice
          });
        },
        error: (error) => {
          console.error('No se pudo actualizar el cargo desde Folio Master.', error);
          this.errorMessage = error?.error?.mensaje || error?.error?.message || 'No se pudo actualizar el cargo de habitación.';
          this.cdr.markForCheck();
        }
      });
  }

  async annulCharge(): Promise<void> {
    if (!this.canMutateCharge || this.submitting) {
      await this.showLockedMessage();
      return;
    }

    const confirmation = await Swal.fire({
      title: 'Anular cargo completo',
      text: `Se anulará el cargo ${this.header.numCrgHab || this.charge.numCrgHab}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      customClass: { container: 'next-confirm-container' }
    });
    if (!confirmation.isConfirmed) return;

    const reasonResult = await Swal.fire({
      title: 'Motivo de anulación',
      input: 'textarea',
      inputLabel: 'Indique el motivo',
      inputAttributes: { maxlength: '250', rows: '4' },
      showCancelButton: true,
      confirmButtonText: 'Aplicar anulación',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      customClass: { container: 'next-confirm-container' },
      inputValidator: (value) => this.clean(value).length >= 5 ? null : 'El motivo debe tener al menos 5 caracteres.'
    });
    if (!reasonResult.isConfirmed) return;

    const payload: RoomChargeAnnulPayload = {
      tipCrgHab: this.clean(this.header.tipCrgHab || this.charge.tipCrgHab) || 'CHB',
      numCrgHab: this.clean(this.header.numCrgHab || this.charge.numCrgHab),
      codRsv: this.clean(this.header.codReserva || this.charge.codReserva),
      numHab: this.clean(this.charge.folio || this.header.numHab || this.charge.numHab),
      motivo: this.clean(reasonResult.value),
      operador: this.getOperator()
    };

    if (Object.values(payload).some((value) => !value)) {
      await Swal.fire({ title: 'Información incompleta', text: 'No se pudo preparar la anulación.', icon: 'warning' });
      return;
    }

    this.submitting = true;
    this.cdr.markForCheck();
    this.mutationService.annul(payload)
      .pipe(
        finalize(() => {
          this.submitting = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          if (this.isFailedResponse(response)) {
            this.errorMessage = response.message || response.mensaje || 'No se pudo anular el cargo.';
            return;
          }
          void Swal.fire({ title: 'Cargo anulado', text: 'El cargo fue anulado correctamente.', icon: 'success', customClass: { container: 'next-confirm-container' } });
          this.chargeChanged.emit({
            tipCrgHab: payload.tipCrgHab,
            numCrgHab: payload.numCrgHab,
            mtoTotal: 0,
            basePrice: null
          });
        },
        error: (error) => {
          console.error('No se pudo anular el cargo desde Folio Master.', error);
          this.errorMessage = error?.error?.mensaje || error?.error?.message || 'No se pudo anular el cargo.';
          this.cdr.markForCheck();
        }
      });
  }

  async requestClose(): Promise<void> {
    if (this.submitting) return;

    if (!this.pendingChanges) {
      this.closeModal.emit();
      return;
    }

    const result = await Swal.fire({
      title: 'Hay cambios sin guardar',
      text: 'Los ajustes del borrador se perderán al cerrar el detalle.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Cerrar y descartar',
      cancelButtonText: 'Volver al detalle',
      reverseButtons: true,
      focusCancel: true,
      customClass: { container: 'next-confirm-container' }
    });
    if (result.isConfirmed) this.closeModal.emit();
  }

  formatTime(value: string): string {
    const [hour, minute] = (value ?? '').trim().split(':');
    return hour && minute ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : (value || 'N/D');
  }

  stateLabel(value: number | string): string {
    const state = this.clean(value).toUpperCase();
    if (!state || state === '0' || state === 'ACT') return 'Activo';
    if (state === '1' || state === 'ANU') return 'Anulado';
    return state;
  }

  trackByLine(_: number, line: FolioMasterChargeLine): string {
    return `${line.numCrgHab}-${line.orden}-${line.codConsumo}`;
  }

  private updateLine(line: FolioMasterChargeLine, patch: Partial<FolioMasterChargeLine>): void {
    if (!this.detail) return;
    this.detail = {
      ...this.detail,
      detalles: this.detail.detalles.map((item) => this.isSameLine(item, line) ? { ...item, ...patch } : item)
    };
    this.pendingChanges = true;
    this.cdr.markForCheck();
  }

  private isSameLine(left: FolioMasterChargeLine, right: FolioMasterChargeLine): boolean {
    return left.orden === right.orden && left.codConsumo === right.codConsumo && left.numCrgHab === right.numCrgHab;
  }

  private cloneDetail(detail: FolioMasterChargeDetail): FolioMasterChargeDetail {
    return {
      ...detail,
      encabezado: detail.encabezado ? { ...detail.encabezado } : null,
      detalles: detail.detalles.map((line) => ({ ...line }))
    };
  }

  private async showLockedMessage(): Promise<void> {
    await Swal.fire({
      title: 'Partida bloqueada',
      text: 'La partida o el cargo se encuentra cerrado/anulado y no admite modificaciones.',
      icon: 'info',
      customClass: { container: 'next-confirm-container' }
    });
  }

  private getOperator(): string {
    const user = this.authService.getCurrentUser();
    return this.clean(user?.usuario || user?.nombre || this.header.operador || this.charge.operador || 'SISTEMA');
  }

  private isFailedResponse(response: unknown): response is { success: false; message?: string; mensaje?: string } {
    return Boolean(response && typeof response === 'object' && (response as { success?: boolean }).success === false);
  }

  private setEditorAmount(elementId: string, amount: number, currency: string): void {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = `${currency} ${amount.toFixed(2)}`;
    }
  }

  private clean(value: unknown): string {
    return (value ?? '').toString().trim();
  }

  private escapeHtml(value: unknown): string {
    return this.clean(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
