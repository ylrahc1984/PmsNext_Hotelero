import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timer } from 'rxjs';
import { retry } from 'rxjs/operators';

import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { QzPrintService } from 'src/app/core/services/qz-print.service';
import { RoomStayManagementService } from 'src/app/modules/front-desk/pages/room-stay-management/services/room-stay-management.service';
import {
  RestaurantRoomChargeDocumentType,
  RestaurantRoomChargePrintBuilder
} from './restaurant-room-charge-print.builder';

@Injectable({
  providedIn: 'root'
})
export class RestaurantRoomChargePrintService {
  private readonly roomStayService = inject(RoomStayManagementService);
  private readonly printBuilder = inject(RestaurantRoomChargePrintBuilder);
  private readonly qzPrintService = inject(QzPrintService);
  private readonly empresaContext = inject(EmpresaContextService);

  async printByOperation(
    tipoOperacion: string,
    numeroOperacion: string,
    printerName = 'TIQUETE',
    documentType: RestaurantRoomChargeDocumentType = 'ORIGINAL'
  ): Promise<void> {
    const tipCrgHab = (tipoOperacion || '').trim();
    const numCrgHab = (numeroOperacion || '').trim();

    if (!tipCrgHab || !numCrgHab) {
      throw new Error('La respuesta no contiene la referencia del cargo necesaria para imprimir.');
    }

    const response = await firstValueFrom(
      this.roomStayService
        .getRoomChargeDetailByNumber(numCrgHab)
        .pipe(
          retry({
            count: 2,
            delay: (_error, retryCount) => timer(retryCount * 500)
          })
        )
    );

    const encabezado = response?.encabezado;
    const detalles = (response?.detalles || []).filter(
      (item) => Boolean((item.nomConsumo || item.codConsumo || '').trim())
        && Number(item.cantidad) > 0
    );

    if (!encabezado?.numCrgHab) {
      throw new Error('El cargo fue guardado, pero su encabezado no está disponible para imprimir.');
    }
    if (
      encabezado.tipCrgHab
      && encabezado.tipCrgHab.trim().toUpperCase() !== tipCrgHab.toUpperCase()
    ) {
      throw new Error('El detalle consultado no corresponde al tipo de cargo generado.');
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
      tipoDocumento: documentType,
      fechaImpresion: new Date()
    });

    await this.qzPrintService.printRaw(commands, printerName);
  }
}
