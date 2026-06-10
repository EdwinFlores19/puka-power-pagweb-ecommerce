import { createSignal } from 'solid-js';

const ingredients = [
  {
    id: 1,
    number: 1,
    name: 'Cáscara de Café',
    title: 'Cáscara de Café - Cafeína Limpia de un Subproducto Noble',
    text: 'La cáscara de café contiene antioxidantes excepcionales llamados polifenoles. Proporciona una asimilación paulatina de cafeína natural que, al combinarse con potasio natural, reduce la fatiga sin impactar violentamente el sistema nervioso central. Ideal para flujos de trabajo prolongados.',
  },
  {
    id: 2,
    number: 2,
    name: 'Camu Camu Peruano',
    title: 'Camu Camu - El Escudo Inmunológico de la Selva',
    text: 'Con hasta 40 veces más Vitamina C que la naranja, el Camu Camu amazónico estimula la producción de colágeno y previene el estrés oxidativo provocado por el ejercicio de alta exigencia o las largas noches de estudio. Incrementa el rendimiento celular orgánico.',
  },
  {
    id: 3,
    number: 3,
    name: 'Maca Negra Andina',
    title: 'Maca Negra Andina - Adaptógeno Supremo de Resistencia',
    text: 'Cultivada por encima de los 4,000 metros, la Maca Negra actúa directamente sobre las glándulas suprarrenales para estabilizar la producción de cortisol. Esto mitiga el estrés mental, optimiza la memoria a largo plazo y mejora la resistencia aeróbica muscular de forma acumulativa.',
  },
];

export default function IngredientsViewer() {
  const [selected, setSelected] = createSignal<number | null>(null);

  const toggleIngredient = (id: number) => {
    setSelected((prev) => (prev === id ? null : id));
  };

  const activeIngredient = () => ingredients.find((i) => i.id === selected());

  return (
    <div class="mt-20 scroll-mt-24 bg-brand-primary/5 rounded-3xl p-6 sm:p-10 border border-brand-primary/10" id="ingredientes">
      <h3 class="font-serif text-2xl sm:text-3xl font-extrabold text-brand-primary text-center mb-8">Nuestros 3 Ingredientes Sagrados</h3>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        {ingredients.map((ing) => (
          <button
            onClick={() => toggleIngredient(ing.id)}
            class="bg-brand-light p-6 rounded-2xl border text-left transition-all duration-300 cursor-pointer"
            classList={{
              'border-brand-accent shadow-md': selected() === ing.id,
              'border-brand-primary/10 hover:border-brand-accent': selected() !== ing.id,
            }}
          >
            <div class="flex items-center space-x-3 mb-3">
              <span class="w-8 h-8 rounded-full bg-brand-primary text-brand-light flex items-center justify-center font-bold text-sm shrink-0">{ing.number}</span>
              <h4 class="font-serif text-lg font-bold text-brand-primary">{ing.name}</h4>
            </div>
            <p class="text-sm text-brand-dark/80">{ing.text}</p>
          </button>
        ))}
      </div>

      <div
        class="mt-8 overflow-hidden transition-all duration-500"
        classList={{
          'max-h-0 opacity-0': !selected(),
          'max-h-96 opacity-100': !!selected(),
        }}
      >
        <div class="bg-brand-primary text-brand-light p-6 rounded-2xl">
          <h5 class="font-serif text-lg sm:text-xl font-bold text-brand-accentGold mb-2">{activeIngredient()?.title}</h5>
          <p class="text-sm sm:text-base leading-relaxed">{activeIngredient()?.text}</p>
        </div>
      </div>
    </div>
  );
}
