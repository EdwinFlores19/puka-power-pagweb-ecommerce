import type { Product } from './types';

export const CATALOG: Record<number, Product> = {
  1: {
    id: 1,
    name: 'Reto Puka - 3 Días',
    price: 24.00,
    description: '3 latas de energía constante. Ideal para probar el poder natural.',
    unitLabel: 'S/ 8.00 por lata',
  },
  2: {
    id: 2,
    name: 'Six Pack Poder',
    price: 43.20,
    originalPrice: 48.00,
    description: '6 latas para un máximo enfoque toda la semana.',
    badge: '10% DESCUENTO - Más Vendido',
    unitLabel: 'Ahorras S/ 4.80',
  },
  3: {
    id: 3,
    name: 'Suscripción Mensual',
    price: 153.60,
    originalPrice: 192.00,
    description: '24 latas mensuales + Envío Gratis. Nunca te quedes sin energía.',
    badge: '20% DSCTO + ENVÍO GRATIS',
    unitLabel: 'Ahorras S/ 38.40',
  },
} as const;

export const PRICE_MAP: Record<number, number> = {
  1: 24.00,
  2: 43.20,
  3: 153.60,
} as const;

export const VALID_COUPON = {
  code: 'BOLT15',
  discountPercent: 0.15,
} as const;
