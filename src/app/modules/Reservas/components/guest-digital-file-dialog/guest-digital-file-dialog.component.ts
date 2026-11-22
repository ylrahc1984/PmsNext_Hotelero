import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, EventEmitter, Input, OnDestroy, OnInit, Output, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { GuestIdentityDocument } from 'src/app/modules/front-desk/check-in-arrivals/models/check-in-arrival.model';
import { GuestIdentityDocumentService } from 'src/app/modules/front-desk/check-in-arrivals/services/guest-identity-document.service';
import { RoomingListV2Huesped as RoomingGuest } from '../../rooming-list-v2/models/rooming-list-v2.model';
import { RoomingListV2Service } from '../../rooming-list-v2/services/rooming-list-v2.service';
import { GuestDigitalFilePrecheckin, GuestDigitalFileService } from '../../services/guest-digital-file.service';

@Component({
  selector: 'app-guest-digital-file-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './guest-digital-file-dialog.component.html',
  styleUrls: ['./guest-digital-file-dialog.component.scss']
})
export class GuestDigitalFileDialogComponent implements OnInit, OnDestroy {
  private readonly roomingService = inject(RoomingListV2Service);
  private readonly documentService = inject(GuestIdentityDocumentService);
  private readonly digitalFileService = inject(GuestDigitalFileService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private objectUrls: string[] = [];

  @Input({ required: true }) codReserva = '';
  @Input({ required: true }) idDesglose = '';
  @Input() numHabita = '';
  @Output() closed = new EventEmitter<void>();

  readonly loading = signal(true);
  readonly error = signal('');
  readonly guests = signal<DigitalFileGuest[]>([]);
  readonly precheckins = signal<GuestDigitalFilePrecheckin[]>([]);
  readonly pdfBusyId = signal<string | null>(null);
  readonly documentBusyId = signal<number | null>(null);
  readonly pdfError = signal('');
  readonly pdfUrl = signal<SafeResourceUrl | null>(null);
  readonly pdfTitle = signal('');
  readonly previewMimeType = signal('application/pdf');

  ngOnInit(): void {
    const reservation = this.codReserva.trim();
    const breakdown = this.idDesglose.trim();
    if (!reservation || !breakdown) {
      this.error.set('No se puede consultar el expediente porque falta la reserva o el identificador de estancia.');
      this.loading.set(false);
      return;
    }

    forkJoin({
      rooming: this.roomingService.consultar(reservation, breakdown),
      precheckins: this.digitalFileService.getPrecheckins(reservation, breakdown)
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: ({ rooming, precheckins }) => {
        if (!rooming.success) {
          this.error.set(this.apiMessage(rooming.message, 'No se pudo consultar la lista de huéspedes de esta estancia.'));
          return;
        }
        if (!precheckins.success) {
          this.error.set(this.apiMessage(precheckins.message, 'No se pudo consultar el expediente digital de esta estancia.'));
          return;
        }
        const matching = (Array.isArray(precheckins.data) ? precheckins.data : [])
          .filter((item) => String(item.idDesglose).trim() === breakdown)
          .sort((left, right) => this.timestamp(right.fechaCompletado) - this.timestamp(left.fechaCompletado));
        this.precheckins.set(matching);
        this.loadGuests(Array.isArray(rooming.data) ? rooming.data : []);
      },
      error: (error: unknown) => this.error.set(this.httpError(error, 'No se pudo cargar el expediente digital.'))
    });
  }

  ngOnDestroy(): void {
    this.revokeObjectUrls();
  }

  close(): void { this.closed.emit(); }

  guestName(guest: DigitalFileGuest): string {
    return `${guest.nombre ?? ''} ${guest.apellidos ?? ''}`.trim() || 'Huésped sin nombre';
  }

  precheckinState(item: GuestDigitalFilePrecheckin): string {
    return item.estadoPreCheckIn?.trim() || (item.fechaCompletado ? 'Completado' : 'Registrado');
  }

  async openSignedPdf(item: GuestDigitalFilePrecheckin): Promise<void> {
    this.pdfError.set('');
    const key = String(item.idPreCheckIn);
    this.pdfBusyId.set(key);
    this.digitalFileService.getSignedPdf(item.idPreCheckIn).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.pdfBusyId.set(null))
    ).subscribe({
      next: (blob) => {
        if (!blob.size) {
          this.pdfError.set('El servidor devolvió un documento firmado vacío.');
          return;
        }
        this.showPreview(blob, `Consentimiento firmado · ${item.nombreFirmante?.trim() || this.codReserva}`, 'application/pdf');
      },
      error: (error: unknown) => this.pdfError.set(this.httpError(error, 'No se pudo abrir el consentimiento firmado.'))
    });
  }

  viewIdentityDocument(document: GuestIdentityDocument): void {
    if (!document.idDocumento || this.documentBusyId() !== null) return;
    this.pdfError.set('');
    this.documentBusyId.set(document.idDocumento);
    this.documentService.getContent(document.idDocumento).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.documentBusyId.set(null))
    ).subscribe({
      next: (blob) => this.showPreview(blob, document.nombreArchivo || 'Documento de identidad', document.mimeType || blob.type),
      error: (error: unknown) => this.pdfError.set(this.httpError(error, 'No se pudo abrir el documento de identidad.'))
    });
  }

  isDocumentBusy(document: GuestIdentityDocument): boolean { return this.documentBusyId() === document.idDocumento; }

  closePdf(): void {
    this.pdfUrl.set(null);
    this.pdfTitle.set('');
    this.revokeObjectUrls();
  }

  isPdfBusy(item: GuestDigitalFilePrecheckin): boolean { return this.pdfBusyId() === String(item.idPreCheckIn); }

  private loadGuests(roomingGuests: RoomingGuest[]): void {
    const activeGuests = roomingGuests.filter((guest) => guest.estado?.toUpperCase() !== 'INACTIVO');
    if (!activeGuests.length) return;
    const requests = activeGuests.map((guest) => this.documentService.getByRooming(guest.idRooming).pipe(
      catchError(() => of(null))
    ));
    forkJoin(requests).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((documents) => {
      this.guests.set(activeGuests.map((guest, index) => ({
        ...guest,
        identityDocument: documents[index]
      })));
    });
  }

  private showPreview(blob: Blob, title: string, mimeType: string): void {
    if (!blob.size) {
      this.pdfError.set('El servidor devolvió un documento vacío.');
      return;
    }
    this.closePdf();
    const url = URL.createObjectURL(blob);
    this.objectUrls.push(url);
    this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    this.pdfTitle.set(title);
    this.previewMimeType.set(mimeType.toLowerCase());
  }

  private apiMessage(message: string | null | undefined, fallback: string): string {
    const clean = (message ?? '').replace(/^ERROR\s*\|\s*/i, '').trim();
    return clean || fallback;
  }

  private httpError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const payload = error.error;
      if (typeof payload === 'string') {
        try {
          const parsed = JSON.parse(payload) as { message?: string; detail?: string };
          return this.apiMessage(parsed.message ?? parsed.detail, fallback);
        } catch { return this.apiMessage(payload, fallback); }
      }
      if (payload && typeof payload === 'object') {
        const body = payload as { message?: string; detail?: string; title?: string };
        return this.apiMessage(body.message ?? body.detail ?? body.title, fallback);
      }
    }
    return fallback;
  }

  private timestamp(value: string | null | undefined): number {
    const parsed = value ? Date.parse(value) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private revokeObjectUrls(): void {
    this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    this.objectUrls = [];
  }
}

type DigitalFileGuest = RoomingGuest & {
  identityDocument: (GuestIdentityDocument & { previewUrl?: string }) | null;
};
