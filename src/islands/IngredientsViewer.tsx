import { createSignal } from 'solid-js';

const ingredients = [
  {
    id: 1,
    number: 1,
    name: 'Cáscara de Café',
    emoji: '\u2615',
    title: 'Cafeína Limpia de un Subproducto Noble',
    text: 'La cáscara de café contiene antioxidantes excepcionales llamados polifenoles. Proporciona una asimilaci\u00F3n paulatina de cafe\u00EDna natural que reduce la fatiga sin impactar violentamente el sistema nervioso central. Ideal para flujos de trabajo prolongados.',
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
  const [expanded, setExpanded] = createSignal<number | null>(null);

  const toggle = (id: number) => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  return (
    <section
      class="mt-20 scroll-mt-24 relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 md:pl-52 lg:pl-60"
      id="ingredientes"
    >
      <div class="absolute inset-0 -mx-4 sm:-mx-6 lg:-mx-8 bg-brand-primary/[0.03] rounded-3xl pointer-events-none" />

      <div class="relative">
        <div class="text-center mb-12">
          <span class="inline-block text-brand-accent text-xs font-extrabold uppercase tracking-[0.2em] mb-3">
            {'\uD83C\uDF3F'} La Tr\u00EDada Sagrada
          </span>
          <h3 class="font-serif text-3xl sm:text-4xl font-extrabold text-brand-primary leading-tight">
            Nuestros 3 Ingredientes{' '}
            <span class="text-brand-accent">Sagrados</span>
          </h3>
          <div class="mt-4 w-16 h-1 bg-brand-accent rounded-full mx-auto" />
        </div>

        <div class="max-w-3xl mx-auto space-y-5">
          {ingredients.map((ing, idx) => {
            const open = expanded() === ing.id;
            return (
              <div class="relative flex items-start gap-4 sm:gap-5">
                {idx < ingredients.length - 1 && (
                  <div class="absolute left-[23px] sm:left-[27px] top-14 bottom-0 w-0.5 bg-brand-accent/15" />
                )}

                <div
                  class="relative z-10 w-11 h-11 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center font-black text-base sm:text-lg shrink-0 transition-all duration-300"
                  classList={{
                    'bg-brand-accent text-brand-light shadow-lg shadow-brand-accent/30 scale-110':
                      open,
                    'bg-brand-primary/10 text-brand-primary': !open,
                  }}
                >
                  {ing.number}
                </div>

                <button
                  onClick={() => toggle(ing.id)}
                  class="flex-1 bg-brand-light rounded-2xl border text-left transition-all duration-300 cursor-pointer overflow-hidden"
                  classList={{
                    'border-brand-accent shadow-lg shadow-brand-accent/10': open,
                    'border-brand-primary/10 hover:border-brand-accent/50 hover:shadow-md':
                      !open,
                  }}
                >
                  <div class="flex items-center gap-3 sm:gap-4 p-4 sm:p-5">
                    <span class="text-2xl sm:text-3xl shrink-0">{ing.emoji}</span>
                    <div class="min-w-0">
                      <h4 class="font-serif text-base sm:text-lg font-bold text-brand-primary">
                        {ing.name}
                      </h4>
                      <p class="text-xs text-brand-dark/40 font-medium mt-0.5">
                        {open
                          ? '\u25B2 Ocultar detalles'
                          : '\u25BC Ver m\u00E1s'}
                      </p>
                    </div>
                  </div>

                  <div
                    class="transition-all duration-500 overflow-hidden"
                    classList={{ 'max-h-0': !open, 'max-h-96': open }}
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
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
