import { createSignal, Show, onMount, onCleanup, createEffect } from 'solid-js';

interface Message {
  text: string;
  action?: () => void;
  icon?: string;
  actionLabel?: string;
  isProductRelated?: boolean;
  /**
   * Optional companion character (e.g. Mio the black cat) shown on the right
   * when this message is active. Only used in /tienda when the user has
   * won the campaign. The companion's bubble is shown after a small delay
   * so the two characters feel like a conversation.
   */
  companion?: {
    image: string;
    name: string;
    text: string;
    delayMs?: number;
  };
}

const baseMessages: Message[] = [
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

/**
 * Special "winner" message shown at the top in /tienda when the user has
 * completed the 3-level campaign. Includes a companion bubble from Mio
 * (the black cat) appearing on the right with a reply message.
 */
const winnerMessage: Message = {
  icon: '\u{1F3C6}',
  text: '\u{00A1}MIAU! \u{1F431} \u{00A1}Felicidades, campe\u{00F3}n! Completaste los 3 niveles y atrapaste a Garu. Eres una verdadera Ninja del amor. Tu 15% de descuento ya est\u{00E1} activado en tu carrito. \u{1F48B}\u{1F3C6}',
  action: () => { window.location.href = '/tienda#productos'; },
  actionLabel: 'Ver mi descuento',
  isProductRelated: true,
  companion: {
    image: '/sprites/gato_negro_cuerpo_completo.png',
    name: 'Mio',
    text: '\u{00A1}Verdad! \u{1F431} Yo tambi\u{00E9}n lo vi desde el \u00E1rbol... Puka Power le dio la energ\u00EDa a Pucca para alcanzar a Garu \u{1F525}\u{1F60A}',
    delayMs: 1200,
  },
};

const WINNER_STORAGE_KEY = 'puka_campaign_won';

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.remove('animate-section-glow');
    void el.offsetWidth;
    el.classList.add('animate-section-glow');
    setTimeout(() => el.classList.remove('animate-section-glow'), 1200);
  }
}

interface Props {
  autoShowDelay?: number;
  startIndex?: number;
  /** When true, the companion cat (Mio) appears on the right when its bubble is active. */
  enableCompanion?: boolean;
}

