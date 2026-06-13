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

  return (
    <div ref={menuRef} class="relative">
      <Show
        when={!loading() && user()}
        fallback={
          <Show when={!loading()}>
            <a
              href="/auth/login"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all duration-200 border border-brand-primary/20"
            >
              <span>👤</span>
              <span class="hidden sm:inline">Iniciar sesión</span>
            </a>
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
    </div>
  );
}
