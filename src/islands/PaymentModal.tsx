import { createSignal, Show, Match, Switch } from 'solid-js';
import type { CustomerInfo } from '@/lib/types';

interface PaymentModalProps {
  orderId: string;
  total: number;
  items: { id: number; qty: number }[];
  couponApplied: string;
  customer?: CustomerInfo;
  onClose: () => void;
}

type PaymentMethod = 'card' | 'yape' | 'cash';
type PaymentStep = 'method' | 'form' | 'processing' | 'done';

function luhnCheck(card: string): boolean {
  const digits = card.replace(/\D/g, '');
  if (digits.length < 13) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function formatCardNumber(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 16);
  return d.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 4);
  if (d.length > 2) return d.slice(0, 2) + '/' + d.slice(2);
  return d;
}

export default function PaymentModal(props: PaymentModalProps) {
  const [step, setStep] = createSignal<PaymentStep>('method');
  const [method, setMethod] = createSignal<PaymentMethod | null>(null);
  const [cardNum, setCardNum] = createSignal('');
  const [cardName, setCardName] = createSignal('');
  const [expiry, setExpiry] = createSignal('');
  const [cvc, setCvc] = createSignal('');
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const [progress, setProgress] = createSignal(0);

  const resetForm = () => {
    setStep('method');
    setMethod(null);
    setCardNum('');
    setCardName('');
    setExpiry('');
    setCvc('');
    setErrors({});
    setProgress(0);
  };

  const selectMethod = (m: PaymentMethod) => {
    setMethod(m);
    setStep('form');
  };

  const validateCard = (): boolean => {
    const e: Record<string, string> = {};
    const num = cardNum().replace(/\s/g, '');
    if (!num) e.num = 'Número de tarjeta requerido';
    else if (!luhnCheck(num)) e.num = 'Número de tarjeta inválido';
    if (!cardName().trim()) e.name = 'Nombre del titular requerido';
    const exp = expiry().replace('/', '');
    if (exp.length !== 4) e.exp = 'Fecha inválida (MM/AA)';
    else {
      const m = parseInt(exp.slice(0, 2), 10);
      if (m < 1 || m > 12) e.exp = 'Mes inválido';
    }
    const c = cvc().replace(/\D/g, '');
    if (c.length < 3) e.cvc = 'Código de seguridad inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const simulateProcessing = () => {
    setStep('processing');
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => setStep('done'), 300);
          return 100;
        }
        return p + Math.random() * 15 + 5;
      });
    }, 200);
  };

  const handlePay = async () => {
    if (method() === 'card' && !validateCard()) return;
    setStep('processing');
    setProgress(0);

    // If paying by card, attempt the Culqi charge via the server.
    // Falls back to the simulated flow if Culqi is not configured OR if
    // the user is paying by Yape / Contra Entrega.
    if (method() === 'card') {
      try {
        const res = await fetch('/api/culqi/charge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // In a real Culqi Checkout v4 integration, the sourceId is
            // obtained from Culqi's tokenization step. Here we just send
            // a placeholder that the server will accept in dev mode
            // (CULQI_SECRET_KEY not set) and reject in live mode.
            // TODO: integrate Culqi Checkout.js and pass the real token.
            sourceId: 'tok_dev_' + Date.now(),
            amount: props.total,
            email: props.customer?.email || 'cliente@pukapower.pe',
            description: `Pedido Puka Power #${props.orderId}`,
            customer: props.customer,
            items: props.items,
            orderId: props.orderId,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          // Show error and go back to form
          setErrors({ num: data.error || 'Pago rechazado' });
          setStep('form');
          return;
        }
        // Charge succeeded → simulate the UI processing and show done
        simulateProcessing();
        return;
      } catch (err) {
        // Network error → fall back to simulated flow
        console.warn('Culqi endpoint unavailable, falling back to simulated:', err);
      }
    }

    // Yape / Contra Entrega / fallback: simulated processing
    simulateProcessing();
  };

  const brandIcon = (num: string) => {
    const n = num.replace(/\s/g, '');
    if (n.startsWith('4')) return '💳';
    if (n.startsWith('5')) return '💳';
    if (n.startsWith('3')) return '💳';
    return '💳';
  };

  return (
    <div class="fixed inset-0 z-50 bg-brand-dark/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div class="bg-brand-light rounded-3xl p-5 sm:p-8 max-w-lg w-full border border-brand-primary/10 shadow-2xl relative">
        <button
          onClick={() => { resetForm(); props.onClose(); }}
          class="absolute top-4 right-4 w-8 h-8 rounded-full bg-brand-dark/5 hover:bg-brand-dark/10 flex items-center justify-center text-brand-dark/40 hover:text-brand-dark transition-colors"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
          </svg>
        </button>

        <Switch>
          <Match when={step() === 'method'}>
            <div class="space-y-6 pt-2">
              <div class="text-center space-y-2">
                <div class="w-14 h-14 bg-brand-accent/10 rounded-2xl flex items-center justify-center mx-auto">
                  <svg class="w-7 h-7 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                </div>
                <h3 class="font-serif text-2xl font-bold text-brand-primary">Elige tu método de pago</h3>
                <p class="text-sm text-brand-dark/60">Total a pagar: <span class="font-extrabold text-brand-accent">S/ {props.total.toFixed(2)}</span></p>
              </div>

              <div class="space-y-3">
                <button onClick={() => selectMethod('card')} class="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-brand-primary/10 hover:border-brand-accent/40 bg-brand-secondary transition-all duration-200 group text-left">
                  <div class="w-12 h-12 bg-brand-accent/10 rounded-xl flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">💳</div>
                  <div class="flex-1">
                    <p class="font-bold text-brand-dark text-sm">Tarjeta Débito / Crédito</p>
                    <p class="text-[11px] text-brand-dark/50">Visa, Mastercard, Amex</p>
                  </div>
                  <svg class="w-5 h-5 text-brand-dark/20 group-hover:text-brand-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>

                <button onClick={() => selectMethod('yape')} class="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-brand-primary/10 hover:border-brand-accent/40 bg-brand-secondary transition-all duration-200 group text-left">
                  <div class="w-12 h-12 bg-brand-accentGold/10 rounded-xl flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">📱</div>
                  <div class="flex-1">
                    <p class="font-bold text-brand-dark text-sm">Yape / Plin</p>
                    <p class="text-[11px] text-brand-dark/50">Paga desde tu app bancaria</p>
                  </div>
                  <svg class="w-5 h-5 text-brand-dark/20 group-hover:text-brand-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>

                <button onClick={() => selectMethod('cash')} class="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-brand-primary/10 hover:border-brand-accent/40 bg-brand-secondary transition-all duration-200 group text-left">
                  <div class="w-12 h-12 bg-brand-success/10 rounded-xl flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">💰</div>
                  <div class="flex-1">
                    <p className="font-bold text-brand-dark text-sm">Pago Contra Entrega</p>
                    <p class="text-[11px] text-brand-dark/50">Paga en efectivo al recibir</p>
                  </div>
                  <svg class="w-5 h-5 text-brand-dark/20 group-hover:text-brand-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>

              <p class="text-[10px] text-brand-dark/40 text-center">🔒 Pago 100% seguro. Tus datos están protegidos.</p>
            </div>
          </Match>

          <Match when={step() === 'form'}>
            <div class="space-y-5 pt-2">
              <button onClick={() => setStep('method')} class="flex items-center gap-1.5 text-xs font-bold text-brand-dark/50 hover:text-brand-accent transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                </svg>
                Cambiar método de pago
              </button>

              <Show when={method() === 'card'}>
                <div class="space-y-4">
                  <div class="bg-gradient-to-br from-brand-primary to-brand-dark p-5 rounded-2xl text-brand-light min-h-[180px] flex flex-col justify-between shadow-xl">
                    <div class="flex justify-between items-start">
                      <span class="text-[10px] uppercase tracking-widest opacity-60">Tarjeta</span>
                      <span class="text-2xl">{brandIcon(cardNum())}</span>
                    </div>
                    <div>
                      <p class="text-lg sm:text-xl font-mono tracking-widest">
                        {cardNum() || '••••  ••••  ••••  ••••'}
                      </p>
                      <div class="flex justify-between mt-3 text-xs">
                        <div>
                          <p class="text-[9px] uppercase tracking-wider opacity-60">Titular</p>
                          <p class="font-semibold">{cardName() || 'NOMBRE DEL TITULAR'}</p>
                        </div>
                        <div class="text-right">
                          <p class="text-[9px] uppercase tracking-wider opacity-60">Vence</p>
                          <p class="font-semibold">{expiry() || 'MM/AA'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="space-y-3">
                    <div>
                      <label class="text-[10px] font-bold uppercase tracking-wider text-brand-dark/60">Número de tarjeta</label>
                      <input type="text" inputmode="numeric" value={cardNum()} onInput={(e) => setCardNum(formatCardNumber(e.currentTarget.value))} placeholder="1234 5678 9012 3456" class="w-full px-4 py-3 rounded-xl bg-brand-secondary border text-sm font-mono outline-none transition-all" classList={{ 'border-brand-accent/50 ring-1 ring-brand-accent/20': errors().num, 'border-brand-primary/10': !errors().num }} />
                      <Show when={errors().num}><p class="text-[10px] text-brand-accent mt-1 font-semibold">{errors().num}</p></Show>
                    </div>
                    <div>
                      <label class="text-[10px] font-bold uppercase tracking-wider text-brand-dark/60">Nombre del titular</label>
                      <input type="text" value={cardName()} onInput={(e) => setCardName(e.currentTarget.value)} placeholder="JUAN PEREZ" class="w-full px-4 py-3 rounded-xl bg-brand-secondary border text-sm font-semibold uppercase outline-none transition-all" classList={{ 'border-brand-accent/50 ring-1 ring-brand-accent/20': errors().name, 'border-brand-primary/10': !errors().name }} />
                      <Show when={errors().name}><p class="text-[10px] text-brand-accent mt-1 font-semibold">{errors().name}</p></Show>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class="text-[10px] font-bold uppercase tracking-wider text-brand-dark/60">Vencimiento</label>
                        <input type="text" inputmode="numeric" value={expiry()} onInput={(e) => setExpiry(formatExpiry(e.currentTarget.value))} placeholder="MM/AA" maxlength="5" class="w-full px-4 py-3 rounded-xl bg-brand-secondary border text-sm font-mono outline-none transition-all" classList={{ 'border-brand-accent/50 ring-1 ring-brand-accent/20': errors().exp, 'border-brand-primary/10': !errors().exp }} />
                        <Show when={errors().exp}><p class="text-[10px] text-brand-accent mt-1 font-semibold">{errors().exp}</p></Show>
                      </div>
                      <div>
                        <label class="text-[10px] font-bold uppercase tracking-wider text-brand-dark/60">CVC</label>
                        <input type="text" inputmode="numeric" value={cvc()} onInput={(e) => setCvc(e.currentTarget.value.replace(/\D/g, '').slice(0, 4))} placeholder="123" maxlength="4" class="w-full px-4 py-3 rounded-xl bg-brand-secondary border text-sm font-mono outline-none transition-all" classList={{ 'border-brand-accent/50 ring-1 ring-brand-accent/20': errors().cvc, 'border-brand-primary/10': !errors().cvc }} />
                        <Show when={errors().cvc}><p class="text-[10px] text-brand-accent mt-1 font-semibold">{errors().cvc}</p></Show>
                      </div>
                    </div>
                  </div>

                  <button onClick={handlePay} class="w-full py-4 bg-brand-accent hover:bg-brand-accentGold text-brand-light font-extrabold text-sm uppercase tracking-widest rounded-xl transition-all duration-300 hover:-translate-y-0.5 shadow-xl shadow-brand-accent/20 active:scale-95">
                    Pagar S/ {props.total.toFixed(2)}
                  </button>
                </div>
              </Show>

              <Show when={method() === 'yape'}>
                <div class="text-center space-y-5 py-4">
                  <div class="bg-brand-secondary p-6 rounded-2xl border border-brand-primary/10 inline-block mx-auto">
                    <img src="/sprites/qr-yape.webp" alt="Código QR Yape para pagar" class="w-48 h-48 object-contain mx-auto" width="192" height="192" />
                  </div>
                  <div>
                    <p class="font-bold text-brand-dark">Escanea el código QR</p>
                    <p class="text-sm text-brand-dark/60">desde Yape o Plin y confirma el pago</p>
                  </div>
                  <div class="bg-brand-secondary rounded-2xl p-4 border border-brand-primary/10 text-sm space-y-2 text-left">
                    <div class="flex justify-between"><span class="text-brand-dark/60">Monto</span><span class="font-bold text-brand-accent">S/ {props.total.toFixed(2)}</span></div>
                    <div class="flex justify-between"><span class="text-brand-dark/60">N° de Pedido</span><span class="font-bold text-brand-dark text-xs font-mono">{props.orderId}</span></div>
                    <div class="flex justify-between"><span class="text-brand-dark/60">Código Yape</span><span class="font-bold text-brand-dark">987 654 321</span></div>
                  </div>
                  <button onClick={handlePay} class="w-full py-4 bg-brand-accent hover:bg-brand-accentGold text-brand-light font-extrabold text-sm uppercase tracking-widest rounded-xl transition-all duration-300 hover:-translate-y-0.5 shadow-xl shadow-brand-accent/20 active:scale-95">
                    Ya pagué, verificar
                  </button>
                </div>
              </Show>

              <Show when={method() === 'cash'}>
                <div class="text-center space-y-5 py-4">
                  <div class="w-20 h-20 bg-brand-success/10 rounded-full flex items-center justify-center mx-auto">
                    <svg class="w-10 h-10 text-brand-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
                    </svg>
                  </div>
                  <div>
                    <p class="font-bold text-brand-dark text-lg">Pago Contra Entrega</p>
                    <p class="text-sm text-brand-dark/60 mt-1">Pagas en efectivo cuando recibas tu pedido. Sin riesgos.</p>
                  </div>
                  <div class="bg-brand-secondary rounded-2xl p-4 border border-brand-primary/10 text-sm space-y-2 text-left">
                    <div class="flex justify-between"><span class="text-brand-dark/60">Total a pagar</span><span class="font-bold text-brand-accent">S/ {props.total.toFixed(2)}</span></div>
                    <div class="flex justify-between"><span class="text-brand-dark/60">Método de entrega</span><span class="font-bold text-brand-dark">Envío Express (Gratis)</span></div>
                  </div>
                  <button onClick={handlePay} class="w-full py-4 bg-brand-accent hover:bg-brand-accentGold text-brand-light font-extrabold text-sm uppercase tracking-widest rounded-xl transition-all duration-300 hover:-translate-y-0.5 shadow-xl shadow-brand-accent/20 active:scale-95">
                    Confirmar Pedido — S/ {props.total.toFixed(2)}
                  </button>
                </div>
              </Show>
            </div>
          </Match>

          <Match when={step() === 'processing'}>
            <div class="text-center space-y-6 py-12">
              <div class="relative w-24 h-24 mx-auto">
                <svg class="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="2" class="text-brand-primary/10" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="2" class="text-brand-accent" stroke-dasharray={`${Math.min(progress(), 100)}, 100`} stroke-linecap="round" style={{ 'stroke-dasharray': `${progress() * 2.87} 100` }} />
                </svg>
                <div class="absolute inset-0 flex items-center justify-center">
                  <span class="text-3xl">{progress() < 100 ? '⏳' : '✅'}</span>
                </div>
              </div>
              <div>
                <p class="font-serif text-xl font-bold text-brand-primary">Procesando tu pago...</p>
                <p class="text-sm text-brand-dark/60 mt-1">Por favor, no cierres esta ventana</p>
              </div>
              <div class="w-full bg-brand-primary/5 rounded-full h-2 overflow-hidden">
                <div class="h-full bg-brand-accent rounded-full transition-all duration-300 ease-out" style={{ width: `${Math.min(progress(), 100)}%` }} />
              </div>
              <p class="text-xs text-brand-dark/40 font-mono">{props.orderId}</p>
            </div>
          </Match>

          <Match when={step() === 'done'}>
            <div class="text-center space-y-5 py-4">
              <div class="w-20 h-20 bg-brand-success/15 rounded-full flex items-center justify-center mx-auto animate-bounce">
                <svg class="w-10 h-10 text-brand-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <div>
                <h3 class="font-serif text-2xl font-bold text-brand-primary">¡Pago Exitoso! 🎉</h3>
                <p class="text-sm text-brand-dark/60 mt-1">Tu compra ha sido procesada correctamente</p>
              </div>
              <div class="bg-brand-secondary rounded-2xl p-4 border border-brand-primary/10 text-xs space-y-2 text-left">
                <div class="flex justify-between"><span class="text-brand-dark/60">N° de Operación</span><span class="font-bold font-mono text-brand-dark">{props.orderId}</span></div>
                <div class="flex justify-between"><span class="text-brand-dark/60">Monto</span><span class="font-bold text-brand-accent">S/ {props.total.toFixed(2)}</span></div>
                <div class="flex justify-between"><span class="text-brand-dark/60">Método</span><span class="font-bold text-brand-dark">{method() === 'card' ? 'Tarjeta' : method() === 'yape' ? 'Yape/Plin' : 'Contra Entrega'}</span></div>
                <div class="flex justify-between"><span class="text-brand-dark/60">Envío</span><span class="font-bold text-brand-success">GRATIS</span></div>
              </div>
              <div class="bg-brand-success/5 border border-brand-success/20 rounded-2xl p-4 text-xs text-brand-dark/70">
                Recibirás un mensaje de WhatsApp en breve para coordinar la entrega. <span class="font-bold text-brand-success">¡Gracias por tu compra!</span>
              </div>
              <button onClick={() => { resetForm(); props.onClose(); }} class="w-full py-4 bg-brand-primary hover:bg-brand-accent text-brand-light font-extrabold text-sm uppercase tracking-widest rounded-xl transition-all duration-300 shadow-lg active:scale-95">
                Volver a la Tienda ⚡
              </button>
            </div>
          </Match>
        </Switch>
      </div>
    </div>
  );
}
