import { createSignal, Show } from 'solid-js';

interface Message {
  text: string;
  action?: () => void;
  icon?: string;
  actionLabel?: string;
  isProductRelated?: boolean;
}

const messages: Message[] = [
  {
    icon: '\u{1F31F}',
    text: '\u{00A1}Hola! Soy el gatito guardi\u{00E1}n de Puka Power \u{1F431}\u{2728}. Bienvenido a la energia ancestral peruana. \u{00BF}Te gu\u{00ED}o por el sitio?',
    isProductRelated: true,
  },
  {
    icon: '\u{1F33F}',
    text: 'Nuestra energia viene de la c\u{00E1}scara de caf\u{00E9}, camu camu y maca andina. Todo natural, sin qu\u{00ED}micos \u{2705}',
    action: () => scrollToSection('beneficios'),
    actionLabel: 'Ver Beneficios',
    isProductRelated: true,
  },
  {
    icon: '\u{1F34B}',
    text: 'El camu camu amaz\u{00F3}nico tiene hasta 40x m\u{00E1}s Vitamina C que la naranja. \u{00A1}Un escudo inmunol\u{00F3}gico! \u{1F30D}',
    action: () => scrollToSection('ingredientes'),
    actionLabel: 'Ver Ingredientes',
    isProductRelated: true,
  },
  {
    icon: '\u{2B50}',
    text: 'Mira lo que dicen los que ya probaron Puka Power. Atletas, programadores y estudiantes lo recomiendan \u{1F91F}',
    action: () => scrollToSection('testimonios'),
    actionLabel: 'Leer Testimonios',
    isProductRelated: false,
  },
  {
    icon: '\u{1F6D2}',
    text: '\u{00BF}Listo para aceptar el reto? Elige tu pack de energia en la tienda. \u{00A1}Env\u{00ED}o gratis en Lima! \u{1F4E6}',
    action: () => { window.location.href = '/tienda'; },
    actionLabel: 'Ir a Tienda',
    isProductRelated: true,
  },
  {
    icon: '\u{1F3AE}',
    text: '\u{00A1}Tenemos un arcade ninja! Completa los 3 niveles y desbloquea un descuento exclusivo. \u{00BF}Aceptas el desaf\u{00ED}o? \u{1F680}',
    action: () => { window.location.href = '/juego'; },
    actionLabel: 'Jugar Ahora',
    isProductRelated: false,
  },
];

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export default function MascotGuide() {
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [showBubble, setShowBubble] = createSignal(true);

  const currentMessage = () => messages[currentIndex()];
  const hasAction = () => !!currentMessage().action;

  const avatarSrc = () =>
    currentMessage().isProductRelated
      ? '/sprites/Gato-Tomando-Puka-Power.webp'
      : '/sprites/gato-puka-power-sonriendo.webp';

  const avatarLabel = () =>
    currentMessage().isProductRelated
      ? 'Gatito Puka Power con su lata de energía'
      : 'Gatito Puka Power sonriendo';

  const advanceMessage = () => {
    setCurrentIndex((prev) => (prev + 1) % messages.length);
    setShowBubble(true);
  };

  const handleBubbleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-action]') || target.closest('[data-close]')) return;
    currentMessage().action?.();
    advanceMessage();
  };

  const handleActionClick = (e: MouseEvent) => {
    e.stopPropagation();
    currentMessage().action?.();
  };

  const handleAvatarClick = () => {
    if (!showBubble()) {
      setShowBubble(true);
    } else {
      advanceMessage();
    }
  };

  const progressPct = () => ((currentIndex() + 1) / messages.length) * 100;

  return (
    <div class="fixed top-20 left-4 sm:left-8 z-40 flex flex-col items-start gap-2 max-w-sm sm:max-w-md">
      <div class="flex items-start gap-4">
        <button
          onClick={handleAvatarClick}
          class="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl shadow-2xl border-2 border-brand-accent/30 hover:border-brand-accent/60 transition-all duration-300 hover:scale-110 active:scale-95 bg-brand-secondary overflow-hidden"
          aria-label="Asistente Puka Power"
        >
          <img
            src={avatarSrc()}
            alt={avatarLabel()}
            class="w-full h-full object-cover"
            width="96"
            height="96"
            decoding="async"
          />
          <Show when={!showBubble()}>
            <span class="absolute -top-1 -right-1 w-5 h-5 bg-brand-accent rounded-full flex items-center justify-center animate-bounce shadow-xl border-2 border-brand-light">
              <svg class="w-3 h-3 text-brand-light" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 7h2v2h-2V9zm0 4h2v6h-2v-6z"/>
              </svg>
            </span>
          </Show>
        </button>

        <Show when={showBubble()}>
          <div
            onClick={handleBubbleClick}
            class="relative flex-1 bg-brand-light text-brand-dark p-5 sm:p-6 rounded-2xl shadow-2xl border border-brand-primary/10 cursor-pointer transition-all duration-300 hover:shadow-xl select-none"
          >
            <div class="absolute -left-2.5 top-5 w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-r-[10px] border-r-brand-light" />

            <div class="text-[11px] sm:text-xs text-brand-accent font-extrabold uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-green-400 animate-ping" />
              <span>Asistente Puka</span>
              <span class="ml-auto text-[11px] text-brand-dark/40 font-bold">{currentIndex() + 1}/{messages.length}</span>
            </div>

            <p class="text-sm sm:text-base leading-relaxed font-semibold text-brand-dark/90">
              <span class="mr-1.5 text-base">{currentMessage().icon}</span>
              {currentMessage().text}
            </p>

            <div class="mt-3 h-1.5 bg-brand-primary/5 rounded-full overflow-hidden">
              <div class="h-full bg-brand-accent rounded-full transition-all duration-500" style={{ width: `${progressPct()}%` }} />
            </div>

            <div class="flex items-center justify-between mt-3 pt-2 border-t border-brand-primary/5">
              <span class="text-[11px] sm:text-xs font-bold text-brand-dark/40 flex items-center gap-1">
                {'\u2190'} Siguiente
              </span>

              <Show when={hasAction()}>
                <button
                  data-action
                  onClick={handleActionClick}
                  class="px-3.5 py-1.5 bg-brand-accent hover:bg-brand-accentGold text-brand-light text-[10px] sm:text-xs font-extrabold uppercase tracking-widest rounded-lg transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
                >
                  {currentMessage().actionLabel ?? 'Ir'}
                </button>
              </Show>
            </div>

            <button
              data-close
              onClick={(e) => { e.stopPropagation(); setShowBubble(false); }}
              class="absolute top-2 right-2 w-6 h-6 rounded-full bg-brand-dark/5 hover:bg-brand-dark/10 flex items-center justify-center text-brand-dark/30 hover:text-brand-dark/60 transition-colors text-xs font-bold"
              aria-label="Cerrar mensaje"
            >
              {'\u2715'}
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}
