import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timer } from 'rxjs';
import { retry } from 'rxjs/operators';

import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { QzPrintService } from 'src/app/core/services/qz-print.service';
import { RestaurantCollaboratorChargeService } from '../services/restaurant-collaborator-charge.service';
import { RestaurantCollaboratorChargePrintBuilder } from './restaurant-collaborator-charge-print.builder';

@Injectable({
  providedIn: 'root'
})
export class RestaurantCollaboratorChargePrintService {
  private readonly collaboratorChargeService = inject(RestaurantCollaboratorChargeService);
  private readonly printBuilder = inject(RestaurantCollaboratorChargePrintBuilder);
  private readonly qzPrintService = inject(QzPrintService);
  private readonly empresaContext = inject(EmpresaContextService);

  async printByOperation(
    tipoOperacion: string,
    numeroOperacion: string,
    printerName = 'TIQUETE',
    puntoVentaNombre = ''
  ): Promise<void> {
    const tipOpe = (tipoOperacion || '').trim();
    const numOpe = (numeroOperacion || '').trim();

    if (!tipOpe || !numOpe) {
      throw new Error('La respuesta no contiene la referencia del cargo necesaria para imprimir.');
    }

    const response = await firstValueFrom(
      this.collaboratorChargeService
        .consultarDetalle(tipOpe, numOpe)
        .pipe(
          retry({
            count: 2,
            delay: (_error, retryCount) => timer(retryCount * 500)
          })
        )
    );

    if ((response?.mensaje || '').trim().toUpperCase() !== 'OK') {
      throw new Error(response?.mensaje || 'No se pudo recuperar el detalle del cargo.');
    }

    const encabezado = response.encabezado?.[0];
    const detalles = (response.detalle || []).filter(
      (item) => Boolean((item.PPV11_NomProducto || item.PPV11_CodProducto || '').trim())
        && Number(item.PPV11_Cantidad) > 0
    );

    if (!encabezado) {
      throw new Error('El cargo fue guardado, pero su encabezado no está disponible para imprimir.');
    }
    if (!detalles.length) {
      throw new Error('El cargo fue guardado, pero no contiene líneas válidas para imprimir.');
    }

    const empresa = this.empresaContext.empresa();
    const commands = this.printBuilder.build({
      empresa: {
        nombre: (empresa?.MA04_Nombre || empresa?.MA04_RazonSocial || 'RESTAURANTE').trim(),
        ruc: empresa?.MA04_Ruc,
        direccion: empresa?.MA04_Direccion,
        telefono: empresa?.MA04_Telefono1
      },
      encabezado,
      detalles,
      puntoVentaNombre: puntoVentaNombre.trim() || encabezado.PPV10_PntVenta,
      fechaImpresion: new Date()
    });

    await this.qzPrintService.printRaw(commands, printerName);
  }
}
