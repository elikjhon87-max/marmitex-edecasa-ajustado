import { useState } from 'react';
import { Star, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function RatingScreen({
  orderId,
  userId,
  onDone,
}: {
  orderId: string;
  userId: string;
  onDone: () => void;
}) {
  const [mealStars, setMealStars] = useState(5);
  const [deliveryStars, setDeliveryStars] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [hoverMeal, setHoverMeal] = useState(0);
  const [hoverDelivery, setHoverDelivery] = useState(0);

  async function submit() {
    setSaving(true);
    const { error } = await supabase.from('order_ratings').insert({
      order_id: orderId,
      user_id: userId,
      meal_stars: mealStars,
      delivery_stars: deliveryStars,
      comment: comment.trim(),
    });
    setSaving(false);
    if (!error) {
      setDone(true);
      setTimeout(onDone, 1200);
    }
  }

  if (done) {
    return (
      <div className="bg-zinc-900 border-2 border-emerald-600 rounded-xl p-5 text-center space-y-2">
        <CheckCircle2 className="text-emerald-400 mx-auto" size={36} />
        <p className="text-sm font-bold text-emerald-400">Avaliação enviada. Obrigado!</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border-2 border-yellow-500 rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-bold text-yellow-400 uppercase text-center">Avalie seu pedido</h3>

      <StarRow
        label="Qualidade da marmita"
        value={mealStars}
        hover={hoverMeal}
        onHover={setHoverMeal}
        onPick={setMealStars}
      />
      <StarRow
        label="Velocidade da entrega"
        value={deliveryStars}
        hover={hoverDelivery}
        onPick={setDeliveryStars}
        onHover={setHoverDelivery}
      />

      <div>
        <label className="text-xs font-bold text-zinc-400 block mb-1">Comentário (opcional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Conte como foi sua experiência..."
          rows={3}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-100 focus:border-yellow-500 focus:outline-none resize-none"
        />
      </div>

      <button
        onClick={submit}
        disabled={saving}
        className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />}
        Enviar avaliação
      </button>
    </div>
  );
}

function StarRow({
  label,
  value,
  hover,
  onHover,
  onPick,
}: {
  label: string;
  value: number;
  hover: number;
  onHover: (n: number) => void;
  onPick: (n: number) => void;
}) {
  return (
    <div>
      <p className="text-xs font-bold text-zinc-300 mb-1">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = (hover || value) >= n;
          return (
            <button
              key={n}
              onMouseEnter={() => onHover(n)}
              onMouseLeave={() => onHover(0)}
              onClick={() => onPick(n)}
              className="p-1"
              aria-label={`${n} estrelas`}
            >
              <Star
                size={26}
                className={active ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-700'}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
