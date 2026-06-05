import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import {
  PuntoVentaPayload,
  PuntoVentaRestaurante,
  PuntosVentaRestauranteService
} from './puntos-venta-restaurante.service';

type PuntoVentaForm = {
  codPntVenta: string;
  nomPntVenta: string;
  codComanda: string;
  numMesa: number;
  pntTouch: number;
  orden: number;
  operador: string;
  impresoraA: string;
  impresoraB: string;
};

@Component({
  selector: 'app-puntos-venta-restaurante',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SharedModule],
  templateUrl: './puntos-venta-restaurante.component.html',
  styleUrls: ['./puntos-venta-restaurante.component.scss']
})
export class PuntosVentaRestauranteComponent implements OnInit {
  private readonly puntosVentaService = inject(PuntosVentaRestauranteService);

  puntosVenta: PuntoVentaRestaurante[] = [];
  filteredPuntosVenta: PuntoVentaRestaurante[] = [];
  pagedPuntosVenta: PuntoVentaRestaurante[] = [];

  isLoading = false;
  isSaving = false;

  filterNombre = '';
  filterTouch = '';

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalRegistros = 0;
  pageSizeOptions = [10, 20, 50, 100];

  showModal = false;
  formModel: PuntoVentaForm = this.getDefaultForm();

  ngOnInit(): void {
    this.loadPuntosVenta();
  }

  loadPuntosVenta(): void {
    this.isLoading = true;
    this.puntosVentaService.getPuntosVenta().subscribe({
      next: (data) => {
        this.puntosVenta = (data ?? []).sort((a, b) => {
          if (a.orden !== b.orden) {
            return a.orden - b.orden;
          }
          return a.codPntVenta.localeCompare(b.codPntVenta);
        });
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar puntos de venta:', error);
        this.isLoading = false;
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los puntos de venta.',
          icon: 'error'
        });
      }
    });
  }

  onBuscar(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  onLimpiar(): void {
    this.filterNombre = '';
    this.filterTouch = '';
    this.currentPage = 1;
    this.applyFilters();
  }

  onPageSizeChange(): void {
    this.pageSize = Number(this.pageSize) || 10;
    this.currentPage = 1;
    this.rebuildPagination();
  }

  goToPageRelative(delta: number): void {
    const nextPage = Number(this.currentPage) + delta;
    if (nextPage < 1 || nextPage > this.totalPages) {
      return;
    }
    this.currentPage = nextPage;
    this.rebuildPagination();
  }

  abrirModalCrear(): void {
    this.formModel = this.getDefaultForm();
    this.showModal = true;
  }

  cerrarModal(): void {
    if (this.isSaving) {
      return;
    }
    this.showModal = false;
    this.formModel = this.getDefaultForm();
  }

  guardarPuntoVenta(): void {
    const payload = this.buildPayload();

    if (!payload.codPntVenta || !payload.nomPntVenta || !payload.codComanda) {
      Swal.fire({
        title: 'Validacion',
        text: 'Codigo, nombre y comanda son obligatorios.',
        icon: 'warning'
      });
      return;
    }

    this.isSaving = true;
    this.puntosVentaService.crearPuntoVenta(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.cerrarModal();
        Swal.fire({
          title: 'Exito',
          text: 'Punto de venta guardado correctamente.',
          icon: 'success'
        });
        this.loadPuntosVenta();
      },
      error: (error) => {
        console.error('Error al guardar punto de venta:', error);
        this.isSaving = false;
        Swal.fire({
          title: 'Error',
          text: 'No se pudo guardar el punto de venta.',
          icon: 'error'
        });
      }
    });
  }

  getTouchBadge(value: number): string {
    return Number(value) === 1 ? 'badge-success' : 'badge-secondary';
  }

  private applyFilters(): void {
    const nombre = (this.filterNombre || '').trim().toLowerCase();
    const touch = this.filterTouch === '' ? null : Number(this.filterTouch);

    this.filteredPuntosVenta = this.puntosVenta.filter((item) => {
      const matchesNombre =
        !nombre ||
        item.codPntVenta.toLowerCase().includes(nombre) ||
        item.nomPntVenta.toLowerCase().includes(nombre) ||
        item.codComanda.toLowerCase().includes(nombre);
      const matchesTouch = touch === null || Number(item.pntTouch) === touch;
      return matchesNombre && matchesTouch;
    });

    this.rebuildPagination();
  }

  private rebuildPagination(): void {
    this.totalRegistros = this.filteredPuntosVenta.length;
    this.totalPages = Math.max(1, Math.ceil(this.totalRegistros / this.pageSize));

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }

    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.pagedPuntosVenta = this.filteredPuntosVenta.slice(start, end);
  }

  private buildPayload(): PuntoVentaPayload {
    return {
      proceso: 0,
      codPntVenta: (this.formModel.codPntVenta || '').trim(),
      nomPntVenta: (this.formModel.nomPntVenta || '').trim(),
      codComanda: (this.formModel.codComanda || '').trim(),
      numMesa: Number(this.formModel.numMesa ?? 0),
      pntTouch: Number(this.formModel.pntTouch ?? 0),
      orden: Number(this.formModel.orden ?? 0),
      operador: (this.formModel.operador || '').trim(),
      impresoraA: (this.formModel.impresoraA || '').trim(),
      impresoraB: (this.formModel.impresoraB || '').trim(),
      respuesta: ''
    };
  }

  private getDefaultForm(): PuntoVentaForm {
    return {
      codPntVenta: '',
      nomPntVenta: '',
      codComanda: '',
      numMesa: 0,
      pntTouch: 1,
      orden: 0,
      operador: '',
      impresoraA: '',
      impresoraB: ''
    };
  }
}
