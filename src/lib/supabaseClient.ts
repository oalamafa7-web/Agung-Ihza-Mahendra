import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Session } from '../types';

// Helper sanitasi URL: tambahkan https:// jika pengguna lupa menuliskannya
export function sanitizeUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let trimmed = String(rawUrl).trim();
  if (trimmed && !/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('[')) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}

// Helper validasi URL HTTP/HTTPS yang sah
export function isValidHttpUrl(stringUrl: string): boolean {
  if (!stringUrl || typeof stringUrl !== 'string') return false;
  const trimmed = stringUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  // Hindari domain placeholder atau marketing yang bukan endpoint API Supabase project
  if (
    trimmed === 'https://supabase.co' ||
    trimmed === 'http://supabase.co' ||
    trimmed.includes('your-project') ||
    trimmed.includes('[') ||
    trimmed.includes(']')
  ) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Helper validasi Anon Key
export function isValidAnonKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (
    trimmed === '[TEMPEL_ANON_PUBLIC_KEY_ANDA_DI_SINI]' ||
    trimmed.includes('TEMPEL_ANON') ||
    trimmed.includes('your-anon-key') ||
    trimmed.length < 20
  ) {
    return false;
  }
  return true;
}

// Ambil kredensial dari ENV, atau localStorage jika disetel di modal, atau fallback
const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const localUrl = typeof window !== 'undefined' ? localStorage.getItem('sopa_custom_supabase_url') || '' : '';
const localKey = typeof window !== 'undefined' ? localStorage.getItem('sopa_custom_supabase_key') || '' : '';

const candidateUrl = sanitizeUrl(envUrl || localUrl);
const candidateKey = (envKey || localKey).trim();

export const SUPABASE_URL = candidateUrl || 'https://supabase.co';
export const SUPABASE_ANON_KEY = candidateKey || '[TEMPEL_ANON_PUBLIC_KEY_ANDA_DI_SINI]';

export const MAIN_TABLE_NAME =
  import.meta.env.VITE_SUPABASE_TABLE ||
  (typeof window !== 'undefined' ? localStorage.getItem('sopa_custom_supabase_table') : '') ||
  'sop_sessions';

// Validasi apakah konfigurasi Supabase sudah siap dan valid
export const isSupabaseConfigured: boolean =
  isValidHttpUrl(SUPABASE_URL) && isValidAnonKey(SUPABASE_ANON_KEY);

// Inisialisasi Supabase Client HANYA jika kredensial sudah valid
// Hal ini mencegah error "Invalid supabaseUrl" saat kredensial masih placeholder
export const supabase: SupabaseClient | null = (() => {
  if (!isSupabaseConfigured) {
    return null;
  }
  try {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    });
  } catch (err) {
    console.warn('Gagal menginisialisasi client Supabase:', err);
    return null;
  }
})();

/**
 * Format data sesi dari format database (snake_case/json) ke model TypeScript Session
 */
export function formatSessionFromRow(row: any): Session {
  return {
    id: String(row.id),
    factory: row.factory || 'Factory 1',
    line: String(row.line || ''),
    date: String(row.date || ''),
    file: String(row.file || ''),
    style: String(row.style || ''),
    fileName: String(row.file_name || row.fileName || ''),
    sheet: String(row.sheet || ''),
    ops: Array.isArray(row.ops) ? row.ops : [],
    hours: Array.isArray(row.hours) ? row.hours : [],
    tpl: String(row.tpl || 'tshirt'),
    map: typeof row.map === 'object' && row.map !== null ? row.map : {},
    checks: typeof row.checks === 'object' && row.checks !== null ? row.checks : {},
    bdate: typeof row.bdate === 'object' && row.bdate !== null ? row.bdate : {},
    created: Number(row.created) || Date.now(),
  };
}

/**
 * Format model Session ke bentuk baris database Supabase
 */
