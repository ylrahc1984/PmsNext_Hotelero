import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, Subject, catchError, finalize, map, of, switchMap, takeUntil, tap } from 'rxjs';
import Swal from 'sweetalert2';

import { environment } from 'src/environments/environment';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ReservaDetalle, ReservaDetalleService } from '../services/reserva-detalle.service';
import { Reserva, ReservasService } from '../services/reservas.service';
import { extractGoogleDisplayText, hasCoordinates, normalizeReservaEstado } from '../create/reserva-create.utils';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';

@Component({
  selector: 'app-reserva-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule, RouterModule],
  templateUrl: './reserva-detalle.component.html',
  styleUrls: ['./reserva-detalle.component.scss']
})
export class ReservaDetalleComponent implements OnInit, OnDestroy {
  codReserva = '';
  reserva: Reserva | null = null;
  detalles: ReservaDetalle[] = [];

  loading = false;
  busyConfirm = false;
  busyCancel = false;
  busyPdf = false;
  errorMsg = '';

  filtro = '';

  private destroy$ = new Subject<void>();
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private reservasService = inject(ReservasService);
  private detalleService = inject(ReservaDetalleService);
  private empresaContext = inject(EmpresaContextService);

  readonly empresa = this.empresaContext.empresa;

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        switchMap((params) => {
          const cod = (params.get('id') ?? '').toString().trim();
          if (!cod) {
            this.router.navigate(['/operaciones/reservas']);
            return of(null);
          }
          this.codReserva = cod;
          return this.load$();
        })
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get estadoLabel(): string {
    const estado = normalizeReservaEstado(this.reserva?.PRV01_Estado ?? '');
    switch (estado) {
      case 'CON':
        return 'CONFIRMADA';
      case 'CAN':
        return 'ANULADA';
      default:
        return 'PENDIENTE';
    }
  }

  get estadoBadgeClass(): string {
    const estado = normalizeReservaEstado(this.reserva?.PRV01_Estado ?? '');
    switch (estado) {
      case 'CON':
        return 'bg-success';
      case 'CAN':
        return 'bg-danger';
      default:
        return 'bg-warning';
    }
  }

  get cantidadServicios(): number {
    return this.detalles.length;
  }

  get totalNeto(): number {
    return this.detalles.reduce((sum, d) => sum + (d.PRV02_MontoServicio || 0), 0);
  }

  get totalRack(): number {
    return this.detalles.reduce(
      (sum, d) => sum + ((d.PRV02_PrecioAdulto || 0) + (d.PRV02_PrecioNino || 0) + (d.PRV02_PrecioPaxExtra || 0)),
      0
    );
  }

  get totalPax(): number {
    return this.detalles.reduce((sum, d) => sum + (d.PRV02_TotalPax || 0), 0);
  }

