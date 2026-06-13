import { createSignal, Show, onMount, For } from 'solid-js';
import type { OrderRecord, User } from '@/lib/types';
import { $orders, getOrdersByEmail } from '@/store/ordersStore';

const STATUS_LABELS: Record<OrderRecord['status'], { label: string; color: string }> = {
  pending: { label: 'Pendiente de pago', color: 'text-yellow-300 bg-yellow-500/15 border-yellow-500/40' },
  paid: { label: 'Pagado', color: 'text-green-300 bg-green-500/15 border-green-500/40' },
  processing: { label: 'En preparación', color: 'text-blue-300 bg-blue-500/15 border-blue-500/40' },
  shipped: { label: 'En camino', color: 'text-purple-300 bg-purple-500/15 border-purple-500/40' },
  delivered: { label: 'Entregado', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40' },
  cancelled: { label: 'Cancelado', color: 'text-red-300 bg-red-500/15 border-red-500/40' },
};

const CATALOG: Record<number, string> = {
  1: 'Reto Puka - 3 Días',
  2: 'Six Pack Poder',
  3: 'Suscripción Mensual',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-PE', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

interface OrderHistoryProps {
  /** When true, this is being rendered server-side inside the
      signed-in /mi-cuenta page. The email-lookup UI is hidden. */
  initialOrders?: OrderRecord[];
  initialCustomer?: User;
}

export default function OrderHistory(props: OrderHistoryProps) {
  const isSignedIn = () => !!props.initialCustomer;

  // ----- Signed-in mode: orders are passed in as a prop -----
  const [signedInOrders] = createSignal<OrderRecord[]>(props.initialOrders || []);

  // ----- Legacy mode: email lookup (for unauthenticated visitors) -----
  const [email, setEmail] = createSignal('');
  const [submitted, setSubmitted] = createSignal(false);
  const [userOrders, setUserOrders] = createSignal<OrderRecord[]>([]);

  onMount(() => {
    if (isSignedIn()) return;
    const last = localStorage.getItem('puka_last_customer_email');
    if (last) {
      setEmail(last);
      handleLookup(last);
    }
  });

  const handleLookup = (emailOverride?: string) => {
    const e = (emailOverride ?? email()).trim().toLowerCase();
    if (!e) return;
    setSubmitted(true);
    setUserOrders(getOrdersByEmail(e));
  };

  return (
    <Show
      when={isSignedIn()}
      fallback={
        // ----- Legacy email-lookup UI -----
        <div class="space-y-6">
          <div class="bg-white/10 backdrop-blur-sm border border-white/15 rounded-3xl p-5 sm:p-6">
            <p class="text-brand-cream/80 text-sm mb-4">
              ¿Ya compraste antes? Ingresa tu email para ver tu historial.
            </p>
            <div class="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleLookup(); }}
                placeholder="tu@email.com"
                class="flex-1 px-4 py-3 bg-white border-2 border-brand-primary/10 rounded-xl text-brand-dark placeholder-brand-dark/40 focus:outline-none focus:border-brand-wine focus:ring-2 focus:ring-brand-wine/20"
              />
              <a
                href="/auth/login"
                class="px-5 py-3 bg-gradient-to-r from-brand-accent to-brand-accentGold text-brand-wineDark font-extrabold uppercase tracking-widest text-xs rounded-xl text-center hover:scale-[1.02] transition-all shadow-lg"
              >
                Inicia sesión
              </a>
            </div>
            <p class="mt-3 text-xs text-brand-cream/50">
              💡 Tip: crea una cuenta con tu email para guardar tu historial permanentemente.
            </p>
          </div>

          <Show when={submitted() && userOrders().length > 0}>
            <OrdersList orders={userOrders()} />
          </Show>
          <Show when={submitted() && userOrders().length === 0}>
            <div class="text-center py-8 text-brand-cream/60">
              <p class="text-sm">No encontramos pedidos para <span class="font-bold text-brand-cream">{email()}</span>.</p>
              <p class="text-xs mt-2 text-brand-cream/40">Si compraste antes con otro email, prueba con ese.</p>
            </div>
          </Show>
        </div>
      }
    >
      <SignedInOrdersList orders={signedInOrders()} />
    </Show>
  );
}

function OrdersList(props: { orders: OrderRecord[] }) {
  return (
    <div class="space-y-4">
      <For each={props.orders}>
        {(order) => <OrderCard order={order} />}
      </For>
    </div>
  );
}

function SignedInOrdersList(props: { orders: OrderRecord[] }) {
  return (
    <Show
      when={props.orders.length > 0}
      fallback={
        <div class="text-center py-12 text-brand-cream/60 bg-brand-cream/5 rounded-2xl border border-brand-cream/10">
          <p class="text-4xl mb-3">📦</p>
          <p class="text-sm font-bold mb-1">Aún no tienes pedidos</p>
          <p class="text-xs text-brand-cream/50 mb-4">¡Visita la tienda y prueba nuestros packs de energía!</p>
          <a
            href="/tienda"
            class="inline-block px-6 py-3 bg-gradient-to-r from-brand-accent to-brand-accentGold text-brand-wineDark font-extrabold uppercase tracking-widest text-xs rounded-xl hover:scale-105 transition-all shadow-lg"
          >
            Ir a la tienda ⚡
          </a>
        </div>
      }
    >
      <div class="space-y-4">
        <For each={props.orders}>
          {(order) => <OrderCard order={order} darkMode={true} />}
        </For>
      </div>
    </Show>
  );
}

function OrderCard(props: { order: OrderRecord; darkMode?: boolean }) {
  const dark = () => !!props.darkMode;
  return (
    <article class={`${dark() ? 'bg-brand-cream/10 backdrop-blur-sm border border-brand-cream/15 hover:border-brand-accent/40' : 'bg-white border border-brand-primary/10 hover:border-brand-accent/40'} rounded-2xl p-5 transition-all duration-200 shadow-xl`}>
      <div class="flex items-start justify-between flex-wrap gap-3 mb-3">
        <div>
          <p class={`text-[10px] font-black uppercase tracking-widest ${dark() ? 'text-brand-accent' : 'text-brand-wine'}`}>Pedido</p>
          <p class={`text-lg font-black font-mono ${dark() ? 'text-brand-cream' : 'text-brand-wine'}`}>{props.order.orderId}</p>
          <p class={`text-xs ${dark() ? 'text-brand-cream/50' : 'text-brand-dark/50'}`}>{formatDate(props.order.createdAt)}</p>
        </div>
        <span class={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider border ${STATUS_LABELS[props.order.status].color}`}>
          {STATUS_LABELS[props.order.status].label}
        </span>
      </div>

      <div class="space-y-1.5 mb-3">
        <For each={props.order.items}>
          {(it) => (
            <div class={`flex justify-between text-sm ${dark() ? 'text-brand-cream/85' : 'text-brand-dark/80'}`}>
              <span>{it.name || CATALOG[it.id] || 'Producto #' + it.id} × {it.qty}</span>
              <span class="font-bold">S/ {((it.price ?? 0) * it.qty).toFixed(2)}</span>
            </div>
          )}
        </For>
      </div>

      <div class={`border-t ${dark() ? 'border-brand-cream/15' : 'border-brand-primary/10'} pt-3 space-y-1.5 text-sm`}>
        <div class={`flex justify-between ${dark() ? 'text-brand-cream/80' : 'text-brand-dark/80'}`}>
          <span>Subtotal</span>
          <span>S/ {props.order.subtotal.toFixed(2)}</span>
        </div>
        <Show when={props.order.discount > 0}>
          <div class={`flex justify-between ${dark() ? 'text-green-300' : 'text-green-600'}`}>
            <span>Descuento (15%)</span>
            <span>- S/ {props.order.discount.toFixed(2)}</span>
          </div>
        </Show>
        <div class={`flex justify-between ${dark() ? 'text-brand-cream/80' : 'text-brand-dark/80'}`}>
          <span>Envío</span>
          <span class={dark() ? 'text-green-300' : 'text-green-600'}>¡GRATIS!</span>
        </div>
        <div class={`flex justify-between items-center pt-1 border-t ${dark() ? 'border-brand-cream/15' : 'border-brand-primary/10'}`}>
          <span class={`font-black ${dark() ? 'text-brand-cream' : 'text-brand-wine'}`}>Total</span>
          <span class={`font-black text-2xl ${dark() ? 'text-brand-accent' : 'text-brand-wine'}`}>S/ {props.order.total.toFixed(2)}</span>
        </div>
      </div>
    </article>
  );
}
