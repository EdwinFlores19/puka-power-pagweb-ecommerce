import { createSignal, onCleanup } from 'solid-js';

const ingredients = [
  {
    id: 1,
    number: 1,
    name: 'C\u00E1scara de Caf\u00E9',
    emoji: '\u2615',
    title: 'Cafe\u00EDna Limpia de un Subproducto Noble',
    text: 'La c\u00E1scara de caf\u00E9 contiene antioxidantes excepcionales llamados polifenoles. Proporciona una asimilaci\u00F3n paulatina de cafe\u00EDna natural que reduce la fatiga sin impactar violentamente el sistema nervioso central. Ideal para flujos de trabajo prolongados.',
  },
  {
    id: 2,
    number: 2,
    name: 'Camu Camu Peruano',
    emoji: '\uD83C\uDF4B',
    title: 'El Escudo Inmunol\u00F3gico de la Selva',
    text: 'Con hasta 40 veces m\u00E1s Vitamina C que la naranja, el Camu Camu amaz\u00F3nico estimula la producci\u00F3n de col\u00E1geno y previene el estr\u00E9s oxidativo provocado por el ejercicio de alta exigencia o las largas noches de estudio. Incrementa el rendimiento celular org\u00E1nico.',
  },
  {
    id: 3,
    number: 3,
    name: 'Maca Negra Andina',
    emoji: '\uD83C\uDF31',
    title: 'Adapt\u00F3geno Supremo de Resistencia',
    text: 'Cultivada por encima de los 4,000 metros, la Maca Negra act\u00FAa directamente sobre las gl\u00E1ndulas suprarrenales para estabilizar la producci\u00F3n de cortisol. Mitiga el estr\u00E9s mental, optimiza la memoria a largo plazo y mejora la resistencia aer\u00F3bica muscular de forma acumulativa.',
  },
];

export default function IngredientsViewer() {
  const [hovered, setHovered] = createSignal<number | null>(null);
  let leaveTimer: ReturnType<typeof setTimeout> | null = null;

  onCleanup(() => {
    if (leaveTimer) clearTimeout(leaveTimer);
  });

  const handleMouseEnter = (id: number) => {
    if (leaveTimer) clearTimeout(leaveTimer);
    setHovered(id);
  };

  const handleMouseLeave = () => {
    leaveTimer = setTimeout(() => setHovered(null), 150);
  };

  return (
    <section
      class="py-16 sm:py-20 scroll-mt-24 bg-brand-primary/[0.02] border-y border-brand-primary/5"
      id="ingredientes"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 md:pl-52 lg:pl-60">
        <div class="text-center mb-12">
          <h3 class="font-serif text-3xl sm:text-4xl font-extrabold text-brand-primary leading-tight">
            Nuestros 3 Ingredientes{' '}
            <span class="text-brand-accent">Sagrados</span>
          </h3>
          <div class="mt-4 w-16 h-1 bg-brand-accent rounded-full mx-auto" />
        </div>

        <div class="max-w-3xl mx-auto space-y-5">
          {ingredients.map((ing, idx) => {
            const open = hovered() === ing.id;
            return (
              <div
                class="relative flex items-start gap-4 sm:gap-5"
                onMouseEnter={() => handleMouseEnter(ing.id)}
                onMouseLeave={handleMouseLeave}
              >
                {idx < ingredients.length - 1 && (
                  <div class="absolute left-[23px] sm:left-[27px] top-14 bottom-0 w-0.5 bg-brand-accent/15" />
                )}

                <div
                  class="relative z-10 w-11 h-11 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center font-black text-base sm:text-lg shrink-0 transition-all duration-500 ease-out"
                  classList={{
                    'bg-brand-accent text-brand-light shadow-lg shadow-brand-accent/30 scale-110':
                      open,
                    'bg-brand-primary/10 text-brand-primary scale-100': !open,
                  }}
                >
                  {ing.number}
                </div>

                <div
                  class="flex-1 bg-brand-light rounded-2xl border text-left cursor-default transition-all duration-500 ease-out overflow-hidden"
                  classList={{
                    'border-brand-accent shadow-lg shadow-brand-accent/10': open,
                    'border-brand-primary/10': !open,
                  }}
                >
                  <div class="flex items-center gap-3 sm:gap-4 p-4 sm:p-5">
                    <span class="text-2xl sm:text-3xl shrink-0">{ing.emoji}</span>
                    <div class="min-w-0">
                      <h4 class="font-serif text-base sm:text-lg font-bold text-brand-primary">
                        {ing.name}
                      </h4>
                    </div>
                    <svg
                      class="ml-auto w-4 h-4 text-brand-dark/20 shrink-0 transition-transform duration-500 ease-out"
                      classList={{ 'rotate-180': open }}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  <div
                    class="transition-all duration-500 ease-in-out overflow-hidden"
                    classList={{ 'max-h-0 opacity-0': !open, 'max-h-96 opacity-100': open }}
                  >
                    <div class="px-4 sm:px-5 pb-5 pt-0 border-t border-brand-accent/10">
                      <div class="mt-3 p-4 sm:p-5 bg-gradient-to-br from-brand-primary/[0.04] to-brand-accent/[0.04] rounded-xl border border-brand-primary/5">
                        <h5 class="font-serif text-base sm:text-lg font-bold text-brand-accent mb-2">
                          {ing.title}
                        </h5>
                        <p class="text-sm sm:text-base text-brand-dark/80 leading-relaxed">
                          {ing.text}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
