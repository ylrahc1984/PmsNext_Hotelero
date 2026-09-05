import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { RoomingListGuest } from '../../models/check-in-arrival.model';

export interface SelfCheckInReservation {
  codigo: string;
}

export interface SelfCheckInRoom {
  numero: string;
}

export interface SelfCheckInOption {
  codigo: string;
  descripcion: string;
}

export interface SelfCheckInGuestSave {
  slotId: string;
  orden: number;
  tipoPax: 'PAX' | 'CHD';
  tipoDocumento: string;
  numeroDocumento: string;
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string;
  codigoNacionalidad: string;
  procede: string;
}

interface GuestSlot {
  id: string;
  orden: number;
  tipoPax: 'PAX' | 'CHD';
  title: string;
  completed: boolean;
  data: SelfCheckInGuestSave | null;
}

@Component({
  selector: 'app-guest-self-checkin-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './guest-self-checkin-dialog.component.html',
  styleUrls: ['./guest-self-checkin-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GuestSelfCheckinDialogComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input({ required: true }) reservation!: SelfCheckInReservation;
  @Input({ required: true }) room!: SelfCheckInRoom;
  @Input() guestCount = 0;
  @Input() adultCount = 0;
  @Input() childCount = 0;
  @Input() existingGuests: RoomingListGuest[] = [];
  @Input() documentTypes: SelfCheckInOption[] = [];
  @Input() nationalities: SelfCheckInOption[] = [];
  @Input() hotelName = 'Casa Lamia Boutique Hotel';
  @Input() hotelLogoUrl = 'assets/images/logo_lamia_head_tight.png';
  @Input() saving = false;
  @Input() errorMessage = '';

  @Output() guestSaved = new EventEmitter<SelfCheckInGuestSave>();
  @Output() registrationFinished = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  readonly guestForm = this.fb.nonNullable.group({
    tipoDocumento           : ['', Validators.required],
    numeroDocumento         : ['', Validators.required],
    nombre                  : ['', Validators.required],
    apellidos               : ['', Validators.required],
    email                   : ['', [Validators.required, Validators.email]],
    telefono                : ['', Validators.required],
    codigoNacionalidad      : ['', Validators.required],
    procede                 : ['']
  });

  guests: GuestSlot[] = [];
  selectedGuestId = '';
  tabletFormVisible = false;
  finished = false;
  private optimisticGuestId = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['guestCount'] || changes['adultCount'] || changes['childCount'] || changes['existingGuests'] || changes['nationalities']) {
      this.buildGuestSlots();
    }
    if (changes['errorMessage'] && this.errorMessage && this.optimisticGuestId) {
      const failedGuest = this.guests.find((guest) => guest.id === this.optimisticGuestId);
      if (failedGuest) {
        failedGuest.completed = false;
        failedGuest.data = null;
        failedGuest.title = `${failedGuest.tipoPax === 'PAX' ? 'Adult' : 'Child'} ${failedGuest.tipoPax === 'PAX' ? failedGuest.orden : failedGuest.orden - this.adultCount}`;
        this.selectGuest(failedGuest);
      }
      this.optimisticGuestId = '';
    }
  }

  get completedCount(): number {
    return this.guests.filter((guest) => guest.completed).length;
  }

  get progressPercent(): number {
    return this.guests.length ? Math.round((this.completedCount / this.guests.length) * 100) : 0;
  }

  get allCompleted(): boolean {
    return this.guests.length > 0 && this.completedCount === this.guests.length;
  }

  get selectedGuest(): GuestSlot | null {
    return this.guests.find((guest) => guest.id === this.selectedGuestId) ?? null;
  }

  selectGuest(guest: GuestSlot): void {
    this.selectedGuestId = guest.id;
    this.tabletFormVisible = true;
    this.patchForm(guest);
  }

  backToList(): void {
    this.tabletFormVisible = false;
  }

  submit(): void {
    if (this.allCompleted) {
      this.finished = true;
      this.registrationFinished.emit();
      return;
    }

    const guest = this.selectedGuest;
    if (!guest || this.guestForm.invalid || this.saving) {
      this.guestForm.markAllAsTouched();
      return;
    }

    const value = this.guestForm.getRawValue();
    const savedGuest: SelfCheckInGuestSave = {
      slotId: guest.id,
      orden: guest.orden,
      tipoPax: guest.tipoPax,
      ...value
    };

    guest.data = savedGuest;
    guest.title = `${value.nombre.trim()} ${value.apellidos.trim()}`.trim();
    guest.completed = true;
    this.optimisticGuestId = guest.id;
    this.guestSaved.emit(savedGuest);

    const nextPending = this.guests.find((item) => !item.completed);
    if (nextPending) {
      this.selectGuest(nextPending);
    }
  }

  close(): void {
    if (!this.saving) this.cancelled.emit();
  }

  trackGuest(_: number, guest: GuestSlot): string {
    return guest.id;
  }

  private buildGuestSlots(): void {
    const adults = Math.max(0, Number(this.adultCount) || 0);
    const children = Math.max(0, Number(this.childCount) || 0);
    const declaredTotal = Math.max(0, Number(this.guestCount) || 0);
    const total = Math.max(declaredTotal, adults + children, this.existingGuests.length, 1);
    const previousSelection = this.selectedGuestId;

    this.guests = Array.from({ length: total }, (_, index) => {
      const existing = this.existingGuests[index];
      const tipoPax: 'PAX' | 'CHD' = index < adults || (!adults && index >= children) ? 'PAX' : 'CHD';
      const fallbackNumber = tipoPax === 'PAX' ? index + 1 : index - adults + 1;
      const data = existing ? this.mapExistingGuest(existing, index + 1, tipoPax) : null;
      return {
        id: existing?.numInterno || `guest-${index + 1}`,
        orden: index + 1,
        tipoPax,
        title: existing ? `${existing.nombre} ${existing.apellidos}`.trim() : `${tipoPax === 'PAX' ? 'Adult' : 'Child'} ${fallbackNumber}`,
        completed: !!existing,
        data
      };
    });

    const selected = this.guests.find((guest) => guest.id === previousSelection)
      ?? this.guests.find((guest) => !guest.completed)
      ?? this.guests[0];
    if (selected) {
      this.selectedGuestId = selected.id;
      this.patchForm(selected);
    }
  }

  private patchForm(guest: GuestSlot): void {
    const data = guest.data;
    this.guestForm.reset({
      tipoDocumento: data?.tipoDocumento ?? '',
      numeroDocumento: data?.numeroDocumento ?? '',
      nombre: data?.nombre ?? '',
      apellidos: data?.apellidos ?? '',
      email: data?.email ?? '',
      telefono: data?.telefono ?? '',
      codigoNacionalidad: data?.codigoNacionalidad ?? '',
      procede: data?.procede ?? ''
    });
  }

  private mapExistingGuest(guest: RoomingListGuest, orden: number, tipoPax: 'PAX' | 'CHD'): SelfCheckInGuestSave {
    return {
      slotId              : guest.numInterno,
      orden,
      tipoPax,
      tipoDocumento       : guest.tipDocu,
      numeroDocumento     : guest.numDocu,
      nombre              : guest.nombre,
      apellidos           : guest.apellidos,
      email               : guest.email,
      telefono            : guest.motivo,
      procede             : guest.procede ?? '',
      codigoNacionalidad  : this.nationalities.find((item) =>
        item.codigo === guest.nacionalidad || item.descripcion.toLocaleLowerCase() === guest.nacionalidad.toLocaleLowerCase()
      )?.codigo ?? guest.nacionalidad
    };
  }
}
