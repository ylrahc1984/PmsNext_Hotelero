import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { RoomChargeMutationService } from '../../../../shared/room-charges/room-charge-mutation.service';
import { RoomChargePayload } from '../../../../shared/room-charges/room-charge-mutation.model';
import { RoomChargePointOfSaleApi, RoomChargePriceListApiItem, RoomStayManagementService } from '../../../room-stay-management/services/room-stay-management.service';
import { FolioMasterChargeHeader } from '../../models/folio-master-charge.model';
import { FolioMaster, FolioMasterStatus } from '../../models/folio-master.model';

@Component({
  selector: 'app-folio-master-charges-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  @Output() chargeCreated = new EventEmitter<void>();

  private readonly roomService = inject(RoomStayManagementService);
  private readonly mutationService = inject(RoomChargeMutationService);
  private readonly operationalDateService = inject(OperationalDateService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  addingCharge = false;
  loadingCatalog = false;
  loadingItems = false;
  submittingCharge = false;
  pointOfSales: Array<{ code: string; name: string; priceList: string; currency: string }> = [];
  chargeItems: RoomChargePriceListApiItem[] = [];
  chargeLines: Array<{ item: RoomChargePriceListApiItem; quantity: number; price: number; priceDraft: string }> = [];
  selectedPointOfSale = '';
  itemSearch = '';
  categoryFilter = '';
  catalogPage = 1;
  chargeError = '';
  private operationalDate = '';
  private readonly catalogPageSize = 8;

  private readonly statuses: FolioMasterStatus[] = [
    { value: 0, label: 'Creado', helper: 'Reserva creada' },
    { value: 1, label: 'In House', helper: 'Check-in realizado' },
    { value: 2, label: 'Check-out', helper: 'Salida realizada' }
  ];

  get total(): number {
    return this.charges.reduce((sum, charge) => sum + Number(charge.mtoTot ?? 0), 0);
  }

  get selectedPos(): { code: string; name: string; priceList: string; currency: string } | undefined {
    return this.pointOfSales.find((pos) => pos.code === this.selectedPointOfSale);
  }

  get filteredChargeItems(): RoomChargePriceListApiItem[] {
    const term = this.itemSearch.trim().toLocaleLowerCase();
    return this.chargeItems.filter((item) => {
      const category = this.itemCategory(item);
      const matchesCategory = !this.categoryFilter || category === this.categoryFilter;
      const matchesSearch = !term || [item.MPV05_CodProducto, item.MPV05_DesProducto, item.MPV05_NomCorto, item.MPV00_NomCategoria, item.MPV01_CodGrupo]
        .some((value) => String(value ?? '').toLocaleLowerCase().includes(term));
      return matchesCategory && matchesSearch;
    });
  }

  get chargeCategories(): string[] {
    return Array.from(new Set(this.chargeItems.map((item) => this.itemCategory(item)).filter(Boolean)))
      .sort((left, right) => left.localeCompare(right, 'es'));
  }

  get catalogTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredChargeItems.length / this.catalogPageSize));
  }

  get paginatedChargeItems(): RoomChargePriceListApiItem[] {
    const page = Math.min(Math.max(this.catalogPage, 1), this.catalogTotalPages);
    const start = (page - 1) * this.catalogPageSize;
    return this.filteredChargeItems.slice(start, start + this.catalogPageSize);
  }

  get totalLineCount(): number {
    return this.chargeLines.reduce((sum, line) => sum + line.quantity, 0);
  }

  get chargeDateLabel(): string {
    const date = this.operationalDateService.operationalDate() || this.operationalDate;
    return normalizePmsDateDDMMYYYY(date) || 'Se asigna al registrar';
  }

  get chargeTotal(): number {
    return this.round(this.chargeLines.reduce((sum, line) => sum + line.quantity * line.price, 0));
  }

  private itemCategory(item: RoomChargePriceListApiItem): string {
    return String(item.MPV00_NomCategoria || item.MPV01_CodCategoria || '').trim();
  }

  setCategoryFilter(category: string): void {
    this.categoryFilter = category;
    this.catalogPage = 1;
  }

  setCatalogPage(page: number): void {
    this.catalogPage = Math.min(Math.max(Math.trunc(Number(page) || 1), 1), this.catalogTotalPages);
  }

  onSearchChange(term: string): void {
    this.itemSearch = term;
    this.catalogPage = 1;
  }

  clearCart(): void {
    this.chargeLines = [];
    this.chargeError = '';
  }

  openNewCharge(): void {
    this.addingCharge = true;
    this.chargeError = '';
    this.chargeLines = [];
    this.itemSearch = '';
    this.categoryFilter = '';
    this.catalogPage = 1;
    if (this.pointOfSales.length) return;
    this.loadingCatalog = true;
    this.roomService.getRoomChargePointOfSales('PF').pipe(
      catchError((error) => {
        console.error('No se pudieron cargar los puntos de venta para Folio Master.', error);
        this.chargeError = 'No se pudieron cargar los puntos de venta.';
        return of([] as RoomChargePointOfSaleApi[]);
      }),
      finalize(() => { this.loadingCatalog = false; this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((items) => {
      this.pointOfSales = items.map((item) => ({
        code: String(item.MPV10_CodPntVenta || item.MPV07_CodPntVenta || '').trim(),
        name: String(item.MPV07_NomPntVenta || item.MPV10_CodPntVenta || item.MPV07_CodPntVenta || '').trim(),
        priceList: String(item.MPV04_CodLstPrecio || item.MPV10_CodLstPrecio || item.MPV07_CodLstPrecio || '').trim(),
        currency: String(item.MPV04_Moneda || 'USD').trim().toUpperCase()
      })).filter((item) => item.code);
      this.selectedPointOfSale = this.pointOfSales[0]?.code ?? '';
      this.loadChargeItems();
      if (!this.pointOfSales.length) this.chargeError = 'No hay puntos de venta asignados para este operador.';
      this.cdr.markForCheck();
    });
  }

  closeNewCharge(): void {
    if (this.submittingCharge) return;
    this.addingCharge = false;
    this.chargeError = '';
  }

  onPointOfSaleChange(): void {
    this.chargeLines = [];
    this.itemSearch = '';
    this.categoryFilter = '';
    this.catalogPage = 1;
    this.loadChargeItems();
  }

  addChargeItem(item: RoomChargePriceListApiItem): void {
    this.chargeError = '';
    const existing = this.chargeLines.find((line) => line.item.MPV05_CodProducto === item.MPV05_CodProducto);
    if (existing) existing.quantity++;
    else {
      const price = Number(item.MPV05_PrecioTotal || 0);
      this.chargeLines = [...this.chargeLines, { item, quantity: 1, price, priceDraft: String(price) }];
    }
    this.catalogPage = Math.min(this.catalogPage, this.catalogTotalPages);
    this.cdr.markForCheck();
  }

  updateChargeLine(index: number, patch: Partial<{ quantity: number }>): void {
    this.chargeError = '';
    this.chargeLines = this.chargeLines.map((line, i) => i === index ? {
      ...line,
      quantity: Math.max(1, Math.floor(Number(patch.quantity ?? line.quantity) || 1))
    } : line);
  }

  onPriceDraftChange(index: number, value: string): void {
    this.chargeLines = this.chargeLines.map((line, i) => i === index ? { ...line, priceDraft: value } : line);
    this.chargeError = '';
  }

  commitPrice(index: number): void {
    this.chargeLines = this.chargeLines.map((line, i) => {
      if (i !== index) return line;
      const parsed = Number(line.priceDraft);
      if (!line.priceDraft.trim() || !Number.isFinite(parsed) || parsed < 0) {
        return { ...line, priceDraft: String(line.price) };
      }
      const price = this.round(parsed);
      return { ...line, price, priceDraft: String(price) };
    });
  }

  removeChargeLine(index: number): void {
    this.chargeLines = this.chargeLines.filter((_, i) => i !== index);
  }

  async submitNewCharge(): Promise<void> {
    const folioNo = (this.folio.PRV09_NumFolio || this.folio.PRV01_Folio || '').trim();
    const reservation = (this.folio.PRV09_CodReserva || this.folio.PRV01_CodReserva || '').trim();
    const operator = this.currentOperator();
    const pos = this.selectedPos;
    const lines = this.chargeLines.filter((line) => line.quantity > 0 && line.price >= 0 && line.quantity * line.price > 0);
    if (!folioNo || !reservation || !pos || !lines.length || this.chargeTotal <= 0) {
      this.chargeError = 'Seleccione punto de venta y al menos un consumo con monto mayor a cero.';
      return;
    }

    try {
      const rawDate = this.operationalDateService.operationalDate() || await firstValueFrom(this.operationalDateService.ensureLoaded());
      this.operationalDate = normalizePmsDateDDMMYYYY(rawDate);
    } catch (error) {
      console.error('No se pudo obtener la fecha operativa para el cargo directo.', error);
      this.chargeError = 'No se puede registrar el cargo sin una fecha operativa válida.';
      return;
    }
    if (!this.operationalDate) {
      this.chargeError = 'No se puede registrar el cargo sin una fecha operativa válida.';
      return;
    }

    const now = new Date();
    const hora = new Intl.DateTimeFormat('es-DO', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    const payload: RoomChargePayload = {
      proceso: 1,
      tipCrgHab: 'CH',
      numCrgHab: '',
      codRsv: reservation,
      numHab: folioNo,
      pntVenta: pos.code,
      fecha: this.operationalDate,
      hora,
      numDocu: '00000000',
      nombrePax: this.folio.PRV01_Descripcion?.trim() || 'Folio Master',
      mtoTotal: this.chargeTotal,
      moneda: pos.currency || 'USD',
      cierre: 0,
      numCierre: 0,
      operador: operator,
      detalle: lines.map((line, index) => ({
        codRsv: reservation, numHab: folioNo, pntVenta: pos.code, fecha: this.operationalDate, hora,
        grupo: String(line.item.MPV01_CodGrupo || '').trim(),
        categoria: String(line.item.MPV01_CodCategoria || line.item.MPV00_NomCategoria || '').trim(),
        codConsumo: String(line.item.MPV05_CodProducto || '').trim(),
        nomConsumo: String(line.item.MPV05_DesProducto || line.item.MPV05_NomCorto || line.item.MPV05_CodProducto || '').trim(),
        cantidad: line.quantity, precio: this.round(line.price), total: this.round(line.quantity * line.price),
        moneda: String(line.item.MPV05_Moneda || pos.currency || 'USD').trim(),
        tipNPedido: '', numNPedido: '', codMozo: '', incluido: 0, exonerado: 0, orden: index + 1,
        comentario: '', operador: operator
      }))
    };

    const confirmation = await Swal.fire({
      title: 'Confirmar cargo directo',
      text: `Se registrará ${payload.moneda} ${payload.mtoTotal.toFixed(2)} en el Folio Master ${folioNo}.`,
      icon: 'question', showCancelButton: true, confirmButtonText: 'Sí, registrar', cancelButtonText: 'Cancelar', reverseButtons: true,
      customClass: { container: 'next-confirm-container' }
    });
    if (!confirmation.isConfirmed) return;

    this.submittingCharge = true;
    this.chargeError = '';
    this.mutationService.create(payload).pipe(
      finalize(() => { this.submittingCharge = false; this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        if (this.isFailedResponse(response)) {
          this.chargeError = response.message || response.mensaje || 'No se pudo registrar el cargo.';
          return;
        }
        this.addingCharge = false;
        this.chargeLines = [];
        this.chargeCreated.emit();
        void Swal.fire({ title: 'Cargo registrado', text: 'El cargo se agregó al Folio Master.', icon: 'success', timer: 2000, showConfirmButton: false, customClass: { container: 'next-confirm-container' } });
      },
      error: (error) => {
        console.error('No se pudo registrar el cargo directo en Folio Master.', error);
        this.chargeError = error?.error?.mensaje || error?.error?.message || 'No se pudo registrar el cargo.';
      }
    });
  }

  private loadChargeItems(): void {
    const priceList = this.selectedPos?.priceList;
    this.chargeItems = [];
    if (!priceList) {
      this.chargeError = 'El punto de venta no tiene lista de precios configurada.';
      return;
    }
    this.loadingItems = true;
    this.roomService.getRoomChargePriceListItems(priceList).pipe(
      catchError((error) => {
        console.error('No se pudo cargar la lista de precios para Folio Master.', error);
        this.chargeError = 'No se pudo cargar la lista de precios.';
        return of([] as RoomChargePriceListApiItem[]);
      }),
      finalize(() => { this.loadingItems = false; this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((items) => {
      this.chargeItems = items;
      this.catalogPage = 1;
      this.categoryFilter = '';
      if (!items.length) this.chargeError = 'La lista de precios no tiene consumos disponibles.';
      this.cdr.markForCheck();
    });
  }

  private currentOperator(): string {
    const user = this.authService.getCurrentUser();
    return String(user?.usuario || user?.nombre || this.folio.PRV09_Operador || 'SISTEMA').trim();
  }

  private isFailedResponse(value: unknown): value is { success: false; message?: string; mensaje?: string } {
    return typeof value === 'object' && value !== null && (value as { success?: boolean }).success === false;
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
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

  trackByChargeLine(index: number): number {
    return index;
  }
}
