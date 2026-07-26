import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription, debounceTime } from 'rxjs';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { Reserva, ReservasService } from '../services/reservas.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-reservas',
  imports: [CommonModule, SharedModule, FormsModule],
  templateUrl: './reservas.component.html',
  styleUrls: ['./reservas.component.scss']
})
export class ReservasComponent implements OnInit, OnDestroy {
  @ViewChild('fechaDesdeNativePicker') private fechaDesdeNativePicker?: ElementRef<HTMLInputElement>;
  @ViewChild('fechaHastaNativePicker') private fechaHastaNativePicker?: ElementRef<HTMLInputElement>;

  private subscription: Subscription = new Subscription();
  private filtrosDebounce$ = new Subject<void>();

  reservas: Reserva[] = [];
  totalReservas = 0;
  pageSizeOptions = [5, 10, 20];
  pageSize = 10;
  currentPage = 1;
  loading = false;
  errorMsg = '';
  private defaultFechaDesdeValue = '';
  private defaultFechaHastaValue = '';

  private reservasService = inject(ReservasService);
  private router = inject(Router);
  private http = inject(HttpClient);

  // --- Filtros y paginación para reservas.component.ts ---
  filtros = {
    fechaDesde: '',
    fechaHasta: '',
    estado: '',
    termino: ''
  };

  agencias: string[] = [];
  formasPago: string[] = ['Prepago', 'Crédito', 'Efectivo', 'Transferencia'];

  filteredReservas: Reserva[] = [];
  pagedReservas: Reserva[] = [];

  ngOnInit(): void {
    this.setDefaultFechas();
    this.subscription.add(
      this.filtrosDebounce$.pipe(debounceTime(350)).subscribe(() => {
        this.currentPage = 1;
        this.loadReservas();
      })
    );
    this.loadReservas();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  applyFilters(): void {
    // Filtros principales (fechas + parÃ¡metro general) se resuelven en backend con /api/reserva/consulta.
    // Debounce para evitar disparar requests en cada pulsaciÃ³n.
    this.ensureValidPaginationState();
    this.filtrosDebounce$.next();
  }

  onFechaInput(field: 'fechaDesde' | 'fechaHasta', rawValue: string): void {
    const sanitized = (rawValue ?? '').toString().replace(/[^\d/]/g, '').slice(0, 10);
    if (sanitized.includes('/')) {
      this.filtros[field] = sanitized;
      return;
    }

    const digits = sanitized.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    this.filtros[field] = formatted;
  }

  onFechaBlur(field: 'fechaDesde' | 'fechaHasta'): void {
    const normalized = this.normalizeDmyDateInput(this.filtros[field]);
    this.filtros[field] = normalized;
    this.applyFilters();
  }

  openNativeDatePicker(field: 'fechaDesde' | 'fechaHasta'): void {
    const inputRef = field === 'fechaDesde' ? this.fechaDesdeNativePicker : this.fechaHastaNativePicker;
    const inputEl = inputRef?.nativeElement;
    if (!inputEl) {
      return;
    }

    const isoValue = this.toIsoDate(this.filtros[field]);
    inputEl.value = isoValue ?? '';

    const pickerAwareInput = inputEl as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerAwareInput.showPicker === 'function') {
      pickerAwareInput.showPicker();
      return;
    }

    inputEl.focus();
    inputEl.click();
  }

  onNativeDateSelected(field: 'fechaDesde' | 'fechaHasta', isoDate: string): void {
    const parsed = this.parseFilterDate(isoDate);
    this.filtros[field] = parsed ? `${parsed.dd}/${parsed.mm}/${parsed.yyyy}` : '';
    this.applyFilters();
  }

  private applyLocalFilters(): void {
    // El endpoint /consulta no contempla estado; lo filtramos localmente sobre la pÃ¡gina ya cargada.
    let filtered = this.reservas;
    if (this.filtros.estado) {
      const filtro = this.normalizeEstado(this.filtros.estado);
      filtered = filtered.filter((r) => this.normalizeEstado(r.PRV01_Estado) === filtro);
    }

    this.filteredReservas = filtered;
    this.pagedReservas = filtered;
  }

  resetFilters(): void {
    this.currentPage = 1;
    this.filtros = {
      fechaDesde: this.defaultFechaDesde(),
      fechaHasta: this.defaultFechaHasta(),
      estado: '',
      termino: ''
    };
    this.loadReservas();
  }

