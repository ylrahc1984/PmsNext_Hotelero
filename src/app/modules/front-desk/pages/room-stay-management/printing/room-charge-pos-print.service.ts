import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timer } from 'rxjs';
import { retry } from 'rxjs/operators';

import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { QzPrintService } from 'src/app/core/services/qz-print.service';
import { RoomStayManagementService } from '../services/room-stay-management.service';
import {
  RoomChargePosDocumentType,
  RoomChargePosPrintBuilder
} from './room-charge-pos-print.builder';

@Injectable({
  providedIn: 'root'
})
export class RoomChargePosPrintService {
  private readonly roomStayService = inject(RoomStayManagementService);
  private readonly printBuilder = inject(RoomChargePosPrintBuilder);
  private readonly qzPrintService = inject(QzPrintService);
  private readonly empresaContext = inject(EmpresaContextService);

  async printByOperation(
    tipoOperacion: string,
    numeroOperacion: string,
    printerName = 'TIQUETE',
    documentType: RoomChargePosDocumentType = 'ORIGINAL',
    puntoVentaNombre = ''
  ): Promise<void> {
    const tipCrgHab = (tipoOperacion || '').trim();
    const numCrgHab = (numeroOperacion || '').trim();

    if (!tipCrgHab || !numCrgHab) {
      throw new Error('El cargo no contiene el tipo y numero de operacion necesarios para imprimir.');
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
      throw new Error('El encabezado del cargo no esta disponible para imprimir.');
    }
    if (
      encabezado.tipCrgHab
      && encabezado.tipCrgHab.trim().toUpperCase() !== tipCrgHab.toUpperCase()
    ) {
      throw new Error('El detalle consultado no corresponde al tipo de cargo seleccionado.');
    }
    if (!detalles.length) {
      throw new Error('El cargo no contiene lineas validas para imprimir.');
    }

    const empresa = this.empresaContext.empresa();
    const commands = this.printBuilder.build({
      empresa: {
        nombre: (empresa?.MA04_Nombre || empresa?.MA04_RazonSocial || 'HOTEL').trim(),
        ruc: empresa?.MA04_Ruc,
        direccion: empresa?.MA04_Direccion,
        telefono: empresa?.MA04_Telefono1
      },
      encabezado,
      detalles,
      puntoVentaNombre: puntoVentaNombre.trim() || encabezado.pntVenta,
      tipoDocumento: documentType,
      fechaImpresion: new Date()
    });

    await this.qzPrintService.printRaw(commands, printerName);
  }
}
