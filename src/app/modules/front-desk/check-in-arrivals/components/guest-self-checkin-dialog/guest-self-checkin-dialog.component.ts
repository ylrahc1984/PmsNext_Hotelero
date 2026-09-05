import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { Overlay } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { ToastService } from 'src/app/core/services/toast.service';
import {
  GuestIdentityDocument,
  RoomingListGuest,
  RoomingListMutationResponse,
  RoomingListSaveRequest
} from '../../models/check-in-arrival.model';
import { CheckInArrivalsService } from '../../services/check-in-arrivals.service';
import { GuestIdentityDocumentService } from '../../services/guest-identity-document.service';
import { IdentityDocumentCardComponent, IdentityDocumentVisualState } from './identity-document-card.component';

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
  existingGuestId?: string;
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

interface GuestDocumentState {
  status: IdentityDocumentVisualState;
  metadata: GuestIdentityDocument | null;
  localFile: File | null;
  localPreviewUrl: string;
  errorMessage: string;
  loadingMetadata: boolean;
}

interface GuestSlot {
  id: string;
  idRooming: string;
  existingGuestId: string;
  orden: number;
  tipoPax: 'PAX' | 'CHD';
  title: string;
  completed: boolean;
  data: SelfCheckInGuestSave | null;
  document: GuestDocumentState;
  roomingRequest: Promise<string> | null;
}

