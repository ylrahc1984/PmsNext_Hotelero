import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { normalizePmsDateDDMMYYYY, toPmsDateInputValue } from 'src/app/core/utils/pms-date.util';
import { AuthService } from 'src/app/core/services/auth.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { FolioMaster, FolioMasterStatus } from './models/folio-master.model';
import { FolioMasterCheckoutPayload, FolioMasterService } from './services/folio-master.service';
import { FolioMasterChargeHeader } from './models/folio-master-charge.model';
import { FolioMasterChargeService } from './services/folio-master-charge.service';
import { FolioMasterChargesModalComponent } from './components/folio-master-charges-modal/folio-master-charges-modal.component';
import { FolioChargeChangedEvent, FolioChargeDetailModalComponent } from './components/folio-charge-detail-modal/folio-charge-detail-modal.component';
import { FolioMasterInvoiceModalComponent } from './components/folio-master-invoice-modal/folio-master-invoice-modal.component';

interface FolioKpi {
  label: string;
  value: number;
  helper: string;
  icon: string;
  accent: 'primary' | 'neutral' | 'success' | 'warning';
}

@Component({
  selector: 'app-folio-master',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule, FolioMasterChargesModalComponent, FolioChargeDetailModalComponent, FolioMasterInvoiceModalComponent],
  templateUrl: './folio-master.component.html',
  styleUrls: ['./folio-master.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FolioMasterComponent implements OnInit {
  private readonly folioService = inject(FolioMasterService);
  private readonly chargeService = inject(FolioMasterChargeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly pageSizeOptions = [10, 20, 50, 100];
  readonly statuses: FolioMasterStatus[] = [
    { value: 0, label: 'Creado', helper: 'Reserva creada' },
    { value: 1, label: 'In House', helper: 'Check-in realizado' },
    { value: 2, label: 'Check-out', helper: 'Salida realizada' }
  ];

  fechaIngreso = this.getCurrentMonthRange().start;
  fechaSalida = this.getCurrentMonthRange().end;
  searchTerm = '';
  pageSize = 10;
  currentPage = 1;
  folios: FolioMaster[] = [];
  selectedFolio: FolioMaster | null = null;
  folioCharges: FolioMasterChargeHeader[] = [];
  selectedCharge: FolioMasterChargeHeader | null = null;
  selectedInvoiceFolio: FolioMaster | null = null;
  invoiceCharges: FolioMasterChargeHeader[] = [];
  invoiceLoadingFolioNumber = '';
  checkoutLoadingFolioNumber = '';
  isLoading = false;
  isDetailLoading = false;
  errorMessage = '';
  detailErrorMessage = '';
  dateRangeError = '';

  ngOnInit(): void {
    this.loadFolios();
  }

  get filteredFolios(): FolioMaster[] {
    const term = this.normalizeSearch(this.searchTerm);
    if (!term) {
      return this.folios;
    }

    return this.folios.filter((folio) =>
      [
        folio.PRV09_NumFolio,
        folio.PRV09_CodReserva,
        folio.PRV09_CodAgen,
        folio.PRV09_DesAgen,
        folio.PRV01_Descripcion,
        folio.PRV09_CodTarifa,
        folio.PRV09_CodPlan,
        this.getStatus(folio.PRV09_Estado).label
      ].some((value) => this.normalizeSearch(value).includes(term))
    );
  }

  get pagedFolios(): FolioMaster[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredFolios.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredFolios.length / this.pageSize));
  }

  get paginationLabel(): string {
    const total = this.filteredFolios.length;
    if (!total) {
      return 'Sin registros';
    }

    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, total);
    return `${start}-${end} de ${total}`;
  }

  get kpis(): FolioKpi[] {
    return [
      { label: 'Folios pendientes', value: this.folios.length, helper: 'Resultado del período', icon: 'layers', accent: 'primary' },
      { label: 'Creados', value: this.countByStatus(0), helper: 'Reservas sin check-in', icon: 'file-text', accent: 'neutral' },
      { label: 'In House', value: this.countByStatus(1), helper: 'Huéspedes alojados', icon: 'log-in', accent: 'success' },
      { label: 'Check-out', value: this.countByStatus(2), helper: 'Listos para facturar', icon: 'log-out', accent: 'warning' }
    ];
  }

  loadFolios(): void {
    if (!this.validateDateRange()) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.currentPage = 1;
    this.selectedFolio = null;

    this.folioService
      .getPendingFolios(this.fechaIngreso, this.fechaSalida)
      .pipe(
        catchError((error) => {
          console.error('No se pudieron cargar los Folios Master.', error);
          this.errorMessage = 'No se pudieron consultar los Folios Master para el período seleccionado.';
          return of([] as FolioMaster[]);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((folios) => {
        this.folios = folios;
        this.cdr.markForCheck();
      });
  }

  onSearchChange(): void {
    this.currentPage = 1;
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
  }

  goToPage(page: number): void {
    this.currentPage = Math.min(Math.max(page, 1), this.totalPages);
  }

  openDetail(folio: FolioMaster): void {
    this.selectedFolio = folio;
    this.folioCharges = [];
    this.selectedCharge = null;
    this.detailErrorMessage = '';

    const codReserva = (folio.PRV09_CodReserva || folio.PRV01_CodReserva || '').trim();
    const numFolio = (folio.PRV09_NumFolio || folio.PRV01_Folio || '').trim();

    if (!codReserva || !numFolio) {
      this.detailErrorMessage = 'El registro no contiene una reserva y un folio validos para consultar sus cargos.';
      return;
    }

    this.isDetailLoading = true;

    this.chargeService
      .getHeaders(codReserva, numFolio)
      .pipe(
        catchError((error) => {
          console.error('No se pudieron consultar los encabezados del Folio Master.', error);
          this.detailErrorMessage = 'No se pudieron consultar los cargos asociados a la reserva y el folio.';
          return of([] as FolioMasterChargeHeader[]);
        }),
        finalize(() => {
          this.isDetailLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((charges) => {
        if (this.getFolioNumber(this.selectedFolio) !== numFolio) {
          return;
        }
        this.folioCharges = charges;
        this.cdr.markForCheck();
      });
  }

  openCommercialReceipt(folio: FolioMaster): void {
    const codReserva = (folio.PRV09_CodReserva || folio.PRV01_CodReserva || '').trim();
    const numFolio = (folio.PRV09_NumFolio || folio.PRV01_Folio || '').trim();
    const codAgencia = (folio.PRV09_CodAgen || folio.PRV01_CodAgencia || '').trim();
    const nomCliente = (folio.PRV09_DesAgen || '').trim();
    const moneda = (folio.PRV09_MonedaTar || folio.PRV01_Moneda || '').trim();
    const listaPrecio = (folio.PRV09_CodTarifa || folio.PRV01_CodTarifa || '').trim();
    const planTarifario = (folio.PRV09_CodPlan || folio.PRV01_CodPlan || '').trim();

    if (!codReserva || !numFolio) {
      void Swal.fire({
        title: 'Información incompleta',
        text: 'El registro no contiene una reserva y un folio válidos para preparar el Recibo Comercial.',
        icon: 'warning',
        customClass: { container: 'next-confirm-container' }
      });
      return;
    }

    void this.router.navigate(['/demo/ordenes-pedido/nuevo'], {
      queryParams: {
        codReserva,
        numFolio,
        ...(codAgencia ? { codAgencia } : {}),
        ...(nomCliente ? { nomCliente } : {}),
        ...(moneda ? { moneda } : {}),
        ...(listaPrecio ? { listaPrecio } : {}),
        ...(planTarifario ? { planTarifario } : {}),
        origen: 'folio-master'
      }
    });
  }

  closeDetail(): void {
    this.selectedFolio = null;
    this.folioCharges = [];
    this.selectedCharge = null;
    this.detailErrorMessage = '';
    this.isDetailLoading = false;
  }

  openChargeDetail(charge: FolioMasterChargeHeader): void {
    this.selectedCharge = charge;
  }

  closeChargeDetail(): void {
    this.selectedCharge = null;
    this.refreshSelectedFolioCharges();
  }

  onChargeChanged(change: FolioChargeChangedEvent): void {
    this.applyChargeChangeToView(change);
    this.selectedCharge = null;
    this.refreshSelectedFolioCharges();
    this.refreshFolioSearchInBackground(change);
  }

  private refreshSelectedFolioCharges(): void {
    const folio = this.selectedFolio;
    if (folio) {
      this.openDetail(folio);
    }
  }

  private applyChargeChangeToView(change: FolioChargeChangedEvent): void {
    this.folioCharges = this.folioCharges.map((charge) =>
      charge.tipCrgHab === change.tipCrgHab && charge.numCrgHab === change.numCrgHab
        ? { ...charge, mtoTot: change.mtoTotal }
        : charge
    );

    if (change.basePrice === null || !this.selectedFolio) {
      return;
    }

    const selectedFolioNumber = this.getFolioNumber(this.selectedFolio);
    const updateTariff = (folio: FolioMaster): FolioMaster =>
      this.getFolioNumber(folio) === selectedFolioNumber
        ? { ...folio, PRV09_TarxNoc: change.basePrice as number }
        : folio;

    this.folios = this.folios.map(updateTariff);
    this.selectedFolio = updateTariff(this.selectedFolio);
    this.cdr.markForCheck();
  }

  private refreshFolioSearchInBackground(change: FolioChargeChangedEvent): void {
    if (!this.validateDateRange()) {
      return;
    }

    const selectedFolioNumber = this.getFolioNumber(this.selectedFolio);
    this.folioService
      .getPendingFolios(this.fechaIngreso, this.fechaSalida)
      .pipe(
        catchError((error) => {
          console.error('No se pudo refrescar el listado de Folios Master después de actualizar el cargo.', error);
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((folios) => {
        if (!folios) {
          return;
        }

        this.folios = folios.map((folio) =>
          change.basePrice !== null && this.getFolioNumber(folio) === selectedFolioNumber
            ? { ...folio, PRV09_TarxNoc: change.basePrice as number }
            : folio
        );
        this.selectedFolio = this.folios.find((folio) => this.getFolioNumber(folio) === selectedFolioNumber) ?? this.selectedFolio;
        this.cdr.markForCheck();
      });
  }

  invoiceFolio(folio: FolioMaster): void {
    const codReserva = (folio.PRV09_CodReserva || folio.PRV01_CodReserva || '').trim();
    const numFolio = (folio.PRV09_NumFolio || folio.PRV01_Folio || '').trim();

    if (!codReserva || !numFolio) {
      void Swal.fire({
        title: 'Información incompleta',
        text: 'El registro no contiene una reserva y un folio válidos para consultar sus cargos.',
        icon: 'warning',
        customClass: { container: 'next-confirm-container' }
      });
      return;
    }

    this.closeDetail();
    this.closeInvoice();
    this.invoiceLoadingFolioNumber = numFolio;
    let requestFailed = false;

    this.chargeService.getHeaders(codReserva, numFolio).pipe(
      catchError((error) => {
        requestFailed = true;
        console.error('No se pudieron consultar los cargos para facturar el Folio Master.', error);
        void Swal.fire({
          title: 'No fue posible preparar la factura',
          text: 'No se pudieron consultar los cargos asociados a la reserva y el folio.',
          icon: 'error',
          customClass: { container: 'next-confirm-container' }
        });
        return of([] as FolioMasterChargeHeader[]);
      }),
      finalize(() => {
        this.invoiceLoadingFolioNumber = '';
        this.cdr.markForCheck();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((charges) => {
      if (requestFailed) {
        return;
      }

      if (!charges.length) {
        void Swal.fire({
          title: 'Folio sin cargos',
          text: `El folio ${numFolio} no tiene cargos de habitación disponibles para facturar.`,
          icon: 'info',
          customClass: { container: 'next-confirm-container' }
        });
        return;
      }

      this.invoiceCharges = charges;
      this.selectedInvoiceFolio = folio;
      this.cdr.markForCheck();
    });
  }

  closeInvoice(): void {
    this.selectedInvoiceFolio = null;
    this.invoiceCharges = [];
  }

  onInvoiceCompleted(): void {
    this.closeInvoice();
    this.loadFolios();
  }

  async checkoutFolio(folio: FolioMaster): Promise<void> {
    if (this.checkoutLoadingFolioNumber) {
      return;
    }

    const codReserva = (folio.PRV09_CodReserva || folio.PRV01_CodReserva || '').trim();
    const numFolio = this.getFolioNumber(folio);
    const currentUser = this.authService.getCurrentUser();
    const operador = (currentUser?.usuario || currentUser?.nombre || folio.PRV09_Operador || folio.PRV01_Operador || '').toString().trim();

    if (!codReserva || !numFolio) {
      await Swal.fire({
        title: 'Información incompleta',
        text: 'La reserva o el Folio Master no están disponibles para procesar el Check Out.',
        icon: 'warning',
        customClass: { container: 'next-confirm-container' }
      });
      return;
    }

    if (!operador) {
      await Swal.fire({
        title: 'Operador no identificado',
        text: 'No se pudo identificar el operador autenticado.',
        icon: 'warning',
        customClass: { container: 'next-confirm-container' }
      });
      return;
    }

    this.checkoutLoadingFolioNumber = numFolio;
    this.cdr.markForCheck();

    try {
      const charges = await firstValueFrom(
        this.chargeService.getHeaders(codReserva, numFolio).pipe(takeUntilDestroyed(this.destroyRef))
      );
      const pendingTotal = charges.reduce((sum, charge) => sum + Number(charge.mtoTot || 0), 0);
      const confirmation = await Swal.fire({
        title: pendingTotal > 0 ? 'Cargos del Folio Master pendientes' : 'Confirmar Check Out',
        html: pendingTotal > 0
          ? `El folio mantiene cargos por <strong>${this.formatCurrency(pendingTotal)}</strong>. Estos cargos no bloquean el Check Out. ¿Desea continuar?`
          : `¿Desea procesar el Check Out del Folio Master <strong>${this.escapeHtml(numFolio)}</strong>?`,
        icon: pendingTotal > 0 ? 'warning' : 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, procesar Check Out',
        cancelButtonText: 'Volver',
        confirmButtonColor: '#dc3545',
        reverseButtons: true,
        customClass: { container: 'next-confirm-container' }
      });

      if (!confirmation.isConfirmed) {
        return;
      }

      const payload: FolioMasterCheckoutPayload = {
        proceso: 3,
        fecCheckout: normalizePmsDateDDMMYYYY(new Date()),
        codReserva,
        numHabitacion: numFolio,
        folio: 'S',
        operador
      };

      console.log('[FolioMaster] POST /checkout/folio payload', payload);
      const response = await firstValueFrom(
        this.folioService.checkoutFolio(payload).pipe(takeUntilDestroyed(this.destroyRef))
      );

      this.closeDetail();
      await Swal.fire({
        title: 'Check Out completado',
        text: response?.mensaje || response?.message || 'Checkout del Folio Master realizado exitosamente.',
        icon: 'success',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#198754',
        customClass: { container: 'next-confirm-container' }
      });
      this.loadFolios();
    } catch (error: any) {
      console.error('No se pudo procesar el Check Out del Folio Master.', error);
      const apiMessage = error?.error?.mensaje || error?.error?.message || error?.message;
      await Swal.fire({
        title: 'No se pudo realizar el Check Out',
        text: apiMessage || 'Revise la conexión con el API e inténtelo nuevamente.',
        icon: 'error',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#dc3545',
        customClass: { container: 'next-confirm-container' }
      });
    } finally {
      this.checkoutLoadingFolioNumber = '';
      this.cdr.markForCheck();
    }
  }

  getStatus(value: number | string): FolioMasterStatus {
    const status = this.statuses.find((item) => item.value === Number(value));
    return status ?? { value: Number(value), label: 'Desconocido', helper: 'Estado no identificado' };
  }

  getStatusClass(value: number | string): string {
    const status = Number(value);
    return status === 0 ? 'status-created' : status === 1 ? 'status-in-house' : status === 2 ? 'status-checkout' : 'status-unknown';
  }

  formatDate(value: string): string {
    return normalizePmsDateDDMMYYYY(value) || 'N/D';
  }

  formatCurrency(amount: number): string {
    return Number(amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  trackByFolio(_: number, folio: FolioMaster): string {
    return folio.PRV09_NumFolio;
  }

  trackByKpi(_: number, kpi: FolioKpi): string {
    return kpi.label;
  }

  private countByStatus(status: number): number {
    return this.folios.filter((folio) => Number(folio.PRV09_Estado) === status).length;
  }

  private validateDateRange(): boolean {
    this.dateRangeError = '';

    if (!this.fechaIngreso || !this.fechaSalida) {
      this.dateRangeError = 'Seleccione ambas fechas para realizar la consulta.';
      return false;
    }

    if (this.fechaIngreso > this.fechaSalida) {
      this.dateRangeError = 'La fecha de ingreso no puede ser posterior a la fecha de salida.';
      return false;
    }

    return true;
  }

  private getCurrentMonthRange(): { start: string; end: string } {
    const today = new Date();
    return {
      start: toPmsDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)),
      end: toPmsDateInputValue(new Date(today.getFullYear(), today.getMonth() + 1, 0))
    };
  }

  private normalizeSearch(value: unknown): string {
    return (value ?? '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private escapeHtml(value: unknown): string {
    return (value ?? '').toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private getFolioNumber(folio: FolioMaster | null): string {
    return (folio?.PRV09_NumFolio || folio?.PRV01_Folio || '').trim();
  }
}
