import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { ConfigComisionEmpresa } from '../../interfaces/config-comision.interface';
import { ConfigComisionService } from '../../services/config-comision.service';

@Component({
  selector: 'app-config-general-comisiones',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './config-general.component.html',
  styleUrl: './config-general.component.scss'
})
export class ConfigGeneralComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly configService = inject(ConfigComisionService);
  private readonly authService = inject(AuthService);
  private readonly empresaContext = inject(EmpresaContextService);

  readonly loading = signal(false);
  readonly existeConfig = signal(false);
  readonly form = this.fb.group({
    proceso: [0],
    aD14_EmpresaId: [1],
    aD14_Activo: [true],
    aD14_TipoCorte: ['MENSUAL'],
    aD14_DiaCorte: [30],
    aD14_RequiereFacturaPagada: [true],
    aD14_BaseCalculo: ['NETO'],
    aD14_IncluyeImpuestos: [false],
    aD14_PermiteLiquidacionParcial: [true],
    aD14_MonedaBase: ['USD'],
    aD14_Operador: ['']
  });

  ngOnInit(): void {
    this.empresaContext.restaurarDesdeStorage();
    this.form.patchValue({
      aD14_EmpresaId: this.getEmpresaId(),
      aD14_Operador: this.getOperador()
    });

    this.loading.set(true);
    this.configService
      .obtener(this.getEmpresaId())
      .pipe(catchError(() => of(null)))
      .subscribe((config) => {
        if (config) {
          this.existeConfig.set(true);
          this.form.patchValue(this.normalizeConfig(config));
        }
        this.loading.set(false);
      });
  }

  guardar(): void {
    const payload = this.buildPayload();
    const request = this.existeConfig() ? this.configService.actualizar(payload) : this.configService.crear(payload);
    request.pipe(catchError(() => of(null))).subscribe();
  }

  private buildPayload(): ConfigComisionEmpresa {
    const raw = this.form.getRawValue();

    return {
      proceso: this.existeConfig() ? 2 : Number(raw.proceso ?? 0),
      aD14_EmpresaId: Number(raw.aD14_EmpresaId ?? this.getEmpresaId()),
      aD14_Activo: Boolean(raw.aD14_Activo),
      aD14_TipoCorte: String(raw.aD14_TipoCorte ?? '').trim(),
      aD14_DiaCorte: Number(raw.aD14_DiaCorte ?? 0),
      aD14_RequiereFacturaPagada: Boolean(raw.aD14_RequiereFacturaPagada),
      aD14_BaseCalculo: String(raw.aD14_BaseCalculo ?? '').trim(),
      aD14_IncluyeImpuestos: Boolean(raw.aD14_IncluyeImpuestos),
      aD14_PermiteLiquidacionParcial: Boolean(raw.aD14_PermiteLiquidacionParcial),
      aD14_MonedaBase: String(raw.aD14_MonedaBase ?? '').trim(),
      aD14_Operador: this.getOperador()
    };
  }

  private normalizeConfig(config: ConfigComisionEmpresa): ConfigComisionEmpresa {
    return {
      proceso: 2,
      aD14_EmpresaId: Number(config.aD14_EmpresaId ?? config['AD14_EmpresaId'] ?? this.getEmpresaId()),
      aD14_Activo: Boolean(config.aD14_Activo ?? config['AD14_Activo'] ?? true),
      aD14_TipoCorte: String(config.aD14_TipoCorte ?? config['AD14_TipoCorte'] ?? 'MENSUAL'),
      aD14_DiaCorte: Number(config.aD14_DiaCorte ?? config['AD14_DiaCorte'] ?? 30),
      aD14_RequiereFacturaPagada: Boolean(config.aD14_RequiereFacturaPagada ?? config['AD14_RequiereFacturaPagada'] ?? true),
      aD14_BaseCalculo: String(config.aD14_BaseCalculo ?? config['AD14_BaseCalculo'] ?? 'NETO'),
      aD14_IncluyeImpuestos: Boolean(config.aD14_IncluyeImpuestos ?? config['AD14_IncluyeImpuestos'] ?? false),
      aD14_PermiteLiquidacionParcial: Boolean(config.aD14_PermiteLiquidacionParcial ?? config['AD14_PermiteLiquidacionParcial'] ?? true),
      aD14_MonedaBase: String(config.aD14_MonedaBase ?? config['AD14_MonedaBase'] ?? 'USD'),
      aD14_Operador: this.getOperador()
    };
  }

  private getEmpresaId(): number {
    const unidad = this.empresaContext.getSnapshot()?.MA04_Unidad;
    const parsed = Number(unidad);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
  }
}
