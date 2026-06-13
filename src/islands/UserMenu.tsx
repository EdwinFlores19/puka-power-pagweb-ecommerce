import { createSignal, Show, onMount, onCleanup } from 'solid-js';

interface SessionUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
}

function initials(name?: string, email?: string): string {
  if (name && name.trim()) return name.trim().slice(0, 1).toUpperCase();
  if (email) return email.trim().slice(0, 1).toUpperCase();
  return '?';
}

function colorFromString(s: string): string {
  // Generate a consistent color from the email/name
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}

export default function UserMenu() {
  const [user, setUser] = createSignal<SessionUser | null>(null);
  const [open, setOpen] = createSignal(false);
  const [loading, setLoading] = createSignal(true);

  // Mini-form state (only used when signed out)
  const [loginEmail, setLoginEmail] = createSignal('');
  const [loginPassword, setLoginPassword] = createSignal('');
  const [showLoginPwd, setShowLoginPwd] = createSignal(false);
  const [loginError, setLoginError] = createSignal('');
  const [loginLoading, setLoginLoading] = createSignal(false);

  let menuRef: HTMLDivElement | undefined;

  const fetchMe = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) { setUser(null); return; }
      const data = await res.json();
      setUser(data.user);
    } catch { setUser(null); }
    finally { setLoading(false); }
  };

  onMount(() => {
    fetchMe();
    // Click outside closes the menu
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef && !menuRef.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onClickOutside);
    onCleanup(() => document.removeEventListener('click', onClickOutside));
  });

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch { /* noop */ }
    window.location.href = '/';
  };

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleEmbeddedLogin = async (e: Event) => {
    e.preventDefault();
    setLoginError('');

    if (!validateEmail(loginEmail())) {
      setLoginError('Ingresa un email válido');
      return;
    }
    if (loginPassword().length < 8) {
      setLoginError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: loginEmail().trim().toLowerCase(),
          password: loginPassword(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLoginError(data.error || 'No se pudo iniciar sesión');
        return;
      }
      // Refresh to reflect the signed-in state everywhere
      window.location.reload();
    } catch {
      setLoginError('Error de conexión. Verifica tu internet.');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div ref={menuRef} class="relative">
      <Show
        when={!loading() && user()}
        fallback={
          <Show when={!loading()}>
            {/* Signed out → trigger button that opens the embedded mini-form */}
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(!open()); }}
              aria-label="Iniciar sesión"
              aria-expanded={open()}
              class="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all duration-200 border border-brand-primary/20"
            >
              <span>👤</span>
              <span class="hidden sm:inline">Iniciar sesión</span>
              <svg class={`w-3 h-3 transition-transform duration-200 ${open() ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </Show>
        }
      >
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(!open()); }}
          aria-label="Menú de usuario"
          class="flex items-center gap-2 px-1 py-1 rounded-full hover:ring-2 hover:ring-brand-accent/40 transition-all"
        >
          <Show
            when={user()!.avatarUrl}
            fallback={
              <div
                class="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm ring-2 ring-brand-accent/40"
                style={{ 'background-color': colorFromString(user()!.email) }}
              >
                {initials(user()!.name, user()!.email)}
              </div>
            }
          >
            <img
              src={user()!.avatarUrl}
              alt={user()!.name || user()!.email}
              class="w-9 h-9 rounded-full ring-2 ring-brand-accent/40 object-cover"
              referrerpolicy="no-referrer"
            />
          </Show>
        </button>

        <Show when={open()}>
          <div class="absolute right-0 mt-2 w-72 bg-brand-cream rounded-2xl shadow-2xl border border-brand-wine/10 overflow-hidden z-50 animate-bubble-in">
            <div class="p-4 bg-gradient-to-br from-brand-wine to-brand-wineDark text-brand-cream">
              <div class="flex items-center gap-3">
                <Show
                  when={user()!.avatarUrl}
                  fallback={
                    <div
                      class="w-12 h-12 rounded-full flex items-center justify-center text-white font-black ring-2 ring-brand-accent/40"
                      style={{ 'background-color': colorFromString(user()!.email) }}
                    >
                      {initials(user()!.name, user()!.email)}
                    </div>
                  }
                >
                  <img
                    src={user()!.avatarUrl}
                    alt=""
                    class="w-12 h-12 rounded-full ring-2 ring-brand-accent/40 object-cover"
                    referrerpolicy="no-referrer"
                  />
                </Show>
                <div class="min-w-0 flex-1">
                  <p class="font-black truncate">{user()!.name || user()!.email.split('@')[0]}</p>
                  <p class="text-xs text-brand-cream/70 truncate">{user()!.email}</p>
                </div>
              </div>
              <div class="flex gap-2 mt-3 text-[10px]">
                <span class="px-2 py-1 bg-brand-cream/15 rounded-md font-bold">{user()!.totalOrders} pedidos</span>
                <span class="px-2 py-1 bg-brand-accent/20 text-brand-accent rounded-md font-bold">S/ {user()!.totalSpent.toFixed(2)}</span>
              </div>
            </div>
            <div class="p-2">
              <a
                href="/mi-cuenta"
                class="block px-3 py-2.5 rounded-lg hover:bg-brand-secondary text-sm font-bold text-brand-dark transition-colors flex items-center gap-2"
              >
                <span>👤</span> Mi Cuenta
              </a>
              <a
                href="/tienda"
                class="block px-3 py-2.5 rounded-lg hover:bg-brand-secondary text-sm font-bold text-brand-dark transition-colors flex items-center gap-2"
              >
                <span>🛒</span> Tienda
              </a>
              <button
                onClick={handleLogout}
                class="w-full text-left block px-3 py-2.5 rounded-lg hover:bg-red-50 text-sm font-bold text-red-600 transition-colors flex items-center gap-2"
              >
                <span>🚪</span> Cerrar sesión
              </button>
            </div>
          </div>
        </Show>
      </Show>

      {/* Embedded mini-form dropdown (signed out) */}
      <Show when={!loading() && !user() && open()}>
        <div class="absolute right-0 mt-2 w-80 sm:w-96 bg-brand-cream rounded-2xl shadow-2xl border border-brand-wine/10 overflow-hidden z-50 animate-bubble-in">
          <div class="p-5 bg-gradient-to-br from-brand-wine to-brand-wineDark text-brand-cream">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl bg-brand-accent/20 flex items-center justify-center text-2xl ring-2 ring-brand-accent/40">
                🐱
              </div>
              <div>
                <p class="font-black text-base">Inicia sesión</p>
                <p class="text-xs text-brand-cream/70">Sin salir de la página</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleEmbeddedLogin} class="p-5 space-y-3">
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-brand-wine mb-1">
                Email
              </label>
              <input
                type="email"
                value={loginEmail()}
                onInput={(e) => setLoginEmail(e.currentTarget.value)}
                placeholder="tu@email.com"
                autocomplete="email"
                required
                class="w-full px-3.5 py-2.5 bg-white border-2 border-brand-primary/10 rounded-xl text-sm focus:outline-none focus:border-brand-wine focus:ring-2 focus:ring-brand-wine/20 transition-all"
              />
            </div>

            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-brand-wine mb-1">
                Contraseña
              </label>
              <div class="relative">
                <input
                  type={showLoginPwd() ? 'text' : 'password'}
                  value={loginPassword()}
                  onInput={(e) => setLoginPassword(e.currentTarget.value)}
                  placeholder="Mínimo 8 caracteres"
                  autocomplete="current-password"
                  minLength={8}
                  required
                  class="w-full px-3.5 py-2.5 pr-10 bg-white border-2 border-brand-primary/10 rounded-xl text-sm focus:outline-none focus:border-brand-wine focus:ring-2 focus:ring-brand-wine/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPwd(!showLoginPwd())}
                  aria-label={showLoginPwd() ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  class="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-brand-dark/50 hover:text-brand-wine transition-colors"
                >
                  <Show
                    when={showLoginPwd()}
                    fallback={
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    }
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  </Show>
                </button>
              </div>
            </div>

            <Show when={loginError()}>
              <div class="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p class="text-[11px] font-semibold text-red-700">{loginError()}</p>
              </div>
            </Show>

            <button
              type="submit"
              disabled={loginLoading()}
              class="w-full py-3 bg-gradient-to-r from-brand-wine to-brand-wineDark hover:from-brand-wineDark hover:to-brand-wine disabled:opacity-60 text-brand-cream font-extrabold uppercase tracking-widest text-xs rounded-xl transition-all shadow-lg shadow-brand-wine/30 flex items-center justify-center gap-2"
            >
              {loginLoading() ? (
                <>
                  <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Entrando...
                </>
              ) : (
                <>⚡ Entrar</>
              )}
            </button>

            <div class="text-center pt-2 border-t border-brand-primary/10 text-[11px] space-y-1.5">
              <p class="text-brand-dark/60">
                ¿No tienes cuenta?{' '}
                <a href="/auth/register" class="text-brand-wine font-extrabold uppercase tracking-wider hover:underline">
                  Regístrate
                </a>
              </p>
              <a
                href="/auth/login"
                class="block text-brand-dark/50 hover:text-brand-wine transition-colors"
              >
                ¿Prefieres la página completa? →
              </a>
            </div>
          </form>
        </div>
      </Show>
    </div>
  );
}
