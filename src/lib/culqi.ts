/**
 * Culqi payment integration.
 *
 * REQUIRED ENVIRONMENT VARIABLES (set in Vercel project settings):
 *   CULQI_PUBLIC_KEY      → pk_test_xxx / pk_live_xxx (used in client-side checkout)
 *   CULQI_SECRET_KEY      → sk_test_xxx / sk_live_xxx (used in server-side charge)
 *   CULQI_ENV             → 'test' | 'production' (default: 'test')
 *
 * Docs: https://docs.culqi.com/
 * - Checkout v4 (client-side tokenization)
 * - Charges API (server-side)
 *
 * This file is a thin wrapper. The actual Culqi SDK is loaded dynamically
 * by /api/culqi/charge (server-side) and via <script src="..."> in the
 * PaymentModal (client-side).
 */

export const CULQI_PUBLIC_KEY = (import.meta as any).env?.PUBLIC_CULQI_PUBLIC_KEY || '';
export const CULQI_ENV = (import.meta as any).env?.PUBLIC_CULQI_ENV || 'test';

export const CULQI_SCRIPT_SRC =
  CULQI_ENV === 'production'
    ? 'https://checkout.culqi.com/js/v4/index.js'
    : 'https://checkout.culqi.com/js/v4/index.js'; // same URL, env is by key

export interface CulqiChargePayload {
  amount: number;          // in céntimos (PEN cents). S/ 24.00 → 2400
  currency: string;         // 'PEN'
  email: string;
  sourceId: string;         // token from Culqi Checkout v4
  description: string;
  metadata?: Record<string, string | number>;
  antifraud?: {
    firstName?: string;
    lastName?: string;
    address?: string;
    addressCity?: string;
    countryCode?: string;
    phone?: string;
  };
}

export interface CulqiChargeResult {
  id: string;
  object: 'charge';
  amount: number;
  currency: string;
  email: string;
  status: 'paid' | 'pending' | 'rejected' | 'refunded';
  reference_code?: string;
  outcome?: {
    type: 'sale' | 'refund' | 'void';
    code?: string;
  };
  created_at: number;
}

export interface CulqiErrorResult {
  user_message: string;
  merchant_message: string;
  type: 'CARD_ERROR' | 'VALIDATION_ERROR' | 'AUTHENTICATION_ERROR' | 'API_ERROR';
  code: string;
}

export function isCulqiConfigured(): boolean {
  return !!CULQI_PUBLIC_KEY;
}

export function formatAmountToCents(amountInSoles: number): number {
  return Math.round(amountInSoles * 100);
}
