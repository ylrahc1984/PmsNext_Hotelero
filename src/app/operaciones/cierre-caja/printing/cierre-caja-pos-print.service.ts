import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { QzPrintService } from 'src/app/core/services/qz-print.service';
import { CierreCajaService } from '../cierre-caja.service';
import { CierreCajaPosPrintBuilder } from './cierre-caja-pos-print.builder';

@Injectable({ providedIn: 'root' })
export class CierreCajaPosPrintService {
  private readonly cierreCajaService = inject(CierreCajaService);
  private readonly builder = inject(CierreCajaPosPrintBuilder);
  private readonly qzPrintService = inject(QzPrintService);

  async print(numCierre: string, printerName = 'TIQUETE'): Promise<void> {
    const normalized = String(numCierre ?? '').trim();
    if (!normalized) {
      throw new Error('No se pudo determinar el número de cierre que desea imprimir.');
    }

    const report = await firstValueFrom(this.cierreCajaService.getCierreCajaPos(normalized));
    if (!report.encabezado.numCierre) {
      throw new Error('El servidor no devolvió el encabezado del cierre de caja.');
    }

    await this.qzPrintService.printRaw(this.builder.build(report), printerName);
  }
}
