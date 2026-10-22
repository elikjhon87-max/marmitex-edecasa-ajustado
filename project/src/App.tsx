import { useEffect, useState, type FormEvent } from 'react';
import {
  ShoppingBag,
  Utensils,
  Phone,
  Clock,
  MapPin,
  LogIn,
  Check,
  Settings,
  AlertCircle,
  Loader2,
  Plus,
  Wallet,
  QrCode,
  Banknote,
  CreditCard,
  Clock3,
  Gift,
  History,
  X,
  UserCircle2,
  KeyRound,
} from 'lucide-react';
import {
  supabase,
  type MenuItem,
  type BusinessConfig,
  type MarmitaSize,
  type Protein,
  type Extra,
  type DeliveryZone,
  type Coupon,
  type OrderLog,
  type DeliveryDriver,
  WEEKDAY_KEYS,
  FALLBACK_SIZES,
  FALLBACK_PROTEINS,
  ADMIN_PASSWORD,
} from '@/lib/supabase';
import { generate4DigitPIN } from '@/lib/format';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { AdminPanel } from '@/components/AdminPanel';
import { CustomerForm, type Customer } from '@/components/CustomerForm';
import { DeliveryOptions, type DeliveryChoice, getScheduledFor } from '@/components/DeliveryOptions';
import { PixModal } from '@/components/PixModal';
import { AuthScreen } from '@/components/AuthScreen';
import { ProfilePanel } from '@/components/ProfilePanel';
import { OrderTracker } from '@/components/OrderTracker';
import { RatingScreen } from '@/components/RatingScreen';
import { NotificationBell } from '@/components/NotificationBell';
import { ChatWidget } from '@/components/ChatWidget';
import { CartBar } from '@/components/CartBar';
import { DriverAuth } from '@/components/DriverAuth';
import { DriverPortal } from '@/components/DriverPortal';
import { CartDrawer } from '@/components/CartDrawer';
import { UtensilsCrossed, ClipboardList, Home as HomeIcon, ShoppingCart, MessageCircle, Bike } from 'lucide-react';
import { type CartItem } from '@/lib/supabase';

function todayWeekday(): string {
  return WEEKDAY_KEYS[(new Date().getDay() + 6) % 7];
}

