import { createSignal, Show, onMount, For } from 'solid-js';

// Ubigeo Perú — para los selects del registro (departamento → provincia → distrito)
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

interface AuthFormsProps {
  mode: 'login' | 'register';
  next?: string;
  from?: string;
}

export default function AuthForms(props: AuthFormsProps) {
  // Common fields
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [showPassword, setShowPassword] = createSignal(false);

  // Register-only fields
  const [name, setName] = createSignal('');
  const [surname, setSurname] = createSignal('');
  const [phone, setPhone] = createSignal('');
  const [address, setAddress] = createSignal('');
  const [department, setDepartment] = createSignal('Lima');
  const [province, setProvince] = createSignal('Lima');
  const [district, setDistrict] = createSignal('');

  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  // Cascade selects
  const provinces = (): string[] => Object.keys(UBIGEO[department()] || {});
  const districts = (): string[] => UBIGEO[department()]?.[province()] || [];

  // If already signed in, redirect.
  onMount(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          window.location.href = props.next || '/mi-cuenta';
        }
      }
    } catch { /* noop */ }
  });

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    setError('');
    if (!validateEmail(email())) {
      setError('Ingresa un email válido');
      return;
    }
    if (password().length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: email().trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'No se pudo iniciar sesión');
        return;
      }
      window.location.href = props.next || '/mi-cuenta';
    } catch (err) {
      setError('Error de conexión. Verifica tu internet.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: Event) => {
    e.preventDefault();
    setError('');

    // Frontend validation (server validates again)
    if (!validateEmail(email())) { setError('Email inválido'); return; }
    if (password().length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    if (name().trim().length < 2) { setError('Ingresa tu nombre'); return; }
    if (surname().trim().length < 2) { setError('Ingresa tus apellidos'); return; }
    if (address().trim().length < 5) { setError('Ingresa tu dirección completa'); return; }
    if (!department() || !province() || !district()) { setError('Completa departamento, provincia y distrito'); return; }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: email().trim().toLowerCase(),
          password,
          name: name().trim(),
          surname: surname().trim(),
          phone: phone().trim() || undefined,
          address: address().trim(),
          department: department(),
          province: province(),
          district: district(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'No se pudo crear la cuenta');
        return;
      }
      window.location.href = props.next || '/mi-cuenta';
    } catch (err) {
      setError('Error de conexión. Verifica tu internet.');
    } finally {
      setIsLoading(false);
    }
  };

  // Cascade resets
  const onDepartmentChange = (v: string) => {
    setDepartment(v);
    const ps = Object.keys(UBIGEO[v] || {});
    setProvince(ps[0] || '');
    setDistrict('');
  };
  const onProvinceChange = (v: string) => {
    setProvince(v);
    const ds = UBIGEO[department()]?.[v] || [];
    setDistrict(ds[0] || '');
  };

  return (
    <div class="bg-brand-cream rounded-3xl shadow-2xl p-8 sm:p-12 border border-brand-wine/10">
      {/* Header */}
      <div class="text-center mb-8">
        <div class="w-20 h-20 bg-gradient-to-br from-brand-wine to-brand-wineDark rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-brand-wine/40">
          <span class="text-4xl">🐱</span>
        </div>
        <h1 class="font-serif text-3xl sm:text-4xl font-black text-brand-wine mb-2">
          {props.mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}
        </h1>
        <p class="text-sm sm:text-base text-brand-dark/60">
          {props.mode === 'login'
            ? 'Mio el gato guardián te está esperando'
            : 'Únete a la manada — energía ancestral con envío a todo el Perú'}
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={props.mode === 'login' ? handleLogin : handleRegister}
        class="space-y-4 sm:space-y-5"
      >
        <Show when={props.mode === 'register'}>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-brand-wine mb-1.5">
                Nombre *
              </label>
              <input
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder="Juan"
                autocomplete="given-name"
                required
                class="w-full px-4 py-3 bg-white border-2 border-brand-primary/10 rounded-xl text-sm focus:outline-none focus:border-brand-wine focus:ring-2 focus:ring-brand-wine/20 transition-all"
              />
            </div>
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-brand-wine mb-1.5">
                Apellidos *
              </label>
              <input
                type="text"
                value={surname()}
                onInput={(e) => setSurname(e.currentTarget.value)}
                placeholder="Pérez García"
                autocomplete="family-name"
                required
                class="w-full px-4 py-3 bg-white border-2 border-brand-primary/10 rounded-xl text-sm focus:outline-none focus:border-brand-wine focus:ring-2 focus:ring-brand-wine/20 transition-all"
              />
            </div>
          </div>
        </Show>

        <div>
          <label class="block text-[10px] font-black uppercase tracking-widest text-brand-wine mb-1.5">
            Email *
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

        <div>
          <label class="block text-[10px] font-black uppercase tracking-widest text-brand-wine mb-1.5">
            Contraseña *
          </label>
          <div class="relative">
            <input
              type={showPassword() ? 'text' : 'password'}
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              placeholder="Mínimo 8 caracteres"
              autocomplete={props.mode === 'login' ? 'current-password' : 'new-password'}
              minLength={8}
              required
              class="w-full px-4 py-3 pr-12 bg-white border-2 border-brand-primary/10 rounded-xl text-sm focus:outline-none focus:border-brand-wine focus:ring-2 focus:ring-brand-wine/20 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword())}
              aria-label={showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              class="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-brand-dark/50 hover:text-brand-wine transition-colors"
            >
              <Show
                when={showPassword()}
                fallback={
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                }
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              </Show>
            </button>
          </div>
        </div>

        <Show when={props.mode === 'register'}>
          <div class="pt-2">
            <p class="text-[10px] font-black uppercase tracking-widest text-brand-wine/70 mb-3 flex items-center gap-2">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Datos de envío
            </p>

            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-brand-wine mb-1.5">
                Celular <span class="text-brand-dark/40 font-normal">(opcional)</span>
              </label>
              <input
                type="tel"
                value={phone()}
                onInput={(e) => setPhone(e.currentTarget.value.replace(/\D/g, '').slice(0, 9))}
                placeholder="987654321"
                inputmode="numeric"
                autocomplete="tel"
                class="w-full px-4 py-3 bg-white border-2 border-brand-primary/10 rounded-xl text-sm focus:outline-none focus:border-brand-wine focus:ring-2 focus:ring-brand-wine/20 transition-all"
              />
            </div>

            <div class="mt-3">
              <label class="block text-[10px] font-black uppercase tracking-widest text-brand-wine mb-1.5">
                Dirección exacta *
              </label>
              <input
                type="text"
                value={address()}
                onInput={(e) => setAddress(e.currentTarget.value)}
                placeholder="Av. Larco 345, Dpto 502"
                autocomplete="street-address"
                required
                class="w-full px-4 py-3 bg-white border-2 border-brand-primary/10 rounded-xl text-sm focus:outline-none focus:border-brand-wine focus:ring-2 focus:ring-brand-wine/20 transition-all"
              />
            </div>

            <div class="grid grid-cols-3 gap-2 mt-3">
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-brand-wine mb-1.5">
                  Dpto. *
                </label>
                <select
                  value={department()}
                  onChange={(e) => onDepartmentChange(e.currentTarget.value)}
                  class="w-full px-2 py-3 bg-white border-2 border-brand-primary/10 rounded-xl text-xs focus:outline-none focus:border-brand-wine focus:ring-2 focus:ring-brand-wine/20 transition-all"
                >
                  <For each={Object.keys(UBIGEO)}>{(d) => <option value={d}>{d}</option>}</For>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-brand-wine mb-1.5">
                  Prov. *
                </label>
                <select
                  value={province()}
                  onChange={(e) => onProvinceChange(e.currentTarget.value)}
                  class="w-full px-2 py-3 bg-white border-2 border-brand-primary/10 rounded-xl text-xs focus:outline-none focus:border-brand-wine focus:ring-2 focus:ring-brand-wine/20 transition-all"
                >
                  <For each={provinces()}>{(p) => <option value={p}>{p}</option>}</For>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-brand-wine mb-1.5">
                  Distrito *
                </label>
                <select
                  value={district()}
                  onChange={(e) => setDistrict(e.currentTarget.value)}
                  class="w-full px-2 py-3 bg-white border-2 border-brand-primary/10 rounded-xl text-xs focus:outline-none focus:border-brand-wine focus:ring-2 focus:ring-brand-wine/20 transition-all"
                >
                  <For each={districts()}>{(d) => <option value={d}>{d}</option>}</For>
                </select>
              </div>
            </div>
          </div>
        </Show>

        <Show when={error()}>
          <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <svg class="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-xs font-semibold text-red-700 leading-relaxed">{error()}</p>
          </div>
        </Show>

        <button
          type="submit"
          disabled={isLoading()}
          class="w-full py-4 bg-gradient-to-r from-brand-wine to-brand-wineDark hover:from-brand-wineDark hover:to-brand-wine disabled:opacity-60 text-brand-cream font-extrabold uppercase tracking-widest text-sm sm:text-base rounded-xl transition-all hover:scale-[1.02] shadow-xl shadow-brand-wine/30 flex items-center justify-center gap-2"
        >
          {isLoading() ? (
            <>
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Procesando...
            </>
          ) : (
            <>
              ⚡ {props.mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </>
          )}
        </button>
      </form>

      <p class="mt-5 text-center text-xs text-brand-dark/50">
        🔒 Tu contraseña se almacena con PBKDF2-SHA256 (100k iteraciones).
      </p>

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
