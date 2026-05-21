// © 2026 ТОО «NOVA Comp». BizBook KZ.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rfleckhzyhfhfmymhquh.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_JsWZaNR9ybJQBx_y6kWXXg_OJCxFxQq'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── AUTH ─────────────────────────────────────────────────────────
export const auth = {
  async signInWithOtp(email) {
    return supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
  },
  async verifyOtp(email, token) {
    return supabase.auth.verifyOtp({ email, token, type: 'email' })
  },
  async signOut() {
    return supabase.auth.signOut()
  },
  async getSession() {
    return supabase.auth.getSession()
  },
  async getUser() {
    const { data } = await supabase.auth.getUser()
    return data?.user
  },
  onAuthStateChange(cb) {
    return supabase.auth.onAuthStateChange(cb)
  }
}

// ─── PROFILES ─────────────────────────────────────────────────────
export const profiles = {
  async get(userId) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
    return { data, error }
  },
  async update(userId, updates) {
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single()
    return { data, error }
  },
  async setAdmin(email) {
    // Только через SQL Editor в Supabase
    return { error: 'Use SQL Editor' }
  }
}

// ─── COMPANIES ────────────────────────────────────────────────────
export const companies = {
  async list(userId) {
    const { data, error } = await supabase
      .from('companies')
      .select('*, tariffs(name, price_month)')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
    return { data: data || [], error }
  },
  async get(id) {
    const { data, error } = await supabase
      .from('companies').select('*, tariffs(*)').eq('id', id).single()
    return { data, error }
  },
  async create(company) {
    const { data, error } = await supabase.from('companies').insert(company).select().single()
    return { data, error }
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('companies').update(updates).eq('id', id).select().single()
    return { data, error }
  },
  // Для админа — все компании
  async listAll() {
    const { data, error } = await supabase
      .from('companies').select('*, profiles(email), tariffs(name)').order('created_at', { ascending: false })
    return { data: data || [], error }
  },
  async setTariff(companyId, tariffId, until) {
    const { data, error } = await supabase
      .from('companies')
      .update({ tariff_id: tariffId, tariff_until: until, status: 'active' })
      .eq('id', companyId).select().single()
    return { data, error }
  },
  async setStatus(companyId, status) {
    const { data, error } = await supabase
      .from('companies').update({ status }).eq('id', companyId).select().single()
    return { data, error }
  }
}

// ─── TARIFFS ──────────────────────────────────────────────────────
export const tariffs = {
  async list() {
    const { data, error } = await supabase.from('tariffs').select('*').eq('is_active', true).order('price_month')
    return { data: data || [], error }
  }
}

// ─── COUNTERPARTIES ───────────────────────────────────────────────
export const counterparties = {
  async list(companyId) {
    const { data, error } = await supabase
      .from('counterparties').select('*').eq('company_id', companyId).order('name')
    return { data: data || [], error }
  },
  async create(cp) {
    const { data, error } = await supabase.from('counterparties').insert(cp).select().single()
    return { data, error }
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('counterparties').update(updates).eq('id', id).select().single()
    return { data, error }
  },
  async delete(id) {
    const { error } = await supabase.from('counterparties').delete().eq('id', id)
    return { error }
  }
}

// ─── NOMENCLATURE ─────────────────────────────────────────────────
export const nomenclature = {
  async list(companyId) {
    const { data, error } = await supabase
      .from('nomenclature').select('*').eq('company_id', companyId).eq('is_active', true).order('name')
    return { data: data || [], error }
  },
  async create(item) {
    const { data, error } = await supabase.from('nomenclature').insert(item).select().single()
    return { data, error }
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('nomenclature').update(updates).eq('id', id).select().single()
    return { data, error }
  },
  async delete(id) {
    const { data, error } = await supabase.from('nomenclature').update({ is_active: false }).eq('id', id).select().single()
    return { data, error }
  }
}

// ─── DOCUMENTS ────────────────────────────────────────────────────
export const documents = {
  async list(companyId, filters = {}) {
    let q = supabase.from('documents').select('*').eq('company_id', companyId)
    if (filters.type) q = q.eq('type', filters.type)
    if (filters.direction) q = q.eq('direction', filters.direction)
    if (filters.status) q = q.eq('status', filters.status)
    q = q.order('date', { ascending: false }).order('created_at', { ascending: false })
    const { data, error } = await q
    return { data: data || [], error }
  },
  async get(id) {
    const { data, error } = await supabase.from('documents').select('*').eq('id', id).single()
    return { data, error }
  },
  async create(doc) {
    const { data, error } = await supabase.from('documents').insert(doc).select().single()
    return { data, error }
  },
  async update(id, updates) {
    const { data, error } = await supabase.from('documents').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    return { data, error }
  },
  async delete(id) {
    const { error } = await supabase.from('documents').delete().eq('id', id)
    return { error }
  },
  async nextNumber(companyId, type) {
    const { data } = await supabase.rpc('next_doc_number', { p_company_id: companyId, p_type: type })
    return data || `${type.toUpperCase()}-0001`
  }
}
