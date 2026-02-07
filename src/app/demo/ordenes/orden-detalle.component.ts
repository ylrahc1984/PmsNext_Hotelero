import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, Subject, catchError, finalize, map, of, switchMap, takeUntil, tap } from 'rxjs';
import Swal from 'sweetalert2';

import { environment } from 'src/environments/environment';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { OrdenTrabajo, OrdenTrabajoDetalle, OrdenesService, ESTADOS_OT } from './ordenes.service';

@Component({
  selector: 'app-orden-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule, RouterModule],
  templateUrl: './orden-detalle.component.html',
  styleUrls: ['./orden-detalle.component.scss']
})
export class OrdenDetalleComponent implements OnInit, OnDestroy {
  codOT = '';
  orden: OrdenTrabajo | null = null;
  detalles: OrdenTrabajoDetalle[] = [];

  loading = false;
  busyPdf = false;
  errorMsg = '';

  filtro = '';

  private destroy$ = new Subject<void>();
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private ordenesService = inject(OrdenesService);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        switchMap((params) => {
          const cod = (params.get('id') ?? '').toString().trim();
          if (!cod) {
            this.router.navigate(['/operaciones/ordenes-trabajo']);
            return of(null);
          }
          this.codOT = cod;
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
    if (!this.orden?.estado) return 'N/D';
    const estadoOption = ESTADOS_OT.find(e => e.codigo === this.orden.estado);
    return estadoOption?.descripcion ?? this.orden.estado;
  }

  get estadoBadgeClass(): string {
    if (!this.orden?.estado) return 'badge-secondary';
    const estadoOption = ESTADOS_OT.find(e => e.codigo === this.orden.estado);
    return estadoOption?.badge ?? 'badge-secondary';
  }

  get cantidadDetalles(): number {
    return this.detalles.length;
  }

  get totalPax(): number {
    return this.detalles.reduce((sum, d) => sum + (d.pax || 0), 0);
  }

  get totalPagar(): number {
    return this.orden?.totalPagar ?? 0;
  }

  get clienteInfo(): { nombre: string; telefono: string; email: string } | null {
    const primerDetalle = this.detalles[0];
    if (!primerDetalle) return null;
    
    return {
      nombre: primerDetalle.clienteFinal || '',
      telefono: primerDetalle.telefonoCliente || '',
      email: primerDetalle.emailCliente || ''
    };
  }

  get esOrdenAnulada(): boolean {
    if (!this.orden?.estado) return false;
    const estado = this.orden.estado.toUpperCase().trim();
    const estadoDesc = this.estadoLabel.toLowerCase().trim();
    return estado === 'ANU' || estadoDesc.includes('anul');
  }

  get detallesFiltrados(): OrdenTrabajoDetalle[] {
    const q = (this.filtro ?? '').toString().trim().toLowerCase();
    if (!q) return this.detalles;

    return this.detalles.filter((d) => {
      const haystack = [
        d.servicioId,
        d.servicio,
        d.clienteFinal,
        d.telefonoCliente,
        d.emailCliente,
        d.origenOT,
        d.destinoOT,
        d.observaciones
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

  editarOrden(): void {
    if (!this.codOT) return;
    
    // Validar que la orden no esté anulada
    if (this.esOrdenAnulada) {
      Swal.fire({
        title: 'Orden Anulada',
        text: 'No se puede editar una orden de trabajo que ha sido anulada.',
        icon: 'warning'
      });
      return;
    }
    
    this.router.navigate(['/operaciones/ordenes-trabajo', this.codOT, 'editar']);
  }

  volverAlListado(): void {
    this.router.navigate(['/operaciones/ordenes-trabajo']);
  }

  imprimirOrden(): void {
    const cod = (this.codOT ?? '').toString().trim();
    if (!cod || this.busyPdf) return;

    this.busyPdf = true;

    const baseApiUrl = (environment.apiUrl ?? '').toString().replace(/\/+$/, '');
    const url = `${baseApiUrl}/ordentrabajo/${encodeURIComponent(cod)}/reporte-pdf`;

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
            link.download = `Orden_Trabajo_${cod}.pdf`;
            link.rel = 'noopener';

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
          } catch (e) {
            console.error('Error descargando orden PDF', e);
            void Swal.fire({ title: 'Error', text: 'No se pudo descargar la orden en PDF.', icon: 'error' });
          }
        },
        error: (err) => {
          console.error('Error obteniendo orden PDF', err);
          void Swal.fire({ title: 'Error', text: 'No se pudo obtener la orden en PDF.', icon: 'error' });
        }
      });
  }

  getMapsLinkFromCoords(lat?: number, lng?: number): string {
    if (!lat || !lng || lat === 0 || lng === 0) return '';
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  getDetalleMapsLink(detalle: OrdenTrabajoDetalle, tipo: 'origen' | 'destino'): string {
    if (tipo === 'origen') return this.getMapsLinkFromCoords(detalle.origenLat, detalle.origenLng);
    return this.getMapsLinkFromCoords(detalle.destinoLat, detalle.destinoLng);
  }

  async copiarLink(tipo: 'origen' | 'destino', detalle: OrdenTrabajoDetalle): Promise<void> {
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

  private load$(): Observable<void> {
    if (!this.codOT) return of(void 0);

    this.loading = true;
    this.errorMsg = '';

    // Primero intentamos buscar en el servicio local
    const ordenLocal = this.ordenesService.getOrdenByCodOT(this.codOT);
    
    if (ordenLocal) {
      // Si la encontramos localmente, la usamos
      console.log('✅ Orden encontrada en servicio local:', this.codOT);
      return of(void 0).pipe(
        tap(() => {
          this.orden = ordenLocal;
          this.detalles = ordenLocal.detalles || [];
        }),
        finalize(() => {
          this.loading = false;
        })
      );
    }

    // Si no está local, obtenemos la orden completa desde el API
    console.log('🔍 Orden no encontrada localmente, consultando API:', this.codOT);
    return this.ordenesService.getOrdenCompletaPorCodOT(this.codOT).pipe(
      tap(orden => {
        console.log('✅ Orden completa obtenida del API:', orden);
        this.orden = orden;
        this.detalles = orden.detalles || [];
      }),
      map(() => void 0),
      catchError((err) => {
        console.error('❌ Error cargando orden completa:', err);
        this.orden = null;
        this.detalles = [];
        this.errorMsg = 'No se pudo cargar el detalle de la orden de trabajo.';
        return of(void 0);
      }),
      finalize(() => {
        this.loading = false;
      })
    );
  }
}