  loadReservas(): void {
    this.ensureValidPaginationState();
    this.loading = true;
    this.errorMsg = '';

    const parametroBusqueda = (this.filtros.termino ?? '').toString().trim();
    const useConsulta = this.shouldUseConsulta();

    const request$ = useConsulta
      ? this.reservasService.consultarReservas({
          fechaInicio: this.toApiDate(this.filtros.fechaDesde),
          fechaFin: this.toApiDate(this.filtros.fechaHasta),
          parametroBusqueda: parametroBusqueda || null,
          pageNumber: this.currentPage,
          pageSize: this.pageSize
        })
      : this.reservasService.getReservas(this.currentPage, this.pageSize);

    request$.subscribe({
      next: (res) => {
        this.reservas = res.data;
        this.totalReservas = res.total;
        this.agencias = Array.from(new Set(this.reservas.map((r) => r.PRV01_CodAgencia).filter(Boolean)));
        this.applyLocalFilters();
        this.loading = false;
        
      },
      error: () => {
        this.errorMsg = 'Error al cargar reservas';
        this.reservas = [];
        this.totalReservas = 0;
        this.filteredReservas = [];
        this.pagedReservas = [];
        this.loading = false;
      }
    });
  }

  changePageSize(size: number | string): void {
    const next = Number(size);
    if (Number.isFinite(next) && this.pageSizeOptions.includes(next)) {
      this.pageSize = next;
    }
    this.currentPage = 1;
    this.loadReservas();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }
    this.currentPage = page;
    this.loadReservas();
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  prevPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalReservas / this.pageSize));
  }

  get pageStart(): number {
    if (!this.totalReservas || this.pagedReservas.length === 0) return 0;
    return this.pageSize * (this.currentPage - 1) + 1;
  }

  get pageEnd(): number {
    if (!this.totalReservas || this.pagedReservas.length === 0) return 0;
    const start = this.pageSize * (this.currentPage - 1);
    return Math.min(start + this.pagedReservas.length, this.totalReservas);
  }

  nuevaReserva(): void {
    this.router.navigate(['/operaciones/reservas/nueva-v2']);
  }

  verReserva(reserva: Reserva): void {
    if (this.isEstadoChk(reserva?.PRV01_Estado)) return;
    this.router.navigate(['/operaciones/reservas', reserva.PRV01_CodReserva, 'editar']);
  }

  verDetalles(reserva: Reserva): void {
    this.router.navigate(['/operaciones/reservas', reserva.PRV01_CodReserva, 'detalle'], {
      queryParams: {
        origen: 'reservas'
      }
    });
  }

  cancelarReserva(reserva: Reserva): void {
    const cod = reserva?.PRV01_CodReserva ?? '';
    const cliente = reserva?.PRV01_NomCliente ?? '';

    void Swal.fire({
      title: 'Cancelar reserva',
      html: `¿Desea cancelar la reserva <strong>#${cod}</strong>${cliente ? ` de <strong>${cliente}</strong>` : ''}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'No, volver',
      confirmButtonColor: '#dc3545'
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.loading = true;
      this.reservasService.eliminarReserva(cod).subscribe({
        next: () => {
          this.loadReservas();
          void Swal.fire({
            title: 'Cancelada',
            text: 'La reserva fue cancelada correctamente.',
            icon: 'success',
            timer: 1800,
            showConfirmButton: false
          });
        },
        error: () => {
          this.errorMsg = 'Error al cancelar reserva';
          this.loading = false;
          void Swal.fire({
            title: 'Error',
            text: 'No se pudo cancelar la reserva.',
            icon: 'error'
          });
        }
      });
    });
  }

  imprimirConfirmacion(codReserva: string): void {
    const cod = (codReserva ?? '').toString().trim();
    if (!cod) {
      void Swal.fire({
        title: 'Imprimir confirmación',
        text: 'Código de reserva inválido.',
        icon: 'warning'
      });
      return;
    }

    const baseApiUrl = (environment.apiUrl || 'http://localhost:5000/api').toString().replace(/\/+$/, '');
    const url = `${baseApiUrl}/reservas-pdf/${encodeURIComponent(cod)}`;

    this.subscription.add(
      this.http.get(url, {
        responseType: 'blob' as const,
        headers: { Accept: 'application/pdf' }
      }).subscribe({
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
            void Swal.fire({
              title: 'Error',
              text: 'No se pudo descargar la confirmación en PDF.',
              icon: 'error'
            });
          }
        },
        error: (err) => {
          console.error('Error obteniendo confirmación PDF', err);
          void Swal.fire({
            title: 'Error',
            text: 'No se pudo obtener la confirmación en PDF.',
            icon: 'error'
          });
        }
      })
    );
  }

  private normalizeEstado(value: string): 'PEN' | 'CON' | 'CAN' | 'UNK' {
    const v = (value || '').toString().trim().toUpperCase();
    if (v === 'PEN' || v === 'PENDIENTE') return 'PEN';
    if (v === 'CON' || v === 'CONFIRMADA' || v === 'CONFIRMADO') return 'CON';
    if (v === 'CAN' || v === 'CANCELADA' || v === 'CANCELADO' || v === 'ANULADA' || v === 'ANULADO') return 'CAN';
    return 'UNK';
  }

  getEstadoLabel(estado: string): string {
    const normalized = this.normalizeEstado(estado);
    if (normalized === 'PEN') return 'Pendiente';
    if (normalized === 'CON') return 'Confirmada';
    if (normalized === 'CAN') return 'Cancelada';
    return (estado || '').toString() || 'Desconocido';
  }

  getEstadoBadge(estado: string): string {
    const normalized = this.normalizeEstado(estado);
    if (normalized === 'PEN') return 'bg-warning text-dark';
    if (normalized === 'CON') return 'bg-success';
    if (normalized === 'CAN') return 'bg-danger';
    return 'bg-secondary';
  }

  getServiciosBadge(cantidad: number): string {
    return cantidad > 1 ? 'bg-primary text-white' : 'bg-light text-dark';
  }

  trackByReservaId(index: number, reserva: Reserva): string {
    return reserva.PRV01_CodReserva;
  }

  getCantidadServicios(reserva: Reserva): number {
    // Si el backend no retorna el detalle, este mÃ©todo puede requerir ajuste
    return  0;
  }

  isEstadoChk(estado: string): boolean {
    return (estado ?? '').toString().trim().toUpperCase() === 'CHK';
  }

  private setDefaultFechas(): void {
    if (!this.defaultFechaDesdeValue) this.defaultFechaDesdeValue = this.defaultFechaDesde();
    if (!this.defaultFechaHastaValue) this.defaultFechaHastaValue = this.defaultFechaHasta();
    if (!this.filtros.fechaDesde) this.filtros.fechaDesde = this.defaultFechaDesdeValue;
    if (!this.filtros.fechaHasta) this.filtros.fechaHasta = this.defaultFechaHastaValue;
  }

  private defaultFechaDesde(): string {
     return this.toDateInput(new Date());
  }

  private defaultFechaHasta(): string {
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return this.toDateInput(lastDayOfMonth);
  }

  private toDateInput(d: Date): string {
    const dd = d.getDate().toString().padStart(2, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const yyyy = d.getFullYear().toString().padStart(4, '0');
    return `${dd}/${mm}/${yyyy}`;
  }

  private toApiDate(dateInput: string): string | null {
    const parsed = this.parseFilterDate(dateInput);
    if (!parsed) return null;
    return `${parsed.mm}/${parsed.dd}/${parsed.yyyy}`;
  }

  private normalizeDmyDateInput(value: string): string {
    const parsed = this.parseFilterDate(value);
    if (!parsed) return '';
    return `${parsed.dd}/${parsed.mm}/${parsed.yyyy}`;
  }

  private toIsoDate(value: string): string | null {
    const parsed = this.parseFilterDate(value);
    if (!parsed) return null;
    return `${parsed.yyyy}-${parsed.mm}-${parsed.dd}`;
  }

  private parseFilterDate(value: string): { dd: string; mm: string; yyyy: string } | null {
    const v = (value ?? '').toString().trim();
    if (!v) return null;

    const dmyMatch = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmyMatch) {
      const [, dd, mm, yyyy] = dmyMatch;
      return this.isValidDateParts(dd, mm, yyyy) ? { dd, mm, yyyy } : null;
    }

    const ymdMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymdMatch) {
      const [, yyyy, mm, dd] = ymdMatch;
      return this.isValidDateParts(dd, mm, yyyy) ? { dd, mm, yyyy } : null;
    }

    return null;
  }

  private isValidDateParts(dd: string, mm: string, yyyy: string): boolean {
    const day = Number(dd);
    const month = Number(mm);
    const year = Number(yyyy);
    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false;
    if (year < 1900 || year > 2100) return false;
    if (month < 1 || month > 12) return false;

    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  private shouldUseConsulta(): boolean {
    const termino = (this.filtros.termino ?? '').toString().trim();
    const fechaDesde = (this.filtros.fechaDesde ?? '').toString().trim();
    const fechaHasta = (this.filtros.fechaHasta ?? '').toString().trim();
    const fechasDefault = fechaDesde === this.defaultFechaDesdeValue && fechaHasta === this.defaultFechaHastaValue;
    const hasFechaFilter = (!!fechaDesde || !!fechaHasta) && !fechasDefault;
    return !!termino || hasFechaFilter;
  }

  private ensureValidPaginationState(): void {
    if (!this.pageSizeOptions.includes(this.pageSize)) {
      this.pageSize = this.pageSizeOptions[0];
    }

    if (!Number.isFinite(this.currentPage) || this.currentPage < 1) {
      this.currentPage = 1;
    }
  }
}
