import { createSignal, Show, onMount, For } from 'solid-js';
import { useStore } from '@nanostores/solid';
import { $orders, $customers, getOrdersByEmail, getCustomerByEmail } from '@/store/ordersStore';
import type { OrderRecord, CustomerRecord } from '@/lib/types';

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

export default function OrderHistory() {
  const orders = useStore($orders);
  const customers = useStore($customers);
  const [email, setEmail] = createSignal('');
  const [submitted, setSubmitted] = createSignal(false);
  const [customer, setCustomer] = createSignal<CustomerRecord | null>(null);
  const [userOrders, setUserOrders] = createSignal<OrderRecord[]>([]);

  // Auto-load if the user already has a saved email (returning customer)
  onMount(() => {
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
    const c = getCustomerByEmail(e);
    setCustomer(c);
    setUserOrders(getOrdersByEmail(e));
  };

  return (
    <div class="space-y-6">
      {/* Email lookup */}
      <div class="bg-slate-800/60 backdrop-blur border border-amber-500/20 rounded-3xl p-5 sm:p-6">
        <label class="block text-xs font-black uppercase tracking-wider text-amber-200 mb-2">Tu email</label>
        <div class="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={email()}
            onInput={(e) => setEmail(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLookup(); }}
            placeholder="tu@email.com"
            class="flex-1 px-4 py-3 bg-slate-900/70 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
          <button
            onClick={() => handleLookup()}
            class="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-900 font-extrabold uppercase tracking-widest text-sm rounded-xl transition-all shadow-lg"
          >
            Ver mis pedidos
          </button>
        </div>
        <Show when={submitted() && !customer()}>
          <p class="mt-3 text-sm text-red-300">
            No encontramos pedidos para <strong>{email()}</strong>. Si ya compraste antes, prueba con el email exacto que usaste.
          </p>
        </Show>
      </div>

      {/* Customer info */}
      <Show when={customer()}>
        <div class="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-3xl p-5 sm:p-6">
          <div class="flex items-start justify-between flex-wrap gap-3">
            <div>
              <p class="text-xs font-black uppercase tracking-wider text-amber-300 mb-1">Bienvenido de vuelta</p>
              <h2 class="text-2xl font-black text-white">{customer()!.name}</h2>
              <p class="text-amber-100/70 text-sm">{customer()!.email} · {customer()!.phone}</p>
              <p class="text-amber-100/50 text-xs mt-1">
                {customer()!.address}, {customer()!.district}, {customer()!.province}, {customer()!.department}
              </p>
            </div>
            <div class="text-right">
              <p class="text-[10px] font-black uppercase tracking-wider text-amber-300">Cliente desde</p>
              <p class="text-sm font-bold text-white">{formatDate(customer()!.createdAt)}</p>
              <div class="mt-2 flex gap-2 text-xs">
                <span class="px-2 py-1 bg-amber-500/20 text-amber-200 rounded-md font-bold">{customer()!.totalOrders} pedidos</span>
                <span class="px-2 py-1 bg-amber-500/20 text-amber-200 rounded-md font-bold">S/ {customer()!.totalSpent.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Orders list */}
      <Show when={customer() && userOrders().length > 0}>
        <div class="space-y-4">
          <h3 class="text-lg font-black text-amber-200 flex items-center gap-2">
            <span>📦</span> Tus Pedidos
            <span class="text-xs font-bold text-amber-100/50">({userOrders().length})</span>
          </h3>
          <For each={userOrders()}>
            {(order) => (
              <div class="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-5 hover:border-amber-500/30 transition-colors">
                <div class="flex items-start justify-between flex-wrap gap-3 mb-3">
                  <div>
                    <p class="text-[10px] font-black uppercase tracking-wider text-amber-300">Pedido</p>
                    <p class="text-lg font-black text-white font-mono">{order.orderId}</p>
                    <p class="text-xs text-amber-100/50">{formatDate(order.createdAt)}</p>
                  </div>
                  <span class={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider border ${STATUS_LABELS[order.status].color}`}>
                    {STATUS_LABELS[order.status].label}
                  </span>
                </div>

                <div class="space-y-1.5 mb-3">
                  {order.items.map((it) => (
                    <div class="flex justify-between text-sm">
                      <span class="text-amber-100/80">
                        {it.name || CATALOG[it.id] || 'Producto #' + it.id} × {it.qty}
                      </span>
                      <span class="font-bold text-white">
                        S/ {((it.price ?? 0) * it.qty).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div class="border-t border-slate-700/50 pt-3 space-y-1.5 text-sm">
                  <div class="flex justify-between text-amber-100/70">
                    <span>Subtotal</span>
                    <span>S/ {order.subtotal.toFixed(2)}</span>
                  </div>
                  {order.discount > 0 && (
                    <div class="flex justify-between text-green-300">
                      <span>Descuento (15%)</span>
                      <span>- S/ {order.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div class="flex justify-between text-amber-100/70">
                    <span>Envío</span>
                    <span class="text-green-300">¡GRATIS!</span>
                  </div>
                  <div class="flex justify-between items-center pt-1 border-t border-slate-700/50">
                    <span class="font-black text-white">Total</span>
                    <span class="font-black text-2xl text-amber-300">S/ {order.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={customer() && userOrders().length === 0}>
        <div class="text-center py-8 text-amber-100/60">
          <p class="text-sm">Aún no tienes pedidos. ¡Visita la <a href="/tienda" class="text-amber-300 underline">tienda</a> y prueba nuestros packs!</p>
        </div>
      </Show>
    </div>
  );
}
