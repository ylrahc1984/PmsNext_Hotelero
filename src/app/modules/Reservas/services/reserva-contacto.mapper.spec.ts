import { ReservaContactoMapper } from './reserva-contacto.mapper';

describe('ReservaContactoMapper', () => {
  it('trims all contact values', () => {
    expect(ReservaContactoMapper.toRequest({
      nombre: '  Charly Quispe  ',
      email: '  charly@gmail.com ',
      telefono: '  +506 8711-8639  '
    })).toEqual({
      nombre: 'Charly Quispe',
      email: 'charly@gmail.com',
      telefono: '+506 8711-8639'
    });
  });

  it('maps blank optional values to null', () => {
    expect(ReservaContactoMapper.toRequest({
      nombre: 'Contacto',
      email: '   ',
      telefono: ''
    })).toEqual({
      nombre: 'Contacto',
      email: null,
      telefono: null
    });
  });
});