export function formatRowFromSession(session: Session): Record<string, any> {
  return {
    id: session.id,
    factory: session.factory || 'Factory 1',
    line: session.line,
    date: session.date,
    file: session.file,
    style: session.style,
    file_name: session.fileName,
    sheet: session.sheet,
    ops: session.ops,
    hours: session.hours,
    tpl: session.tpl,
    map: session.map,
    checks: session.checks,
    bdate: session.bdate,
    created: session.created,
    updated_at: new Date().toISOString(),
  };
}

/**
 * READ: Mengambil seluruh sesi dari Supabase
 */
export async function fetchAllSessions(): Promise<{ data: Session[] | null; error: string | null }> {
  if (!supabase || !isSupabaseConfigured) {
    return { data: null, error: 'Kredensial Supabase belum dikonfigurasi.' };
  }

  try {
    const { data, error } = await supabase
      .from(MAIN_TABLE_NAME)
      .select('*')
      .order('created', { ascending: false });

    if (error) {
      console.error(`Error mengambil data dari ${MAIN_TABLE_NAME}:`, error);
      return { data: null, error: error.message };
    }

    const sessions = (data || []).map(formatSessionFromRow);
    return { data: sessions, error: null };
  } catch (err: any) {
    console.error('Fetch sessions failed:', err);
    return { data: null, error: err?.message || 'Gagal terhubung ke database' };
  }
}

/**
 * CREATE: Menyimpan sesi baru ke Supabase
 */
export async function insertSession(session: Session): Promise<{ success: boolean; error: string | null }> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: 'Kredensial Supabase belum dikonfigurasi.' };
  }

  try {
    const row = formatRowFromSession(session);
    const { error } = await supabase.from(MAIN_TABLE_NAME).insert(row);

    if (error) {
      console.error(`Error insert ke ${MAIN_TABLE_NAME}:`, error);
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal menyimpan data baru' };
  }
}

/**
 * UPDATE: Memperbarui sesi (termasuk checklist dan mapping) ke Supabase
 */
export async function updateSession(session: Session): Promise<{ success: boolean; error: string | null }> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: 'Kredensial Supabase belum dikonfigurasi.' };
  }

  try {
    const row = formatRowFromSession(session);
    const { error } = await supabase
      .from(MAIN_TABLE_NAME)
      .upsert(row, { onConflict: 'id' });

    if (error) {
      console.error(`Error update ke ${MAIN_TABLE_NAME}:`, error);
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal memperbarui data' };
  }
}

/**
 * DELETE: Menghapus satu atau beberapa sesi dari Supabase
 */
export async function deleteSessions(ids: string[]): Promise<{ success: boolean; error: string | null }> {
  if (!supabase || !isSupabaseConfigured || ids.length === 0) {
    return { success: false, error: 'Kredensial Supabase belum dikonfigurasi atau ID kosong.' };
  }

  try {
    const { error } = await supabase.from(MAIN_TABLE_NAME).delete().in('id', ids);

    if (error) {
      console.error(`Error hapus dari ${MAIN_TABLE_NAME}:`, error);
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal menghapus data' };
  }
}

/**
 * REAL-TIME: Berlangganan perubahan real-time pada tabel Supabase
 */
export function subscribeToSessionChanges(
  onInsert: (newSession: Session) => void,
  onUpdate: (updatedSession: Session) => void,
  onDelete: (deletedId: string) => void
) {
  if (!supabase || !isSupabaseConfigured) return null;

  try {
    const channel = supabase
      .channel(`realtime_${MAIN_TABLE_NAME}_channel`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: MAIN_TABLE_NAME },
        (payload) => {
          if (payload.new) {
            onInsert(formatSessionFromRow(payload.new));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: MAIN_TABLE_NAME },
        (payload) => {
          if (payload.new) {
            onUpdate(formatSessionFromRow(payload.new));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: MAIN_TABLE_NAME },
        (payload) => {
          if (payload.old && payload.old.id) {
            onDelete(String(payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        console.log(`Supabase Realtime status (${MAIN_TABLE_NAME}):`, status);
      });

    return channel;
  } catch (err) {
    console.error('Gagal membuat subscription realtime:', err);
    return null;
  }
}
