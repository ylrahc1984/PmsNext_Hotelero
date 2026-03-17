import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';

import { AuthService } from 'src/app/core/services/auth.service';
import { PuntoVentaUI } from 'src/app/demo/administracion/usuarios/usuario.models';
import { UsuarioService } from 'src/app/demo/administracion/usuarios/usuario.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { CierreCajaService } from './cierre-caja.service';
import { CierreCajaRecord } from './models/cierre-caja.model';

@Component({
  selector: 'app-cierre-caja-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './cierre-caja-list.component.html',
  styleUrls: ['./cierre-caja-list.component.scss']
})
export class CierreCajaListComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly cierreCajaService = inject(CierreCajaService);

  readonly filtrosForm = this.fb.group({
    fecha: this.fb.control(this.getTodayIsoDate()),
    estado: this.fb.control(''),
    pntVenta: this.fb.control('')
  });

  readonly estados = [
    { value: '', label: 'Todos' },
    { value: 'ABIERTO', label: 'Abiertos' },
    { value: 'CERRADO', label: 'Cerrados' }
  ];

  cierres: CierreCajaRecord[] = [];
  puntosVenta: PuntoVentaUI[] = [];
  isLoading = false;
  currentUsuario = '';

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.currentUsuario = String(user?.usuario ?? '').trim();
    this.loadPuntosVenta();
    this.loadCierres();
  }

  applyFilters(): void {
    this.loadCierres();
  }

  resetFilters(): void {
    this.filtrosForm.reset({
      fecha: this.getTodayIsoDate(),
      estado: '',
      pntVenta: ''
    });
    this.loadCierres();
  }

  nuevaApertura(): void {
    void this.router.navigate(['/operaciones/cierre-caja/nuevo']);
  }

  abrirRegistro(item: CierreCajaRecord): void {
    void this.router.navigate(['/operaciones/cierre-caja', item.id]);
  }

  get abiertosCount(): number {
    return this.cierres.filter((item) => item.estado === 'ABIERTO').length;
  }

  get cerradosCount(): number {
    return this.cierres.filter((item) => item.estado === 'CERRADO').length;
  }

  get diferenciaAcumulada(): number {
    return this.round(this.cierres.reduce((sum, item) => sum + this.toNumber(item.diferenciaTotal), 0));
  }

  getEstadoBadgeClass(item: CierreCajaRecord): string {
    if (item.estado === 'CERRADO') {
      return 'badge bg-success-subtle text-success border border-success-subtle';
    }
    if (item.estado === 'ANULADO') {
      return 'badge bg-danger-subtle text-danger border border-danger-subtle';
    }
    return 'badge bg-warning-subtle text-warning border border-warning-subtle';
  }

  private loadPuntosVenta(): void {
    const request$ = this.currentUsuario
      ? this.usuarioService.getPuntosVentaUsuario(this.currentUsuario)
      : this.usuarioService.getPuntosVenta();

    request$
      .pipe(catchError(() => of([] as PuntoVentaUI[])))
      .subscribe((data) => {
        this.puntosVenta = [...(data ?? [])].sort((a, b) => a.orden - b.orden);
      });
  }

  private loadCierres(): void {
    this.isLoading = true;
    const value = this.filtrosForm.getRawValue();

    this.cierreCajaService
      .list({
        usuario: this.currentUsuario,
        fecha: value.fecha,
        estado: value.estado,
        pntVenta: value.pntVenta
      })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe((data) => {
        this.cierres = data ?? [];
      });
  }

  private getTodayIsoDate(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private round(value: number): number {
    return Math.round((this.toNumber(value) + Number.EPSILON) * 100) / 100;
  }
}
