import { describe, expect, it } from 'vitest';
import { parseAuthCallback } from './authCallback';

describe('parseAuthCallback', () => {
  it('mengambil code dari query', () => {
    expect(parseAuthCallback('ngide://auth-callback?code=abc123')).toEqual({ code: 'abc123', error: null });
  });

  it('mengambil error_description dari query', () => {
    expect(parseAuthCallback('ngide://auth-callback?error=access_denied&error_description=Email+tidak+terdaftar')).toEqual({
      code: null,
      error: 'Email tidak terdaftar',
    });
  });

  it('mengambil error dari fragment (#)', () => {
    expect(parseAuthCallback('ngide://auth-callback#error=server_error&error_description=Database%20error%20saving%20new%20user')).toEqual({
      code: null,
      error: 'Database error saving new user',
    });
  });

  it('error tanpa deskripsi memakai kode error', () => {
    expect(parseAuthCallback('ngide://auth-callback?error=access_denied')).toEqual({ code: null, error: 'access_denied' });
  });

  it('tanpa code dan error', () => {
    expect(parseAuthCallback('ngide://auth-callback')).toEqual({ code: null, error: null });
  });
});
