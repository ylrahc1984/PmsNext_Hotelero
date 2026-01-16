import { Component, OnInit, ViewChild, ElementRef, inject, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from 'src/app/core/services/auth.service';
import { MonedaService, MonedaUI } from './moneda.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ToastService } from 'src/app/core/services/toast.service';
import Swal from 'sweetalert2';
import { S } from '@angular/cdk/scrolling-module.d-C_w4tIrZ';

declare var bootstrap: any;

@Component({
  selector: 'app-monedas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule, SharedModule, RouterLink],
  templateUrl: './monedas.component.html',
  styleUrls: ['./monedas.component.scss']
})
export class MonedasComponent implements OnInit {
  // Services
  private monedaService = inject(MonedaService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);
  
  // Data
  monedas: MonedaUI[] = [];
  filteredMonedas: MonedaUI[] = [];
  currentMoneda: MonedaUI | null = null;
  monedaForm!: FormGroup;

  // UI State
  searchTerm: string = '';
  statusFilter: string = '';
  currentPage: number = 1;
  itemsPerPage: number = 10;
  isEditing: boolean = false;
  isLoading: boolean = false;
  

  @ViewChild('monedaModal') monedaModal!: ElementRef;

  ngOnInit(): void {
    this.initializeForm();
    this.loadMonedas();
  }

  /**
   * Inicializa el formulario reactivo
   */
  private initializeForm(): void {
    this.monedaForm = this.fb.group({
      codMoneda: ['', [Validators.required]],
      moneda: ['', [Validators.required]],
      simbolo: ['', [Validators.required]],
      activo: [1, [Validators.required]],
      primario: [0, [Validators.required]],
      secundario: [0, [Validators.required]],
      orden: [0, [Validators.required, Validators.min(0)]]
    });
  }
 
  /**
   * Carga todas las monedas desde la API
   */
  loadMonedas(): void {
    this.isLoading = true;
    this.monedaService.getAll().subscribe({
      next: (data: MonedaUI[]) => {
        this.monedas = data;
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar monedas:', error);
        this.toastService.addToast({
          title: 'Error',
          message: 'No se pudieron cargar las monedas. Verifique la conexión a la API.',
          type: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  /**
   * Aplica filtros de búsqueda y estado
   */
  applyFilters(): void {
    this.filteredMonedas = this.monedas.filter(moneda => {
      const matchesSearch =
        !this.searchTerm ||
        moneda.moneda.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        moneda.codMoneda.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        moneda.simbolo.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesStatus =
        !this.statusFilter ||
        (this.statusFilter === 'active' && moneda.activo === 1) ||
        (this.statusFilter === 'inactive' && moneda.activo === 0);

      return matchesSearch && matchesStatus;
    });
    this.currentPage = 1;
  }

  /**
   * Maneja cambios en la búsqueda
   */
  onSearchChange(): void {
    this.applyFilters();
  }

  /**
   * Maneja cambios en el filtro de estado
   */
  onFilterChange(): void {
    this.applyFilters();
  }

  /**
   * Obtiene las monedas paginadas
   */
  getPaginatedMonedas(): MonedaUI[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredMonedas.slice(startIndex, endIndex);
  }

  /**
   * Abre el modal para crear una nueva moneda
   */
  createNewMoneda(): void {
    this.currentMoneda = {
      codMoneda: '',
      moneda: '',
      simbolo: '',
      activo: 1,
      primario: 0,
      secundario: 0,
      orden: this.monedas.length + 1
    };
    this.isEditing = false;
    this.monedaForm.reset({
      codMoneda: '',
      moneda: '',
      simbolo: '',
      activo: 1,
      primario: 0,
      secundario: 0,
      orden: this.monedas.length + 1
    });
    this.openModal();
  }

  /**
   * Abre el modal para editar una moneda
   */
  editMoneda(moneda: MonedaUI): void {

    Swal.fire({
      title: 'Editar Moneda',
      text: `¿Desea editar la moneda "${moneda.moneda}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Si, editar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.currentMoneda = { ...moneda };
        this.isEditing = true;
        this.monedaForm.patchValue({
          codMoneda: moneda.codMoneda,
          moneda: moneda.moneda,
          simbolo: moneda.simbolo,
          activo: moneda.activo,
          primario: moneda.primario,
          secundario: moneda.secundario,
          orden: moneda.orden
        });
        this.openModal();
      }
    });
  }

  /**
   * Guarda la moneda (crea o actualiza)
   */
  saveMoneda(): void {
    if (!this.monedaForm.valid) {
      this.toastService.addToast({
        title: 'Validación',
        message: 'Por favor, complete todos los campos requeridos.',
        type: 'warning'
      });
      return;
    }

    const formValue = this.monedaForm.value;
    const monedaToSave: MonedaUI = {
      codMoneda: formValue.codMoneda,
      moneda: formValue.moneda,
      simbolo: formValue.simbolo,
      activo: parseInt(formValue.activo),
      primario: parseInt(formValue.primario),
      secundario: parseInt(formValue.secundario),
      orden: parseInt(formValue.orden)
    };

    this.isLoading = true;

    const operador = this.authService.getCurrentUser()?.usuario;

    const operation = this.isEditing
      ? this.monedaService.update(monedaToSave, operador)
      : this.monedaService.create(monedaToSave, operador);

    operation.subscribe({
      next: (response) => {
        const message = this.isEditing
          ? 'Moneda actualizada exitosamente'
          : 'Moneda creada exitosamente';

        this.toastService.addToast({
          title: 'Éxito',
          message: message,
          type: 'success'
        });

        this.closeModal();
        this.loadMonedas();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al guardar moneda:', error);
        const errorMsg = error.error?.respuesta || 'Error al guardar la moneda';
        this.toastService.addToast({
          title: 'Error',
          message: errorMsg,
          type: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  /**
   * Elimina una moneda
   */
  deleteMoneda(moneda: MonedaUI): void {
    
    Swal.fire({
      title: 'Eliminar Moneda',
      text: `¿Está seguro de que desea eliminar la moneda "${moneda.moneda}"? Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
            this.isLoading = true;

            this.monedaService.delete(moneda.codMoneda).subscribe({
              next: (response) => {
                this.toastService.addToast({
                  title: 'Éxito',
                  message: 'Moneda eliminada exitosamente',
                  type: 'success'
                });
                this.loadMonedas();
                this.isLoading = false;
              },
              error: (error) => {
                console.error('Error al eliminar moneda:', error);
                const errorMsg = error.error?.respuesta || 'Error al eliminar la moneda';
                this.toastService.addToast({
                  title: 'Error',
                  message: errorMsg,
                  type: 'error'
                });
                this.isLoading = false;
              }
            });
      }
    });
 
  }

  /**
   * Abre el modal
   */
  private openModal(): void {
    if (this.monedaModal) {
      const modal = new bootstrap.Modal(this.monedaModal.nativeElement);
      modal.show();
    }
  }

  /**
   * Cierra el modal
   */
  private closeModal(): void {
    if (this.monedaModal) {
      const modal = bootstrap.Modal.getInstance(this.monedaModal.nativeElement);
      if (modal) {
        modal.hide();
      }
    }
    this.currentMoneda = null;
    this.isEditing = false;
  }

  // ==================== Propiedades Calculadas ====================

  get totalPages(): number {
    return Math.ceil(this.filteredMonedas.length / this.itemsPerPage);
  }

  get totalMonedas(): number {
    return this.filteredMonedas.length;
  }

  get isFormValid(): boolean {
    return this.monedaForm ? this.monedaForm.valid : false;
  }

  // ==================== Métodos de Paginación ====================

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  goToPageRelative(offset: number): void {
    this.goToPage(this.currentPage + offset);
  }

  getVisiblePages(): number[] {
    const totalPages = this.totalPages;
    const current = this.currentPage;
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, current - delta); i <= Math.min(totalPages - 1, current + delta); i++) {
      range.push(i);
    }

    if (current - delta > 2) {
      rangeWithDots.push(1, -1);
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (current + delta < totalPages - 1) {
      rangeWithDots.push(-1, totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  }

  // ==================== Helpers ====================

  getActivoLabel(valor: number): string {
    return valor === 1 ? 'Sí' : 'No';
  }

  getPrimarioLabel(valor: number): string {
    return valor === 1 ? 'Sí' : 'No';
  }

  getSecundarioLabel(valor: number): string {
    return valor === 1 ? 'Sí' : 'No';
  }

  trackByFn(index: number, item: MonedaUI): string {
    return item.codMoneda;
  }
}
