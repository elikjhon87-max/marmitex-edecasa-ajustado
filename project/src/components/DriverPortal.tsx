import { useEffect, useState } from 'react';
import {
  Bike, MapPin, Clock, Phone, Navigation, Package, Check, X, Loader2, Truck,
  RotateCcw, User, LogOut, Wallet, Route, KeyRound, AlertCircle, CheckCircle2,
  Settings, Banknote, Save,
} from 'lucide-react';
import { supabase, type OrderLog, type DeliveryDriver, type DriverWalletTransaction, type DeliveryRoute, type BusinessConfig } from '@/lib/supabase';
import { calculateBatchRoute } from '@/lib/deliveryRoute';

const VEHICLE_LABELS: Record<string, string> = {
  moto: 'Moto',
  bicicleta: 'Bicicleta',
  carro: 'Carro',
  caminhonete: 'Caminhonete',
};

type Tab = 'available' | 'mine' | 'wallet' | 'routes' | 'settings';

function genPickupPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export function DriverPortal({ driver, onExit }: { driver: DeliveryDriver; onExit: () => void }) {
  const [orders, setOrders] = useState<OrderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('available');
  const [pickupPinInput, setPickupPinInput] = useState<Record<string, string>>({});
  const [pinError, setPinError] = useState<Record<string, string>>({});
  const [selectedForBatch, setSelectedForBatch] = useState<string[]>([]);
  const [batchResult, setBatchResult] = useState<{ totalDistanceKm: number; totalEarnings: number; optimizedOrder: { orderId: string; address: string; sequence: number }[] } | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [walletTx, setWalletTx] = useState<DriverWalletTransaction[]>([]);
  const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
  const [config, setConfig] = useState<BusinessConfig | null>(null);
  const [payForm, setPayForm] = useState({
    payment_frequency: driver.payment_frequency ?? 'weekly',
    pix_key: driver.pix_key ?? '',
    bank_name: driver.bank_name ?? '',
    bank_agency: driver.bank_agency ?? '',
    bank_account: driver.bank_account ?? '',
    account_type: driver.account_type ?? 'pix',
  });
  const [paySaving, setPaySaving] = useState(false);
  const [paySaved, setPaySaved] = useState(false);
  const [deliveryActionBusy, setDeliveryActionBusy] = useState<Record<string, boolean>>({});
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [isAvailable, setIsAvailable] = useState(Boolean((driver as DeliveryDriver & { available_for_jobs?: boolean }).available_for_jobs));

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const [ordRes, txRes, routeRes, cfgRes] = await Promise.all([
      supabase.from('orders_log').select('*').neq('status', 'cancelado').order('created_at', { ascending: false }).limit(80),
      supabase.from('driver_wallet_transactions').select('*').eq('driver_id', driver.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('delivery_routes').select('*').eq('driver_id', driver.id).order('started_at', { ascending: false }).limit(20),
      supabase.from('business_config').select('*').eq('id', 1).maybeSingle(),
    ]);
    setOrders((ordRes.data ?? []) as OrderLog[]);
    setWalletTx((txRes.data ?? []) as DriverWalletTransaction[]);
    setRoutes((routeRes.data ?? []) as DeliveryRoute[]);
    setConfig((cfgRes.data ?? null) as BusinessConfig | null);
    setLoading(false);
  }

  async function acceptOrder(order: OrderLog) {
    if (deliveryActionBusy[order.id]) return;
    setDeliveryActionBusy((prev) => ({ ...prev, [order.id]: true }));
    try {
      const pickupPin = genPickupPin();
      const { data, error } = await supabase
        .from('orders_log')
        .update({
          status: 'confirmado', delivery_status: 'a_caminho', assigned_driver_id: driver.id,
          driver_picked_at: new Date().toISOString(), pickup_pin: pickupPin,
        })
        .eq('id', order.id)
        .eq('status', 'enviado')
        .is('assigned_driver_id', null)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        alert('Outro entregador já aceitou este pedido. Atualize a tela.');
        await load();
        return;
      }
      const { error: notificationError } = await supabase.from('app_notifications').insert({
        target: 'store', kind: 'driver_accepted',
        payload: { order_id: order.id, driver_name: driver.name, driver_phone: driver.phone, pickup_pin: pickupPin },
      });
      if (notificationError) console.error('Pedido aceito, mas não foi possível notificar a loja:', notificationError);
      setPickupPinInput({});
      setPinError({});
      await load();
    } catch (error) {
      console.error('Erro ao aceitar entrega:', error);
      alert('Não foi possível aceitar o pedido. Atualize a tela e tente novamente.');
    } finally {
      setDeliveryActionBusy((prev) => ({ ...prev, [order.id]: false }));
    }
  }

  async function verifyPickupPin(order: OrderLog) {
    const input = (pickupPinInput[order.id] ?? '').replace(/\D/g, '');
    if (input.length !== 4) {
      setPinError({ ...pinError, [order.id]: 'Digite o PIN de 4 dígitos.' });
      return;
    }
    if (input !== order.pickup_pin) {
      setPinError({ ...pinError, [order.id]: 'PIN incorreto. Peça o PIN para a loja.' });
      return;
    }
    setPinError({ ...pinError, [order.id]: '' });
    const { data, error } = await supabase
      .from('orders_log')
      .update({ pickup_verified_at: new Date().toISOString(), delivery_status: 'a_caminho' })
      .eq('id', order.id)
      .eq('assigned_driver_id', driver.id)
      .eq('pickup_pin', input)
      .is('pickup_verified_at', null)
      .neq('status', 'entregue')
      .select('id')
      .maybeSingle();
    if (error || !data) {
      setPinError((prev) => ({ ...prev, [order.id]: 'Não foi possível confirmar a retirada. Atualize o pedido e tente novamente.' }));
      return;
    }
    void load();
  }

  async function markDelivered(order: OrderLog) {
    // Não permite concluir sem a retirada confirmada pelo PIN.
    if (!order.pickup_verified_at) {
      setPinError((prev) => ({ ...prev, [order.id]: 'Confirme primeiro a retirada na loja usando o PIN de 4 dígitos.' }));
      setTab('mine');
      return;
    }
    if (order.status === 'entregue' || deliveryActionBusy[order.id]) return;

    setDeliveryActionBusy((prev) => ({ ...prev, [order.id]: true }));
    try {
      const { data: config } = await supabase
        .from('business_config')
        .select('driver_fee_per_order')
        .eq('id', 1)
        .maybeSingle();
      const earnings = Number(config?.driver_fee_per_order ?? 3.0);

      // A função SQL conclui o pedido e credita a carteira em uma única transação.
      // Ela valida o PIN já confirmado e bloqueia conclusões duplicadas no banco.
      const { data: completion, error: completionError } = await supabase.rpc('complete_delivery_order', {
        p_order_id: order.id,
        p_driver_id: driver.id,
        p_earnings: earnings,
      });
      if (completionError) throw completionError;
      if (!completion || completion.success !== true) {
        alert(completion?.message ?? 'Este pedido já foi concluído ou a retirada ainda não foi confirmada. Atualize a tela.');
        await load();
        return;
      }

      await load();
    } catch (error) {
      console.error('Erro ao concluir entrega:', error);
      alert('Não foi possível concluir a entrega. Atualize a tela e confira o pedido antes de tentar novamente.');
    } finally {
      setDeliveryActionBusy((prev) => ({ ...prev, [order.id]: false }));
    }
  }

  async function toggleAvailability() {
    setAvailabilityBusy(true);
    const next = !isAvailable;
    const { error } = await supabase.from('delivery_drivers')
      .update({ available_for_jobs: next })
      .eq('id', driver.id);
    if (error) {
      console.error('Erro ao atualizar disponibilidade:', error);
      alert('Não foi possível atualizar sua disponibilidade. Verifique se aplicou a migração SQL do projeto.');
    } else {
      setIsAvailable(next);
    }
    setAvailabilityBusy(false);
  }

  async function releaseOrder(order: OrderLog) {
    await supabase
      .from('orders_log')
      .update({ status: 'enviado', delivery_status: 'preparando', assigned_driver_id: null, driver_picked_at: null, pickup_pin: null, pickup_verified_at: null })
      .eq('id', order.id);
    void load();
  }

  function openWaze(order: OrderLog) {
    const addr = encodeURIComponent(order.customer_address || '');
    window.open(`https://www.waze.com/ul?q=${addr}&navigate=yes`, '_blank');
  }

  function callCustomer(order: OrderLog) {
    const phone = (order.customer_phone ?? '').replace(/\D/g, '');
    if (phone) window.open(`https://wa.me/55${phone}`, '_blank');
  }

  function toggleBatchSelect(orderId: string) {
    setSelectedForBatch((prev) => prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]);
    setBatchResult(null);
  }

  async function calculateBatch() {
    if (selectedForBatch.length < 2) return;
    setBatchLoading(true);
    const selectedOrders = available.filter((o) => selectedForBatch.includes(o.id));
    const result = await calculateBatchRoute(
      selectedOrders.map((o) => o.id),
      selectedOrders.map((o) => o.customer_address || ''),
    );
    setBatchLoading(false);
    if ('error' in result) {
      setBatchResult(null);
      return;
    }
    setBatchResult({
      totalDistanceKm: result.totalDistanceKm,
      totalEarnings: result.totalEarnings,
      optimizedOrder: result.optimizedOrder,
    });
  }

  async function acceptBatch() {
    if (!batchResult) return;
    setBatchLoading(true);
    // Criar rota
    const { data: route } = await supabase.from('delivery_routes').insert({
      driver_id: driver.id,
      status: 'active',
      total_distance_km: batchResult.totalDistanceKm,
      total_earnings: batchResult.totalEarnings,
      order_count: selectedForBatch.length,
    }).select('*').maybeSingle();

    if (!route) {
      setBatchLoading(false);
      return;
    }

    // Aceitar todos os pedidos da rota com sequence
    for (const item of batchResult.optimizedOrder) {
      const pickupPin = genPickupPin();
      await supabase.from('orders_log').update({
        status: 'confirmado',
        delivery_status: 'a_caminho',
        assigned_driver_id: driver.id,
        driver_picked_at: new Date().toISOString(),
        pickup_pin: pickupPin,
        delivery_route_id: route.id,
        route_sequence: item.sequence,
      }).eq('id', item.orderId);
    }

    await supabase.from('app_notifications').insert({
      target: 'store',
      kind: 'driver_batch_accepted',
      payload: { route_id: route.id, driver_name: driver.name, order_count: selectedForBatch.length },
    });

    setSelectedForBatch([]);
    setBatchResult(null);
    setBatchLoading(false);
    setTab('mine');
    void load();
  }

  const available = orders.filter((o) => o.status === 'enviado' && !o.assigned_driver_id);
  const mine = orders.filter((o) => o.assigned_driver_id === driver.id && o.status !== 'entregue');
  const done = orders.filter((o) => o.assigned_driver_id === driver.id && o.status === 'entregue');

  const feePerOrder = Number(config?.driver_fee_per_order ?? 3.0);
  const feePerKm = Number(config?.driver_fee_per_km ?? 1.5);
  function estimateEarnings(order: OrderLog): number {
    return Number(order.delivery_earnings) > 0 ? Number(order.delivery_earnings) : feePerOrder;
  }

  async function savePaymentSettings() {
    setPaySaving(true);
    await supabase.from('delivery_drivers').update({
      payment_frequency: payForm.payment_frequency,
      pix_key: payForm.pix_key || null,
      bank_name: payForm.bank_name || null,
      bank_agency: payForm.bank_agency || null,
      bank_account: payForm.bank_account || null,
      account_type: payForm.account_type,
    }).eq('id', driver.id);
    setPaySaving(false);
    setPaySaved(true);
    setTimeout(() => setPaySaved(false), 1500);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-12">
      <header className="bg-gradient-to-b from-blue-600 to-blue-800 p-4 shadow-xl border-b-4 border-blue-400">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Bike size={22} className="text-white shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-black uppercase text-white truncate">Portal do Entregador</p>
              <p className="text-[10px] text-blue-200 truncate flex items-center gap-1">
                <User size={10} /> {driver.name} · {VEHICLE_LABELS[driver.vehicle_type ?? 'moto'] ?? 'Moto'}
                {driver.verification_status === 'verified' && <CheckCircle2 size={10} className="text-emerald-300" />}
              </p>
            </div>
          </div>
          <button onClick={onExit} className="bg-black/20 hover:bg-black/40 text-white p-2 rounded-lg shrink-0" title="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 mt-4 space-y-4">
        {/* Wallet summary */}
        <div className="bg-gradient-to-r from-emerald-900/40 to-emerald-800/20 border border-emerald-700/40 rounded-xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-600/20 border border-emerald-500 flex items-center justify-center shrink-0">
            <Wallet size={18} className="text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-emerald-300 uppercase font-bold">Saldo da carteira</p>
            <p className="text-lg font-black text-emerald-400">R$ {Number(driver.wallet_balance ?? 0).toFixed(2)}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[9px] text-zinc-400 uppercase">Total ganho</p>
            <p className="text-xs font-bold text-zinc-200">R$ {Number(driver.driver_earnings ?? 0).toFixed(2)}</p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-1">
          <TabBtn label="Pedidos" count={available.length} active={tab === 'available'} onClick={() => setTab('available')} icon={<Package size={13} />} />
          <TabBtn label="Meus" count={mine.length} active={tab === 'mine'} onClick={() => setTab('mine')} icon={<Truck size={13} />} />
          <TabBtn label="Rotas" count={routes.length} active={tab === 'routes'} onClick={() => setTab('routes')} icon={<Route size={13} />} />
          <TabBtn label="Carteira" count={walletTx.length} active={tab === 'wallet'} onClick={() => setTab('wallet')} icon={<Wallet size={13} />} />
          <TabBtn label="Conta" count={0} active={tab === 'settings'} onClick={() => setTab('settings')} icon={<Settings size={13} />} />
        </div>

        {loading && <div className="flex items-center justify-center py-16 text-blue-400"><Loader2 className="animate-spin" size={28} /></div>}

        {/* TAB: Available with batch selection */}
        {!loading && tab === 'available' && (
          <div className="space-y-3">
            {available.length >= 2 && (
              <div className="bg-blue-950/20 border border-blue-800/40 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-1.5"><Route size={12} /> Rota multi-pedido</span>
                  <span className="text-[9px] text-zinc-500">{selectedForBatch.length} selecionados</span>
                </div>
                <p className="text-[9px] text-zinc-500">Selecione 2 ou mais pedidos próximos para entregar juntos e ganhar mais.</p>
                {selectedForBatch.length >= 2 && (
                  <button onClick={calculateBatch} disabled={batchLoading} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5">
                    {batchLoading ? <Loader2 size={13} className="animate-spin" /> : <Route size={13} />}
                    Calcular rota e ganho
                  </button>
                )}
                {batchResult && (
                  <div className="bg-blue-600/10 border border-blue-600 rounded-lg p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">Distância total:</span>
                      <span className="font-bold text-blue-300">{batchResult.totalDistanceKm.toFixed(1)} km</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">Ganho total:</span>
                      <span className="font-black text-emerald-400">R$ {batchResult.totalEarnings.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-blue-700 pt-1.5">
                      <p className="text-[9px] text-zinc-400 uppercase mb-1">Ordem otimizada:</p>
                      {batchResult.optimizedOrder.map((o) => (
                        <p key={o.orderId} className="text-[10px] text-zinc-300 truncate">{o.sequence}º {o.address}</p>
                      ))}
                    </div>
                    <button onClick={acceptBatch} disabled={batchLoading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 mt-1">
                      <Check size={13} /> Aceitar rota completa
                    </button>
                  </div>
                )}
                {selectedForBatch.length > 0 && (
                  <button onClick={() => { setSelectedForBatch([]); setBatchResult(null); }} className="w-full text-[10px] text-zinc-400 hover:text-zinc-200">
                    Limpar seleção
                  </button>
                )}
              </div>
            )}

            {available.length === 0 && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-8 text-center">
                <Package className="text-blue-400 mx-auto mb-2" size={32} />
                <p className="text-xs text-zinc-400">Nenhum pedido disponível no momento.</p>
              </div>
            )}

            {available.map((order) => {
              const isSelected = selectedForBatch.includes(order.id);
              return (
                <div key={order.id} className={`bg-zinc-900 border rounded-xl p-3 space-y-2.5 ${isSelected ? 'border-blue-500' : 'border-zinc-800'}`}>
                  <div className="flex items-start gap-2">
                    {available.length >= 2 && (
                      <input type="checkbox" checked={isSelected} onChange={() => toggleBatchSelect(order.id)} className="accent-blue-500 mt-1 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-yellow-400 truncate">Pedido para entrega</p>
                      <p className="text-[10px] text-zinc-500">{new Date(order.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                    <span className="text-sm font-black text-emerald-400 shrink-0">+ R$ {estimateEarnings(order).toFixed(2)}</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-xs text-zinc-300">
                    <MapPin size={13} className="text-blue-400 shrink-0 mt-0.5" />
                    <span className="min-w-0">{order.customer_address || 'Endereço não informado'}</span>
                  </div>
                  <button onClick={() => void acceptOrder(order)} disabled={Boolean(deliveryActionBusy[order.id])} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5">
                    {deliveryActionBusy[order.id] ? <Loader2 size={13} className="animate-spin" /> : <Truck size={13} />} Aceitar entrega
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB: Mine with pickup PIN */}
        {!loading && tab === 'mine' && (
          <div className="space-y-3">
            {mine.length === 0 && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-8 text-center">
                <Package className="text-blue-400 mx-auto mb-2" size={32} />
                <p className="text-xs text-zinc-400">Você não tem pedidos em andamento.</p>
              </div>
            )}
            {mine.map((order) => (
              <div key={order.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-yellow-400 truncate">Pedido {order.route_sequence ? `${order.route_sequence}º da rota` : 'em andamento'}</p>
                    <p className="text-[10px] text-zinc-500">{new Date(order.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                  <span className="text-sm font-black text-emerald-400 shrink-0">+ R$ {estimateEarnings(order).toFixed(2)}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-start gap-1.5 text-xs text-zinc-300">
                    <MapPin size={13} className="text-blue-400 shrink-0 mt-0.5" />
                    <span className="min-w-0">{order.customer_address || 'Endereço não informado'}</span>
                  </div>
                </div>

                {/* Pickup PIN verification */}
                {order.pickup_pin && !order.pickup_verified_at && (
                  <div className="bg-amber-950/20 border border-amber-700/40 rounded-lg p-2.5 space-y-1.5">
                    <p className="text-[10px] font-bold text-amber-400 uppercase flex items-center gap-1.5">
                      <KeyRound size={12} /> PIN de retirada na loja
                    </p>
                    <p className="text-[9px] text-zinc-400">A loja vai te dizer o PIN de 4 dígitos. Digite aqui para confirmar a retirada.</p>
                    <div className="flex gap-1.5">
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={pickupPinInput[order.id] ?? ''}
                        onChange={(e) => setPickupPinInput({ ...pickupPinInput, [order.id]: e.target.value.replace(/\D/g, '') })}
                        placeholder="0000"
                        className="flex-1 bg-zinc-800 border border-amber-700 rounded-lg p-2 text-sm text-amber-400 font-mono text-center focus:border-amber-500 focus:outline-none"
                      />
                      <button onClick={() => verifyPickupPin(order)} className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 rounded-lg text-xs">
                        Confirmar
                      </button>
                    </div>
                    {pinError[order.id] && <p className="text-[10px] text-red-400 flex items-center gap-1"><AlertCircle size={10} /> {pinError[order.id]}</p>}
                  </div>
                )}

                {order.pickup_verified_at && (
                  <div className="bg-emerald-600/10 border border-emerald-600 rounded-lg p-2 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span className="text-[10px] text-emerald-300 font-bold">Retirada confirmada</span>
                  </div>
                )}

                <div className="flex gap-1.5 pt-1 border-t border-zinc-800">
                  <button onClick={() => openWaze(order)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5">
                    <Navigation size={13} /> Waze
                  </button>
                  <button onClick={() => callCustomer(order)} className="bg-zinc-700 hover:bg-zinc-600 text-white py-2 px-3 rounded-lg">
                    <Phone size={13} />
                  </button>
                  <button onClick={() => void markDelivered(order)} disabled={Boolean(deliveryActionBusy[order.id]) || !order.pickup_verified_at} title={!order.pickup_verified_at ? 'Confirme a retirada com o PIN antes de concluir' : 'Marcar como entregue'} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5">
                    {deliveryActionBusy[order.id] ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Entregue
                  </button>
                </div>
                <button onClick={() => releaseOrder(order)} className="w-full text-[10px] text-zinc-500 hover:text-red-400 flex items-center justify-center gap-1">
                  <RotateCcw size={10} /> Devolver para fila
                </button>
              </div>
            ))}
          </div>
        )}

        {/* TAB: Routes */}
        {!loading && tab === 'routes' && (
          <div className="space-y-3">
            {routes.length === 0 && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-8 text-center">
                <Route className="text-blue-400 mx-auto mb-2" size={32} />
                <p className="text-xs text-zinc-400">Nenhuma rota registrada ainda.</p>
              </div>
            )}
            {routes.map((r) => (
              <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-400">Rota de {r.order_count} pedido{r.order_count !== 1 ? 's' : ''}</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${r.status === 'active' ? 'bg-blue-600/20 text-blue-400' : r.status === 'completed' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-zinc-700 text-zinc-400'}`}>{r.status}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Distância: <span className="font-bold text-zinc-200">{Number(r.total_distance_km).toFixed(1)} km</span></span>
                  <span className="text-zinc-400">Ganho: <span className="font-bold text-emerald-400">R$ {Number(r.total_earnings).toFixed(2)}</span></span>
                </div>
                <p className="text-[10px] text-zinc-500">{new Date(r.started_at).toLocaleString('pt-BR')}</p>
              </div>
            ))}
          </div>
        )}

        {/* TAB: Wallet */}
        {!loading && tab === 'wallet' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <p className="text-[9px] text-zinc-400 uppercase">Saldo atual</p>
                <p className="text-lg font-black text-emerald-400">R$ {Number(driver.wallet_balance ?? 0).toFixed(2)}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <p className="text-[9px] text-zinc-400 uppercase">Total pago</p>
                <p className="text-lg font-black text-blue-400">R$ {Number(driver.driver_payouts ?? 0).toFixed(2)}</p>
              </div>
            </div>
            {walletTx.length === 0 && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-8 text-center">
                <Wallet className="text-blue-400 mx-auto mb-2" size={32} />
                <p className="text-xs text-zinc-400">Nenhuma transação ainda. Faça entregas para ganhar.</p>
              </div>
            )}
            {walletTx.map((tx) => (
              <div key={tx.id} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tx.amount >= 0 ? 'bg-emerald-600/20' : 'bg-red-600/20'}`}>
                  {tx.type === 'earning' && <Check size={14} className="text-emerald-400" />}
                  {tx.type === 'payout' && <Wallet size={14} className="text-red-400" />}
                  {tx.type === 'bonus' && <CheckCircle2 size={14} className="text-emerald-400" />}
                  {tx.type === 'adjustment' && <AlertCircle size={14} className="text-blue-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-zinc-200 truncate">{tx.description}</p>
                  <p className="text-[9px] text-zinc-500">{new Date(tx.created_at).toLocaleString('pt-BR')} · saldo R$ {Number(tx.balance_after).toFixed(2)}</p>
                </div>
                <span className={`text-sm font-black shrink-0 ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {tx.amount >= 0 ? '+' : ''}R$ {Number(tx.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* TAB: Settings (payment frequency + bank data) */}
        {!loading && tab === 'settings' && (
          <div className="space-y-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2">
              <span className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-1.5"><Bike size={12} /> Disponibilidade para entregas</span>
              <p className="text-[10px] text-zinc-400">Ative quando estiver perto da região e puder receber pedidos. Desative quando não estiver disponível.</p>
              <button type="button" onClick={() => void toggleAvailability()} disabled={availabilityBusy} className={`w-full rounded-lg py-2.5 text-xs font-bold disabled:opacity-50 ${isAvailable ? 'bg-emerald-600 text-white' : 'bg-zinc-700 text-zinc-200'}`}>
                {availabilityBusy ? 'Salvando...' : isAvailable ? '● Estou disponível para entregas' : '○ Estou indisponível'}
              </button>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-3">
              <span className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-1.5"><Banknote size={12} /> Como você quer receber</span>
              <p className="text-[9px] text-zinc-500">Escolha a frequência de pagamento. A loja paga conforme a sua escolha.</p>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1.5">Frequência de pagamento</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { value: 'daily', label: 'Diário' },
                    { value: 'weekly', label: 'Semanal' },
                    { value: 'biweekly', label: 'Quinzenal' },
                    { value: 'monthly', label: 'Mensal' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPayForm({ ...payForm, payment_frequency: opt.value })}
                      className={`p-2.5 rounded-lg border-2 text-xs font-bold transition ${
                        payForm.payment_frequency === opt.value
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-1.5"><Wallet size={11} /> Dados para pagamento</span>
                <PayField label="Chave PIX"><input value={payForm.pix_key} onChange={(e) => setPayForm({ ...payForm, pix_key: e.target.value })} placeholder="CPF, telefone, e-mail ou chave aleatória" className={payInputCls} /></PayField>
                <div className="grid grid-cols-2 gap-2">
                  <PayField label="Banco"><input value={payForm.bank_name} onChange={(e) => setPayForm({ ...payForm, bank_name: e.target.value })} placeholder="Ex: Nubank" className={payInputCls} /></PayField>
                  <PayField label="Tipo de conta">
                    <select value={payForm.account_type} onChange={(e) => setPayForm({ ...payForm, account_type: e.target.value })} className={payInputCls}>
                      <option value="pix">PIX</option>
                      <option value="corrente">Conta corrente</option>
                      <option value="poupanca">Poupança</option>
                    </select>
                  </PayField>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <PayField label="Agência"><input value={payForm.bank_agency} onChange={(e) => setPayForm({ ...payForm, bank_agency: e.target.value })} placeholder="0001" className={payInputCls} /></PayField>
                  <PayField label="Conta"><input value={payForm.bank_account} onChange={(e) => setPayForm({ ...payForm, bank_account: e.target.value })} placeholder="12345-6" className={payInputCls} /></PayField>
                </div>
              </div>

              <button onClick={savePaymentSettings} disabled={paySaving} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5">
                {paySaving ? <Loader2 size={14} className="animate-spin" /> : paySaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                {paySaved ? 'Salvo!' : 'Salvar dados de pagamento'}
              </button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Resumo da conta</span>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-zinc-400">Nome:</span><span className="text-zinc-200">{driver.name}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Veículo:</span><span className="text-zinc-200">{VEHICLE_LABELS[driver.vehicle_type ?? 'moto'] ?? 'Moto'}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Região:</span><span className="text-zinc-200">{driver.zone ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Verificação:</span><span className={driver.verification_status === 'verified' ? 'text-emerald-400' : 'text-amber-400'}>{driver.verification_status === 'verified' ? 'Verificado' : 'Pendente'}</span></div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const payInputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none';

function PayField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}

function TabBtn({ label, count, active, onClick, icon }: { label: string; count: number; active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`p-2 rounded-lg border text-center transition ${active ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}>
      <span className="flex items-center justify-center mb-0.5">{icon}</span>
      <span className="text-base font-black block leading-none">{count}</span>
      <span className="text-[8px] font-bold uppercase">{label}</span>
    </button>
  );
}
