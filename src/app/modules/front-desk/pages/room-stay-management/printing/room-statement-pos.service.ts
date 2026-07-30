import { Injectable, inject } from '@angular/core';

import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { QzPrintService } from 'src/app/core/services/qz-print.service';
import { RoomStatementDataService } from './room-statement-data.service';
import { RoomStatementPosBuilder } from './room-statement-pos.builder';

@Injectable({ providedIn: 'root' })
export class RoomStatementPosService {
  private readonly dataService = inject(RoomStatementDataService);
  private readonly builder = inject(RoomStatementPosBuilder);
  private readonly qzPrintService = inject(QzPrintService);
  private readonly empresaContext = inject(EmpresaContextService);

  async print(
    roomNumber: string,
    reservationNumber = '',
    printerName = 'TIQUETE'
  ): Promise<void> {
    const statement = await this.dataService.load(roomNumber, reservationNumber);
    const company = this.empresaContext.empresa();
    const commands = this.builder.build({
      company: {
        name: (company?.MA04_Nombre || company?.MA04_RazonSocial || 'HOTEL').trim(),
        ruc: company?.MA04_Ruc,
        address: company?.MA04_Direccion,
        phone: company?.MA04_Telefono1
      },
      statement
    });

    await this.qzPrintService.printRaw(commands, printerName);
  }
}
