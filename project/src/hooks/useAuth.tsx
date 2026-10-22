import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

export type CustomerProfile = {
  user_id: string;
  full_name: string;
  phone: string;
  default_address_id: string | null;
};

export type SavedAddress = {
  id: string;
  label: string;
  address: string;
  reference: string;
  is_default: boolean;
};

type AuthContextValue = {
  session: ReturnType<typeof supabase.auth.getSession> extends Promise<{ data: { session: infer S } }> ? S : null;
  loading: boolean;
  profile: CustomerProfile | null;
  addresses: SavedAddress[];
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  saveAddress: (addr: Omit<SavedAddress, 'id'> & { id?: string }) => Promise<void>;
  removeAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
  updateProfile: (patch: Partial<CustomerProfile>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      (async () => {
        setSession(sess);
        if (sess?.user) {
          await loadProfile(sess.user.id);
        } else {
          setProfile(null);
          setAddresses([]);
        }
      })();
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProfile(userId: string) {
    const { data: existing } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (existing) {
      setProfile(existing as CustomerProfile);
    } else {
      // Cria perfil na primeira vez a partir dos metadados do cadastro.
      const meta = session?.user?.user_metadata ?? {};
      const newProfile = {
        user_id: userId,
        full_name: String(meta.full_name ?? ''),
        phone: String(meta.phone ?? ''),
      };
      const { data, error } = await supabase.from('customer_profiles').insert(newProfile).select().maybeSingle();
      if (!error && data) setProfile(data as CustomerProfile);
    }
    await loadAddresses(userId);
  }

  async function loadAddresses(userId: string) {
    const { data } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    setAddresses((data ?? []) as SavedAddress[]);
  }

  async function refreshProfile() {
    if (!session?.user) return;
    await loadProfile(session.user.id);
  }

  async function signInWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUpWithEmail(email: string, password: string, fullName: string, phone: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone } },
    });
    if (error) return { error: error.message };
    if (data.user) {
      // Cria perfil imediatamente se a sessão foi retornada.
      await supabase.from('customer_profiles').upsert({
        user_id: data.user.id,
        full_name: fullName,
        phone,
      });
    }
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setAddresses([]);
  }

  async function saveAddress(addr: Omit<SavedAddress, 'id'> & { id?: string }) {
    if (!session?.user) return;
    if (addr.id) {
      await supabase
        .from('customer_addresses')
        .update({
          label: addr.label,
          address: addr.address,
          reference: addr.reference,
          is_default: addr.is_default,
        })
        .eq('id', addr.id);
    } else {
      await supabase.from('customer_addresses').insert({
        user_id: session.user.id,
        label: addr.label,
        address: addr.address,
        reference: addr.reference,
        is_default: addr.is_default,
      });
    }
    if (addr.is_default) {
      await supabase
        .from('customer_addresses')
        .update({ is_default: false })
        .neq('id', addr.id ?? '________')
        .eq('user_id', session.user.id);
    }
    await loadAddresses(session.user.id);
  }

  async function removeAddress(id: string) {
    if (!session?.user) return;
    await supabase.from('customer_addresses').delete().eq('id', id);
    await loadAddresses(session.user.id);
  }

  async function setDefaultAddress(id: string) {
    if (!session?.user) return;
    await supabase
      .from('customer_addresses')
      .update({ is_default: false })
      .eq('user_id', session.user.id)
      .neq('id', id);
    await supabase.from('customer_addresses').update({ is_default: true }).eq('id', id);
    await supabase.from('customer_profiles').update({ default_address_id: id }).eq('user_id', session.user.id);
    await loadAddresses(session.user.id);
    await loadProfile(session.user.id);
  }

  async function updateProfile(patch: Partial<CustomerProfile>) {
    if (!session?.user || !profile) return;
    const { data } = await supabase
      .from('customer_profiles')
      .update(patch)
      .eq('user_id', session.user.id)
      .select()
      .maybeSingle();
    if (data) setProfile(data as CustomerProfile);
  }

  const value: AuthContextValue = {
    session,
    loading,
    profile,
    addresses,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    refreshProfile,
    saveAddress,
    removeAddress,
    setDefaultAddress,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
