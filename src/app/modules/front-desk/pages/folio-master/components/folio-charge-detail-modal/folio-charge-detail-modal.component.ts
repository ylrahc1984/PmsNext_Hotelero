import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { FolioMasterChargeDetail, FolioMasterChargeHeader, FolioMasterChargeLine } from '../../models/folio-master-charge.model';
import { FolioMasterChargeService } from '../../services/folio-master-charge.service';

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

  private readonly chargeService = inject(FolioMasterChargeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  detail: FolioMasterChargeDetail | null = null;
  private originalDetail: FolioMasterChargeDetail | null = null;
  loading = false;
  errorMessage = '';
  pendingChanges = false;

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

  canMutate(line: FolioMasterChargeLine): boolean {
    const lineState = this.clean(line.estado).toUpperCase();
    const closeState = this.clean(this.header.cierre).toUpperCase();
    return lineState !== '1' && lineState !== 'ANU' && closeState !== '1' && closeState !== 'S';
  }

  async editLine(line: FolioMasterChargeLine): Promise<void> {
    if (!this.canMutate(line)) {
      await this.showLockedMessage();
      return;
    }

    const result = await Swal.fire({
      title: 'Modificar partida',
      html: `
        <div class="folio-charge-editor">
          <label>Descripción<input id="folio-line-name" class="swal2-input" value="${this.escapeHtml(line.nomConsumo)}"></label>
          <div><label>Cantidad<input id="folio-line-quantity" type="number" min="0.01" step="0.01" class="swal2-input" value="${Number(line.cantidad)}"></label>
          <label>Precio<input id="folio-line-price" type="number" min="0" step="0.01" class="swal2-input" value="${Number(line.precio)}"></label></div>
          <label>Comentario<textarea id="folio-line-comment" class="swal2-textarea">${this.escapeHtml(line.comentario)}</textarea></label>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Aplicar al borrador',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      customClass: { container: 'next-confirm-container' },
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
        return { name, quantity, price, comment };
      }
    });

    if (!result.isConfirmed || !result.value) return;

    this.updateLine(line, {
      nomConsumo: result.value.name,
      cantidad: result.value.quantity,
      precio: result.value.price,
      total: this.round(result.value.quantity * result.value.price - Number(line.descuento ?? 0)),
      comentario: result.value.comment
    });
  }

  async removeLine(line: FolioMasterChargeLine): Promise<void> {
    if (!this.canMutate(line)) {
      await this.showLockedMessage();
      return;
    }

    const result = await Swal.fire({
      title: 'Quitar partida del borrador',
      text: `¿Desea quitar "${line.nomConsumo || line.codConsumo}" del cargo ${line.numCrgHab}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, quitar',
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
    this.cdr.markForCheck();
  }

  async explainPendingPersistence(): Promise<void> {
    await Swal.fire({
      title: 'Falta contrato de actualización',
      text: 'Los cambios están preparados únicamente en pantalla. Para guardarlos se requiere el endpoint y payload de actualización/eliminación de partidas de cargo-habitación.',
      icon: 'info',
      confirmButtonText: 'Entendido',
      customClass: { container: 'next-confirm-container' }
    });
  }

  async requestClose(): Promise<void> {
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

  private round(value: number): number {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
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