export default function MascotGuide(props: Props) {
  const [isWinner, setIsWinner] = createSignal(false);
  const [currentIndex, setCurrentIndex] = createSignal(props.startIndex ?? 0);
  const [showBubble, setShowBubble] = createSignal((props.autoShowDelay ?? 0) === 0);
  const [showCompanion, setShowCompanion] = createSignal(false);
  const [showMainBubble, setShowMainBubble] = createSignal(false);
  let companionTimer: ReturnType<typeof setTimeout> | null = null;
  let mainBubbleTimer: ReturnType<typeof setTimeout> | null = null;

  // Build the active messages list: when the user has won the campaign,
  // the winner greeting is prepended so it's the first thing they see.
  const allMessages = (): Message[] => {
    if (isWinner()) {
      return [winnerMessage, ...baseMessages];
    }
    return baseMessages;
  };

  // Whether the companion (Mio) should be rendered. Only in /tienda after
  // the user has won AND the current message has a companion.
  const showCompanionCat = () => {
    if (!props.enableCompanion) return false;
    if (!isWinner()) return false;
    const m = currentMessage();
    return !!(m.companion);
  };

  // When the current message changes, schedule the companion bubble.
  createEffect(() => {
    const m = currentMessage();
    if (companionTimer) { clearTimeout(companionTimer); companionTimer = null; }
    if (mainBubbleTimer) { clearTimeout(mainBubbleTimer); mainBubbleTimer = null; }
    setShowCompanion(false);
    if (showCompanionCat() && m.companion) {
      // Show main bubble first, then companion after the delay.
      setShowMainBubble(false);
      companionTimer = setTimeout(() => {
        setShowCompanion(true);
        companionTimer = null;
      }, m.companion.delayMs ?? 1200);
    } else {
      setShowCompanion(false);
      setShowMainBubble(showBubble());
    }
  });

  onMount(() => {
    // Detect whether the user has won the campaign via cross-page flag
    if (typeof window !== 'undefined') {
      try {
        if (localStorage.getItem(WINNER_STORAGE_KEY) === 'true') {
          setIsWinner(true);
          setCurrentIndex(0);
        }
      } catch (_) { /* localStorage unavailable; ignore */ }
    }

    const delay = props.autoShowDelay ?? 0;
    if (delay > 0) {
      setTimeout(() => {
        setShowBubble(true);
        setShowMainBubble(true);
      }, delay);
    } else {
      setShowMainBubble(true);
    }
  });

  onCleanup(() => {
    if (companionTimer) clearTimeout(companionTimer);
    if (mainBubbleTimer) clearTimeout(mainBubbleTimer);
  });

  const currentMessage = () => allMessages()[currentIndex()];
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
    if (companionTimer) { clearTimeout(companionTimer); companionTimer = null; }
    if (mainBubbleTimer) { clearTimeout(mainBubbleTimer); mainBubbleTimer = null; }
    setShowCompanion(false);
    setCurrentIndex((prev) => (prev + 1) % allMessages().length);
    setShowBubble(true);
    setShowMainBubble(true);
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
      setShowMainBubble(true);
    } else {
      advanceMessage();
    }
  };

  const progressPct = () => ((currentIndex() + 1) / allMessages().length) * 100;

  return (
    <div class="fixed top-24 left-4 sm:left-8 right-4 sm:right-8 z-40 flex justify-between items-start gap-3 pointer-events-none">
      {/* Left: Puka Power guardian cat (the original mascot) */}
      <div class="flex items-start gap-2 sm:gap-3 max-w-xs sm:max-w-sm pointer-events-auto">
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

        <Show when={showBubble() && showMainBubble()}>
          <div
            onClick={handleBubbleClick}
            class="relative flex-1 bg-brand-light text-brand-dark p-3 sm:p-4 rounded-2xl shadow-2xl border border-brand-primary/10 cursor-pointer transition-all duration-300 hover:shadow-xl select-none animate-bubble-in"
          >
            <div class="absolute -left-2.5 top-4 w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-r-[10px] border-r-brand-light" />

            <div class="text-[10px] sm:text-xs text-brand-accent font-extrabold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <Show when={isWinner() && currentIndex() === 0}>
                <span class="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                <span>Asistente Puka {'\u{1F3C6}'}</span>
              </Show>
              <Show when={!(isWinner() && currentIndex() === 0)}>
                <span class="w-2 h-2 rounded-full bg-green-400 animate-ping" />
                <span>Asistente Puka</span>
              </Show>
              <span class="ml-auto text-[10px] text-brand-dark/40 font-bold">{currentIndex() + 1}/{allMessages().length}</span>
            </div>

            <p class="text-xs sm:text-sm leading-relaxed font-semibold text-brand-dark/90">
              <span class="mr-1 text-sm">{currentMessage().icon}</span>
              {currentMessage().text}
            </p>

            <div class="mt-2 h-1 bg-brand-primary/5 rounded-full overflow-hidden">
              <div class="h-full bg-brand-accent rounded-full transition-all duration-500" style={{ width: `${progressPct()}%` }} />
            </div>

            <div class="flex items-center justify-between mt-2 pt-1.5 border-t border-brand-primary/5">
              <span class="text-[10px] font-bold text-brand-dark/40 flex items-center gap-1">
                {'\u2190'} Siguiente
              </span>

              <Show when={hasAction()}>
                <button
                  data-action
                  onClick={handleActionClick}
                  class="px-2.5 py-1 bg-brand-accent hover:bg-brand-accentGold text-brand-light text-[9px] font-extrabold uppercase tracking-widest rounded-lg transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
                >
                  {currentMessage().actionLabel ?? 'Ir'}
                </button>
              </Show>
            </div>

            <button
              data-close
              onClick={(e) => { e.stopPropagation(); setShowBubble(false); setShowMainBubble(false); }}
              class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-brand-dark/5 hover:bg-brand-dark/10 flex items-center justify-center text-brand-dark/30 hover:text-brand-dark/60 transition-colors text-xs font-bold"
              aria-label="Cerrar mensaje"
            >
              {'\u2715'}
            </button>
          </div>
        </Show>
      </div>

      {/* Right: Mio the black cat (companion, only when winner + companion is defined) */}
      <Show when={showCompanionCat() && currentMessage().companion}>
        {(comp) => (
          <div class="flex items-start gap-2 sm:gap-3 max-w-xs sm:max-w-sm pointer-events-auto flex-row-reverse animate-bubble-in">
            <div class="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl shadow-2xl border-2 border-brand-primary/10 bg-brand-secondary overflow-hidden">
              <img
                src={comp().image}
                alt={comp().name}
                class="w-full h-full object-contain"
                width="96"
                height="96"
                decoding="async"
              />
              <div class="absolute -bottom-1 -right-1 w-7 h-7 bg-brand-accent rounded-full flex items-center justify-center text-xs font-black text-brand-dark shadow-lg ring-2 ring-brand-light">
                M
              </div>
            </div>

            <Show when={showCompanion()}>
              <div class="relative flex-1 bg-brand-light text-brand-dark p-3 sm:p-4 rounded-2xl shadow-2xl border border-brand-primary/10">
                <div class="absolute -right-2.5 top-4 w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[10px] border-l-brand-light" />

                <div class="text-[10px] sm:text-xs text-brand-accent font-extrabold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-green-400 animate-ping" />
                  <span>{comp().name}</span>
                </div>

                <p class="text-xs sm:text-sm leading-relaxed font-semibold text-brand-dark/90">
                  {comp().text}
                </p>
              </div>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}
