import { createSignal, Show, onMount } from 'solid-js';
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
  refreshCouponFromServer,
} from '@/store/cartStore';
import { saveOrder, getCustomerPrefill } from '@/store/ordersStore';
import type { CustomerInfo, OrderRecord } from '@/lib/types';
import { trackBeginCheckout, trackPurchase } from '@/lib/analytics';
import PaymentModal from './PaymentModal';

// Ubigeo Perú — los más comunes (departamento → provincias → distritos)
const UBIGEO: Record<string, Record<string, string[]>> = {
  'Lima': {
    'Lima': ['Miraflores', 'San Isidro', 'Surco', 'La Molina', 'San Borja', 'Surquillo', 'Barranco', 'Chorrillos', 'San Miguel', 'Pueblo Libre', 'Jesús María', 'Lince', 'Magdalena', 'San Luis', 'Ate', 'Cercado de Lima', 'Comas', 'Independencia', 'Los Olivos', 'San Martín de Porres', 'Rimac'],
    'Callao': ['Callao', 'Bellavista', 'Carmen de la Legua', 'La Perla', 'La Punta', 'Ventanilla', 'Mi Perú'],
  },
  'Arequipa': {
    'Arequipa': ['Arequipa', 'Cayma', 'Cerro Colorado', 'Jacobo Hunter', 'Mariano Melgar', 'Miraflores', 'Paucarpata', 'Sabandía', 'Socabaya', 'Tiabaya', 'Yanahuara', 'José Luis Bustamante y Rivero'],
  },
  'La Libertad': {
    'Trujillo': ['Trujillo', 'La Esperanza', 'Florencia de Mora', 'Huanchaco', 'Larco Herrera', 'El Porvenir', 'Víctor Larco Herrera', 'Moche', 'Salaverry'],
  },
  'Cusco': {
    'Cusco': ['Cusco', 'San Sebastián', 'San Jerónimo', 'Wanchaq', 'Santiago'],
  },
};

