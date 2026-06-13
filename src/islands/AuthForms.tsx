import { createSignal, Show, onMount } from 'solid-js';
import { useStore } from '@nanostores/solid';
import { $cart, addItemToCart, refreshCouponFromServer } from '@/store/cartStore';
import { $orders, saveOrder } from '@/store/ordersStore';

interface AuthFormsProps {
  mode: 'login' | 'register';
  next?: string;
  from?: string;
}

export default function AuthForms(props: AuthFormsProps) {
  const [email, setEmail] = createSignal('');
  const [name, setName] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [emailSent, setEmailSent] = createSignal(false);
  const [sentToEmail, setSentToEmail] = createSignal('');
  const [googleAvailable, setGoogleAvailable] = createSignal(true);

  // Check if Google OAuth is available
  onMount(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        // If the user is already signed in, redirect
        if (data.user) {
          window.location.href = props.next || '/mi-cuenta';
        }
      }
    } catch { /* noop */ }
  });

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleMagicLink = async (e: Event) => {
    e.preventDefault();
    setError('');
    if (!validateEmail(email())) {
      setError('Ingresa un email válido');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email().trim().toLowerCase(), name: name().trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'No se pudo enviar el link. Intenta de nuevo.');
        return;
      }
      setSentToEmail(email().trim().toLowerCase());
      setEmailSent(true);
    } catch (err) {
      setError('Error de conexión. Verifica tu internet.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = () => {
    // Just navigate; the endpoint will redirect to Google
    const next = props.next || '/mi-cuenta';
    window.location.href = `/api/auth/google/start?next=${encodeURIComponent(next)}`;
  };

  return (
    <div class="bg-brand-cream rounded-3xl shadow-2xl p-7 sm:p-9 border border-brand-wine/10">
      {/* Header */}
      <div class="text-center mb-6">
        <div class="w-16 h-16 bg-gradient-to-br from-brand-wine to-brand-wineDark rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-wine/30">
          <span class="text-3xl">🐱</span>
        </div>
        <h1 class="font-serif text-2xl sm:text-3xl font-black text-brand-wine mb-1">
          {props.mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}
        </h1>
        <p class="text-xs sm:text-sm text-brand-dark/60">
          {props.mode === 'login'
            ? 'Mio el gato guardián te está esperando'
            : 'Únete a la manada en menos de 30 segundos'}
        </p>
      </div>

      {/* Magic link sent confirmation */}
      <Show when={emailSent()}>
        <div class="text-center py-4 space-y-4">
          <div class="w-16 h-16 bg-green-500/15 rounded-full flex items-center justify-center mx-auto">
            <span class="text-3xl">📬</span>
          </div>
          <h2 class="font-black text-xl text-brand-wine">¡Revisa tu email!</h2>
          <p class="text-sm text-brand-dark/70 leading-relaxed">
            Te enviamos un link mágico a <br /><span class="font-bold text-brand-wine">{sentToEmail()}</span>
          </p>
          <p class="text-xs text-brand-dark/50">
            El link caduca en 15 minutos. Si no lo ves, revisa spam.
          </p>
          <button
            onClick={() => { setEmailSent(false); setEmail(''); setName(''); }}
            class="text-xs text-brand-wine/70 hover:text-brand-wine font-bold uppercase tracking-wider underline mt-2"
          >
            Usar otro email
          </button>
        </div>
      </Show>

      {/* Form */}
      <Show when={!emailSent()}>
        {/* Google OAuth button */}
        <button
          onClick={handleGoogle}
          type="button"
          class="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white hover:bg-slate-50 border-2 border-brand-primary/10 hover:border-brand-primary/20 text-brand-dark font-bold text-sm rounded-xl transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continuar con Google
        </button>

        {/* Divider */}
        <div class="flex items-center gap-3 my-5">
          <div class="flex-1 h-px bg-brand-primary/15"></div>
          <span class="text-[10px] font-black uppercase tracking-widest text-brand-dark/40">o con email</span>
          <div class="flex-1 h-px bg-brand-primary/15"></div>
        </div>

        {/* Magic link form */}
        <form onSubmit={handleMagicLink} class="space-y-3">
          <Show when={props.mode === 'register'}>
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-brand-wine mb-1">
                Nombre <span class="text-brand-dark/40 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder="Tu nombre"
                class="w-full px-4 py-3 bg-white border-2 border-brand-primary/10 rounded-xl text-sm focus:outline-none focus:border-brand-wine focus:ring-2 focus:ring-brand-wine/20 transition-all"
              />
            </div>
          </Show>
          <div>
            <label class="block text-[10px] font-black uppercase tracking-widest text-brand-wine mb-1">
              Email
            </label>
            <input
              type="email"
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
              placeholder="tu@email.com"
              inputmode="email"
              autocomplete="email"
              required
              class="w-full px-4 py-3 bg-white border-2 border-brand-primary/10 rounded-xl text-sm focus:outline-none focus:border-brand-wine focus:ring-2 focus:ring-brand-wine/20 transition-all"
            />
          </div>
          <Show when={error()}>
            <p class="text-xs font-bold text-red-600">{error()}</p>
          </Show>
          <button
            type="submit"
            disabled={isLoading()}
            class="w-full py-3.5 bg-gradient-to-r from-brand-wine to-brand-wineDark hover:from-brand-wineDark hover:to-brand-wine disabled:opacity-60 text-brand-cream font-extrabold uppercase tracking-widest text-sm rounded-xl transition-all hover:scale-[1.02] shadow-xl shadow-brand-wine/30 flex items-center justify-center gap-2"
          >
            {isLoading() ? (
              <>
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                Enviando...
              </>
            ) : (
              <>
                ⚡ {props.mode === 'login' ? 'Enviar link de acceso' : 'Enviar link de activación'}
              </>
            )}
          </button>
        </form>

        <p class="mt-5 text-center text-[11px] text-brand-dark/50 leading-relaxed">
          🔒 Sin contraseñas. Te enviamos un link seguro por email.
        </p>
      </Show>

      {/* Switch between login / register */}
      <div class="mt-6 pt-5 border-t border-brand-primary/10 text-center text-sm">
        <Show
          when={props.mode === 'login'}
          fallback={
            <p class="text-brand-dark/60">
              ¿Ya tienes cuenta?{' '}
              <a href="/auth/login" class="text-brand-wine font-extrabold uppercase tracking-wider hover:underline">
                Inicia sesión
              </a>
            </p>
          }
        >
          <p class="text-brand-dark/60">
            ¿No tienes cuenta?{' '}
            <a href="/auth/register" class="text-brand-wine font-extrabold uppercase tracking-wider hover:underline">
              Regístrate
            </a>
          </p>
        </Show>
      </div>
    </div>
  );
}
