import { useStore } from '@nanostores/solid';
import { $totalQty } from '../store/cartStore';

export default function CartBadge() {
  const totalQty = useStore($totalQty);

  return (
    <span class="absolute -top-1 -right-1 bg-brand-accent text-brand-light text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-brand-secondary transition-transform duration-300"
      classList={{
        'scale-90': totalQty() === 0,
        'scale-100': totalQty() > 0,
      }}
    >
      {totalQty()}
    </span>
  );
}
