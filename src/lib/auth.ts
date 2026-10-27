import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { parseAuthCallback } from './authCallback';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

// Kode login bisa datang dua jalur sekaligus (hasil openAuthSessionAsync dan deep link
// ke route auth-callback). Tukar sekali saja per kode.
const exchanges = new Map<string, Promise<void>>();

export function completeSignIn(url: string): Promise<void> {
  const { code, error } = parseAuthCallback(url);
  if (error) return Promise.reject(new Error(error));
  if (!code) return Promise.reject(new Error('Kode login tidak ditemukan'));

  let pending = exchanges.get(code);
  if (!pending) {
    pending = supabase.auth.exchangeCodeForSession(code).then(async ({ error: exchangeError }) => {
      if (!exchangeError) return;
      // Jalur lain mungkin sudah berhasil menukar kode ini.
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw exchangeError;
    });
    exchanges.set(code, pending);
  }
  return pending;
}

export async function signInWithGoogle(): Promise<void> {
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw error ?? new Error('Tidak ada URL login');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  // Di Android hasilnya kadang 'dismiss' walau redirect berhasil; route auth-callback yang menyelesaikannya.
  if (result.type === 'success') await completeSignIn(result.url);
}
