import { createSignal, Show } from 'solid-js';

interface Message {
  text: string;
  action?: () => void;
  icon?: string;
}

const messages: Message[] = [
  {
    icon: '\u{1F31F}',
    text: '\u{00A1}Hola! Soy el guardi\u{00E1}n de Puka Power \u{1F431}\u{2728}. Bienvenido a la energia ancestral peruana. \u{00BF}Te gu\u{00ED}o por el sitio?',
  },
  {
    icon: '\u{1F33F}',
    text: 'Nuestra energia viene de la c\u{00E1}scara de caf\u{00E9}, camu camu y maca andina. Todo natural, sin qu\u{00ED}micos \u{2705}',
    action: () => scrollToSection('beneficios'),
  },
  {
    icon: '\u{1F34B}',
    text: 'El camu camu amaz\u{00F3}nico tiene hasta 40x m\u{00E1}s Vitamina C que la naranja. \u{00A1}Un escudo inmunol\u{00F3}gico! \u{1F30D}',
    action: () => scrollToSection('ingredientes'),
  },
  {
    icon: '\u{2B50}',
    text: 'Mira lo que dicen los que ya probaron Puka Power. Atletas, programadores y estudiantes lo recomiendan \u{1F91F}',
    action: () => scrollToSection('testimonios'),
  },
  {
    icon: '\u{1F6D2}',
    text: '\u{00BF}Listo para aceptar el reto? Elige tu pack de energia en la tienda. \u{00A1}Env\u{00ED}o gratis en Lima! \u{1F4E6}',
    action: () => { window.location.href = '/tienda'; },
  },
  {
    icon: '\u{1F3AE}',
    text: '\u{00A1}Tenemos un arcade ninja! Completa los 3 niveles y desbloquea un descuento exclusivo. \u{00BF}Aceptas el desaf\u{00ED}o? \u{1F680}',
    action: () => { window.location.href = '/juego'; },
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
  const [hasInteracted, setHasInteracted] = createSignal(false);

  const currentMessage = () => messages[currentIndex()];

  const handleClick = () => {
    if (!hasInteracted()) setHasInteracted(true);
    const msg = currentMessage();
    if (msg.action) msg.action();
    setCurrentIndex((prev) => (prev + 1) % messages.length);
    setShowBubble(true);
  };

  const progressPct = () => ((currentIndex() + 1) / messages.length) * 100;

  return (
    <div class="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50 flex flex-col items-end gap-2 max-w-xs sm:max-w-sm">
      <Show when={showBubble()}>
        <div
          onClick={handleClick}
          class="relative bg-brand-light text-brand-dark p-4 pr-8 rounded-2xl shadow-2xl border border-brand-primary/10 cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 select-none group"
        >
          <div class="text-xs text-brand-accent font-extrabold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-green-400 animate-ping" />
            <span>Asistente Puka</span>
            <span class="ml-auto text-[9px] text-brand-dark/30 font-bold">{currentIndex() + 1}/{messages.length}</span>
          </div>
          <p class="text-sm leading-relaxed">
            <span class="mr-1.5">{currentMessage().icon}</span>
            {currentMessage().text}
          </p>
          <div class="mt-2 h-1 bg-brand-primary/5 rounded-full overflow-hidden">
            <div class="h-full bg-brand-accent rounded-full transition-all duration-300" style={{ width: `${progressPct()}%` }} />
          </div>
          <div class="absolute -bottom-2 right-8 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-brand-light" />
          <button
            onClick={(e) => { e.stopPropagation(); setShowBubble(false); }}
            class="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-dark/5 hover:bg-brand-dark/10 flex items-center justify-center text-brand-dark/30 hover:text-brand-dark/60 transition-colors text-xs font-bold"
            aria-label="Cerrar mensaje"
          >
            {'\u2715'}
          </button>
        </div>
      </Show>

      <button
        onClick={() => {
          if (!showBubble()) {
            setShowBubble(true);
          } else {
            handleClick();
          }
        }}
        class="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full shadow-2xl border-2 border-brand-accent/30 hover:border-brand-accent/60 transition-all duration-300 hover:scale-110 active:scale-95 bg-brand-secondary overflow-hidden group"
        aria-label="Asistente Puka Power"
      >
        <img
          src="/sprites/3-puka-power.png"
          alt="Puka Power - Tu guía de energía"
          class="w-full h-full object-cover drop-shadow-lg"
          width="80"
          height="80"
          decoding="async"
        />
        <Show when={!showBubble()}>
          <span class="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-accent rounded-full flex items-center justify-center animate-bounce">
            <svg class="w-2.5 h-2.5 text-brand-light" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 7h2v2h-2V9zm0 4h2v6h-2v-6z"/>
            </svg>
          </span>
        </Show>
      </button>
    </div>
  );
}
