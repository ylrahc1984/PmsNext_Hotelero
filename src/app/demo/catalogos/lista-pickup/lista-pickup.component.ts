import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, merge, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, map, switchMap, takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { PickupListaItem } from './lista-pickup.models';
import { ListaPickupService } from './lista-pickup.service';

@Component({
  selector: 'app-lista-pickup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SharedModule],
  templateUrl: './lista-pickup.component.html',
  styleUrls: ['./lista-pickup.component.scss']
})
export class ListaPickupComponent implements OnInit, OnDestroy {
  private listaPickupService = inject(ListaPickupService);
  private router = inject(Router);

  searchControl = new FormControl('', { nonNullable: true });
  pickups: PickupListaItem[] = [];
  isLoading = false;
  errorMsg = '';
  pageNumber = 1;
  pageSize = 5;

  private destroy$ = new Subject<void>();
  private refresh$ = new Subject<void>();

  ngOnInit(): void {
    const termChanges$ = this.searchControl.valueChanges.pipe(
      map((value) => (value ?? '').toString()),
      debounceTime(400),
      distinctUntilChanged(),
      map((value) => value.trim())
    );

    const refresh$ = this.refresh$.pipe(map(() => (this.searchControl.value ?? '').toString().trim()));

    merge(termChanges$, refresh$)
      .pipe(
        switchMap((term) => {
          this.isLoading = true;
          this.errorMsg = '';
          return this.listaPickupService.getAll(term).pipe(
            catchError((error) => {
              const message = error?.message || 'No se pudo cargar la lista pickup.';
              this.errorMsg = message;
              void Swal.fire({
                title: 'Error',
                text: message,
                icon: 'error'
              });
              return of([]);
            }),
            finalize(() => {
              this.isLoading = false;
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((data) => {
        this.pickups = data ?? [];
        this.pageNumber = 1;
      });

    this.refresh$.next();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onBuscar(): void {
    this.pageNumber = 1;
    this.refresh$.next();
  }

  onLimpiar(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.pageNumber = 1;
    this.refresh$.next();
  }

  nuevoPickup(): void {
    this.router.navigate(['/operaciones/lista-pickup/nuevo']);
  }

  editarPickup(item: PickupListaItem): void {
    this.router.navigate(['/operaciones/lista-pickup', item.CR11_ID, 'editar']);
  }

  eliminarPickup(item: PickupListaItem): void {
    const nombre = (item.CR11_Nombre || '').toString();
    Swal.fire({
      title: 'Eliminar pickup',
      text: `Desea eliminar el pickup ${nombre || item.CR11_ID}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isLoading = true;
      this.listaPickupService.delete(item.CR11_ID).subscribe({
        next: (response) => {
          const message = response?.respuesta || 'Pickup eliminado correctamente.';
          Swal.fire({
            title: 'Eliminado',
            text: message,
            icon: 'success'
          });
          this.refresh$.next();
        },
        error: (error) => {
          const message = error?.message || 'No se pudo eliminar el pickup.';
          Swal.fire({
            title: 'Error',
            text: message,
            icon: 'error'
          });
          this.isLoading = false;
        }
      });
    });
  }

  getEstadoText(estado: number): string {
    return Number(estado) === 1 ? 'Activo' : 'Inactivo';
  }

  getEstadoBadgeClass(estado: number): string {
    return Number(estado) === 1 ? 'badge bg-success' : 'badge bg-danger';
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.pickups.length / this.pageSize));
  }

  get pagedPickups(): PickupListaItem[] {
    const start = (this.pageNumber - 1) * this.pageSize;
    return this.pickups.slice(start, start + this.pageSize);
  }

  get pageStart(): number {
    if (!this.pickups.length) return 0;
    return (this.pageNumber - 1) * this.pageSize + 1;
  }

  get pageEnd(): number {
    if (!this.pickups.length) return 0;
    return Math.min(this.pageNumber * this.pageSize, this.pickups.length);
  }

  goToPreviousPage(): void {
    if (this.pageNumber <= 1) return;
    this.pageNumber -= 1;
  }

  goToNextPage(): void {
    if (this.pageNumber >= this.totalPages) return;
    this.pageNumber += 1;
  }

  trackById(index: number, item: PickupListaItem): number {
    return item.CR11_ID;
  }
}
