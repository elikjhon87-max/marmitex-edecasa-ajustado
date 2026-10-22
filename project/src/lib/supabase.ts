import { createClient } from '@supabase/supabase-js';

async function ensureColumnsExist(supabaseClient: any) {
  try {
    await supabaseClient.from('business_config').select('lunch_close_hours').limit(1);
    
  } catch (e) {
    console.log('verificando colunas...');
  }
  
}
export function parseBRL(input: string): number {
  if (!input) return 0;
  let s = String(input).trim().replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // Formato brasileiro: ponto é milhar, vírgula é decimal.
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    // Só vírgula: é o decimal.
    s = s.replace(',', '.');
  } else if (hasDot) {
    // Só ponto: assume decimal (17.50 -> 17.50). Se vier "1.234" sem vírgula,
    // tratamos como milhar só quando houver mais de 2 dígitos após o último ponto
    // e nenhum grupo incomum; para segurança, mantemos como decimal.
    const parts = s.split('.');
    if (parts.length === 2 && parts[1].length === 3 && parts[0].length >= 1 && Number(parts[0]) >= 1) {
      // "1.234" -> provável milhar (sem casas decimais). Converte para inteiro.
      s = parts.join('');
    }
  }
  const value = parseFloat(s);
  return Number.isFinite(value) ? value : 0;
}

export function formatBRL(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type MenuItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  available: boolean;
  price: number;
  image_url: string | null;
  available_days: string[];
  created_at?: string;
};

export type MarmitaSize = {
  id: string;
  name: string;
  capacity: string;
  price: number;
  available: boolean;
  display_order: number;
};

export type Protein = {
  id: string;
  name: string;
  price: number;
  available: boolean;
  display_order: number;
  image_url?: string | null;
};

export type Extra = {
  id: string;
  name: string;
  price: number;
  available: boolean;
  display_order: number;
  image_url?: string | null;
};

export type BusinessConfig = {
  id: number;
  primary_phone: string;
  secondary_phone: string;
  address: string;
  hours: string;
  instagram: string;
  pix_key: string;
  pix_key_type: string;
  prep_time_minutes: number;
  store_address: string;
  motoboy_phone: string;
  open_hours: string;
  close_hours: string;
  closed_days: string[];
  kitchen_open_hours?: string;
  kitchen_close_hours?: string;
  prep_start_hours?: string;
  delivery_start_hours?: string;
  delivery_end_hours?: string;
  vapid_public_key?: string;
  vapid_private_key?: string;
  delivery_pricing_mode?: 'fixed' | 'distance';
  delivery_price_per_km?: number;
  delivery_base_fee?: number;
  delivery_free_km?: number;
  delivery_max_km?: number;
  store_lat?: number | null;
  store_lng?: number | null;
  driver_fee_per_km?: number;
  driver_fee_per_order?: number;
  driver_fee_multiplier_batch?: number;
  driver_batch_radius_km?: number;
  pickup_pin_enabled?: boolean;
  card_on_delivery_enabled?: boolean;
  card_on_delivery_types?: string;
};

export type DeliveryZone = {
  id: string;
  name: string;
  delivery_fee: number;
  estimated_minutes: number;
  active: boolean;
  display_order: number;
  created_at?: string;
};

export const FALLBACK_SIZES: MarmitaSize[] = [
  { id: 'p', name: 'Marmita Pequena', capacity: '500 ml ~ (Fundo Redondo)', price: 17, available: true, display_order: 1 },
  { id: 'g', name: 'Marmita Grande', capacity: '750 ml ~ (Fundo Redondo)', price: 24, available: true, display_order: 2 },
];

export const FALLBACK_PROTEINS: Protein[] = [
  { id: 'fallback-1', name: 'Filé de Peito Empanado', price: 0, available: true, display_order: 1 },
  { id: 'fallback-2', name: 'Bisteca Suína', price: 0, available: true, display_order: 2 },
  { id: 'fallback-3', name: 'Mista (Peito Empanado + Bisteca)', price: 0, available: true, display_order: 3 },
  { id: 'fallback-4', name: 'Feijoada Completa', price: 0, available: true, display_order: 4 },
  { id: 'fallback-5', name: 'Omelete Recheado (Napolitano)', price: 0, available: true, display_order: 5 },
  { id: 'fallback-6', name: 'Omelete Recheado (Frango c/ Milho)', price: 0, available: true, display_order: 6 },
];