function isStoreOpen(config: BusinessConfig | null): { open: boolean; reason: string } {
if (!config) return { open: true, reason: '' };
const today = todayWeekday();
if ((config.closed_days ?? []).includes(today)) {
return { open: false, reason: 'Estamos montando o cardápio especial do dia. Faça seu pedido antecipado.' };
}

const now = new Date();
const currentMinutes = now.getHours() * 60 + now.getMinutes();

// Turno 1: Almoço
const [loh, lom] = (config.lunch_open_hours ?? '11:00').split(':').map(Number);
const [lch, lcm] = (config.lunch_close_hours ?? '15:00').split(':').map(Number);
const lunchOpenMin = loh * 60 + lom;
const lunchCloseMin = lch * 60 + lcm;
const isOpenLunch = currentMinutes >= lunchOpenMin && currentMinutes < lunchCloseMin;

// Turno 2: Janta
const [oh, om] = (config.open_hours ?? '18:00').split(':').map(Number);
const [ch, cm] = (config.close_hours ?? '23:00').split(':').map(Number);
const dinnerOpenMin = oh * 60 + om;
const dinnerCloseMin = ch * 60 + cm;
const isOpenDinner = currentMinutes >= dinnerOpenMin && currentMinutes < dinnerCloseMin;

// Se não estiver aberto nem no almoço nem na janta
if (!isOpenLunch && !isOpenDinner) {
return { open: false, reason: 'Estamos montando o cardápio especial do dia. Faça seu pedido antecipado.' };
}

return { open: true, reason: '' };
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

function AppInner() {
  const { profile, session, addresses, refreshProfile } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [config, setConfig] = useState<BusinessConfig | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [sizes, setSizes] = useState<MarmitaSize[]>(FALLBACK_SIZES);
  const [proteins, setProteins] = useState<Protein[]>(FALLBACK_PROTEINS);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [orderHistory, setOrderHistory] = useState<OrderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<Customer>(() => {
    const saved = localStorage.getItem('edecasa_customer');
    return saved ? JSON.parse(saved) : { name: '', phone: '', address: '' };
  });
  const [selectedSizeId, setSelectedSizeId] = useState('g');
  const [selectedOption, setSelectedOption] = useState('');
  const [selectedProteinId, setSelectedProteinId] = useState('');
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);
  const [customObs, setCustomObs] = useState('');
  const [wantSurcharge, setWantSurcharge] = useState(true);
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('edecasa_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [addedFlash, setAddedFlash] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'dinheiro' | 'cartao'>('pix');
  const [paymentTiming, setPaymentTiming] = useState<'agora' | 'entrega'>('entrega');
  const [changeFor, setChangeFor] = useState('');
  const [showPixModal, setShowPixModal] = useState(false);
  const [deliveryChoice, setDeliveryChoice] = useState<DeliveryChoice>({ zoneId: '', needsMotoboy: false, pickup: false, scheduleMode: 'now', scheduledFor: '', destinationAddress: '', calculatedFee: null, distanceKm: null, durationMin: null, routeError: '' });
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [trackerOrderId, setTrackerOrderId] = useState<string | null>(null);
  const [ratingOrder, setRatingOrder] = useState<OrderLog | null>(null);
  const [lastPlacedPin, setLastPlacedPin] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'cardapio' | 'pedidos' | 'perfil'>('cardapio');
  const [showDriverPortal, setShowDriverPortal] = useState(false);
  const [driverAuthOpen, setDriverAuthOpen] = useState(false);
  const [loggedDriver, setLoggedDriver] = useState<DeliveryDriver | null>(null);

  const todayKey = todayWeekday();
  const visibleMenuItems = menuItems.filter((item) => {
    if (!item.available) return false;
    const days = item.available_days ?? [];
    if (days.length === 0) return true;
    return days.includes(todayKey);
  });
  const visibleSizes = sizes.filter((size) => size.available);
  const visibleProteins = proteins.filter((protein) => protein.available);
  const visibleExtras = extras.filter((extra) => extra.available);
  const selectedSize = visibleSizes.find((size) => size.id === selectedSizeId) ?? visibleSizes[0] ?? FALLBACK_SIZES[1];
  const selectedProtein = visibleProteins.find((protein) => protein.id === selectedProteinId) ?? visibleProteins[0] ?? FALLBACK_PROTEINS[0];
  const selectedMenuItem = menuItems.find((item) => item.title === selectedOption);
  const selectedExtras = visibleExtras.filter((extra) => selectedExtraIds.includes(extra.id));
  const extrasTotal = selectedExtras.reduce((total, extra) => total + Number(extra.price), 0);
  const menuItemSurcharge = wantSurcharge ? Number(selectedMenuItem?.price ?? 0) : 0;
  const unitPrice = Number(selectedSize.price) + Number(selectedProtein.price) + menuItemSurcharge;
  const cartItemsTotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const visibleDeliveryZones = deliveryZones.filter((z) => z.active);
  const selectedZone = visibleDeliveryZones.find((z) => z.id === deliveryChoice.zoneId) ?? visibleDeliveryZones[0];
  const isDistanceMode = (config?.delivery_pricing_mode ?? 'fixed') === 'distance' && !deliveryChoice.pickup;
  const deliveryFee = deliveryChoice.pickup ? 0 : isDistanceMode ? (deliveryChoice.calculatedFee ?? 0) : Number(selectedZone?.delivery_fee ?? 0);
  const prepMinutes = config?.prep_time_minutes ?? 30;
  const driveMinutes = isDistanceMode ? (deliveryChoice.durationMin ?? 0) : 0;
  const totalEstimateMinutes = deliveryChoice.pickup ? prepMinutes : isDistanceMode ? prepMinutes + driveMinutes : prepMinutes + (selectedZone?.estimated_minutes ?? 0);

  const subtotal = cartItemsTotal + deliveryFee;
  const discount = appliedCoupon
    ? appliedCoupon.discount_type === 'percent'
      ? subtotal * (Number(appliedCoupon.discount_value) / 100)
      : Math.min(Number(appliedCoupon.discount_value), subtotal)
    : 0;
  const total = Math.max(0, subtotal - discount);

  const storeStatus = isStoreOpen(config);

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    localStorage.setItem('edecasa_customer', JSON.stringify(customer));
  }, [customer]);

  useEffect(() => {
    localStorage.setItem('edecasa_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (visibleMenuItems.length && !visibleMenuItems.some((item) => item.title === selectedOption)) {
      setSelectedOption(visibleMenuItems[0].title);
    }
  }, [visibleMenuItems, selectedOption]);

  useEffect(() => {
    setWantSurcharge(true);
  }, [selectedOption]);

  useEffect(() => {
    const availableProteins = proteins.filter((protein) => protein.available);
    if (!selectedProteinId && availableProteins[0]) setSelectedProteinId(availableProteins[0].id);
  }, [proteins, selectedProteinId]);

  useEffect(() => {
    const availableZones = deliveryZones.filter((z) => z.active);
    if (!deliveryChoice.zoneId && availableZones[0]) {
      setDeliveryChoice((c) => ({ ...c, zoneId: availableZones[0].id }));
    }
  }, [deliveryZones, deliveryChoice.zoneId]);

  useEffect(() => {
    void loadHistory();
  }, [customer.phone, profile?.user_id]);

  useEffect(() => {
    // Handle push notification deep links: ?order=<id> or ?order=<id>&rate=1
    const params = new URLSearchParams(window.location.search);
    const orderParam = params.get('order');
    if (orderParam) {
      setTrackerOrderId(orderParam);
      setActiveTab('pedidos');
      // Clean URL.
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (profile) {
      setCustomer((c) => ({
        name: c.name || profile.full_name,
        phone: c.phone || profile.phone,
        address: c.address || (addresses.find((a) => a.is_default)?.address ?? ''),
      }));
      setShowAuth(false);
      setShowProfile(true);
    }
  }, [profile, addresses]);

  async function loadData() {
    setLoading(true);
    const [cfgRes, menuRes, sizesRes, proteinsRes, extrasRes, zonesRes, couponsRes] = await Promise.all([
      supabase.from('business_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('menu_items').select('*').order('created_at', { ascending: true }),
      supabase.from('marmita_sizes').select('*').order('display_order', { ascending: true }),
      supabase.from('proteins').select('*').order('display_order', { ascending: true }),
      supabase.from('extras').select('*').order('display_order', { ascending: true }),
      supabase.from('delivery_zones').select('*').order('display_order', { ascending: true }),
      supabase.from('coupons').select('*').order('created_at', { ascending: false }),
    ]);

    if (cfgRes.error) console.error('Erro ao carregar business_config:', cfgRes.error.message);
    if (cfgRes.data) setConfig(cfgRes.data as BusinessConfig);
    if (menuRes.data) setMenuItems(menuRes.data as MenuItem[]);
    if (sizesRes.data?.length) setSizes(sizesRes.data as MarmitaSize[]);
    if (proteinsRes.data?.length) setProteins(proteinsRes.data as Protein[]);
    if (extrasRes.data) setExtras(extrasRes.data as Extra[]);
    if (zonesRes.data) setDeliveryZones(zonesRes.data as DeliveryZone[]);
    if (couponsRes.data) setCoupons(couponsRes.data as Coupon[]);
    setLoading(false);
  }

  async function loadHistory() {
    if (profile?.user_id) {
      const { data } = await supabase
        .from('orders_log')
        .select('*')
        .eq('customer_user_id', profile.user_id)
        .order('created_at', { ascending: false })
        .limit(10);
      setOrderHistory((data ?? []) as OrderLog[]);
      return;
    }
    const phone = (customer.phone ?? '').replace(/\D/g, '');
    if (!phone) { setOrderHistory([]); return; }
    const { data } = await supabase
      .from('orders_log')
      .select('*')
      .or(`customer_phone.eq.${phone}`)
      .order('created_at', { ascending: false })
      .limit(10);
    setOrderHistory((data ?? []) as OrderLog[]);
  }

  function handleAdminLogin(e: FormEvent) {
    e.preventDefault();
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowAdminLogin(false);
      setLoginError('');
      setAdminPassword('');
    } else {
      setLoginError('Senha incorreta!');
    }
  }

  async function refreshTable(table: 'menu_items' | 'marmita_sizes' | 'proteins' | 'extras') {
    const query = supabase.from(table).select('*');
    const { data } = table === 'menu_items'
      ? await query.order('created_at', { ascending: true })
      : await query.order('display_order', { ascending: true });
    if (!data) return;
    if (table === 'menu_items') setMenuItems(data as MenuItem[]);
    if (table === 'marmita_sizes') setSizes(data as MarmitaSize[]);
    if (table === 'proteins') setProteins(data as Protein[]);
    if (table === 'extras') setExtras(data as Extra[]);
  }

  function toggleExtra(id: string) {
    setSelectedExtraIds((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  }

  function addToCart() {
    if (!selectedSize) return;
    const extrasTotalNum = selectedExtras.reduce((sum, e) => sum + Number(e.price), 0);
    const item: CartItem = {
      id: crypto.randomUUID(),
      sizeId: selectedSize.id,
      sizeName: selectedSize.name,
      sizeCapacity: selectedSize.capacity,
      sizePrice: Number(selectedSize.price),
      menuItemTitle: selectedOption,
      menuItemPrice: menuItemSurcharge,
      proteinId: selectedProtein.id,
      proteinName: selectedProtein.name,
      proteinPrice: Number(selectedProtein.price),
      extraIds: selectedExtraIds,
      extraNames: selectedExtras.map((e) => e.name),
      extraPrices: selectedExtras.map((e) => Number(e.price)),
      extrasTotal: extrasTotalNum,
      obs: customObs,
      quantity: 1,
      unitPrice,
      lineTotal: unitPrice + extrasTotalNum,
    };
    // Se já existe um item idêntico, soma quantidade em vez de duplicar.
    const existingIdx = cart.findIndex((c) =>
      c.sizeId === item.sizeId && c.menuItemTitle === item.menuItemTitle &&
      c.proteinId === item.proteinId && JSON.stringify(c.extraIds) === JSON.stringify(item.extraIds) && c.obs === item.obs
    );
    if (existingIdx >= 0) {
      setCart((prev) => prev.map((c, i) => i === existingIdx ? { ...c, quantity: c.quantity + 1, lineTotal: (c.quantity + 1) * c.unitPrice + c.extrasTotal * (c.quantity + 1) } : c));
    } else {
      setCart((prev) => [...prev, item]);
    }
    setAddedFlash(true);
    setTimeout(() => setAddedFlash(false), 2000);
  }

  function increaseCartItem(id: string) {
    setCart((prev) => prev.map((c) => c.id === id ? { ...c, quantity: c.quantity + 1, lineTotal: (c.quantity + 1) * (c.unitPrice + c.extrasTotal) } : c));
  }

  function decreaseCartItem(id: string) {
    setCart((prev) => prev.map((c) => c.id === id ? { ...c, quantity: Math.max(1, c.quantity - 1), lineTotal: Math.max(1, c.quantity - 1) * (c.unitPrice + c.extrasTotal) } : c).filter((c) => c.quantity > 0));
  }

  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((c) => c.id !== id));
  }

  function clearCart() {
    setCart([]);
  }

  function applyCoupon() {
    setCouponError('');
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    const found = coupons.find((c) => c.code === code && c.active);
    if (!found) { setAppliedCoupon(null); setCouponError('Cupom não encontrado ou inválido.'); return; }
    if (found.expires_at && new Date(found.expires_at) < new Date()) {
      setAppliedCoupon(null);
      setCouponError('Este cupom expirou.');
      return;
    }
    setAppliedCoupon(found);
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  }

  function repeatOrder(order: OrderLog) {
    const summary = order.items_summary;
    const sizeMatch = summary.match(/(\d+)x (.+?)(?: \||$)/);
    if (sizeMatch) {
      const qty = parseInt(sizeMatch[1], 10);
      const sizeName = sizeMatch[2].trim();
      const size = visibleSizes.find((s) => s.name === sizeName);
      if (size) {
        const item: CartItem = {
          id: crypto.randomUUID(),
          sizeId: size.id, sizeName: size.name, sizeCapacity: size.capacity, sizePrice: Number(size.price),
          menuItemTitle: selectedOption, menuItemPrice: menuItemSurcharge,
          proteinId: selectedProtein.id, proteinName: selectedProtein.name, proteinPrice: Number(selectedProtein.price),
          extraIds: [], extraNames: [], extraPrices: [], extrasTotal: 0,
          obs: '', quantity: qty,
          unitPrice: Number(size.price) + Number(selectedProtein.price) + menuItemSurcharge,
          lineTotal: qty * (Number(size.price) + Number(selectedProtein.price) + menuItemSurcharge),
        };
        setCart((prev) => [...prev, item]);
        setActiveTab('cardapio');
      }
    }
    setShowHistory(false);
  }

  function buildItemsSummary(): string {
    return cart.map((item) => {
      const parts = [`${item.quantity}x ${item.sizeName}`, item.menuItemTitle, item.proteinName];
      if (item.extraNames.length) parts.push(`Extras: ${item.extraNames.join(', ')}`);
      if (item.obs) parts.push(`Obs: ${item.obs}`);
      return parts.join(' | ');
    }).join(' \u2022 ');
  }

  function buildReadyLabel(): string {
    const now = new Date();
    const ready = new Date(now.getTime() + totalEstimateMinutes * 60000);
    const hh = ready.getHours().toString().padStart(2, '0');
    const mm = ready.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm} (~${totalEstimateMinutes} min)`;
  }

  function buildOrderMessage(paid = false): string {
    const lines: string[] = [
      '*--- NOVO PEDIDO: MARMITEX É DE CASA ---*', '',
      `*Cliente:* ${customer.name}`,
      `*Telefone:* ${customer.phone}`,
      `*Endereço:* ${customer.address}`, '',
    ];
    if (deliveryChoice.pickup) {
      lines.push('*ENTREGA:* Retirar no local', '');
    } else if (isDistanceMode) {
      const addr = deliveryChoice.destinationAddress.trim() || customer.address;
      lines.push(`*ENTREGA:* Por distância (${deliveryChoice.distanceKm?.toFixed(1) ?? '—'} km) — R$ ${deliveryFee.toFixed(2)}`);
      lines.push(`*Endereço de entrega:* ${addr}`);
      if (deliveryChoice.needsMotoboy) lines.push('*MOTOBOY:* Solicitado pelo cliente');
      lines.push('');
    } else {
      lines.push(`*ENTREGA:* ${selectedZone?.name ?? '—'} (R$ ${deliveryFee.toFixed(2)})`);
      if (deliveryChoice.needsMotoboy) lines.push('*MOTOBOY:* Solicitado pelo cliente');
      lines.push('');
    }
    lines.push('*ITENS DO PEDIDO:*');
    cart.forEach((item) => {
      lines.push(`• ${item.quantity}x ${item.sizeName} (${item.sizeCapacity}) - R$ ${item.lineTotal.toFixed(2)}`);
      lines.push(`  Prato: ${item.menuItemTitle}${item.menuItemPrice ? ` (+R$ ${item.menuItemPrice.toFixed(2)})` : ' (sem acréscimo)'}`);
      lines.push(`  Proteína: ${item.proteinName}${item.proteinPrice ? ` (+R$ ${item.proteinPrice.toFixed(2)})` : ''}`);
      if (item.extraNames.length) lines.push(`  Adicionais: ${item.extraNames.join(', ')}`);
      if (item.obs) lines.push(`  Obs: ${item.obs}`);
    });
    const scheduledFor = getScheduledFor(deliveryChoice);
    if (scheduledFor) {
      lines.push('', '*AGENDAMENTO:*');
      lines.push(`• Entregar/retirar em: ${new Date(scheduledFor).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`);
    }
    lines.push('', '*TEMPO ESTIMADO:*', `• Pronto às ${buildReadyLabel()}`);

    const methodLabel = paymentMethod === 'pix' ? 'PIX' : paymentMethod === 'dinheiro' ? 'Dinheiro' : 'Cartão (crédito/débito)';
    const timingLabel = paymentTiming === 'agora' ? 'Pagar adiantado agora' : 'Pagar na entrega/retirada';
    lines.push('', '*PAGAMENTO:*');
    lines.push(`• *Forma:* ${methodLabel}`);
    lines.push(`• *Quando:* ${timingLabel}`);
    if (paymentMethod === 'dinheiro' && changeFor.trim()) lines.push(`• *Troco para:* R$ ${changeFor.trim()}`);
    if (paid) lines.push('• *Status:* Pagamento adiantado confirmado pelo cliente via app');
    if (appliedCoupon) lines.push(`• *Cupom:* ${appliedCoupon.code} (${appliedCoupon.discount_type === 'percent' ? `${formatBRL(Number(appliedCoupon.discount_value))}%` : `R$ ${Number(appliedCoupon.discount_value).toFixed(2)}`})`);

    lines.push('', `*VALOR TOTAL:* R$ ${total.toFixed(2)}`);
    if (discount > 0) lines.push(`_(desconto de R$ ${discount.toFixed(2)} aplicado)_`);
    if (!deliveryChoice.pickup && deliveryFee > 0) lines.push(`_(inclui R$ ${deliveryFee.toFixed(2)} de entrega)_`);
    lines.push('', '_É De Casa mesmo - Direto pra sua Mesa!_');
    return lines.join('\n');
  }


  async function saveOrderLog(paid: boolean): Promise<OrderLog | null> {
    const pin = generate4DigitPIN(orderHistory.map((o) => o.delivery_pin ?? '').filter(Boolean));
    const insertPayload: Record<string, unknown> = {
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_address: customer.address,
      items_summary: buildItemsSummary(),
      total,
      payment_method: paymentMethod,
      payment_timing: paymentTiming,
      paid,
      status: 'enviado',
      delivery_fee: deliveryFee,
      delivery_zone: deliveryChoice.pickup ? 'Retirada' : isDistanceMode ? `Distância (${deliveryChoice.distanceKm?.toFixed(1) ?? '—'} km)` : (selectedZone?.name ?? ''),
      needs_motoboy: !deliveryChoice.pickup && deliveryChoice.needsMotoboy,
      estimated_ready_at: buildReadyLabel(),
      delivery_pin: pin,
      delivery_status: 'recebido',
      scheduled_for: getScheduledFor(deliveryChoice) ?? null,
    };
    if (profile?.user_id) insertPayload.customer_user_id = profile.user_id;
    const { data, error } = await supabase.from('orders_log').insert(insertPayload).select().maybeSingle();
    if (!error && data) {
      await supabase.from('order_pins').insert({ order_id: (data as OrderLog).id, pin });
      // Notifica a loja (admin) sobre o novo pedido.
      await supabase.from('app_notifications').insert({
        target: 'store',
        kind: 'new_order',
        payload: {
          order_id: (data as OrderLog).id,
          customer_name: customer.name,
          total,
          items_summary: buildItemsSummary(),
        },
      });
      // Notifica o cliente com a confirmação.
      if (profile?.user_id) {
        await supabase.from('app_notifications').insert({
          target: 'customer',
          user_id: profile.user_id,
          kind: 'status_update',
          payload: { order_id: (data as OrderLog).id, delivery_status: 'recebido' },
        });
      }
      setLastPlacedPin(pin);
      setTrackerOrderId((data as OrderLog).id);
    }
    void loadHistory();
    return (data as OrderLog) ?? null;
  }

  function handleSendOrder() {
    if (cart.length === 0) {
      alert('Seu carrinho está vazio. Monte sua marmita e adicione ao carrinho primeiro!');
      return;
    }
    if (!customer.name || !customer.address) {
      alert('Por favor, preencha o seu Nome e Endereço de Entrega antes de enviar o pedido.');
      return;
    }
    if (isDistanceMode && deliveryChoice.calculatedFee === null) {
      alert('Calcule a taxa de entrega pelo endereço antes de enviar o pedido.');
      return;
    }
    void saveOrderLog(false).then((order) => {
      if (order) {
        clearCart();
        setCartOpen(false);
        setActiveTab('pedidos');
      }
    });
  }

  function handlePayNow() {
    if (cart.length === 0) {
      alert('Seu carrinho está vazio. Monte sua marmita e adicione ao carrinho primeiro!');
      return;
    }
    if (!customer.name || !customer.address) {
      alert('Por favor, preencha o seu Nome e Endereço de Entrega antes de pagar.');
      return;
    }
    if (isDistanceMode && deliveryChoice.calculatedFee === null) {
      alert('Calcule a taxa de entrega pelo endereço antes de pagar.');
      return;
    }
    if (paymentMethod === 'pix') {
      setShowPixModal(true);
    } else if (paymentMethod === 'cartao') {
      alert('Para pagamento com cartão, pague na entrega com a maquininha. O pedido será registrado agora.');
      void saveOrderLog(false).then((order) => {
        if (order) { clearCart(); setCartOpen(false); setActiveTab('pedidos'); }
      });
    } else {
      void saveOrderLog(false).then((order) => {
        if (order) { clearCart(); setCartOpen(false); setActiveTab('pedidos'); }
      });
    }
  }

  function handlePixConfirmed() {
    setShowPixModal(false);
    void saveOrderLog(true).then((order) => {
      if (order) { clearCart(); setCartOpen(false); setActiveTab('pedidos'); }
    });
  }

  const phonePrimary = config?.primary_phone ?? '31996647863';
  const phoneSecondary = config?.secondary_phone ?? '31995956952';
  const pixKey = config?.pix_key ?? '';
  const pixKeyType = config?.pix_key_type ?? 'cpf';

  if (showDriverPortal && loggedDriver) {
    return <DriverPortal driver={loggedDriver} onExit={() => { setShowDriverPortal(false); setLoggedDriver(null); }} />;
  }

  if (driverAuthOpen) {
    return (
      <DriverAuth
        onBack={() => setDriverAuthOpen(false)}
        onLogin={(driver) => { setLoggedDriver(driver); setDriverAuthOpen(false); setShowDriverPortal(true); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-body pb-12">
      <header className="bg-gradient-to-b from-amber-500 via-yellow-500 to-amber-600 p-3 shadow-xl border-b-4 border-red-600">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <img src="/assets/5049368D-D189-404F-ABC1-277F472E981E.jpeg" alt="Marmitex É De Casa - comida caseira" className="w-full max-w-[270px] h-auto max-h-32 object-contain object-left rounded-xl shadow-lg" />
          </div>
          <div className="flex items-center gap-1.5">
            {profile && (
              <button onClick={() => setShowProfile(!showProfile)} className="bg-black/20 hover:bg-black/40 text-zinc-950 p-2 rounded-lg text-xs font-bold flex items-center transition" aria-label="Meu perfil">
                <UserCircle2 size={18} />
              </button>
            )}
            {!profile && (
              <button onClick={() => setShowAuth(!showAuth)} className="bg-black/20 hover:bg-black/40 text-zinc-950 p-2 rounded-lg text-xs font-bold flex items-center transition" aria-label="Entrar na minha conta">
                <UserCircle2 size={18} />
              </button>
            )}
            <button onClick={() => setDriverAuthOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg text-xs font-bold flex items-center transition" aria-label="Portal do entregador" title="Entregador parceiro">
              <Bike size={18} />
            </button>
            <button onClick={() => (isAdmin ? setIsAdmin(false) : setShowAdminLogin(!showAdminLogin))} className="bg-black/20 hover:bg-black/40 text-zinc-950 p-2 rounded-lg text-xs font-bold flex items-center transition" aria-label={isAdmin ? 'Sair do painel admin' : 'Acesso administrador'}>
              {isAdmin ? <Settings size={18} className="text-red-700" /> : <LogIn size={18} />}
            </button>
          </div>
        </div>
      </header>

      <div className="bg-red-600 text-yellow-200 py-2 px-4 text-center shadow-inner"><span className="brand-script text-2xl leading-none tracking-wide">É De Casa mesmo — Direto pra sua Mesa!</span></div>

      <main className="max-w-md mx-auto px-4 mt-4 space-y-5 pb-28">
        {loading && <div className="flex items-center justify-center py-16 text-yellow-400"><Loader2 className="animate-spin" size={28} /></div>}

        {!loading && (
          <NotificationBell
            isStore={isAdmin}
            onOpenOrder={(orderId) => {
              setTrackerOrderId(orderId);
              setActiveTab(isAdmin ? 'pedidos' : 'pedidos');
            }}
          />
        )}

        {!loading && showAdminLogin && !isAdmin && (
          <div className="bg-zinc-900 border-2 border-yellow-500 rounded-xl p-4 shadow-2xl">
            <h3 className="text-sm font-bold text-yellow-400 uppercase flex items-center space-x-2"><LogIn size={16} /> <span>Acesso do Administrador</span></h3>
            <form onSubmit={handleAdminLogin} className="mt-3 space-y-3">
              <input type="password" placeholder="Senha de Acesso" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-sm focus:border-yellow-500 focus:outline-none" />
              {loginError && <p className="text-red-400 text-xs flex items-center"><AlertCircle size={12} className="mr-1" />{loginError}</p>}
              <div className="flex space-x-2"><button type="submit" className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 rounded-lg text-xs transition">Entrar</button><button type="button" onClick={() => setShowAdminLogin(false)} className="bg-zinc-800 text-zinc-400 py-2 px-3 rounded-lg text-xs">Cancelar</button></div>
            </form>
          </div>
        )}

        {!loading && isAdmin && config && (
          <>
            <AdminPanel config={config} menuItems={menuItems} sizes={sizes} proteins={proteins} extras={extras} deliveryZones={deliveryZones} coupons={coupons} onMenuItemSaved={() => refreshTable('menu_items')} onSizesSaved={() => refreshTable('marmita_sizes')} onProteinsSaved={() => refreshTable('proteins')} onExtrasSaved={() => refreshTable('extras')} onConfigUpdated={setConfig} onLogout={() => setIsAdmin(false)} onDataRefreshed={loadData} />
          </>
        )}

        {!loading && !storeStatus.open && (
          <div className="bg-yellow-500/10 border-2 border-yellow-500 rounded-xl p-5 text-center space-y-2">
            <Clock className="text-yellow-400 mx-auto" size={32} />
            <p className="text-sm font-bold text-yellow-300 uppercase">Montando o cardápio de amanhã</p>
            <p className="text-xs text-zinc-300">{storeStatus.reason}</p>
            <p className="text-[10px] text-zinc-500 mt-1">Horário de atendimento: {config?.open_hours ?? '18:00'} às {config?.close_hours ?? '23:00'}</p>
          </div>
        )}

        {!loading && storeStatus.open && activeTab === 'perfil' && (
          <>
            {showAuth && !profile && (
              <AuthScreen onClose={() => setShowAuth(false)} />
            )}
            {profile && (
              <ProfilePanel onPickAddress={(addr) => { setCustomer((c) => ({ ...c, address: addr })); }} />
            )}
            {orderHistory.length > 0 && (
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 shadow-lg space-y-2">
                <h3 className="text-xs font-bold uppercase text-yellow-400 flex items-center gap-1.5"><History size={14} /> Meus Pedidos Anteriores</h3>
                <div className="space-y-1.5">
                  {orderHistory.map((order) => (
                    <div key={order.id} className="bg-zinc-800/50 rounded-lg p-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-zinc-500">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                          <p className="text-xs text-zinc-300 truncate">{order.items_summary}</p>
                          {order.delivery_pin && (
                            <p className="text-[10px] text-yellow-500/80 flex items-center gap-1 mt-0.5">
                              <KeyRound size={10} /> PIN {order.delivery_pin} • {order.delivery_status ?? 'recebido'}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => { setTrackerOrderId(order.id); setActiveTab('cardapio'); }} className="flex-1 text-[9px] bg-zinc-700 hover:bg-zinc-600 text-zinc-100 font-bold py-1.5 rounded flex items-center justify-center gap-1">
                          <Clock size={11} /> Acompanhar
                        </button>
                        <button onClick={() => repeatOrder(order)} className="flex-1 text-[9px] bg-yellow-500 text-black font-bold py-1.5 rounded">Repetir</button>
                        {profile && (order.delivery_status ?? 'recebido') === 'entregue' && (
                          <button onClick={() => { setRatingOrder(order); }} className="flex-1 text-[9px] bg-emerald-600 text-white font-bold py-1.5 rounded">Avaliar</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!loading && storeStatus.open && activeTab === 'pedidos' && (
          <>
            {trackerOrderId && (() => {
              const tracked = orderHistory.find((o) => o.id === trackerOrderId);
              if (!tracked) return null;
              return (
                <OrderTracker
                  key={tracked.id}
                  order={{ ...tracked, delivery_pin: tracked.delivery_pin ?? lastPlacedPin ?? undefined }}
                />
              );
            })()}
            {profile && ratingOrder && ratingOrder.delivery_status === 'entregue' && (
              <RatingScreen
                orderId={ratingOrder.id}
                userId={profile.user_id}
                onDone={() => setRatingOrder(null)}
              />
            )}
            {orderHistory.length === 0 && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 text-center">
                <ClipboardList className="text-yellow-400 mx-auto mb-2" size={28} />
                <p className="text-xs text-zinc-400">Você ainda não fez pedidos. Volte ao cardápio e monte sua marmita!</p>
              </div>
            )}
          </>
        )}

        {!loading && storeStatus.open && activeTab === 'cardapio' && <>
          {showAuth && !profile && (
            <AuthScreen onClose={() => setShowAuth(false)} />
          )}

          {profile && showProfile && (
            <ProfilePanel onPickAddress={(addr) => { setCustomer((c) => ({ ...c, address: addr })); }} />
          )}

          {trackerOrderId && (() => {
            const tracked = orderHistory.find((o) => o.id === trackerOrderId);
            if (!tracked) return null;
            return (
              <OrderTracker
                key={tracked.id}
                order={{ ...tracked, delivery_pin: tracked.delivery_pin ?? lastPlacedPin ?? undefined }}
              />
            );
          })()}

          {profile && ratingOrder && ratingOrder.delivery_status === 'entregue' && (
            <RatingScreen
              orderId={ratingOrder.id}
              userId={profile.user_id}
              onDone={() => setRatingOrder(null)}
            />
          )}

          {/* Endereço compacto quando já salvo no perfil */}
          {profile && customer.address && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <MapPin size={14} className="text-yellow-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold">Entregar em</p>
                  <p className="text-xs text-zinc-200 truncate">{customer.address}</p>
                </div>
              </div>
              <button onClick={() => setActiveTab('perfil')} className="text-[10px] text-yellow-400 font-bold hover:underline shrink-0">
                Alterar
              </button>
            </div>
          )}

          {/* Mostra o formulário completo apenas quando não há perfil com endereço salvo */}
          {(!profile || !customer.address) && (
            <CustomerForm customer={customer} onChange={setCustomer} />
          )}

          {orderHistory.length > 0 && (
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 shadow-lg space-y-2">
              <button onClick={() => setShowHistory(!showHistory)} className="w-full flex items-center justify-between text-xs font-bold uppercase text-yellow-400">
                <span className="flex items-center gap-1.5"><History size={14} /> Meus Pedidos Anteriores</span>
                <span className="text-zinc-500">{showHistory ? 'Ocultar' : 'Ver'}</span>
              </button>
              {showHistory && (
                <div className="space-y-1.5 pt-1">
                  {orderHistory.map((order) => (
                    <div key={order.id} className="bg-zinc-800/50 rounded-lg p-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-zinc-500">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                          <p className="text-xs text-zinc-300 truncate">{order.items_summary}</p>
                          {order.delivery_pin && (
                            <p className="text-[10px] text-yellow-500/80 flex items-center gap-1 mt-0.5">
                              <KeyRound size={10} /> PIN {order.delivery_pin} • {order.delivery_status ?? 'recebido'}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => { setTrackerOrderId(order.id); setShowHistory(false); }} className="flex-1 text-[9px] bg-zinc-700 hover:bg-zinc-600 text-zinc-100 font-bold py-1.5 rounded flex items-center justify-center gap-1">
                          <Clock size={11} /> Acompanhar
                        </button>
                        <button onClick={() => repeatOrder(order)} className="flex-1 text-[9px] bg-yellow-500 text-black font-bold py-1.5 rounded">Repetir</button>
                        {profile && (order.delivery_status ?? 'recebido') === 'entregue' && (
                          <button onClick={() => { setRatingOrder(order); setShowHistory(false); }} className="flex-1 text-[9px] bg-emerald-600 text-white font-bold py-1.5 rounded">Avaliar</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DeliveryOptions zones={deliveryZones} prepTimeMinutes={prepMinutes} choice={deliveryChoice} onChange={setDeliveryChoice} config={config} customerAddress={customer.address} />

          {config && (config.delivery_start_hours || config.delivery_end_hours) && (
            <div className="bg-orange-950/20 border border-orange-800/40 rounded-xl p-3 space-y-1">
              <p className="text-[10px] font-bold text-orange-400 uppercase flex items-center gap-1.5">
                <Clock size={12} /> Janela de Entrega
              </p>
              <p className="text-[11px] text-zinc-300">
                Entregas a partir das <strong className="text-orange-400">{config.delivery_start_hours}</strong>
                {config.delivery_end_hours && <> até as <strong className="text-orange-400">{config.delivery_end_hours}</strong></>}
              </p>
              {config.kitchen_open_hours && config.prep_start_hours && (
                <p className="text-[10px] text-zinc-500">
                  Cozinha abre {config.kitchen_open_hours} · preparo começa {config.prep_start_hours}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <h2 className="display-type text-sm font-black uppercase tracking-wider text-yellow-400 flex items-center"><Utensils size={14} className="mr-1.5" /> Escolha o Tamanho da Marmita</h2>
            <div className="grid grid-cols-2 gap-3">
              {visibleSizes.map((size) => <button key={size.id} onClick={() => setSelectedSizeId(size.id)} className={`relative p-3 rounded-xl border-2 text-left transition shadow-md flex flex-col justify-between ${selectedSize.id === size.id ? 'bg-yellow-500/10 border-yellow-500 text-yellow-300' : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}><div><div className="flex justify-between items-start"><span className="text-xs font-black uppercase">{size.name}</span>{selectedSize.id === size.id && <Check size={16} className="text-yellow-400" />}</div><p className="text-[10px] text-zinc-400 mt-1">{size.capacity}</p></div><div className="mt-3"><span className="text-lg font-black text-red-500">R$ {Number(size.price).toFixed(2)}</span><span className="text-[10px] text-zinc-500 block">reais</span></div></button>)}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="display-type text-sm font-black uppercase tracking-wider text-yellow-400 flex items-center"><ShoppingBag size={14} className="mr-1.5" /> Cardápio Disponível Hoje</h2>
            <div className="space-y-2.5">
              {visibleMenuItems.length === 0 && <p className="text-xs text-zinc-500 italic px-1">Nenhum prato disponível hoje.</p>}
              {visibleMenuItems.map((item) => <div key={item.id} onClick={() => setSelectedOption(item.title)} className={`p-3.5 rounded-xl border-2 transition cursor-pointer relative ${selectedOption === item.title ? 'bg-red-950/20 border-red-600 text-zinc-100' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}>
                {item.image_url && <img src={item.image_url} alt={item.title} className="w-full h-36 object-cover rounded-lg mb-3" />}
                <div className="flex justify-between items-start"><h3 className="text-xs font-bold text-yellow-400 pr-4">{item.title}</h3>{selectedOption === item.title && <span className="bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Selecionado</span>}</div>
                {item.description && <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">{item.description}</p>}
                {item.price > 0 && <p className="text-xs text-amber-400 font-bold mt-2">Acréscimo do prato: R$ {Number(item.price).toFixed(2)}</p>}
              </div>)}

          {selectedMenuItem && Number(selectedMenuItem.price) > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-zinc-200">Incluir acréscimo do prato?</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">+ R$ {Number(selectedMenuItem.price).toFixed(2)} — {wantSurcharge ? 'Incluso no preço' : 'Removido do preço'}</p>
              </div>
              <button
                onClick={() => setWantSurcharge(!wantSurcharge)}
                className={`relative w-12 h-6 rounded-full transition shrink-0 ${wantSurcharge ? 'bg-emerald-600' : 'bg-zinc-700'}`}
                aria-label={wantSurcharge ? 'Desativar acréscimo' : 'Ativar acréscimo'}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${wantSurcharge ? 'translate-x-6' : ''}`} />
              </button>
            </div>
          )}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
            <div><label className="text-xs font-bold text-yellow-400 block mb-1">Escolha a Mistura / Proteína:</label>
              {selectedProtein.image_url && <img src={selectedProtein.image_url} alt={selectedProtein.name} className="w-full h-28 object-cover rounded-lg mb-2" />}
              <select value={selectedProtein.id} onChange={(e) => setSelectedProteinId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-100 focus:border-yellow-400 focus:outline-none">{visibleProteins.map((protein) => <option key={protein.id} value={protein.id}>{protein.name}{protein.price > 0 ? ` (+ R$ ${Number(protein.price).toFixed(2)})` : ''}</option>)}</select></div>

            <div><label className="text-xs font-bold text-yellow-400 block mb-2">Adicionais:</label><div className="space-y-2">{visibleExtras.map((extra) => <label key={extra.id} className="flex items-center justify-between gap-3 bg-zinc-800 rounded-lg p-2.5 cursor-pointer"><span className="flex items-center gap-2 text-xs text-zinc-200 min-w-0">{extra.image_url && <img src={extra.image_url} alt={extra.name} className="w-8 h-8 rounded object-cover shrink-0" />}<input type="checkbox" checked={selectedExtraIds.includes(extra.id)} onChange={() => toggleExtra(extra.id)} className="accent-yellow-500 shrink-0" /><span className="truncate">{extra.name}</span></span><span className="text-xs font-bold text-amber-400 shrink-0">+ R$ {Number(extra.price).toFixed(2)}</span></label>)}{visibleExtras.length === 0 && <p className="text-xs text-zinc-500">Nenhum adicional cadastrado.</p>}</div></div>

            <div><label className="text-xs font-bold text-zinc-400 block mb-1">Observações ou Retirar Ingrediente:</label><input type="text" placeholder="Ex: Sem cebola, caprichar na farofa..." value={customObs} onChange={(e) => setCustomObs(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-100 focus:border-yellow-400 focus:outline-none" /></div>

            <button onClick={addToCart} className={`w-full font-black py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition active:scale-95 ${addedFlash ? 'bg-emerald-600 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}>
              {addedFlash ? <><Check size={18} /> Adicionado ao carrinho!</> : <><ShoppingCart size={18} /> Adicionar ao Carrinho · R$ {formatBRL(unitPrice + extrasTotal)}</>}
            </button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
            <h2 className="display-type text-sm font-black uppercase tracking-wider text-yellow-400 flex items-center"><Wallet size={14} className="mr-1.5" /> Forma de Pagamento</h2>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setPaymentMethod('pix')} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition ${paymentMethod === 'pix' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}><QrCode size={18} /><span className="text-[10px] font-bold uppercase">PIX</span></button>
              <button onClick={() => setPaymentMethod('dinheiro')} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition ${paymentMethod === 'dinheiro' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}><Banknote size={18} /><span className="text-[10px] font-bold uppercase">Dinheiro</span></button>
              <button onClick={() => setPaymentMethod('cartao')} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition ${paymentMethod === 'cartao' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}><CreditCard size={18} /><span className="text-[10px] font-bold uppercase">Cartão</span></button>
            </div>

            {paymentMethod === 'dinheiro' && (
              <div><label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Troco para quanto?</label><input type="text" inputMode="decimal" placeholder="Ex: 50,00 (deixe vazio se não precisa)" value={changeFor} onChange={(e) => setChangeFor(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-100 focus:border-yellow-400 focus:outline-none" /></div>
            )}

            <div className="border-t border-zinc-800 pt-3">
              <label className="text-xs font-bold text-zinc-300 block mb-2">Quando vai pagar?</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPaymentTiming('agora')} className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition ${paymentTiming === 'agora' ? 'bg-emerald-600/20 border-emerald-600 text-emerald-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}><Clock3 size={16} /><span className="text-[10px] font-bold uppercase text-center leading-tight">Pagar adiantado agora</span></button>
                <button onClick={() => setPaymentTiming('entrega')} className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition ${paymentTiming === 'entrega' ? 'bg-emerald-600/20 border-emerald-600 text-emerald-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}><Clock size={16} /><span className="text-[10px] font-bold uppercase text-center leading-tight">Pagar na entrega</span></button>
              </div>
              {paymentMethod === 'pix' && paymentTiming === 'agora' && <p className="text-[10px] text-zinc-500 mt-2">O pagamento será feito direto pelo app: mostramos a chave PIX e você paga pelo app do seu banco.</p>}
              {paymentMethod === 'cartao' && <p className="text-[10px] text-zinc-500 mt-2">Pague com cartão de crédito ou débito na entrega com a maquininha. Sem complicações — você passa o cartão quando o pedido chegar.</p>}
              {paymentMethod === 'dinheiro' && paymentTiming === 'entrega' && <p className="text-[10px] text-zinc-500 mt-2">Tenha o valor exato ou informe o troco acima para facilitar.</p>}
            </div>

            <div className="border-t border-zinc-800 pt-3">
              <label className="text-xs font-bold text-yellow-400 block mb-1.5 flex items-center gap-1.5"><Gift size={14} /> Tem um cupom de desconto?</label>
              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-emerald-600/10 border border-emerald-600 rounded-lg p-2">
                  <span className="text-xs text-emerald-400 font-bold">{appliedCoupon.code} aplicado! (- R$ {discount.toFixed(2)})</span>
                  <button onClick={removeCoupon} className="text-zinc-400 hover:text-white"><X size={14} /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Digite o código (ex: BEMVINDO10)" className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-100 focus:border-yellow-400 focus:outline-none" />
                  <button onClick={applyCoupon} className="bg-yellow-500 text-black font-bold px-3 rounded-lg text-xs">Aplicar</button>
                </div>
              )}
              {couponError && <p className="text-[10px] text-red-400 mt-1">{couponError}</p>}
            </div>
          </div>

          <PixModal open={showPixModal} onClose={() => setShowPixModal(false)} total={total} pixKey={pixKey} pixKeyType={pixKeyType} onConfirm={handlePixConfirmed} />

          {/* Card de recrutamento de entregador parceiro */}
          <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 border border-blue-700/40 rounded-xl p-4 space-y-2.5">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-600/30 border border-blue-500 flex items-center justify-center shrink-0">
                <Bike size={20} className="text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-blue-300">Quer ser entregador parceiro?</p>
                <p className="text-[11px] text-zinc-300 leading-relaxed mt-0.5">
                  Faça entregas na região de Betim e Contagem com flexibilidade. Você escolhe a frequência de pagamento, usa moto, bicicleta ou carro, e ganha por entrega feita.
                </p>
              </div>
            </div>
            <button
              onClick={() => setDriverAuthOpen(true)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Bike size={15} /> Quero ser entregador parceiro
            </button>
          </div>

          <footer className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center space-y-2 text-xs text-zinc-400"><p className="font-bold text-yellow-400">{config?.instagram ?? 'Marmitex É De CASA comida caseira'}</p><div className="flex items-center justify-center space-x-1"><Clock size={12} className="text-red-500" /><span>Aberto das {config?.open_hours ?? '18:00'} às {config?.close_hours ?? '23:00'}</span></div><div className="flex items-center justify-center space-x-1"><Phone size={12} className="text-emerald-500" /><span>WhatsApp: {formatPhone(phonePrimary)} / {formatPhone(phoneSecondary)}</span></div><div className="flex items-center justify-center space-x-1"><MapPin size={12} className="text-yellow-500" /><span>{config?.address}</span></div></footer>
        </>}
      </main>

      {/* Navegação inferior: Cardápio / Pedidos / Perfil */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 shadow-2xl">
        <div className="max-w-md mx-auto grid grid-cols-3">
          <button onClick={() => setActiveTab('cardapio')} className={`flex flex-col items-center gap-0.5 py-2.5 transition ${activeTab === 'cardapio' ? 'text-yellow-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <UtensilsCrossed size={20} />
            <span className="text-[10px] font-bold uppercase">Cardápio</span>
          </button>
          <button onClick={() => setActiveTab('pedidos')} className={`flex flex-col items-center gap-0.5 py-2.5 transition relative ${activeTab === 'pedidos' ? 'text-yellow-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <ClipboardList size={20} />
            <span className="text-[10px] font-bold uppercase">Pedidos</span>
            {orderHistory.length > 0 && trackerOrderId && (
              <span className="absolute top-1 right-1/4 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
          <button onClick={() => setActiveTab('perfil')} className={`flex flex-col items-center gap-0.5 py-2.5 transition ${activeTab === 'perfil' ? 'text-yellow-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
            {profile ? <HomeIcon size={20} /> : <LogIn size={20} />}
            <span className="text-[10px] font-bold uppercase">{profile ? 'Perfil' : 'Entrar'}</span>
          </button>
        </div>
      </nav>

      {profile && <ChatWidget />}
      {!profile && (
        <button
          onClick={() => setShowAuth(true)}
          className="fixed bottom-14 right-4 z-30 w-12 h-12 rounded-full bg-zinc-800 border-2 border-yellow-500 text-yellow-400 shadow-xl flex items-center justify-center hover:bg-zinc-700 transition active:scale-95"
          aria-label="Entrar para conversar"
        >
          <MessageCircle size={22} />
        </button>
      )}
      <CartBar itemCount={cartItemCount} total={total} onOpen={() => setCartOpen(true)} />
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        total={cartItemsTotal}
        onIncrease={increaseCartItem}
        onDecrease={decreaseCartItem}
        onRemove={removeFromCart}
        onCheckout={handleSendOrder}
        deliveryFee={deliveryFee}
        discount={discount}
        finalTotal={total}
      />
    </div>
  );
}

function formatBRL(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}
