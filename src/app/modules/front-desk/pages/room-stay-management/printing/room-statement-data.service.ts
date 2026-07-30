import { Injectable, inject } from '@angular/core';
import { firstValueFrom, forkJoin, of } from 'rxjs';

import { AuthService } from 'src/app/core/services/auth.service';
import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import {
  FolioMasterChargeDetail,
  FolioMasterChargeLine
} from '../../folio-master/models/folio-master-charge.model';
import { FolioMasterChargeService } from '../../folio-master/services/folio-master-charge.service';
import {
  RoomStayApiCharge,
  RoomStayApiData,
  RoomStayManagementService
} from '../services/room-stay-management.service';
import {
  RoomStatementBucket,
  RoomStatementCharge,
  RoomStatementData,
  RoomStatementLine,
  RoomStatementTotals
} from './room-statement.model';

interface StatementChargeReference {
  bucket: RoomStatementBucket;
  type: string;
  number: string;
  source: RoomStayApiCharge;
}

@Injectable({ providedIn: 'root' })
export class RoomStatementDataService {
  private readonly roomStayService = inject(RoomStayManagementService);
  private readonly chargeService = inject(FolioMasterChargeService);
  private readonly operationalDateService = inject(OperationalDateService);
  private readonly authService = inject(AuthService);

  async load(roomNumber: string, reservationNumber = ''): Promise<RoomStatementData> {
    const normalizedRoom = this.text(roomNumber);
    if (!normalizedRoom) {
      throw new Error('No se indicó la habitación para generar el Estado de Cuenta.');
    }

    const operationalDate = normalizePmsDateDDMMYYYY(
      this.operationalDateService.operationalDate()
    );
    if (!operationalDate) {
      throw new Error('No hay una fecha operativa válida para generar el Estado de Cuenta.');
    }

    const stay = await firstValueFrom(
      this.roomStayService.getRoomStay(normalizedRoom, this.text(reservationNumber))
    );
    if (!stay) {
      throw new Error('No se encontró una estancia vigente para generar el Estado de Cuenta.');
    }

    const references = this.buildReferences(stay);
    const details = references.length
      ? await firstValueFrom(
          forkJoin(
            references.map((reference) =>
              this.chargeService.getDetail(reference.type, reference.number)
            )
          )
        )
      : await firstValueFrom(of([] as FolioMasterChargeDetail[]));

    const charges = references
      .map((reference, index) => this.mapCharge(reference, details[index]))
      .filter((charge): charge is RoomStatementCharge => charge !== null);
    const lodgingCharges = charges.filter((charge) => charge.bucket === 'lodging');
    const extraCharges = charges.filter((charge) => charge.bucket === 'extras');

    return {
      roomNumber: this.text(stay.numHabita) || normalizedRoom,
      reservationNumber: this.text(stay.codReserva),
      masterFolio: this.text(stay.folio),
      agency: this.text(stay.nombreAgencia || stay.codAgencia),
      plan: this.text(stay.codPlan),
      checkIn: normalizePmsDateDDMMYYYY(stay.fechaIng),
      checkOut: normalizePmsDateDDMMYYYY(stay.fechaSal),
      guests: (stay.roomingList || [])
        .map((guest) => [guest.nombre, guest.apellidos].map((value) => this.text(value)).filter(Boolean).join(' '))
        .filter(Boolean),
      currency: 'USD',
      operationalDate,
      generatedAt: new Date(),
      operator: this.currentOperator(stay),
      charges,
      lodgingTotals: this.calculateTotals(lodgingCharges),
      extraTotals: this.calculateTotals(extraCharges),
      totals: this.calculateTotals(charges)
    };
  }

  private buildReferences(stay: RoomStayApiData): StatementChargeReference[] {
    const references = [
      ...(stay.cargosFolioMaster || []).map((source) => this.reference('lodging', source)),
      ...(stay.cargosExtras || []).map((source) => this.reference('extras', source))
    ].filter((reference): reference is StatementChargeReference => reference !== null);

    return [
      ...new Map(
        references.map((reference) => [
          `${reference.type.toUpperCase()}|${reference.number}`,
          reference
        ])
      ).values()
    ];
  }

