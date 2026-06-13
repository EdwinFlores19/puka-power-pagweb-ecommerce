import { CATALOG } from '../lib/constants';
import { addItemToCart } from '../store/cartStore';
import { trackAddToCart } from '../lib/analytics';

export default function ProductCatalog() {
  const products = Object.values(CATALOG);

  return (
    <section class="space-y-6">
      <h2 class="text-xs uppercase tracking-widest font-extrabold text-brand-dark/60 mb-2">Selecciona un Pack de Energía</h2>

      {products.map((product) => (
        <div
          class="group bg-brand-light rounded-3xl border border-brand-primary/5 shadow-md flex flex-col sm:flex-row items-center sm:items-stretch justify-between gap-6 hover:shadow-xl transition-all duration-500 ease-out relative"
          classList={{
            'border-2 border-brand-accent shadow-xl p-6': !!product.badge,
            'p-6': !product.badge,
          }}
        >
          {product.badge && (
            <span class="absolute -top-3.5 left-6 bg-brand-accent text-brand-light text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md">
              🔥 {product.badge}
            </span>
          )}

          <div class="flex flex-col sm:flex-row items-center gap-6 w-full" classList={{ 'pt-2 sm:pt-0': !!product.badge }}>
            <div class="w-32 h-32 bg-gradient-to-b from-brand-primary/10 to-brand-primary/25 rounded-2xl flex items-center justify-center shrink-0 border border-brand-primary/10 relative overflow-hidden select-none transition-all duration-500 ease-out group-hover:scale-105 group-hover:shadow-xl"
              classList={{
                'from-brand-accent/10 to-brand-accent/20 border-brand-accent/10': product.id === 2,
                'from-brand-accentGold/10 to-brand-accentGold/20 border-brand-accentGold/10': product.id === 3,
                'from-brand-primary/10 to-brand-primary/25 border-brand-primary/10': product.id === 1,
              }}
            >
              {product.id === 1 && (
                <img src="/sprites/3-puka-power.webp" alt="Pack Reto Puka Power - 3 latas" class="w-full h-full object-contain drop-shadow-[0_4px_12px_rgba(123,17,19,0.3)]" width="128" height="128" loading="lazy" decoding="async" />
              )}
              {product.id === 2 && (
                <img src="/sprites/six-pack-puka-power.webp" alt="Six pack Puka Power - 6 latas" class="w-full h-full object-contain drop-shadow-[0_4px_12px_rgba(123,17,19,0.3)]" width="128" height="128" loading="lazy" decoding="async" />
              )}
              {product.id === 3 && (
                <img src="/sprites/24-puka-power.webp" alt="Suscripción mensual Puka Power - 24 latas" class="w-full h-full object-contain drop-shadow-[0_4px_12px_rgba(123,17,19,0.3)]" width="128" height="128" loading="lazy" decoding="async" />
              )}
            </div>

            <div class="space-y-2 text-center sm:text-left flex-1">
              <h3 class="font-serif text-xl font-bold text-brand-primary">{product.name}</h3>
              <p class="text-xs sm:text-sm text-brand-dark/70 font-light">{product.description}</p>
              <div class="flex items-center justify-center sm:justify-start space-x-3 pt-1">
                <span class="font-sans text-xl font-extrabold text-brand-accent">S/ {product.price.toFixed(2)}</span>
                {product.originalPrice && (
                  <>
                    <span class="text-sm text-brand-dark/40 line-through">S/ {product.originalPrice.toFixed(2)}</span>
                    <span class="text-xs text-brand-success font-semibold">({product.unitLabel})</span>
                  </>
                )}
                {!product.originalPrice && product.unitLabel && (
                  <span class="text-xs text-brand-dark/50">({product.unitLabel})</span>
                )}
              </div>
            </div>
          </div>

          <div class="flex sm:flex-col justify-center sm:justify-between items-center shrink-0 gap-4 w-full sm:w-auto">
            <button
              onClick={() => {
                addItemToCart(product.id);
                trackAddToCart({ id: product.id, name: product.name, price: product.price, qty: 1 });
              }}
              class="w-full sm:w-auto px-6 py-3 font-bold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 shadow-md"
              classList={{
                'bg-brand-accent text-brand-light hover:bg-brand-accentGold': true,
                'font-extrabold px-6 py-4 animate-btn-pulse': product.id === 2,
              }}
            >
              {product.id === 3 ? 'Suscribirse' : 'Añadir'}
              <svg class="inline-block ml-1.5 w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d={product.id === 3 ? 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' : 'M12 4v16m8-8H4'} />
              </svg>
            </button>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes subtle-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 15px 0 rgba(217, 83, 79, 0.4); }
          50% { transform: scale(1.02); box-shadow: 0 4px 25px 0 rgba(217, 83, 79, 0.6); }
        }
        .animate-btn-pulse { animation: subtle-pulse 2.5s infinite ease-in-out; }
      `}</style>
    </section>
  );
}
