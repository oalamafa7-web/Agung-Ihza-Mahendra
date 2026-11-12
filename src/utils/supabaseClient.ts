import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Session, SOPTemplate } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'https://your-project.supabase.co' &&
    !supabaseUrl.includes('your-project')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Table names configurable via env or default
export const TABLES = {
  SESSIONS: 'sop_sessions',
  TEMPLATES: 'sop_templates',
};

/**
 * Fetch all sessions from Supabase
 */
export async function fetchSessionsFromSupabase(): Promise<Session[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from(TABLES.SESSIONS)
      .select('*')
      .order('created', { ascending: false });

    if (error) {
      console.warn('Supabase fetch sessions error:', error.message);
      return null;
    }

    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        id: item.id,
        factory: item.factory || 'Factory 1',
        line: item.line,
        date: item.date,
        file: item.file || '',
        style: item.style || '',
        fileName: item.file_name || item.fileName || '',
        sheet: item.sheet || '',
        ops: item.ops || [],
        hours: item.hours || [],
        tpl: item.tpl || '',
        map: item.map || {},
        checks: item.checks || {},
        bdate: item.bdate || {},
        created: item.created || Date.now(),
      }));
    }
    return null;
  } catch (err) {
    console.error('Failed to query Supabase sessions:', err);
    return null;
  }
}

/**
 * Save/Upsert a single session to Supabase
 */
export async function saveSessionToSupabase(session: Session): Promise<boolean> {
  if (!supabase) return false;
  try {
    const row = {
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

    const { error } = await supabase.from(TABLES.SESSIONS).upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase upsert session error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error saving session to Supabase:', err);
    return false;
  }
}

/**
 * Delete sessions by IDs from Supabase
 */
export async function deleteSessionsFromSupabase(ids: string[]): Promise<boolean> {
  if (!supabase || ids.length === 0) return false;
  try {
    const { error } = await supabase.from(TABLES.SESSIONS).delete().in('id', ids);
    if (error) {
      console.warn('Supabase delete error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error deleting from Supabase:', err);
    return false;
  }
}

/**
 * Fetch custom templates from Supabase
 */
export async function fetchTemplatesFromSupabase(): Promise<SOPTemplate[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from(TABLES.TEMPLATES).select('*');
    if (error) {
      console.warn('Supabase fetch templates error:', error.message);
      return null;
    }
    if (Array.isArray(data)) {
      return data.map((t: any) => ({
        key: t.key,
        name: t.name,
        builtin: t.builtin || false,
        blocks: t.blocks || [],
      }));
    }
    return null;
  } catch (err) {
    console.error('Failed to query Supabase templates:', err);
    return null;
  }
}

/**
 * Upsert template to Supabase
 */
export async function saveTemplateToSupabase(template: SOPTemplate): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from(TABLES.TEMPLATES).upsert(
      {
        key: template.key,
        name: template.name,
        builtin: template.builtin || false,
        blocks: template.blocks,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
    return !error;
  } catch (err) {
    console.error('Error saving template to Supabase:', err);
    return false;
  }
}
