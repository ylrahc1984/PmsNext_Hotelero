import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EMPTY, catchError, finalize, of } from 'rxjs';
import Swal from 'sweetalert2';
import { ToastService } from 'src/app/core/services/toast.service';
import { TagCategory, TagCategoryRequest } from './models/tag-category.model';
import { TagCategoryService } from './services/tag-category.service';

interface CategoryForm { nombre: FormControl<string>; descripcion: FormControl<string>; orden: FormControl<number>; }

@Component({ selector: 'app-tag-categories', standalone: true, imports: [CommonModule, FormsModule, ReactiveFormsModule], templateUrl: './tag-categories.component.html', styleUrls: ['./tag-categories.component.scss'] })
export class TagCategoriesComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly service = inject(TagCategoryService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly form: FormGroup<CategoryForm> = this.fb.group({
    nombre: this.fb.control('', [Validators.required, Validators.maxLength(40)]),
    descripcion: this.fb.control('', [Validators.maxLength(150)]),
    orden: this.fb.control(0, [Validators.required, Validators.min(-32768), Validators.max(32767)])
  });
  categories: TagCategory[] = []; filtered: TagCategory[] = []; search = ''; loading = false; saving = false; deleting = false; editing = false; showModal = false; selectedId: number | null = null; error = '';
  ngOnInit(): void { this.load(); }
  load(): void { this.loading = true; this.error = ''; this.service.getAll().pipe(catchError((e) => { this.handleError('No se pudieron cargar las categorías de tags.', e); return of([]); }), finalize(() => this.loading = false), takeUntilDestroyed(this.destroyRef)).subscribe((items) => { this.categories = items; this.filter(); }); }
  filter(): void { const term = this.search.trim().toLowerCase(); this.filtered = this.categories.filter((item) => !term || `${item.nombre} ${item.descripcion ?? ''}`.toLowerCase().includes(term)); }
  openCreate(): void { this.editing = false; this.selectedId = null; this.form.reset({ nombre: '', descripcion: '', orden: 0 }); this.showModal = true; }
  openEdit(item: TagCategory): void { this.editing = true; this.selectedId = item.idCategoria; this.form.reset({ nombre: item.nombre, descripcion: item.descripcion ?? '', orden: item.orden }); this.showModal = true; }
  close(): void { if (!this.saving) this.showModal = false; }
  save(): void {
    if (this.form.invalid || this.selectedId === null && this.editing) { this.form.markAllAsTouched(); return; }
    this.saving = true; const value = this.form.getRawValue(); const request: TagCategoryRequest = { nombre: value.nombre.trim(), descripcion: value.descripcion.trim() || null, orden: value.orden };
    const action = this.editing ? this.service.update(this.selectedId as number, request) : this.service.create(request);
    action.pipe(catchError((e) => { this.handleError('No se pudo guardar la categoría de tags.', e); return EMPTY; }), finalize(() => this.saving = false), takeUntilDestroyed(this.destroyRef)).subscribe(() => { const message = this.editing ? 'La categoría fue actualizada correctamente.' : 'La categoría fue creada correctamente.'; this.close(); void Swal.fire({ icon: 'success', title: '¡Satisfactorio!', text: message, confirmButtonText: 'Aceptar', customClass: { container: 'swal-front-container' } }); this.load(); });
  }
  deactivate(item: TagCategory): void { Swal.fire({ title: 'Desactivar categoría', text: `¿Desea desactivar “${item.nombre}”?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, desactivar', cancelButtonText: 'Cancelar' }).then((result) => { if (!result.isConfirmed) return; this.deleting = true; this.service.deactivate(item.idCategoria).pipe(catchError((e) => { this.handleError('No se pudo desactivar la categoría de tags.', e); return EMPTY; }), finalize(() => this.deleting = false), takeUntilDestroyed(this.destroyRef)).subscribe(() => { this.success('Categoría desactivada correctamente.'); this.load(); }); }); }
  invalid(field: keyof CategoryForm): boolean { const control = this.form.controls[field]; return control.invalid && (control.dirty || control.touched); }
  errorFor(field: keyof CategoryForm): string { const c = this.form.controls[field]; if (c.errors?.['required']) return 'Campo requerido'; if (c.errors?.['maxlength']) return `Máximo ${c.errors['maxlength'].requiredLength} caracteres`; if (c.errors?.['min'] || c.errors?.['max']) return 'Debe estar dentro del rango SMALLINT'; return ''; }
  private success(message: string): void { this.toast.addToast({ title: 'Éxito', message, type: 'success' }); }
  private handleError(message: string, error: any): void { console.error(message, error); this.error = error?.status === 409 ? 'La operación entra en conflicto con datos existentes.' : error?.status === 404 ? 'El registro no fue encontrado.' : message; this.toast.addToast({ title: 'Error', message: this.error, type: 'error' }); }
}