type CheckoutStep = 'cart' | 'customer' | 'review';

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

  // Multi-step checkout state
  const [step, setStep] = createSignal<CheckoutStep>('cart');
  const [customer, setCustomer] = createSignal<CustomerInfo>({
    name: '', email: '', phone: '', dni: '', address: '',
    department: 'Lima', province: 'Lima', district: '',
  });
  const [customerErrors, setCustomerErrors] = createSignal<Record<string, string>>({});
  // True while we're waiting for the server to confirm the won-cookie.
  // While true, we show a "Verificando descuento..." skeleton instead of
  // the "¿Quieres 15%?" prompt (avoids the flash of wrong state).
  const [isVerifyingCoupon, setIsVerifyingCoupon] = createSignal(true);

  // Restore draft on mount
  onMount(() => {
    // Refresh coupon from server (in case user just won). The server is
    // the source of truth — we wait for the response before showing the
    // "verifying" or the "applied" state.
    setIsVerifyingCoupon(true);
    refreshCouponFromServer()
      .finally(() => setIsVerifyingCoupon(false));

    // Restore customer draft
    try {
      const draft = localStorage.getItem('puka_customer_draft');
      if (draft) {
        const parsed = JSON.parse(draft);
        setCustomer((prev) => ({ ...prev, ...parsed }));
      } else {
        // No draft yet: try to prefill from a previous order for the last known email
        const lastEmail = localStorage.getItem('puka_last_customer_email');
        if (lastEmail) {
          const prefill = getCustomerPrefill(lastEmail);
          if (prefill) setCustomer(prefill);
        }
      }
    } catch { /* noop */ }

    // Migrate local orders to the server-side user account (if signed in).
    // This runs once per session: it checks if the user has any local
    // orders that haven't been migrated yet, sends them to the server,
    // and clears the local copy.
    void migrateLocalOrders();
  });

  /**
   * Send any localStorage orders to the server so they appear in the
   * signed-in user's Mi Cuenta. After a successful migration, the
   * local copy is cleared.
   */
  const migrateLocalOrders = async () => {
    try {
      // Only run if signed in
      const meRes = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!meRes.ok) return;
      const meData = await meRes.json();
      if (!meData.user) return;

      // Read local orders
      const raw = localStorage.getItem('puka_orders');
      if (!raw) return;
      const localOrders = JSON.parse(raw);
      if (!Array.isArray(localOrders) || localOrders.length === 0) return;

      // Send to server
      const res = await fetch('/api/auth/migrate-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ orders: localOrders }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Clear local copy so we don't double-migrate
        localStorage.removeItem('puka_orders');
        console.log('[cart] Migrated', data.migrated, 'orders to user account');
      }
    } catch (e) {
      // Silent — not critical
    }
  };

  // Persist customer draft on every change
  const updateCustomerField = (field: keyof CustomerInfo, value: string) => {
    setCustomer((prev) => {
      const next = { ...prev, [field]: value };
      try { localStorage.setItem('puka_customer_draft', JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
    // Clear error for the field
    setCustomerErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _drop, ...rest } = prev;
      return rest;
    });
  };

  const validateCustomer = (): boolean => {
    const c = customer();
    const errs: Record<string, string> = {};
    if (!c.name.trim() || c.name.trim().length < 3) errs.name = 'Ingresa tu nombre completo';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) errs.email = 'Email inválido';
    if (!/^9[0-9]{8}$/.test(c.phone)) errs.phone = 'Celular debe empezar con 9 y tener 9 dígitos';
    if (!/^\d{8}$|^\d{11}$/.test(c.dni)) errs.dni = 'DNI (8 dígitos) o RUC (11 dígitos)';
    if (!c.address.trim() || c.address.trim().length < 5) errs.address = 'Dirección completa';
    if (!c.department) errs.department = 'Selecciona un departamento';
    if (!c.province) errs.province = 'Selecciona una provincia';
    if (!c.district) errs.district = 'Selecciona un distrito';
    setCustomerErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goToCustomerStep = () => {
    setStep('customer');
    setCheckoutError('');
    // E-commerce funnel: begin_checkout
    try { trackBeginCheckout(total(), totalQty()); } catch { /* noop */ }
  };

  const goToReviewStep = () => {
    if (!validateCustomer()) {
      setCheckoutError('Por favor completa todos los campos correctamente');
      return;
    }
    setStep('review');
    setCheckoutError('');
  };

  const backToCart = () => {
    setStep('cart');
    setCheckoutError('');
  };

  const backToCustomer = () => {
    setStep('customer');
    setCheckoutError('');
  };

  const handleCheckout = async () => {
    if (cart().length === 0) return;
    if (!validateCustomer()) {
      setStep('customer');
      return;
    }
    setIsProcessing(true);
    setCheckoutError('');

    try {
      const c = customer();
      const payload = {
        items: cart().map((item) => ({ id: item.id, qty: item.qty })),
        couponCode: coupon().applied ? coupon().code : undefined,
        customer: {
          name: c.name.trim(),
          email: c.email.trim().toLowerCase(),
          phone: c.phone.trim(),
          dni: c.dni.trim(),
          address: c.address.trim(),
          department: c.department,
          province: c.province,
          district: c.district,
        },
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
        setIsProcessing(false);
        return;
      }

      setOrderData({
        orderId: result.orderId,
        total: result.total,
        items: payload.items,
        couponApplied: result.couponApplied || '',
      });

      // Persist customer email for future pre-fills (Mi cuenta)
      try { localStorage.setItem('puka_last_customer_email', c.email); } catch { /* noop */ }

      // Save the order to local storage (so Mi Cuenta can show it)
      try {
        const orderRecord: OrderRecord = {
          orderId: result.orderId,
          customerId: 'cust_' + Date.now().toString(36),
          customer: c,
          items: payload.items.map((it) => {
            const found = cart().find((ci) => ci.id === it.id);
            return { ...it, name: found?.name, price: found?.price };
          }),
          subtotal: subtotal(),
          discount: discount(),
          total: total(),
          couponApplied: result.couponApplied || '',
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        saveOrder(orderRecord);
      } catch (e) {
        console.error('Failed to save order locally:', e);
      }

      // E-commerce funnel: purchase
      try {
        trackPurchase(
          result.orderId,
          result.total,
          payload.items.map((it) => {
            const found = cart().find((ci) => ci.id === it.id);
            return {
              id: it.id,
              name: found?.name || ('Producto #' + it.id),
              price: found?.price ?? 0,
              quantity: it.qty,
            };
          }),
        );
      } catch { /* noop */ }

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
    try { localStorage.removeItem('puka_customer_draft'); } catch { /* noop */ }
    setStep('cart');
  };

  // Compute provinces and districts for the cascade
  const provinces = (): string[] => Object.keys(UBIGEO[customer().department] || {});
  const districts = (): string[] => {
    const d = customer().department;
    const p = customer().province;
    return UBIGEO[d]?.[p] || [];
  };

  return (
    <>
      <div class="bg-brand-light rounded-3xl p-6 sm:p-8 shadow-xl border border-brand-primary/10 space-y-6">
        <div class="flex justify-between items-center border-b border-brand-primary/5 pb-4">
          <h3 class="font-serif text-2xl font-black text-brand-primary flex items-center">
            <svg class="w-6 h-6 mr-3 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2z"/>
            </svg>
            <Show when={step() === 'cart'} fallback={step() === 'customer' ? 'Datos de Envío' : 'Revisar Pedido'}>
              Resumen de tu Pedido
            </Show>
          </h3>
          <Show when={cart().length > 0 && step() === 'cart'}>
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

        {/* Step indicator */}
        <Show when={cart().length > 0}>
          <div class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-dark/40">
            <span classList={{ 'text-brand-accent': step() === 'cart' }}>1. Carrito</span>
            <span>→</span>
            <span classList={{ 'text-brand-accent': step() === 'customer' }}>2. Envío</span>
            <span>→</span>
            <span classList={{ 'text-brand-accent': step() === 'review' }}>3. Revisar</span>
          </div>
        </Show>

        {/* STEP 1: Cart items list */}
        <Show when={step() === 'cart'}>
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
                <div class="flex items-center justify-between gap-4 p-3.5 bg-brand-secondary rounded-2xl border border-brand-primary/5 transition-all duration-500 ease-out hover:shadow-md hover:border-brand-accent/20 hover:bg-brand-secondary/80 animate-fade-in-up">
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
              <Show when={isVerifyingCoupon()}>
                {/* Skeleton while the server confirms whether the user has a
                    won-cookie. Prevents the "flash of wrong state" where
                    the ¿Quieres 15%? prompt appears for 1 frame before
                    being replaced by the green "applied" badge. */}
                <div class="bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl border border-slate-200 p-4 animate-pulse">
                  <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-lg bg-slate-300" />
                    <div class="flex-1 space-y-1.5">
                      <div class="h-3 w-3/4 rounded bg-slate-300" />
                      <div class="h-2.5 w-1/2 rounded bg-slate-300" />
                    </div>
                  </div>
                </div>
              </Show>
              <Show when={!isVerifyingCoupon() && coupon().applied}>
                <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border-2 border-green-500/30 p-4 shadow-[0_0_20px_rgba(34,197,94,0.15)]">
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0 text-lg ring-2 ring-green-500/30">
                      ✅
                    </div>
                    <div class="space-y-1 min-w-0 flex-1">
                      <p class="text-xs font-black uppercase tracking-wider text-green-700">¡Descuento por juego aplicado!</p>
                      <p class="text-2xl font-black text-green-700">15% OFF</p>
                      <p class="text-[10px] text-green-700/70 leading-relaxed">
                        Completaste los 3 niveles del arcade ninja. El poder del rayo te espera.
                      </p>
                    </div>
                  </div>
                </div>
              </Show>
              <Show when={!isVerifyingCoupon() && !coupon().applied}>
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
          </Show>
        </Show>

        {/* Coupon block — ALWAYS visible (even with empty cart) so the
            user can see their 15% reward right after winning the game,
            before adding any products. Mirrors the cart() > 0 block
            above, but the "applied" variant adds a "Ver productos" CTA
            when the cart is empty. */}
        <Show when={cart().length === 0}>
          <div class="border-t border-brand-primary/10 pt-4 space-y-4">
            <Show when={isVerifyingCoupon()}>
              <div class="bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl border border-slate-200 p-4 animate-pulse">
                <div class="flex items-center gap-2.5">
                  <div class="w-9 h-9 rounded-lg bg-slate-300" />
                  <div class="flex-1 space-y-1.5">
                    <div class="h-3 w-3/4 rounded bg-slate-300" />
                    <div class="h-2.5 w-1/2 rounded bg-slate-300" />
                  </div>
                </div>
              </div>
            </Show>
            <Show when={!isVerifyingCoupon() && coupon().applied}>
              <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border-2 border-green-500/30 p-4 shadow-[0_0_20px_rgba(34,197,94,0.15)]">
                <div class="flex items-start gap-3">
                  <div class="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0 text-lg ring-2 ring-green-500/30">
                    ✅
                  </div>
                  <div class="space-y-1.5 min-w-0 flex-1">
                    <p class="text-xs font-black uppercase tracking-wider text-green-700">¡Descuento por juego aplicado!</p>
                    <p class="text-2xl font-black text-green-700">15% OFF</p>
                    <p class="text-[10px] text-green-700/70 leading-relaxed">
                      Completaste los 3 niveles. El poder del rayo te espera — añade productos al carrito para aplicar el descuento.
                    </p>
                    <a
                      href="#productos"
                      class="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white font-extrabold text-[10px] uppercase tracking-widest rounded-lg transition-all duration-200 shadow-md"
                    >
                      <span>Ver productos</span>
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 5l7 7-7 7"/>
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            </Show>
            <Show when={!isVerifyingCoupon() && !coupon().applied}>
              <div class="bg-gradient-to-br from-brand-accent/5 to-brand-primary/5 rounded-2xl border border-brand-accent/15 p-4">
                <div class="flex items-start gap-3">
                  <div class="w-10 h-10 rounded-xl bg-brand-accent/10 flex items-center justify-center shrink-0 text-lg">🎮</div>
                  <div class="space-y-1 min-w-0">
                    <p class="text-xs font-black uppercase tracking-wider text-brand-primary">¿Quieres 15% de descuento?</p>
                    <p class="text-[10px] text-brand-dark/60 leading-relaxed">
                      Juega nuestro arcade Ninja, completa los 3 niveles y desbloquea un descuento exclusivo.
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
        </Show>

        {/* STEP 2: Customer form */}
        <Show when={step() === 'customer'}>
          <div class="space-y-3 max-h-[420px] overflow-y-auto scrollbar-hidden pr-1">
            <p class="text-xs text-brand-dark/60 leading-relaxed">
              Necesitamos estos datos para enviarte tu pedido. Toda la información se guarda de forma segura.
            </p>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-brand-primary mb-1">Nombre Completo *</label>
              <input
                type="text"
                value={customer().name}
                onInput={(e) => updateCustomerField('name', e.currentTarget.value)}
                placeholder="Juan Pérez García"
                class="w-full px-3 py-2 text-sm bg-brand-light border rounded-lg outline-none focus:ring-2 focus:ring-brand-accent/50"
                classList={{ 'border-brand-primary/15': !customerErrors().name, 'border-red-500': customerErrors().name }}
              />
              <Show when={customerErrors().name}>
                <p class="text-[10px] text-red-500 mt-0.5">{customerErrors().name}</p>
              </Show>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-brand-primary mb-1">Email *</label>
              <input
                type="email"
                value={customer().email}
                onInput={(e) => updateCustomerField('email', e.currentTarget.value)}
                placeholder="tu@email.com"
                class="w-full px-3 py-2 text-sm bg-brand-light border rounded-lg outline-none focus:ring-2 focus:ring-brand-accent/50"
                classList={{ 'border-brand-primary/15': !customerErrors().email, 'border-red-500': customerErrors().email }}
              />
              <Show when={customerErrors().email}>
                <p class="text-[10px] text-red-500 mt-0.5">{customerErrors().email}</p>
              </Show>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-brand-primary mb-1">Celular *</label>
                <input
                  type="tel"
                  value={customer().phone}
                  onInput={(e) => updateCustomerField('phone', e.currentTarget.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="987654321"
                  inputmode="numeric"
                  class="w-full px-3 py-2 text-sm bg-brand-light border rounded-lg outline-none focus:ring-2 focus:ring-brand-accent/50"
                  classList={{ 'border-brand-primary/15': !customerErrors().phone, 'border-red-500': customerErrors().phone }}
                />
                <Show when={customerErrors().phone}>
                  <p class="text-[10px] text-red-500 mt-0.5">{customerErrors().phone}</p>
                </Show>
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-brand-primary mb-1">DNI / RUC *</label>
                <input
                  type="text"
                  value={customer().dni}
                  onInput={(e) => updateCustomerField('dni', e.currentTarget.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="12345678"
                  inputmode="numeric"
                  class="w-full px-3 py-2 text-sm bg-brand-light border rounded-lg outline-none focus:ring-2 focus:ring-brand-accent/50"
                  classList={{ 'border-brand-primary/15': !customerErrors().dni, 'border-red-500': customerErrors().dni }}
                />
                <Show when={customerErrors().dni}>
                  <p class="text-[10px] text-red-500 mt-0.5">{customerErrors().dni}</p>
                </Show>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2">
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-brand-primary mb-1">Departamento *</label>
                <select
                  value={customer().department}
                  onChange={(e) => updateCustomerField('department', e.currentTarget.value)}
                  class="w-full px-2 py-2 text-xs bg-brand-light border rounded-lg outline-none focus:ring-2 focus:ring-brand-accent/50 border-brand-primary/15"
                >
                  {Object.keys(UBIGEO).map((d) => <option value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-brand-primary mb-1">Provincia *</label>
                <select
                  value={customer().province}
                  onChange={(e) => updateCustomerField('province', e.currentTarget.value)}
                  class="w-full px-2 py-2 text-xs bg-brand-light border rounded-lg outline-none focus:ring-2 focus:ring-brand-accent/50 border-brand-primary/15"
                >
                  {provinces().map((p) => <option value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-brand-primary mb-1">Distrito *</label>
                <select
                  value={customer().district}
                  onChange={(e) => updateCustomerField('district', e.currentTarget.value)}
                  class="w-full px-2 py-2 text-xs bg-brand-light border rounded-lg outline-none focus:ring-2 focus:ring-brand-accent/50 border-brand-primary/15"
                >
                  {districts().map((d) => <option value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-brand-primary mb-1">Dirección Exacta *</label>
              <input
                type="text"
                value={customer().address}
                onInput={(e) => updateCustomerField('address', e.currentTarget.value)}
                placeholder="Av. Larco 345, Dpto 502"
                class="w-full px-3 py-2 text-sm bg-brand-light border rounded-lg outline-none focus:ring-2 focus:ring-brand-accent/50"
                classList={{ 'border-brand-primary/15': !customerErrors().address, 'border-red-500': customerErrors().address }}
              />
              <Show when={customerErrors().address}>
                <p class="text-[10px] text-red-500 mt-0.5">{customerErrors().address}</p>
              </Show>
            </div>
          </div>
        </Show>

        {/* STEP 3: Review */}
        <Show when={step() === 'review'}>
          <div class="space-y-3 text-sm">
            <div class="bg-brand-secondary rounded-xl p-3 space-y-1">
              <p class="text-[10px] font-black uppercase tracking-wider text-brand-primary">Enviar a:</p>
              <p class="font-bold text-brand-dark">{customer().name}</p>
              <p class="text-xs text-brand-dark/70">{customer().address}</p>
              <p class="text-xs text-brand-dark/70">{customer().district}, {customer().province}, {customer().department}</p>
              <p class="text-xs text-brand-dark/70">Tel: {customer().phone} · DNI/RUC: {customer().dni}</p>
              <p class="text-xs text-brand-dark/70">{customer().email}</p>
              <button onClick={backToCustomer} class="text-[10px] text-brand-accent font-bold uppercase tracking-wider hover:underline">Editar</button>
            </div>
            <div class="space-y-1.5">
              {cart().map((item) => (
                <div class="flex justify-between text-xs">
                  <span>{item.name} × {item.qty}</span>
                  <span class="font-bold">S/ {(item.price * item.qty).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </Show>

        {/* Totals + CTA — only show on cart step */}
        <Show when={step() === 'cart' && cart().length > 0}>
          <div class="border-t border-brand-primary/10 pt-4 space-y-4">
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

            <div class="pt-2">
              <button
                onClick={goToCustomerStep}
                class="w-full py-4 bg-brand-accent hover:bg-brand-accentGold text-brand-light font-extrabold text-sm uppercase tracking-widest rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 shadow-xl shadow-brand-accent/20 flex items-center justify-center space-x-2"
              >
                <span>Continuar al envío</span>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>
        </Show>

        {/* CTAs for step 2 / 3 */}
        <Show when={step() !== 'cart'}>
          <div class="border-t border-brand-primary/10 pt-4 space-y-2">
            <div class="flex justify-between text-sm text-brand-dark/80">
              <span>Total a Pagar</span>
              <span class="font-sans text-2xl font-extrabold text-brand-accent">S/ {total().toFixed(2)}</span>
            </div>
            <div class="flex gap-2">
              <button
                onClick={step() === 'customer' ? backToCart : backToCustomer}
                class="flex-1 py-3 bg-brand-primary/10 hover:bg-brand-primary/15 text-brand-primary font-bold text-xs uppercase tracking-widest rounded-xl transition-all"
              >
                Atrás
              </button>
              <Show when={step() === 'customer'}>
                <button
                  onClick={goToReviewStep}
                  class="flex-[2] py-3 bg-brand-accent hover:bg-brand-accentGold text-brand-light font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md"
                >
                  Revisar pedido
                </button>
              </Show>
              <Show when={step() === 'review'}>
                <button
                  onClick={handleCheckout}
                  disabled={isProcessing()}
                  class="flex-[2] py-3 bg-gradient-to-r from-brand-accent to-brand-accentGold hover:from-brand-accentGold hover:to-brand-accent text-brand-light font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md disabled:opacity-50"
                >
                  {isProcessing() ? 'Procesando...' : 'Finalizar Compra'}
                </button>
              </Show>
            </div>
            <Show when={checkoutError()}>
              <p class="text-xs font-bold text-red-500 text-center">{checkoutError()}</p>
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
          customer={customer()}
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
