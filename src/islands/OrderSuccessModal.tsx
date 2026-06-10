import { createSignal } from 'solid-js';

interface OrderData {
  orderId: string;
  total: number;
}

interface Props {
  onClose: () => void;
}

function loadOrderData(): OrderData {
  const stored =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('puka-last-order')
      : null;
  if (stored) {
    try {
      return JSON.parse(stored) as OrderData;
    } catch {
      return { orderId: `PK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`, total: 0 };
    }
  }
  return { orderId: `PK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`, total: 0 };
}

export default function OrderSuccessModal(props: Props) {
  const [orderData] = createSignal<OrderData>(loadOrderData());

  return (
    <div class="fixed inset-0 z-50 bg-brand-dark/80 backdrop-blur-md flex items-center justify-center p-4">
      <div class="bg-brand-secondary rounded-3xl p-6 sm:p-10 max-w-md w-full border border-brand-primary/10 shadow-2xl relative space-y-6">
        <button
          onClick={props.onClose}
          class="absolute top-4 right-4 text-brand-dark/50 hover:text-brand-dark focus:outline-none"
          aria-label="Cerrar"
        >
          <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
          </svg>
        </button>

        <div class="text-center space-y-3">
          <div class="w-16 h-16 bg-brand-success/15 rounded-full flex items-center justify-center text-brand-success mx-auto">
            <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <h4 class="font-serif text-2xl font-bold text-brand-primary">¡Transacción Iniciada de Forma Segura!</h4>
          <p class="text-sm text-brand-dark/70">
            Tu carrito de compras ha sido procesado correctamente con nuestra plataforma contra entrega integrada.
          </p>
        </div>

        <div class="bg-brand-light p-4 rounded-2xl border border-brand-primary/10 text-xs space-y-2">
          <div class="flex justify-between">
            <span class="text-brand-dark/60">N° de Operación</span>
            <span class="font-bold text-brand-dark font-mono">{orderData().orderId}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-brand-dark/60">Monto Final</span>
            <span class="font-bold text-brand-accent text-sm">S/ {orderData().total.toFixed(2)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-brand-dark/60">Método de Envío</span>
            <span class="font-bold text-brand-dark">Envío Express (Gratis)</span>
          </div>
        </div>

        <div class="space-y-2">
          <p class="text-[10px] text-brand-dark/50 text-center uppercase tracking-wider font-semibold">
            Te contactaremos de inmediato por WhatsApp
          </p>
          <button
            onClick={props.onClose}
            class="w-full py-3.5 bg-brand-primary hover:bg-brand-accent text-brand-light font-bold text-xs uppercase tracking-widest rounded-xl transition-colors duration-200"
          >
            Entendido, gracias ⚡
          </button>
        </div>
      </div>
    </div>
  );
}