export const ADMIN_PASSWORD = 'admin123';

export type OrderLog = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  items_summary: string;
  total: number;
  payment_method: string;
  payment_timing: string;
  paid: boolean;
  status: string;
  created_at: string;
  delivery_fee?: number;
  delivery_zone?: string;
  needs_motoboy?: boolean;
  estimated_ready_at?: string;
  customer_user_id?: string | null;
  delivery_pin?: string | null;
  delivery_status?: 'recebido' | 'preparando' | 'a_caminho' | 'entregue' | 'cancelado';
  confirmed_at?: string | null;
  notes?: string;
  scheduled_for?: string | null;
  assigned_driver_id?: string | null;
  driver_picked_at?: string | null;
  pickup_pin?: string | null;
  pickup_verified_at?: string | null;
  delivery_route_id?: string | null;
  delivery_earnings?: number;
  route_sequence?: number | null;
};

export type DeliveryDriver = {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  available_for_jobs?: boolean;
  created_at: string;
  vehicle_type?: string;
  pin?: string | null;
  approved?: boolean;
  zone?: string | null;
  rejection_reason?: string | null;
  cnh_number?: string | null;
  cnh_category?: string | null;
  cnh_image_url?: string | null;
  photo_url?: string | null;
  vehicle_plate?: string | null;
  vehicle_model?: string | null;
  document_url?: string | null;
  verification_status?: 'pending' | 'verified' | 'rejected';
  verification_notes?: string | null;
  wallet_balance?: number;
  driver_earnings?: number;
  driver_payouts?: number;
  payment_frequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  pix_key?: string | null;
  bank_name?: string | null;
  bank_agency?: string | null;
  bank_account?: string | null;
  account_type?: string | null;
  last_payout_at?: string | null;
};

export type VehicleType = 'moto' | 'bicicleta' | 'carro' | 'caminhonete';

export type DeliveryRoute = {
  id: string;
  driver_id: string | null;
  status: 'active' | 'completed' | 'cancelled';
  total_distance_km: number;
  total_earnings: number;
  started_at: string;
  completed_at: string | null;
  order_count: number;
};

export type DriverWalletTransaction = {
  id: string;
  driver_id: string;
  type: 'earning' | 'payout' | 'bonus' | 'adjustment';
  amount: number;
  balance_after: number;
  description: string;
  order_id?: string | null;
  route_id?: string | null;
  created_at: string;
};

export type DriverDocument = {
  id: string;
  driver_id: string;
  doc_type: 'cnh' | 'photo' | 'vehicle_doc' | 'id_document';
  file_url: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_at?: string | null;
  created_at: string;
};

export type OrderRating = {
  id: string;
  order_id: string;
  user_id: string;
  meal_stars: number;
  delivery_stars: number;
  comment: string;
  created_at: string;
};

export type ExpenseCategory = {
  id: string;
  name: string;
  display_order: number;
};

export type Expense = {
  id: string;
  category_id: string;
  description: string;
  amount: number;
  supplier_id: string | null;
  expense_date: string;
  notes: string;
  created_at: string;
};

export type Supplier = {
  id: string;
  name: string;
  address: string;
  location_hint: string;
  notes: string;
  created_at: string;
  category?: string;
  contact_name?: string;
  phone?: string;
  whatsapp?: string;
  city?: string;
  maps_link?: string;
  products?: string;
  favorite?: boolean;
};

export type SupplierPrice = {
  id: string;
  supplier_id: string;
  product_name: string;
  unit: string;
  price: number;
  notes: string;
  updated_at: string;
};

export type Coupon = {
  id: string;
  code: string;
  description: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
};

export type CartItem = {
  id: string;
  sizeId: string;
  sizeName: string;
  sizeCapacity: string;
  sizePrice: number;
  menuItemTitle: string;
  menuItemPrice: number;
  proteinId: string;
  proteinName: string;
  proteinPrice: number;
  extraIds: string[];
  extraNames: string[];
  extraPrices: number[];
  extrasTotal: number;
  obs: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayKey = typeof WEEKDAY_KEYS[number];

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: 'Segunda', tue: 'Terça', wed: 'Quarta', thu: 'Quinta',
  fri: 'Sexta', sat: 'Sábado', sun: 'Domingo',
};
