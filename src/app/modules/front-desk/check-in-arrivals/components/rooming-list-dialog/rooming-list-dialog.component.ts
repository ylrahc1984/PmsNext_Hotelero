import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { normalizePmsDateDDMMYYYY, toPmsDateInputValue } from 'src/app/core/utils/pms-date.util';
import { Nationality } from 'src/app/modules/front-desk/settings/nationalities/models/nationality.model';
import { WalkInOption } from 'src/app/modules/front-desk/walk-in/models/walk-in.model';
import { WalkInService } from 'src/app/modules/front-desk/walk-in/services/walk-in.service';
import { RoomingListGuest } from '../../models/check-in-arrival.model';
import { CheckInArrivalsService } from '../../services/check-in-arrivals.service';

export interface RoomingListDialogContext {
  codReserva: string;
  numHabita: string;
  categoria?: string;
}

@Component({
  selector: 'app-rooming-list-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './rooming-list-dialog.component.html',
  styleUrls: ['./rooming-list-dialog.component.scss']
})
export class RoomingListDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly arrivalsService = inject(CheckInArrivalsService);
  private readonly walkInService = inject(WalkInService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) context!: RoomingListDialogContext;
  @Output() closed = new EventEmitter<void>();
  @Output() guestsLoaded = new EventEmitter<RoomingListGuest[]>();

  readonly guestForm = this.fb.nonNullable.group({
    codNacion: ['', Validators.required], tipDocu: ['', Validators.required], numDocu: ['', Validators.required],
    nombre: ['', Validators.required], apellido: ['', Validators.required], fecNac: [toPmsDateInputValue(new Date()), Validators.required],
    sexo: [''], estCivil: [''], tiPax: ['PAX', Validators.required], direccion: [''], email: ['', Validators.email],
    motivo: [''], procede: [''], mdoArribo: ['']
  });
  readonly nationalitySearchControl = this.fb.nonNullable.control('');
  guests: RoomingListGuest[] = [];
  documentTypes: WalkInOption[] = [];
  nationalities: Nationality[] = [];
  loading = true;
  saving = false;
  errorMessage = '';
  nationalitySearchOpen = false;
  editingGuest: RoomingListGuest | null = null;

  ngOnInit(): void {
    this.loadCatalogs();
    this.loadGuests();
  }

  close(): void {
    if (!this.saving) this.closed.emit();
  }

  filteredNationalities(): Nationality[] {
    const term = this.normalizeText(this.nationalitySearchControl.value);
    return this.nationalities.filter((item) => !term || this.normalizeText(`${item.CR06_Codigo} ${item.CR06_Descripcion}`).includes(term)).slice(0, 25);
  }

  openNationalitySearch(): void { this.nationalitySearchOpen = true; }

  onNationalitySearchChange(value: string): void {
    this.nationalitySearchControl.setValue(value, { emitEvent: false });
    this.guestForm.controls.codNacion.setValue('');
    this.nationalitySearchOpen = true;
  }

  closeNationalitySearch(): void {
    setTimeout(() => { this.nationalitySearchOpen = false; this.cdr.markForCheck(); }, 120);
  }

  selectNationality(item: Nationality): void {
    this.guestForm.controls.codNacion.setValue(item.CR06_Codigo);
    this.guestForm.controls.codNacion.markAsTouched();
    this.nationalitySearchControl.setValue(item.CR06_Descripcion, { emitEvent: false });
    this.nationalitySearchOpen = false;
  }

  saveGuest(): void {
    if (this.guestForm.invalid || this.saving) { this.guestForm.markAllAsTouched(); return; }
    const value = this.guestForm.getRawValue();
    this.saving = true;
    this.errorMessage = '';
    const mutation = {
      proceso: 0, idOpe: this.editingGuest?.numInterno || '', codRsv: this.context.codReserva, numHabita: this.context.numHabita,
      ...value, fecNac: normalizePmsDateDDMMYYYY(value.fecNac), orden: this.guests.length + 1,
      operador: this.authService.getCurrentUser()?.usuario?.trim() || 'admin'
    };
    const request = this.editingGuest
      ? this.arrivalsService.updateRoomingListGuest({ ...mutation, orden: this.editingGuest.orden })
      : this.arrivalsService.addRoomingListGuest(mutation);
    request.pipe(
      finalize(() => { this.saving = false; this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => { this.resetGuestForm(); this.loadGuests(); },
      error: () => { this.errorMessage = 'No se pudo guardar el huésped.'; this.cdr.markForCheck(); }
    });
  }

  async deleteGuest(guest: RoomingListGuest): Promise<void> {
    if (this.saving) return;
    const result = await Swal.fire({
      title: 'Eliminar huésped', text: `${guest.nombre} ${guest.apellidos}`, icon: 'warning',
      showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#dc3545',
      customClass: { container: 'next-confirm-container' }
    });
    if (!result.isConfirmed || this.saving) return;
    this.saving = true;
    this.arrivalsService.deleteRoomingListGuest(guest.numInterno, this.context.codReserva).pipe(
      finalize(() => { this.saving = false; this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => this.loadGuests(),
      error: () => { this.errorMessage = 'No se pudo eliminar el huésped.'; this.cdr.markForCheck(); }
    });
  }

  trackGuest(_: number, guest: RoomingListGuest): string { return guest.numInterno; }

  clearForm(): void { this.resetGuestForm(); }

  editGuest(guest: RoomingListGuest): void {
    this.editingGuest = guest;
    this.guestForm.reset({
      codNacion: guest.nacionalidad || '', tipDocu: guest.tipDocu || '', numDocu: guest.numDocu || '',
      nombre: guest.nombre || '', apellido: guest.apellidos || '', fecNac: guest.fecNaci || '',
      sexo: guest.sexo || '', estCivil: guest.estCivil || '', tiPax: guest.tipoPax || 'PAX', direccion: guest.direccion || '',
      email: guest.email || '', motivo: guest.motivo || '', procede: guest.procede || '', mdoArribo: guest.mdoArribo || ''
    });
    this.nationalitySearchControl.setValue(this.nationalities.find((item) => item.CR06_Codigo === guest.nacionalidad)?.CR06_Descripcion || '', { emitEvent: false });
  }

  private resetGuestForm(): void {
    this.editingGuest = null;
    this.guestForm.reset({
      codNacion: '', tipDocu: this.documentTypes[0]?.codigo ?? '', numDocu: '', nombre: '', apellido: '',
      fecNac: toPmsDateInputValue(new Date()), sexo: '', estCivil: '', tiPax: 'PAX', direccion: '', email: '', motivo: '', procede: '', mdoArribo: ''
    });
    this.nationalitySearchControl.setValue('', { emitEvent: false });
    this.nationalitySearchOpen = false;
  }

  private loadCatalogs(): void {
    forkJoin({
      documents: this.walkInService.getTiposDocumento().pipe(catchError(() => of([] as WalkInOption[]))),
      nationalities: this.walkInService.getNacionalidades().pipe(catchError(() => of([] as Nationality[])))
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ documents, nationalities }) => {
      const hasPassport = documents.some((item) =>
        item.codigo.trim().toUpperCase() === 'PAS' || this.normalizeText(item.descripcion).includes('pasaporte')
      );
      this.documentTypes = hasPassport ? documents : [...documents, { codigo: 'PAS', descripcion: 'Pasaporte' }];
      this.nationalities = nationalities;
      this.guestForm.controls.tipDocu.setValue(this.documentTypes[0]?.codigo ?? '');
      this.cdr.markForCheck();
    });
  }

  private loadGuests(): void {
    this.loading = true;
    this.errorMessage = '';
    this.arrivalsService.getRoomingList(this.context.codReserva, this.context.numHabita).pipe(
      finalize(() => { this.loading = false; this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (guests) => { this.guests = guests; this.guestsLoaded.emit(guests); this.cdr.markForCheck(); },
      error: () => { this.errorMessage = 'No fue posible cargar los huéspedes de esta habitación.'; this.cdr.markForCheck(); }
    });
  }

  private normalizeText(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
}