@Component({
  selector: 'app-guest-self-checkin-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, A11yModule, IdentityDocumentCardComponent],
  templateUrl: './guest-self-checkin-dialog.component.html',
  styleUrls: ['./guest-self-checkin-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GuestSelfCheckinDialogComponent implements OnChanges, OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly backgroundScroll = inject(Overlay).scrollStrategies.block();
  private readonly arrivalsService = inject(CheckInArrivalsService);
  private readonly documentService = inject(GuestIdentityDocumentService);
  private readonly empresaContext = inject(EmpresaContextService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('cameraInput') private cameraInput?: ElementRef<HTMLInputElement>;
  @ViewChild('fileInput') private fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('replaceInput') private replaceInput?: ElementRef<HTMLInputElement>;

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
  localSaving = false;
  localErrorMessage = '';
  documentViewerUrl = '';
  documentViewerTitle = '';
  private documentViewerObjectUrl = '';

  ngOnInit(): void {
    this.backgroundScroll.enable();
  }

  ngOnDestroy(): void {
    this.backgroundScroll.disable();
    this.guests.forEach((guest) => this.revokeGuestPreview(guest));
    this.closeDocumentViewer();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['guestCount'] || changes['adultCount'] || changes['childCount'] || changes['existingGuests'] || changes['nationalities']) {
      this.buildGuestSlots();
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

  get selectedGuestIsExisting(): boolean {
    return !!this.selectedGuest?.idRooming;
  }

  get effectiveSaving(): boolean {
    return this.saving || this.localSaving;
  }

  get visibleErrorMessage(): string {
    return this.localErrorMessage || this.errorMessage;
  }

  get selectedDocument(): GuestDocumentState {
    return this.selectedGuest?.document ?? this.createDocumentState();
  }

  get documentActionsDisabled(): boolean {
    const status = this.selectedDocument.status;
    return this.effectiveSaving || status === 'preparing-rooming' || status === 'uploading' || status === 'replacing' || status === 'deleting';
  }

  get saveButtonLabel(): string {
    if (this.effectiveSaving) return 'Saving guest…';
    if (this.selectedGuestIsExisting) return 'Update guest';
    return this.allCompleted ? 'Complete registration' : 'Save guest';
  }

  get isSaveDisabled(): boolean {
    return this.effectiveSaving || this.documentActionsDisabled;
  }

  selectGuest(guest: GuestSlot): void {
    this.cacheCurrentFormValues();
    this.closeDocumentViewer();
    this.selectedGuestId = guest.id;
    this.tabletFormVisible = true;
    this.patchForm(guest);
    this.loadDocumentForGuest(guest);
  }

  backToList(): void {
    this.tabletFormVisible = false;
  }

  async submit(): Promise<void> {
    const guest = this.selectedGuest;
    if (!guest) {
      this.guestForm.markAllAsTouched();
      return;
    }

    if (this.allCompleted && !this.selectedGuestIsExisting && !this.guestForm.dirty && !this.effectiveSaving) {
      this.finished = true;
      this.registrationFinished.emit();
      return;
    }

    if (this.guestForm.invalid || this.isSaveDisabled) {
      this.guestForm.markAllAsTouched();
      return;
    }

    this.localSaving = true;
    this.localErrorMessage = '';
    const wasCompleted = guest.completed;
    this.cacheCurrentFormValues();
    this.cdr.markForCheck();

    try {
      await this.persistRoomingForGuest(guest);
      guest.completed = true;
      this.refreshGuestTitle(guest);
      this.guestSaved.emit(this.buildSavedGuest(guest));
      this.guestForm.markAsPristine();

      const nextPending = this.guests.find((item) => !item.completed);
      if (nextPending) {
        this.selectGuest(nextPending);
      } else if (!wasCompleted) {
        this.finished = true;
        this.registrationFinished.emit();
      }
    } catch (error) {
      console.error('No se pudo guardar el huésped.', error);
      this.localErrorMessage = 'We could not save your information. Please review the details and try again.';
    } finally {
      this.localSaving = false;
      this.cdr.markForCheck();
    }
  }

  close(): void {
    if (!this.effectiveSaving && !this.documentActionsDisabled) this.cancelled.emit();
  }

  trackGuest(_: number, guest: GuestSlot): string {
    return guest.id;
  }

  openCameraPicker(): void {
    if (!this.documentActionsDisabled) this.cameraInput?.nativeElement.click();
  }

  openFilePicker(): void {
    if (!this.documentActionsDisabled) this.fileInput?.nativeElement.click();
  }

  openReplacePicker(): void {
    if (!this.documentActionsDisabled) this.replaceInput?.nativeElement.click();
  }

  onDocumentFileSelected(event: Event, replacing: boolean): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;
    void this.handleDocumentFile(file, replacing);
  }

  async retryDocumentUpload(): Promise<void> {
    const guest = this.selectedGuest;
    const file = guest?.document.localFile;
    if (!guest || !file) return;
    await this.handleDocumentFile(file, !!guest.document.metadata);
  }

  removeLocalDocumentSelection(): void {
    const guest = this.selectedGuest;
    if (!guest || this.documentActionsDisabled) return;
    this.revokeGuestPreview(guest);
    guest.document.localFile = null;
    guest.document.errorMessage = '';
    guest.document.status = guest.document.metadata ? 'stored' : 'empty';
    this.cdr.markForCheck();
  }

  async viewDocument(): Promise<void> {
    const guest = this.selectedGuest;
    const idDocumento = guest?.document.metadata?.idDocumento;
    if (!guest || !idDocumento || this.documentActionsDisabled) return;

    this.cdr.markForCheck();
    try {
      const blob = await firstValueFrom(this.documentService.getContent(idDocumento));
      this.closeDocumentViewer();
      this.documentViewerObjectUrl = URL.createObjectURL(blob);
      this.documentViewerUrl = this.documentViewerObjectUrl;
      this.documentViewerTitle = `${guest.title} · Identity document`;
    } catch (error) {
      console.error('No se pudo consultar el documento.', error);
      this.toast.error('No fue posible abrir el documento de identidad.');
    } finally {
      this.cdr.markForCheck();
    }
  }

  async confirmDeleteDocument(): Promise<void> {
    const guest = this.selectedGuest;
    const idDocumento = guest?.document.metadata?.idDocumento;
    if (!guest || !idDocumento || this.documentActionsDisabled) return;

    const result = await Swal.fire({
      title: 'Delete identity document',
      text: 'This removes the stored document for this guest.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc3545',
      customClass: { container: 'next-confirm-container' }
    });
    if (!result.isConfirmed) return;

    const targetGuest = guest;
    targetGuest.document.status = 'deleting';
    this.cdr.markForCheck();
    try {
      await firstValueFrom(this.documentService.delete(idDocumento));
      targetGuest.document = this.createDocumentState();
      this.toast.success('Identity document deleted.');
    } catch (error) {
      console.error('No se pudo eliminar el documento.', error);
      targetGuest.document.status = 'stored';
      this.toast.error('No fue posible eliminar el documento de identidad.');
    } finally {
      this.cdr.markForCheck();
    }
  }

  closeDocumentViewer(): void {
    if (this.documentViewerObjectUrl) URL.revokeObjectURL(this.documentViewerObjectUrl);
    this.documentViewerObjectUrl = '';
    this.documentViewerUrl = '';
    this.documentViewerTitle = '';
  }

  getDocumentTypeLabel(code: string): string {
    return this.documentTypes.find((item) => item.codigo === code)?.descripcion || code;
  }

  formatFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  formatStoredDate(value: string): string {
    if (!value) return '';
    const normalized = value.includes('/') ? value.split('/').reverse().join('-') : value;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  private buildGuestSlots(): void {
    const previousByOrder = new Map(this.guests.map((guest) => [guest.orden, guest]));
    const adults = Math.max(0, Number(this.adultCount) || 0);
    const children = Math.max(0, Number(this.childCount) || 0);
    const declaredTotal = Math.max(0, Number(this.guestCount) || 0);
    const total = Math.max(declaredTotal, adults + children, this.existingGuests.length, 1);
    const previousSelection = this.selectedGuestId;

    this.guests = Array.from({ length: total }, (_, index) => {
      const existing = this.existingGuests[index];
      const previous = previousByOrder.get(index + 1);
      const tipoPax: 'PAX' | 'CHD' = index < adults || (!adults && index >= children) ? 'PAX' : 'CHD';
      const fallbackNumber = tipoPax === 'PAX' ? index + 1 : index - adults + 1;
      const slotId = `guest-${index + 1}`;
      const idRooming = existing?.numInterno?.trim() || previous?.idRooming || '';
      const data = existing ? this.mapExistingGuest(existing, slotId, index + 1, tipoPax) : previous?.data ?? null;
      return {
        id: slotId,
        idRooming,
        existingGuestId: idRooming,
        orden: index + 1,
        tipoPax,
        title: data ? `${data.nombre} ${data.apellidos}`.trim() : `${tipoPax === 'PAX' ? 'Adult' : 'Child'} ${fallbackNumber}`,
        completed: !!existing || previous?.completed === true,
        data,
        document: previous?.document ?? this.createDocumentState(),
        roomingRequest: previous?.roomingRequest ?? null
      };
    });

    const selected = this.guests.find((guest) => guest.id === previousSelection)
      ?? this.guests.find((guest) => !guest.completed)
      ?? this.guests[0];
    if (selected) {
      this.selectedGuestId = selected.id;
      this.patchForm(selected);
      this.loadDocumentForGuest(selected);
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

  private cacheCurrentFormValues(): void {
    const guest = this.selectedGuest;
    if (!guest) return;
    guest.data = this.buildSavedGuest(guest);
    this.refreshGuestTitle(guest);
  }

  private async handleDocumentFile(file: File, replacing: boolean): Promise<void> {
    const guest = this.selectedGuest;
    if (!guest || this.documentActionsDisabled) return;

    const validationError = this.validateDocumentFile(file);
    if (validationError) {
      guest.document.status = 'error';
      guest.document.errorMessage = validationError;
      guest.document.localFile = null;
      this.revokeGuestPreview(guest);
      this.cdr.markForCheck();
      return;
    }

    if (this.guestForm.invalid) {
      this.guestForm.markAllAsTouched();
      guest.document.status = 'error';
      guest.document.errorMessage = 'Complete the guest information before uploading the identity document.';
      this.cdr.markForCheck();
      return;
    }

    this.cacheCurrentFormValues();
    this.setLocalDocumentFile(guest, file);
    guest.document.status = 'ready';
    this.cdr.markForCheck();

    try {
      if (!guest.idRooming) {
        guest.document.status = 'preparing-rooming';
        this.cdr.markForCheck();
        await this.persistRoomingForGuest(guest);
      }

      guest.document.status = replacing && guest.document.metadata ? 'replacing' : 'uploading';
      guest.document.errorMessage = '';
      this.cdr.markForCheck();

      const payload = {
        file,
        empresa: this.getEmpresa(),
        idRooming: guest.idRooming,
        codReserva: this.reservation.codigo,
        tipoDocumento: this.guestForm.controls.tipoDocumento.value
      };
      const response = guest.document.metadata?.idDocumento
        ? await firstValueFrom(this.documentService.replace(guest.document.metadata.idDocumento, payload))
        : await firstValueFrom(this.documentService.create(payload));

      const savedDocument = await this.fetchSavedDocument(guest, response);
      guest.document.metadata = savedDocument;
      guest.document.status = savedDocument ? 'stored' : 'empty';
      guest.document.errorMessage = '';
      guest.document.localFile = null;
      this.revokeGuestPreview(guest);
      this.toast.success('Identity document saved.');
    } catch (error) {
      console.error('No se pudo guardar el documento.', error);
      guest.document.status = 'error';
      guest.document.errorMessage = 'We could not save the document. Please try again.';
      this.toast.error('No fue posible guardar el documento de identidad.');
    } finally {
      this.cdr.markForCheck();
    }
  }

  private async persistRoomingForGuest(guest: GuestSlot): Promise<string> {
    if (guest.roomingRequest) return guest.roomingRequest;
    const request = this.buildRoomingListRequest(guest);
    guest.roomingRequest = firstValueFrom(
      guest.idRooming
        ? this.arrivalsService.updateRoomingListGuest(request)
        : this.arrivalsService.addRoomingListGuest(request)
    )
      .then((response) => {
        const idRooming = guest.idRooming || this.extractRoomingMutationId(response);
        if (!idRooming) throw new Error('Rooming response did not include idOpe.');
        guest.idRooming = idRooming;
        guest.existingGuestId = idRooming;
        if (guest.data) guest.data.existingGuestId = idRooming;
        return idRooming;
      })
      .finally(() => {
        guest.roomingRequest = null;
      });
    return guest.roomingRequest;
  }

  private buildRoomingListRequest(guest: GuestSlot): RoomingListSaveRequest {
    const data = guest.data ?? this.buildSavedGuest(guest);
    return {
      proceso: 0,
      idOpe: guest.idRooming,
      codRsv: this.reservation.codigo,
      numHabita: this.room.numero,
      codNacion: data.codigoNacionalidad,
      tipDocu: data.tipoDocumento,
      numDocu: data.numeroDocumento,
      nombre: data.nombre,
      apellido: data.apellidos,
      fecNac: '',
      sexo: '',
      estCivil: '',
      tiPax: data.tipoPax,
      direccion: '',
      email: data.email,
      motivo: data.telefono,
      procede: data.procede,
      mdoArribo: '',
      orden: data.orden,
      operador: this.authService.getCurrentUser()?.usuario?.trim() || 'admin'
    };
  }

  private buildSavedGuest(guest: GuestSlot): SelfCheckInGuestSave {
    const value = this.guestForm.getRawValue();
    return {
      slotId: guest.id,
      ...(guest.idRooming ? { existingGuestId: guest.idRooming } : {}),
      orden: guest.orden,
      tipoPax: guest.tipoPax,
      ...value
    };
  }

  private async fetchSavedDocument(guest: GuestSlot, response: RoomingListMutationResponse): Promise<GuestIdentityDocument | null> {
    const idGenerado = Number(response?.data?.idGenerado) || 0;
    if (idGenerado > 0) {
      const byId = await firstValueFrom(this.documentService.getById(idGenerado));
      if (byId) return byId;
    }
    return firstValueFrom(this.documentService.getByRooming(guest.idRooming));
  }

  private loadDocumentForGuest(guest: GuestSlot): void {
    if (!guest.idRooming || guest.document.loadingMetadata || guest.document.metadata || guest.document.localFile) return;
    guest.document.loadingMetadata = true;
    firstValueFrom(this.documentService.getByRooming(guest.idRooming))
      .then((document) => {
        if (document) {
          guest.document.metadata = document;
          guest.document.status = 'stored';
        }
      })
      .catch((error) => {
        console.warn('No se pudo consultar el documento del huésped.', error);
      })
      .finally(() => {
        guest.document.loadingMetadata = false;
        this.cdr.markForCheck();
      });
  }

  private mapExistingGuest(guest: RoomingListGuest, slotId: string, orden: number, tipoPax: 'PAX' | 'CHD'): SelfCheckInGuestSave {
    return {
      slotId,
      existingGuestId     : guest.numInterno,
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

  private createDocumentState(): GuestDocumentState {
    return {
      status: 'empty',
      metadata: null,
      localFile: null,
      localPreviewUrl: '',
      errorMessage: '',
      loadingMetadata: false
    };
  }

  private setLocalDocumentFile(guest: GuestSlot, file: File): void {
    this.revokeGuestPreview(guest);
    guest.document.localFile = file;
    guest.document.localPreviewUrl = URL.createObjectURL(file);
    guest.document.errorMessage = '';
  }

  private revokeGuestPreview(guest: GuestSlot): void {
    if (guest.document.localPreviewUrl) URL.revokeObjectURL(guest.document.localPreviewUrl);
    guest.document.localPreviewUrl = '';
  }

  private refreshGuestTitle(guest: GuestSlot): void {
    const data = guest.data;
    if (!data) return;
    const title = `${data.nombre.trim()} ${data.apellidos.trim()}`.trim();
    if (title) guest.title = title;
  }

  private validateDocumentFile(file: File): string {
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!file.size) return 'The selected image is empty.';
    if (file.size > 10 * 1024 * 1024) return 'The image must be 10 MB or less.';
    if (!allowedTypes.has(file.type)) return 'Use a JPG, PNG or WEBP image.';
    return '';
  }

  private getEmpresa(): string {
    return this.empresaContext.getSnapshot()?.MA04_Unidad?.trim() || '';
  }

  private extractRoomingMutationId(response: unknown): string {
    if (!response) return '';
    if (typeof response === 'string') {
      try {
        return this.extractRoomingMutationId(JSON.parse(response));
      } catch {
        return '';
      }
    }
    if (typeof response !== 'object') return '';
    const data = (response as { data?: { idOpe?: unknown } | null }).data;
    return typeof data?.idOpe === 'string' ? data.idOpe.trim() : '';
  }
}
