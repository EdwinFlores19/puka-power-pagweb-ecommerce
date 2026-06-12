import { createSignal, Show } from 'solid-js';
import { useStore } from '@nanostores/solid';
import {
  $cart,
  $subtotal,
  $totalQty,
  $total,
  $discount,
  $coupon,
  addItemToCart,
  decrementItemInCart,
  removeFromCart,
  clearCart,
  clearCoupon,
} from '@/store/cartStore';
import PaymentModal from './PaymentModal';

export default function CartSidebar() {
  const cart = useStore($cart);
  const subtotal = useStore($subtotal);
  const totalQty = useStore($totalQty);
  const total = useStore($total);
  const discount = useStore($discount);
  const coupon = useStore($coupon);
  const [showModal, setShowModal] = createSignal(false);
  const [orderData, setOrderData] = createSignal({ orderId: '', total: 0, items: [] as { id: number; qty: number }[], couponApplied: '' });
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [checkoutError, setCheckoutError] = createSignal('');

  const handleCheckout = async () => {
    if (cart().length === 0) return;
    setIsProcessing(true);
    setCheckoutError('');

    try {
      const payload = {
        items: cart().map((item) => ({ id: item.id, qty: item.qty })),
        couponCode: coupon().applied ? coupon().code : undefined,
      };

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setCheckoutError(
          result.error || 'Error al procesar el pago. Intenta de nuevo.',
        );
        return;
      }

      setOrderData({
        orderId: result.orderId,
        total: result.total,
        items: payload.items,
        couponApplied: result.couponApplied || '',
      });

      setShowModal(true);
    } catch {
      setCheckoutError(
        'Error de conexión. Verifica tu internet e intenta de nuevo.',
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    clearCart();
    clearCoupon();
  };

  return (
    <>
      <div class="bg-brand-light rounded-3xl p-6 sm:p-8 shadow-xl border border-brand-primary/10 space-y-6">
        <div class="flex justify-between items-center border-b border-brand-primary/5 pb-4">
          <h3 class="font-serif text-2xl font-black text-brand-primary flex items-center">
            <svg class="w-6 h-6 mr-3 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2z"/>
            </svg>
            Resumen de tu Pedido
          </h3>
          <Show when={cart().length > 0}>
            <button
              onClick={clearCart}
              class="text-xs font-bold text-brand-accent hover:underline focus:outline-none flex items-center space-x-1"
              aria-label="Vaciar carrito"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              <span>Vaciar</span>
            </button>
          </Show>
        </div>

        <div class="space-y-4 max-h-[250px] overflow-y-auto scrollbar-hidden pr-1">
          <Show when={cart().length > 0} fallback={
            <div class="py-8 text-center space-y-4">
              <svg class="w-16 h-16 mx-auto text-brand-dark/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"/>
              </svg>
              <div>
                <p class="text-sm font-bold text-brand-dark/60">Tu carrito está vacío</p>
                <p class="text-xs text-brand-dark/40 mt-1">¡Elige tu pack de energía ideal y prepárate para el poder del rayo!</p>
              </div>
              <a
                href="#productos"
                class="inline-block px-6 py-3 bg-brand-accent hover:bg-brand-accentGold text-brand-light font-bold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 shadow-md"
              >
                Explorar productos
              </a>
            </div>
          }>
            {cart().map((item) => (
              <div class="flex items-center justify-between gap-4 p-3.5 bg-brand-secondary rounded-2xl border border-brand-primary/5 transition-all duration-300">
                <div class="space-y-1 flex-grow min-w-0">
                  <h4 class="font-bold text-sm text-brand-primary leading-tight truncate">{item.name}</h4>
                  <p class="text-[10px] text-brand-dark/60 font-light truncate max-w-[160px]">{item.description}</p>
                  <div class="font-sans font-extrabold text-brand-accent text-xs">
                    S/ {(item.price * item.qty).toFixed(2)}
                  </div>
                </div>

                <div class="flex items-center space-x-2.5 shrink-0">
                  <div class="flex items-center bg-brand-light rounded-lg border border-brand-primary/15 overflow-hidden">
                    <button
                      onClick={() => decrementItemInCart(item.id)}
                      class="px-2 py-1 text-xs font-bold text-brand-dark/60 hover:bg-brand-primary/5 hover:text-brand-primary transition-colors focus:outline-none"
                      aria-label={`Reducir cantidad de ${item.name}`}
                    >
                      -
                    </button>
                    <span class="px-2 py-1 text-xs font-bold text-brand-dark select-none min-w-[20px] text-center">{item.qty}</span>
                    <button
                      onClick={() => addItemToCart(item.id)}
                      class="px-2 py-1 text-xs font-bold text-brand-dark/60 hover:bg-brand-primary/5 hover:text-brand-primary transition-colors focus:outline-none"
                      aria-label={`Aumentar cantidad de ${item.name}`}
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    class="text-brand-dark/40 hover:text-brand-accent transition-colors duration-200 focus:outline-none"
                    aria-label={`Eliminar ${item.name} del carrito`}
                  >
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </Show>
        </div>

        <Show when={cart().length > 0}>
          <div class="border-t border-brand-primary/10 pt-4 space-y-4">
            <div class="space-y-1.5">
               <Show when={coupon().applied}>
                <div class="space-y-1.5">
                  <p class="text-xs font-bold text-brand-success flex items-center space-x-1">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                    <span>¡Descuento por juego aplicado! 15% OFF.</span>
                  </p>
                </div>
              </Show>
              <Show when={!coupon().applied}>
                <div class="bg-gradient-to-br from-brand-accent/5 to-brand-primary/5 rounded-2xl border border-brand-accent/15 p-4">
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-brand-accent/10 flex items-center justify-center shrink-0 text-lg">🎮</div>
                    <div class="space-y-1 min-w-0">
                      <p class="text-xs font-black uppercase tracking-wider text-brand-primary">¿Quieres 15% de descuento?</p>
                      <p class="text-[10px] text-brand-dark/60 leading-relaxed">
                        Juega nuestro arcade Ninja, completa los 3 niveles y desbloquea un descuento exclusivo. ¡El poder del rayo te espera!
                      </p>
                      <a
                        href="/juego"
                        class="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1.5 bg-brand-accent hover:bg-brand-accentGold text-brand-light font-extrabold text-[10px] uppercase tracking-widest rounded-lg transition-all duration-200 shadow-md"
                      >
                        <span>Jugar ahora</span>
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 5l7 7-7 7"/>
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              </Show>
            </div>

            <div class="space-y-2.5 pt-2">
              <div class="flex justify-between text-sm text-brand-dark/80">
                <span>Subtotal ({totalQty()} {totalQty() === 1 ? 'producto' : 'productos'})</span>
                <span class="font-bold">S/ {subtotal().toFixed(2)}</span>
              </div>

              <Show when={coupon().applied}>
                <div class="flex justify-between text-sm text-brand-success">
                  <span>Descuento (15%)</span>
                  <span class="font-bold">- S/ {discount().toFixed(2)}</span>
                </div>
              </Show>

              <div class="flex justify-between text-sm text-brand-dark/80">
                <span>Costo de Envío</span>
                <span class="font-bold text-brand-success">¡GRATIS!</span>
              </div>

              <div class="flex justify-between items-center pt-3 border-t border-brand-primary/15">
                <span class="font-serif text-lg font-bold text-brand-primary">Total a Pagar</span>
                <span class="font-sans text-3xl font-extrabold text-brand-accent">S/ {total().toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div class="pt-2">
            <button
              onClick={handleCheckout}
              disabled={cart().length === 0 || isProcessing()}
              class="w-full py-4 bg-brand-accent hover:bg-brand-accentGold disabled:bg-brand-dark/30 disabled:cursor-not-allowed text-brand-light font-extrabold text-sm uppercase tracking-widest rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 shadow-xl shadow-brand-accent/20 flex items-center justify-center space-x-2"
              aria-label="Proceder al pago seguro"
            >
              <Show when={isProcessing()} fallback={
                <>
                  <span>Proceder al Pago Seguro</span>
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                </>
              }>
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Procesando...</span>
              </Show>
            </button>
            <Show when={checkoutError()}>
              <p class="mt-2 text-xs font-bold text-brand-accent text-center">{checkoutError()}</p>
            </Show>
          </div>
        </Show>

        <div class="pt-4 border-t border-brand-primary/5 flex justify-center text-center">
          <div class="flex items-center space-x-2 text-brand-dark/60 text-xs">
            <svg class="w-4 h-4 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2-1m9 1h3a1 1 0 001-1v-4a1 1 0 00-.293-.707l-5-5A1 1 0 0012.586 5H11"/>
            </svg>
            <span>Envío a todo el Perú</span>
          </div>
        </div>
      </div>

      <Show when={showModal()}>
        <PaymentModal
          orderId={orderData().orderId}
          total={orderData().total}
          items={orderData().items}
          couponApplied={orderData().couponApplied}
          onClose={handleCloseModal}
        />
      </Show>

      <style>{`
        .scrollbar-hidden::-webkit-scrollbar { display: none; }
        .scrollbar-hidden { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  );
}
