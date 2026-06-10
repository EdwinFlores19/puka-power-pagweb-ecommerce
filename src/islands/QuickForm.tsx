import { createSignal } from 'solid-js';

interface FormData {
  nombre: string;
  email: string;
  telefono: string;
  departamento: string;
  pack: string;
}

const initialForm: FormData = {
  nombre: '',
  email: '',
  telefono: '',
  departamento: 'lima',
  pack: 'reto3dias',
};

export default function QuickForm() {
  const [formData, setFormData] = createSignal<FormData>(initialForm);
  const [isPending, setIsPending] = createSignal(false);
  const [feedback, setFeedback] = createSignal<{ type: 'success' | 'error'; message: string } | null>(null);

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setIsPending(true);
    setFeedback(null);

    try {
      const { actions } = await import('astro:actions');
      const { error } = await actions.sendLead(formData());

      if (error) {
        setFeedback({ type: 'error', message: 'Error al procesar tu solicitud. Intenta de nuevo.' });
      } else {
        setFeedback({ type: 'success', message: `🎉 ¡Gracias por tu pedido, ${formData().nombre}! Un asesor te contactará pronto.` });
        setFormData(initialForm);
      }
    } catch {
      setFeedback({ type: 'error', message: 'Error al enviar tu solicitud. Verifica tu conexión e intenta de nuevo.' });
    }

    setIsPending(false);
  };

  const packName = () => formData().pack === 'reto3dias' ? 'Pack Reto (3 latas) - S/ 24.90' : 'Pack Pro (12 latas) - S/ 79.90';

  return (
    <form onSubmit={handleSubmit} class="space-y-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label for="qf-name" class="block text-xs font-bold uppercase tracking-wider text-brand-dark/70 mb-2">Nombre Completo</label>
          <input
            type="text"
            id="qf-name"
            required
            placeholder="Ej. Juan Pérez"
            value={formData().nombre}
            onInput={(e) => updateField('nombre', e.currentTarget.value)}
            class="w-full px-4 py-3 rounded-xl bg-brand-secondary border border-brand-primary/10 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all duration-200"
          />
        </div>
        <div>
          <label for="qf-email" class="block text-xs font-bold uppercase tracking-wider text-brand-dark/70 mb-2">Correo Electrónico</label>
          <input
            type="email"
            id="qf-email"
            required
            placeholder="Ej. juan@correo.com"
            value={formData().email}
            onInput={(e) => updateField('email', e.currentTarget.value)}
            class="w-full px-4 py-3 rounded-xl bg-brand-secondary border border-brand-primary/10 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all duration-200"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label for="qf-phone" class="block text-xs font-bold uppercase tracking-wider text-brand-dark/70 mb-2">Celular / WhatsApp</label>
          <input
            type="tel"
            id="qf-phone"
            required
            placeholder="Ej. 987654321"
            value={formData().telefono}
            onInput={(e) => updateField('telefono', e.currentTarget.value)}
            class="w-full px-4 py-3 rounded-xl bg-brand-secondary border border-brand-primary/10 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all duration-200"
          />
        </div>
        <div>
          <label for="qf-department" class="block text-xs font-bold uppercase tracking-wider text-brand-dark/70 mb-2">Departamento de Envío</label>
          <select
            id="qf-department"
            required
            value={formData().departamento}
            onChange={(e) => updateField('departamento', e.currentTarget.value)}
            class="w-full px-4 py-3 rounded-xl bg-brand-secondary border border-brand-primary/10 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all duration-200"
          >
            <option value="lima">Lima & Callao (Envío Gratis)</option>
            <option value="arequipa">Arequipa</option>
            <option value="cusco">Cusco</option>
            <option value="trujillo">La Libertad</option>
            <option value="provincia">Otros Departamentos</option>
          </select>
        </div>
      </div>

      <div>
        <label class="block text-xs font-bold uppercase tracking-wider text-brand-dark/70 mb-3">Elige tu Pack de Energía</label>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label class="relative flex p-4 bg-brand-secondary rounded-xl border border-brand-primary/20 cursor-pointer hover:bg-brand-primary/5 transition-all"
            classList={{ 'border-brand-accent ring-1 ring-brand-accent': formData().pack === 'reto3dias' }}
          >
            <input
              type="radio"
              name="product_pack"
              value="reto3dias"
              checked={formData().pack === 'reto3dias'}
              onChange={(e) => e.currentTarget.checked && updateField('pack', 'reto3dias')}
              class="mt-1 h-4 w-4 text-brand-accent border-gray-300 focus:ring-brand-accent"
            />
            <span class="ml-3 flex flex-col">
              <span class="block text-sm font-bold text-brand-primary">Pack Reto (3 latas)</span>
              <span class="block text-xs text-brand-dark/60">Prueba y convéncete</span>
              <span class="block text-sm font-extrabold text-brand-accent mt-1">S/ 24.90</span>
            </span>
          </label>

          <label class="relative flex p-4 bg-brand-secondary rounded-xl border cursor-pointer hover:bg-brand-primary/5 transition-all"
            classList={{
              'border-brand-accentGold/60': formData().pack === 'packpro',
              'border-brand-primary/20': formData().pack !== 'packpro',
            }}
          >
            <input
              type="radio"
              name="product_pack"
              value="packpro"
              checked={formData().pack === 'packpro'}
              onChange={(e) => e.currentTarget.checked && updateField('pack', 'packpro')}
              class="mt-1 h-4 w-4 text-brand-accent border-gray-300 focus:ring-brand-accent"
            />
            <span class="ml-3 flex flex-col">
              <span class="block text-sm font-bold text-brand-primary flex items-center">
                Pack Pro (12 latas)
                <span class="ml-2 bg-brand-accent text-brand-light text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded">Mejor Valor</span>
              </span>
              <span class="block text-xs text-brand-dark/60">Energía para el mes</span>
              <span class="block text-sm font-extrabold text-brand-accent mt-1">S/ 79.90</span>
            </span>
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending()}
        class="w-full py-4 bg-brand-accent text-brand-light font-extrabold text-sm uppercase tracking-widest rounded-xl hover:bg-brand-accentGold transition-all duration-300 transform hover:-translate-y-0.5 shadow-xl shadow-brand-accent/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
      >
        {isPending() ? 'Procesando...' : `Finalizar Compra Segura - ${packName()}`}
      </button>

      {feedback() && (
        <div
          class="mt-4 p-4 rounded-xl text-center font-bold text-sm transition-all duration-300"
          classList={{
            'bg-brand-success/10 text-brand-success': feedback()!.type === 'success',
            'bg-brand-accent/10 text-brand-accent': feedback()!.type === 'error',
          }}
        >
          {feedback()!.message}
        </div>
      )}
    </form>
  );
}