  private reference(
    bucket: RoomStatementBucket,
    source: RoomStayApiCharge
  ): StatementChargeReference | null {
    const number = this.text(source.numCrgHab || source.folio);
    if (!number) {
      return null;
    }

    return {
      bucket,
      type: this.text(source.tipCrgHab || source.tipoCrgHab || source.tipCargo) || 'CHB',
      number,
      source
    };
  }

  private mapCharge(
    reference: StatementChargeReference,
    detail: FolioMasterChargeDetail | undefined
  ): RoomStatementCharge | null {
    const header = detail?.encabezado;
    const state = this.text(header?.estado ?? reference.source.estado).toUpperCase();

    if (state === '1' || state === 'ANU' || state === 'ANULADO') {
      return null;
    }

    const lines = (detail?.detalles || [])
      .filter((line) => this.isActiveLine(line))
      .map((line, index) => this.mapLine(line, index));

    if (!lines.length) {
      throw new Error(`El cargo ${reference.number} no contiene detalle válido para el Estado de Cuenta.`);
    }

    return {
      bucket: reference.bucket,
      type: this.text(header?.tipCrgHab) || reference.type,
      number: this.text(header?.numCrgHab) || reference.number,
      date: normalizePmsDateDDMMYYYY(header?.fecha || reference.source.fecCargo),
      time: this.text(header?.hora || reference.source.horaCargo),
      pointOfSale: this.text(header?.pntVenta || reference.source.pntVenta),
      guestName: this.text(header?.nombrePax || reference.source.nombreHuesped),
      currency: 'USD',
      total: this.round(
        this.number(header?.mtoTot) || lines.reduce((sum, line) => sum + line.total, 0)
      ),
      lines
    };
  }

  private isActiveLine(line: FolioMasterChargeLine): boolean {
    const state = this.text(line.estado).toUpperCase();
    return state !== '1' && state !== 'ANU' && state !== 'ANULADO'
      && Boolean(this.text(line.nomConsumo || line.codConsumo))
      && this.number(line.cantidad) > 0;
  }

  private mapLine(line: FolioMasterChargeLine, index: number): RoomStatementLine {
    const discount = this.round(this.number(line.descuento));
    const taxes = this.round(this.number(line.impuestos));
    const total = this.round(this.number(line.total));
    const net = this.round(
      this.number(line.precioSinImpNeto)
      || Math.max(total - taxes, 0)
    );
    const subtotal = this.round(
      this.number(line.subTotal)
      || net + discount
    );

    return {
      order: this.number(line.orden) || index + 1,
      quantity: this.number(line.cantidad),
      code: this.text(line.codConsumo),
      description: this.text(line.nomConsumo || line.codConsumo) || `Cargo ${index + 1}`,
      subtotal,
      discount,
      net,
      taxes,
      total,
      currency: 'USD',
      comment: this.meaningfulComment(line.comentario)
    };
  }

  private calculateTotals(charges: RoomStatementCharge[]): RoomStatementTotals {
    const lines = charges.flatMap((charge) => charge.lines);

    return {
      subtotal: this.round(lines.reduce((sum, line) => sum + line.subtotal, 0)),
      discount: this.round(lines.reduce((sum, line) => sum + line.discount, 0)),
      net: this.round(lines.reduce((sum, line) => sum + line.net, 0)),
      taxes: this.round(lines.reduce((sum, line) => sum + line.taxes, 0)),
      total: this.round(charges.reduce((sum, charge) => sum + charge.total, 0))
    };
  }

  private currentOperator(stay: RoomStayApiData): string {
    const user = this.authService.getCurrentUser();
    return this.text(
      user?.usuario
      || user?.nombre
      || stay.roomingList?.[0]?.operador
      || stay.cargosFolioMaster?.[0]?.operador
      || stay.cargosExtras?.[0]?.operador
      || 'SISTEMA'
    );
  }

  private meaningfulComment(value: unknown): string {
    const comment = this.text(value);
    const normalized = comment.toUpperCase();
    return !comment || normalized === 'SIN COMENTARIO' || normalized === 'N/A' || normalized === 'N/D'
      ? ''
      : comment;
  }

  private text(value: unknown): string {
    return (value ?? '').toString().trim();
  }

  private number(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
