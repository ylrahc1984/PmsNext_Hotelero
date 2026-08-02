import {
  RestaurantCollaboratorChargePrintBuilder,
  RestaurantCollaboratorChargePrintData
} from './restaurant-collaborator-charge-print.builder';

describe('RestaurantCollaboratorChargePrintBuilder', () => {
  it('prints quantities and descriptions with all voucher amounts at zero', () => {
    const builder = new RestaurantCollaboratorChargePrintBuilder();
    const receipt = builder.build(makePrintData()).join('');

    expect(receipt).toContain('2 x Almuerzo ejecutivo');
    expect(receipt).toContain('0.00 USD');
    expect(receipt).not.toContain('25.00 USD');
    expect(receipt).not.toContain('5.00 USD');
    expect(receipt).not.toContain('50.00 USD');
  });
});

function makePrintData(): RestaurantCollaboratorChargePrintData {
  return {
    empresa: { nombre: 'Restaurante' },
    encabezado: {
      PPV10_TipOpe: 'CC',
      PPV10_NumOpe: '1',
      PPV10_PntVenta: 'REST',
      PPV10_Fecha: '2026-08-01',
      PPV10_Hora: '12:00',
      PPV10_CodVendedor: '01',
      PPV10_CodCola: '100',
      PPV10_RucCola: '1-0000-0000',
      PPV10_NomColabora: 'Colaborador',
      PPV10_Direccion: '',
      PPV10_TotalDocu: 50,
      PPV10_EstDocu: 'PEN',
      PPV10_Moneda: 'USD',
      PPV10_TCambio: 1,
      PPV10_LPrecio: '01',
      PPV10_TipoNDP: 'NP',
      PPV10_SerieNDP: '001',
      PPV10_NumeroNDP: '1',
      PPV10_Operador: 'ADMIN'
    },
    detalles: [{
      PPV11_TipOpe: 'CC',
      PPV11_NumOpe: '1',
      PPV11_Grupo: '',
      PPV11_Categoria: '',
      PPV11_CodProducto: 'ALM-01',
      PPV11_NomProducto: 'Almuerzo ejecutivo',
      PPV11_UMedida: 'UND',
      PPV11_Cantidad: 2,
      PPV11_Precio: 25,
      PPV11_Descuento: 5,
      PPV11_PorDescu: 10,
      PPV11_Total: 50,
      PPV11_Almacen: null,
      PPV11_Moneda: 'USD',
      PPV11_TCambio: 1,
      PPV11_Orden: 1,
      PPV11_Operador: 'ADMIN'
    }],
    fechaImpresion: new Date(2026, 7, 1, 12, 0)
  };
}
