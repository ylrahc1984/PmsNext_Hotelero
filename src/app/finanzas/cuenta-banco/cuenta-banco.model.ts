export interface CuentaBanco {
  ctaBanco: string;
  codBanco: string;
  nombreCta: string;
  numeroCta?: string;
  moneda: string;
  ctaContable?: string;
  numCheque?: string;
  saldo?: number;
  fechaApe?: string;
  empresa: string;
  operador: string;
  saldoBanco?: number;
}