  get detallesFiltrados(): ReservaDetalle[] {
    const q = (this.filtro ?? '').toString().trim().toLowerCase();
    if (!q) return this.detalles;

    return this.detalles.filter((d) => {
      const haystack = [
        d.PRV02_CodServicio,
        d.PRV02_NomServicio,
        d.PRV02_OrigenTexto,
        d.PRV02_DestinoTexto,
        d.PRV02_ZonaOrigen,
        d.PRV02_ZonaDestino,
        d.PRV02_Observacion
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  reload(): void {
    this.load$().subscribe();
  }

  private load$(): Observable<void> {
    if (!this.codReserva) return of(void 0);

    this.loading = true;
    this.errorMsg = '';

    return this.reservasService.getReservaByCod(this.codReserva).pipe(
      tap((reserva) => {
        this.reserva = reserva;
      }),
      switchMap(() =>
        this.detalleService.getDetalle(this.codReserva).pipe(
          catchError(() => {
            this.detalles = [];
            return of([] as ReservaDetalle[]);
          })
        )
      ),
      tap((detalles) => {
        this.detalles = detalles;
      }),
      map(() => void 0),
      catchError((err) => {
        console.error('Error cargando detalle de reserva', err);
        this.reserva = null;
        this.detalles = [];
        this.errorMsg = 'No se pudo cargar el detalle de la reserva.';
        return of(void 0);
      }),
      finalize(() => {
        this.loading = false;
      })
    );
  }

  editarReserva(): void {
    if (!this.codReserva) return;
    this.router.navigate(['/operaciones/reservas', this.codReserva, 'editar']);
  }

  async confirmarReserva(): Promise<void> {
    if (this.busyConfirm || !this.codReserva) return;
    if (normalizeReservaEstado(this.reserva?.PRV01_Estado ?? '') !== 'PEN') return;

    const result = await Swal.fire({
      title: 'Confirmar reserva',
      html: `¿Desea confirmar la reserva <strong>#${this.codReserva}</strong>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'No, volver',
      confirmButtonColor: '#198754'
    });

    if (!result.isConfirmed) return;

    this.busyConfirm = true;
    this.reservasService
      .confirmarReserva(this.codReserva)
      .pipe(
        finalize(() => {
          this.busyConfirm = false;
        })
      )
      .subscribe({
        next: () => {
          void Swal.fire({ title: 'Confirmada', text: 'La reserva fue confirmada.', icon: 'success', timer: 1600, showConfirmButton: false });
          this.reload();
        },
        error: (err) => {
          console.error('Error confirmando reserva', err);
          void Swal.fire({ title: 'Error', text: 'No se pudo confirmar la reserva.', icon: 'error' });
        }
      });
  }

  async cancelarReserva(): Promise<void> {
    if (this.busyCancel || !this.codReserva) return;
    if (normalizeReservaEstado(this.reserva?.PRV01_Estado ?? '') === 'CAN') return;

    const cliente = (this.reserva?.PRV01_NomCliente ?? '').toString().trim();
    const result = await Swal.fire({
      title: 'Cancelar reserva',
      html: `¿Desea cancelar la reserva <strong>#${this.codReserva}</strong>${cliente ? ` de <strong>${cliente}</strong>` : ''}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'No, volver',
      confirmButtonColor: '#dc3545'
    });

    if (!result.isConfirmed) return;

    this.busyCancel = true;
    this.reservasService
      .eliminarReserva(this.codReserva)
      .pipe(
        finalize(() => {
          this.busyCancel = false;
        })
      )
      .subscribe({
        next: () => {
          void Swal.fire({ title: 'Cancelada', text: 'La reserva fue cancelada correctamente.', icon: 'success', timer: 1600, showConfirmButton: false });
          this.router.navigate(['/operaciones/reservas']);
        },
        error: (err) => {
          console.error('Error cancelando reserva', err);
          void Swal.fire({ title: 'Error', text: 'No se pudo cancelar la reserva.', icon: 'error' });
        }
      });
  }

  imprimirConfirmacion(): void {
    const cod = (this.codReserva ?? '').toString().trim();
    if (!cod || this.busyPdf) return;

    this.busyPdf = true;

    const baseApiUrl = (environment.apiUrl ?? '').toString().replace(/\/+$/, '');
    const url = `${baseApiUrl}/reservas/${encodeURIComponent(cod)}/confirmacion-pdf`;

    this.http
      .get(url, { responseType: 'blob' as const })
      .pipe(
        finalize(() => {
          this.busyPdf = false;
        })
      )
      .subscribe({
        next: (data) => {
          try {
            const pdfBlob = new Blob([data], { type: 'application/pdf' });
            const objectUrl = URL.createObjectURL(pdfBlob);

            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = `Confirmacion_Reserva_${cod}.pdf`;
            link.rel = 'noopener';

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
          } catch (e) {
            console.error('Error descargando confirmación PDF', e);
            void Swal.fire({ title: 'Error', text: 'No se pudo descargar la confirmación en PDF.', icon: 'error' });
          }
        },
        error: (err) => {
          console.error('Error obteniendo confirmación PDF', err);
          void Swal.fire({ title: 'Error', text: 'No se pudo obtener la confirmación en PDF.', icon: 'error' });
        }
      });
  }

  getMapsLinkFromCoords(lat?: number, lng?: number): string {
    if (!hasCoordinates(lat, lng)) return '';
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  getDetalleMapsLink(detalle: ReservaDetalle, tipo: 'origen' | 'destino'): string {
    if (tipo === 'origen') return this.getMapsLinkFromCoords(detalle.PRV02_OrigenLat, detalle.PRV02_OrigenLng);
    return this.getMapsLinkFromCoords(detalle.PRV02_DestinoLat, detalle.PRV02_DestinoLng);
  }

  getGoogleDisplayText(value: unknown): string {
    return extractGoogleDisplayText(value);
  }

  async copiarLink(tipo: 'origen' | 'destino', detalle: ReservaDetalle): Promise<void> {
    const link = this.getDetalleMapsLink(detalle, tipo);
    if (!link) {
      void Swal.fire({ title: 'Sin coordenadas', text: 'No hay coordenadas guardadas para copiar el enlace.', icon: 'info' });
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = link;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      void Swal.fire({ title: 'Copiado', text: 'Enlace copiado al portapapeles.', icon: 'success', timer: 1000, showConfirmButton: false });
    } catch (err) {
      console.error('Error copiando enlace', err);
      void Swal.fire({ title: 'Error', text: 'No se pudo copiar el enlace.', icon: 'error' });
    }
  }
}
