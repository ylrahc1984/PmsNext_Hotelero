import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ProveedorService, ProveedorUI } from 'src/app/demo/compras/proveedores/proveedor.service';

type ProveedorSearchForm = {
  search: FormControl<string>;
};

@Component({
  selector: 'app-proveedor-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './proveedor-modal.component.html',
  styleUrls: ['./proveedor-modal.component.scss']
})
export class ProveedorModalComponent implements OnInit, OnChanges {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly proveedorService = inject(ProveedorService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() open = false;
  @Output() close = new EventEmitter<void>();
  @Output() selected = new EventEmitter<ProveedorUI>();

  readonly searchForm: FormGroup<ProveedorSearchForm> = this.fb.group({
    search: this.fb.control('')
  });

  proveedores: ProveedorUI[] = [];
  filteredProveedores: ProveedorUI[] = [];
  loading = false;

  emptyLabel = 'No hay proveedores para mostrar.';

  ngOnInit(): void {
    this.searchForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyLocalFilter());
  }

  ngOnChanges(changes: SimpleChanges): void {
    const openChange = changes['open'];
    if (openChange?.currentValue === true && openChange?.previousValue !== true) {
      this.searchForm.reset({ search: '' }, { emitEvent: false });
      this.loadProveedores();
    }
  }

  onClose(): void {
    this.close.emit();
  }

  buscar(): void {
    this.loadProveedores();
  }

  limpiarBusqueda(): void {
    this.searchForm.reset({ search: '' });
    this.applyLocalFilter();
  }

  seleccionar(proveedor: ProveedorUI): void {
    this.selected.emit(proveedor);
  }

  private loadProveedores(): void {
    const term = this.normalize(this.searchForm.controls.search.value);
    this.loading = true;
    const codProve = term && term.length <= 12 ? term : undefined;
    const descripcion = term || undefined;

    this.proveedorService.getProveedores(1, 50, codProve, descripcion).subscribe({
      next: (response) => {
        this.proveedores = response?.data ?? [];
        this.loading = false;
        this.applyLocalFilter();
      },
      error: (error) => {
        console.error('Error al cargar proveedores:', error);
        this.proveedores = [];
        this.filteredProveedores = [];
        this.loading = false;
      }
    });
  }

  private applyLocalFilter(): void {
    const term = this.normalize(this.searchForm.controls.search.value).toLowerCase();
    if (!term) {
      this.filteredProveedores = [...this.proveedores];
      return;
    }
    this.filteredProveedores = this.proveedores.filter((proveedor) => {
      const nombre = (proveedor.descripcion || '').toLowerCase();
      const ruc = (proveedor.ruc || '').toLowerCase();
      const codigo = (proveedor.codigo || '').toLowerCase();
      return nombre.includes(term) || ruc.includes(term) || codigo.includes(term);
    });
  }

  private normalize(value: string | null | undefined): string {
    return (value ?? '').toString().trim();
  }
}
