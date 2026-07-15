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
import { ReporteCierreEncabezado } from './models/cierre-caja.model';

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
    pntVenta: this.fb.control('')
  });

  cierres: ReporteCierreEncabezado[] = [];
  puntosVenta: PuntoVentaUI[] = [];
  puntosVentaLoading = false;
  isLoading = false;
  currentUsuario = '';
  printingCierres = new Set<string>();

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
      pntVenta: ''
    });
    this.loadCierres();
  }

  nuevaApertura(): void {
    void this.router.navigate(['/operaciones/cierre-caja/nuevo']);
  }

  verDetalle(item: ReporteCierreEncabezado): void {
    const numCierre = this.cleanText(item.numCierre);
    if (!numCierre) {
      return;
    }

    void this.router.navigate(['/operaciones/cierre-caja', numCierre, 'detalle']);
  }

  imprimirCierre(item: ReporteCierreEncabezado): void {
    const numCierre = this.cleanText(item.numCierre);
    if (!numCierre || this.printingCierres.has(numCierre)) {
      return;
    }

    this.printingCierres.add(numCierre);
    this.cierreCajaService
      .getCierreCajaPdf(numCierre)
      .pipe(finalize(() => this.printingCierres.delete(numCierre)))
      .subscribe({
        next: (blob) => this.openPdfBlob(blob, `Cierre_Caja_${numCierre}.pdf`),
        error: (error: unknown) => {
          window.alert(error instanceof Error ? error.message : 'No se pudo generar el PDF del cierre de caja.');
        }
      });
  }

  isPrinting(item: ReporteCierreEncabezado): boolean {
    const numCierre = this.cleanText(item.numCierre);
    return !!numCierre && this.printingCierres.has(numCierre);
  }

  get abiertosCount(): number {
    return this.cierres.length;
  }

  get cerradosCount(): number {
    return this.puntosVenta.length;
  }

  get diferenciaAcumulada(): number {
    return this.round(this.cierres.reduce((sum, item) => sum + this.toNumber(item.fondoCaja), 0));
  }

  private loadPuntosVenta(): void {
    this.puntosVentaLoading = true;
    this.usuarioService
      .getPuntosVenta()
      .pipe(
        catchError(() => of([] as PuntoVentaUI[])),
        finalize(() => (this.puntosVentaLoading = false))
      )
      .subscribe((data) => {
        this.applyPuntosVentaCatalogo(this.sortPuntosVenta(data));
      });
  }

  private applyPuntosVentaCatalogo(puntosVenta: PuntoVentaUI[]): void {
    this.puntosVenta = puntosVenta;

    const current = this.filtrosForm.controls.pntVenta.value;
    if (current && !this.puntosVenta.some((item) => item.codigo === current)) {
      this.filtrosForm.controls.pntVenta.setValue('', { emitEvent: false });
    }
  }

  private sortPuntosVenta(data: PuntoVentaUI[] | null | undefined): PuntoVentaUI[] {
    return [...(data ?? [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  }

  private loadCierres(): void {
    this.isLoading = true;
    const value = this.filtrosForm.getRawValue();

    this.cierreCajaService
      .getReporteEncabezados({
        fecha: value.fecha,
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

  private cleanText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private openPdfBlob(blob: Blob, filename: string): void {
    const pdfBlob = new Blob([blob], { type: 'application/pdf' });
    const objectUrl = URL.createObjectURL(pdfBlob);
    const opened = window.open(objectUrl, '_blank', 'noopener');

    if (!opened) {
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}
