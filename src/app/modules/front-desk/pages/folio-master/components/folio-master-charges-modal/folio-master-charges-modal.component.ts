import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { FolioMasterChargeHeader } from '../../models/folio-master-charge.model';
import { FolioMaster, FolioMasterStatus } from '../../models/folio-master.model';

@Component({
  selector: 'app-folio-master-charges-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './folio-master-charges-modal.component.html',
  styleUrls: ['./folio-master-charges-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FolioMasterChargesModalComponent {
  @Input({ required: true }) folio!: FolioMaster;
  @Input() charges: FolioMasterChargeHeader[] = [];
  @Input() loading = false;
  @Input() errorMessage = '';
  @Input() checkoutLoading = false;

  @Output() closeModal = new EventEmitter<void>();
  @Output() retry = new EventEmitter<void>();
  @Output() viewCharge = new EventEmitter<FolioMasterChargeHeader>();
  @Output() invoice = new EventEmitter<FolioMaster>();
  @Output() checkout = new EventEmitter<FolioMaster>();

  private readonly statuses: FolioMasterStatus[] = [
    { value: 0, label: 'Creado', helper: 'Reserva creada' },
    { value: 1, label: 'In House', helper: 'Check-in realizado' },
    { value: 2, label: 'Check-out', helper: 'Salida realizada' }
  ];

  get total(): number {
    return this.charges.reduce((sum, charge) => sum + Number(charge.mtoTot ?? 0), 0);
  }

  formatDate(value: string): string {
    return normalizePmsDateDDMMYYYY(value) || 'N/D';
  }

  formatTime(value: string): string {
    const [hour, minute] = (value ?? '').trim().split(':');
    return hour && minute ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : (value || 'N/D');
  }

  getStatus(value: number | string): FolioMasterStatus {
    return this.statuses.find((item) => item.value === Number(value))
      ?? { value: Number(value), label: 'Desconocido', helper: 'Estado no identificado' };
  }

  getStatusClass(value: number | string): string {
    const status = Number(value);
    return status === 0 ? 'is-created' : status === 1 ? 'is-in-house' : status === 2 ? 'is-checkout' : 'is-unknown';
  }

  getChargeState(value: number | string): string {
    const state = (value ?? '').toString().trim().toUpperCase();
    if (!state || state === '0' || state === 'ACT') return 'Activo';
    if (state === '1' || state === 'ANU') return 'Anulado';
    return state;
  }

  trackByCharge(_: number, charge: FolioMasterChargeHeader): string {
    return `${charge.tipCrgHab}-${charge.numCrgHab}`;
  }
}
