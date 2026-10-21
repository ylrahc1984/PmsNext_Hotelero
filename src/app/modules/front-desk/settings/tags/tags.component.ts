import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EMPTY, catchError, finalize, forkJoin, of } from 'rxjs';
import Swal from 'sweetalert2';
import { ToastService } from 'src/app/core/services/toast.service';
import { TagCategory } from '../tag-categories/models/tag-category.model';
import { TagCategoryService } from '../tag-categories/services/tag-category.service';
import { Tag, TagRequest } from './models/tag.model';
import { TagService } from './services/tag.service';

interface TagForm { idCategoria: FormControl<number>; nombre: FormControl<string>; descripcion: FormControl<string>; color: FormControl<string>; icono: FormControl<string>; prioridad: FormControl<number>; esAlerta: FormControl<boolean>; permiteManual: FormControl<boolean>; grupoExclusion: FormControl<string>; activo: FormControl<boolean>; }

@Component({ selector: 'app-tags', standalone: true, imports: [CommonModule, FormsModule, ReactiveFormsModule], templateUrl: './tags.component.html', styleUrls: ['./tags.component.scss'] })
export class TagsComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder); private readonly service = inject(TagService); private readonly categoriesService = inject(TagCategoryService); private readonly toast = inject(ToastService); private readonly destroyRef = inject(DestroyRef);
  readonly iconOptions = [
    'accessibility', 'baby', 'badge', 'badge-alert', 'badge-check', 'badge-percent', 'bed-single', 'briefcase-business',
    'briefcase-medical', 'building-2', 'cake-slice', 'car', 'car-front', 'circle-check', 'circle-dollar-sign', 'clipboard-check',
    'clock', 'clock-arrow-down', 'clock-arrow-up', 'copy', 'crown', 'feather', 'file-clock', 'file-warning', 'gift', 'hand-helping',
    'handshake', 'heart', 'heart-handshake', 'hotel', 'landmark', 'link', 'lock-keyhole', 'log-out', 'message-square-warning',
    'moon', 'network', 'panels-top-left', 'party-popper', 'paw-print', 'person-standing', 'phone-call', 'plane', 'plane-landing',
    'plane-takeoff', 'receipt-text', 'repeat', 'repeat-2', 'search', 'shield-alert', 'shield-check', 'sparkles', 'triangle-alert',
    'undo-2', 'user-round-check', 'user-x', 'users', 'utensils', 'volume-x', 'wallet-cards'
  ] as const;
  readonly form: FormGroup<TagForm> = this.fb.group({ idCategoria: this.fb.control(0, [Validators.required, Validators.min(1)]), nombre: this.fb.control('', [Validators.required, Validators.maxLength(50)]), descripcion: this.fb.control('', [Validators.maxLength(200)]), color: this.fb.control('#3B82F6', [Validators.required, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)]), icono: this.fb.control('', [Validators.maxLength(50)]), prioridad: this.fb.control(0, [Validators.required, Validators.min(0), Validators.max(5)]), esAlerta: this.fb.control(false), permiteManual: this.fb.control(true), grupoExclusion: this.fb.control('', [Validators.maxLength(30)]), activo: this.fb.control(true) });
  categories: TagCategory[] = []; tags: Tag[] = []; filtered: Tag[] = []; selectedCategory = 0; search = ''; loading = false; saving = false; deleting = false; editing = false; showModal = false; selectedId: number | null = null; error = '';
  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading = true;
    this.error = '';
    forkJoin({
      categories: this.categoriesService.getActive().pipe(
        catchError((e) => {
          this.handleError('No se pudieron cargar las categorías de tags.', e);
          return of([] as TagCategory[]);
        })
      ),
      tags: this.service.getAll().pipe(
        catchError((e) => {
          this.handleError('No se pudieron cargar los tags.', e);
          return of([] as Tag[]);
        })
      )
    })
      .pipe(finalize(() => this.loading = false), takeUntilDestroyed(this.destroyRef))
      .subscribe(({ categories, tags }) => {
        this.categories = categories;
        this.tags = tags;
        this.filter();
      });
  }
  filter(): void { const term = this.search.trim().toLowerCase(); this.filtered = this.tags.filter((item) => (!this.selectedCategory || item.idCategoria === this.selectedCategory) && (!term || `${item.nombre} ${item.descripcion ?? ''} ${item.categoria ?? ''}`.toLowerCase().includes(term))); }
  openCreate(): void { this.editing = false; this.selectedId = null; this.form.reset({ idCategoria: this.selectedCategory || 0, nombre: '', descripcion: '', color: '#3B82F6', icono: '', prioridad: 0, esAlerta: false, permiteManual: true, grupoExclusion: '', activo: true }); this.showModal = true; }
  openEdit(item: Tag): void { this.editing = true; this.selectedId = item.idTag; this.form.reset({ idCategoria: item.idCategoria, nombre: item.nombre, descripcion: item.descripcion ?? '', color: item.color, icono: item.icono ?? '', prioridad: item.prioridad, esAlerta: item.esAlerta, permiteManual: item.permiteManual, grupoExclusion: item.grupoExclusion ?? '', activo: item.activo }); this.showModal = true; }
  close(): void { if (!this.saving) this.showModal = false; }
  save(): void { if (this.form.invalid || this.selectedId === null && this.editing) { this.form.markAllAsTouched(); return; } this.saving = true; const v = this.form.getRawValue(); const request: TagRequest = { idCategoria: v.idCategoria, nombre: v.nombre.trim(), descripcion: v.descripcion.trim() || null, color: v.color.toUpperCase(), icono: v.icono.trim() || null, prioridad: v.prioridad, esAlerta: v.esAlerta, permiteManual: v.permiteManual, grupoExclusion: v.grupoExclusion.trim() || null, activo: v.activo }; const action = this.editing ? this.service.update(this.selectedId as number, request) : this.service.create(request); action.pipe(catchError((e) => { this.handleError('No se pudo guardar el tag.', e); return EMPTY; }), finalize(() => this.saving = false), takeUntilDestroyed(this.destroyRef)).subscribe(() => { const message = this.editing ? 'El tag fue actualizado correctamente.' : 'El tag fue creado correctamente.'; this.close(); void Swal.fire({ icon: 'success', title: '¡Satisfactorio!', text: message, confirmButtonText: 'Aceptar', customClass: { container: 'swal-front-container' } }); this.load(); }); }
  deactivate(item: Tag): void { Swal.fire({ title: 'Desactivar tag', text: `¿Desea desactivar “${item.nombre}”?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, desactivar', cancelButtonText: 'Cancelar' }).then((result) => { if (!result.isConfirmed) return; this.deleting = true; this.service.deactivate(item.idTag).pipe(catchError((e) => { this.handleError('No se pudo desactivar el tag.', e); return EMPTY; }), finalize(() => this.deleting = false), takeUntilDestroyed(this.destroyRef)).subscribe(() => { this.success('Tag desactivado correctamente.'); this.load(); }); }); }
  categoryName(id: number): string { return this.categories.find((item) => item.idCategoria === id)?.nombre || '—'; }
  iconLabel(icon: string): string { return icon.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '); }
  selectIcon(icon: string): void { this.form.controls.icono.setValue(icon); }
  iconClass(icon: string): string {
    const classes: Record<string, string> = {
      accessibility: 'bi-universal-access', baby: 'bi-person-heart', badge: 'bi-award', 'badge-alert': 'bi-patch-exclamation',
      'badge-check': 'bi-patch-check', 'badge-percent': 'bi-patch-minus', 'bed-single': 'bi-bed', 'briefcase-business': 'bi-briefcase',
      'briefcase-medical': 'bi-briefcase-medical', 'building-2': 'bi-building', 'cake-slice': 'bi-cake2', car: 'bi-car-front',
      'car-front': 'bi-car-front-fill', 'circle-check': 'bi-check-circle', 'circle-dollar-sign': 'bi-cash-coin', 'clipboard-check': 'bi-clipboard-check',
      clock: 'bi-clock', 'clock-arrow-down': 'bi-clock-history', 'clock-arrow-up': 'bi-clock-history', copy: 'bi-copy', crown: 'bi-crown',
      feather: 'bi-feather', 'file-clock': 'bi-file-earmark-text', 'file-warning': 'bi-file-earmark-exclamation', gift: 'bi-gift',
      'hand-helping': 'bi-hand-index', handshake: 'bi-handshake', heart: 'bi-heart', 'heart-handshake': 'bi-heart', hotel: 'bi-building',
      landmark: 'bi-bank', link: 'bi-link-45deg', 'lock-keyhole': 'bi-lock', 'log-out': 'bi-box-arrow-right',
      'message-square-warning': 'bi-chat-square-text', moon: 'bi-moon', network: 'bi-diagram-3', 'panels-top-left': 'bi-grid-1x2',
      'party-popper': 'bi-stars', 'paw-print': 'bi-paw', 'person-standing': 'bi-person-standing', 'phone-call': 'bi-telephone', plane: 'bi-airplane',
      'plane-landing': 'bi-airplane-engines', 'plane-takeoff': 'bi-airplane-engines', 'receipt-text': 'bi-receipt', repeat: 'bi-arrow-repeat',
      'repeat-2': 'bi-repeat-2', search: 'bi-search', 'shield-alert': 'bi-shield-exclamation', 'shield-check': 'bi-shield-check',
      sparkles: 'bi-stars', 'triangle-alert': 'bi-exclamation-triangle', 'undo-2': 'bi-arrow-counterclockwise', 'user-round-check': 'bi-person-check',
      'user-x': 'bi-person-x', users: 'bi-people', utensils: 'bi-utensils', 'volume-x': 'bi-volume-mute', 'wallet-cards': 'bi-wallet2'
    };
    return classes[icon] ?? 'bi-tag';
  }
  invalid(field: keyof TagForm): boolean { const c = this.form.controls[field]; return c.invalid && (c.dirty || c.touched); }
  errorFor(field: keyof TagForm): string { const c = this.form.controls[field]; if (c.errors?.['required']) return 'Campo requerido'; if (c.errors?.['pattern']) return 'Formato requerido: #RRGGBB'; if (c.errors?.['maxlength']) return `Máximo ${c.errors['maxlength'].requiredLength} caracteres`; if (c.errors?.['min'] || c.errors?.['max']) return 'Valor fuera de rango'; return ''; }
  private success(message: string): void { this.toast.addToast({ title: 'Éxito', message, type: 'success' }); }
  private handleError(message: string, error: any): void { console.error(message, error); this.error = error?.status === 409 ? 'La operación entra en conflicto con datos existentes.' : error?.status === 404 ? 'El registro no fue encontrado.' : message; this.toast.addToast({ title: 'Error', message: this.error, type: 'error' }); }
}
