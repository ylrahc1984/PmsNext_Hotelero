import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, NonNullableFormBuilder } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';
import Swal from 'sweetalert2';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { RecepcionFacturasService } from './recepcion-facturas.service';
import { CompraFactura } from './interfaces/CompraFactura.interface';
import { CompraFacturaResponse } from './interfaces/CompraFacturaResponse.interface';

interface RecepcionFacturasFiltroForm {
  fechaInicio: FormControl<string>;
  fechaFinal: FormControl<string>;
  proveedor: FormControl<string>;
  numeroFactura: FormControl<string>;
  tipoDocumento: FormControl<string>;
}

type TipoDocumento = 'COM' | 'SRV';

@Component({
  selector: 'app-recepcion-facturas',
  imports: [CommonModule, SharedModule, RouterModule],
  templateUrl: './recepcion-facturas.component.html',
  styleUrls: ['./recepcion-facturas.component.scss']
})
export class RecepcionFacturasComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly facturasService = inject(RecepcionFacturasService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly filtrosForm: FormGroup<RecepcionFacturasFiltroForm> = this.fb.group({
    fechaInicio: this.fb.control(''),
    fechaFinal: this.fb.control(''),
    proveedor: this.fb.control(''),
    numeroFactura: this.fb.control(''),
    tipoDocumento: this.fb.control('')
  });

  readonly tiposDocumento = [
    { value: '', label: 'Todos' },
    { value: 'COM', label: 'Compra Artículos' },
    { value: 'SRV', label: 'Compra Servicios' }
  ];

  facturas: CompraFactura[] = [];
  isLoading = false;
  isDeleting = false;
  errorMessage = '';

  pageNumber = 1;
  pageSize = 10;
  totalRecords = 0;
  totalPages = 1;
  pageStart = 0;
  pageEnd = 0;
  readonly pageSizeOptions = [10, 20, 50];

  ngOnInit(): void {
    this.loadFacturas();
  }

  applyFilters(): void {
    this.pageNumber = 1;
    this.loadFacturas();
  }

  resetFilters(): void {
    this.filtrosForm.reset({
      fechaInicio: '',
      fechaFinal: '',
      proveedor: '',
      numeroFactura: '',
      tipoDocumento: ''
    });
    this.pageNumber = 1;
    this.loadFacturas();
  }

  onPageSizeChange(size: string): void {
    this.pageSize = Number(size) || this.pageSize;
    this.pageNumber = 1;
    this.loadFacturas();
  }

  goToPageRelative(delta: number): void {
    const nextPage = this.pageNumber + delta;
    if (nextPage < 1 || nextPage > this.totalPages) {
      return;
    }
    this.pageNumber = nextPage;
    this.loadFacturas();
  }

  nuevaCompra(tipo: TipoDocumento): void {
    if (tipo === 'COM') {
      this.router.navigate(['/compras/recepcion-facturas/nueva-compra-articulos']);
      return;
    }
    this.router.navigate(['/compras/recepcion-facturas/nueva-compra-servicios']);
  }

  verDetalle(factura: CompraFactura): void {
    Swal.fire({
      title: 'Detalle',
      text: `Detalle pendiente para documento ${factura.numDocu}.`,
      icon: 'info'
    });
  }

  editarFactura(factura: CompraFactura): void {
    Swal.fire({
      title: 'Edicion',
      text: `Edicion pendiente para documento ${factura.numDocu}.`,
      icon: 'info'
    });
  }

  eliminarFactura(factura: CompraFactura): void {
    Swal.fire({
      title: 'Eliminar factura',
      text: `Desea eliminar la factura ${factura.numDocu}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }
      this.isDeleting = true;
      Swal.fire({
        title: 'Pendiente',
        text: 'La eliminacion sera integrada con el backend en una siguiente fase.',
        icon: 'info'
      }).finally(() => {
        this.isDeleting = false;
      });
    });
  }

  registrarPago(factura: CompraFactura): void {
    Swal.fire({
      title: 'Registrar pago',
      text: `Registrar pago para documento ${factura.numDocu}.`,
      icon: 'info'
    });
  }

  canEdit(factura: CompraFactura): boolean {
    return this.normalizeEstado(factura.estado) === 'ABI';
  }

  canDelete(factura: CompraFactura): boolean {
    return this.normalizeEstado(factura.estado) === 'ABI';
  }

  canRegisterPayment(factura: CompraFactura): boolean {
    return this.normalizeEstado(factura.estado) === 'ABI';
  }

  getTipoLabel(factura: CompraFactura): string {
    const tipo = this.normalizeTipo(factura.tipDocu);
    if (tipo === 'COM') {
      return 'Compra Artículos';
    }
    if (tipo === 'SRV') {
      return 'Compra Servicios';
    }
    return tipo || 'Sin tipo';
  }

  getTipoBadgeClass(factura: CompraFactura): string {
    const tipo = this.normalizeTipo(factura.tipDocu);
    if (tipo === 'COM') {
      return 'badge-tipo badge-tipo-com';
    }
    if (tipo === 'SRV') {
      return 'badge-tipo badge-tipo-srv';
    }
    return 'badge-tipo badge-tipo-otro';
  }

  getEstadoLabel(factura: CompraFactura): string {
    const estado = this.normalizeEstado(factura.estado);
    switch (estado) {
      case 'ABI':
        return 'Abierta';
      case 'PAG':
        return 'Pagada';
      case 'ANU':
        return 'Anulada';
      default:
        return estado || 'Sin estado';
    }
  }

  getEstadoBadgeClass(factura: CompraFactura): string {
    const estado = this.normalizeEstado(factura.estado);
    switch (estado) {
      case 'ABI':
        return 'badge-estado badge-estado-abi';
      case 'PAG':
        return 'badge-estado badge-estado-pag';
      case 'ANU':
        return 'badge-estado badge-estado-anu';
      default:
        return 'badge-estado badge-estado-otro';
    }
  }

  get emptyMessage(): string {
    return this.isLoading ? 'Cargando facturas...' : 'No hay facturas para mostrar.';
  }

  private loadFacturas(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const filters = this.buildFilters();

    this.facturasService
      .getFacturas(filters)
      .pipe(
        catchError((error) => {
          this.handleError('No se pudieron cargar las facturas.', error);
          const emptyResponse: CompraFacturaResponse = {
            data: [],
            pageNumber: filters.pageNumber,
            pageSize: filters.pageSize,
            totalRecords: 0
          };
          return of(emptyResponse);
        }),
        finalize(() => {
          this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.facturas = response.data ?? [];
        this.pageNumber = response.pageNumber || filters.pageNumber;
        this.pageSize = response.pageSize || filters.pageSize;
        this.totalRecords = response.totalRecords ?? 0;
        this.totalPages = Math.max(1, Math.ceil(this.totalRecords / this.pageSize));
        this.updateRange();
      });
  }

  private buildFilters(): {
    fechaInicio?: string;
    fechaFinal?: string;
    proveedor?: string;
    numeroFactura?: string;
    tipoDocumento?: string;
    pageNumber: number;
    pageSize: number;
  } {
    const raw = this.filtrosForm.getRawValue();
    return {
      fechaInicio: this.normalizeValue(raw.fechaInicio),
      fechaFinal: this.normalizeValue(raw.fechaFinal),
      proveedor: this.normalizeValue(raw.proveedor),
      numeroFactura: this.normalizeValue(raw.numeroFactura),
      tipoDocumento: this.normalizeValue(raw.tipoDocumento),
      pageNumber: this.pageNumber,
      pageSize: this.pageSize
    };
  }

  private updateRange(): void {
    if (this.totalRecords === 0) {
      this.pageStart = 0;
      this.pageEnd = 0;
      return;
    }
    this.pageStart = (this.pageNumber - 1) * this.pageSize + 1;
    this.pageEnd = Math.min(this.pageNumber * this.pageSize, this.totalRecords);
  }

  private normalizeValue(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  private normalizeTipo(value?: string): string {
    return (value || '').trim().toUpperCase();
  }

  private normalizeEstado(value?: string): string {
    return (value || '').trim().toUpperCase();
  }

  private handleError(message: string, error: unknown): void {
    console.error(message, error);
    this.errorMessage = message;
    Swal.fire({
      title: 'Error',
      text: message,
      icon: 'error'
    });
  }
}
