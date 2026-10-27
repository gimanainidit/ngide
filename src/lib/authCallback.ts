// Pure: tanpa import React Native supaya bisa dites dengan vitest.
export function parseAuthCallback(url: string): { code: string | null; error: string | null } {
  const queryStart = url.indexOf('?');
  const hashStart = url.indexOf('#');
  const query = queryStart >= 0 ? url.slice(queryStart + 1, hashStart > queryStart ? hashStart : undefined) : '';
  const hash = hashStart >= 0 ? url.slice(hashStart + 1) : '';
  const params = new URLSearchParams(query);
  new URLSearchParams(hash).forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  const error = params.get('error_description') ?? params.get('error');
  return { code: params.get('code'), error };
}
