import { GuardarReservaContactoRequest } from '../models/reserva-contacto.model';

export interface ReservaContactoFormValue {
  nombre: string;
  email: string;
  telefono: string;
}

export class ReservaContactoMapper {
  static toRequest(value: ReservaContactoFormValue): GuardarReservaContactoRequest {
    const nombre = value.nombre.trim();
    const email = value.email.trim();
    const telefono = value.telefono.trim();
    return {
      nombre,
      email: email || null,
      telefono: telefono || null
    };
  }
}
