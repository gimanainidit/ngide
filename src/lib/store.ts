import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// Nilai yang disimpan di AsyncStorage + bisa di-subscribe. Penulisan diserialkan.
export function createStore<T>(key: string, parse: (raw: string | null) => T) {
  let value: T | null = null;
  let loading: Promise<T> | null = null;
  let chain: Promise<unknown> = Promise.resolve();
  const listeners = new Set<(v: T) => void>();

  function get(): Promise<T> {
    if (value !== null) return Promise.resolve(value);
    loading ??= AsyncStorage.getItem(key).then((raw) => (value = parse(raw)));
    return loading;
  }

  function update(fn: (current: T) => T): Promise<T> {
    const next = chain.then(async () => {
      const updated = fn(await get());
      value = updated;
      await AsyncStorage.setItem(key, JSON.stringify(updated));
      listeners.forEach((l) => l(updated));
      return updated;
    });
    chain = next.catch(() => undefined);
    return next;
  }

  function useValue(): T | null {
    const [state, setState] = useState<T | null>(value);
    useEffect(() => {
      listeners.add(setState);
      void get().then(setState);
      return () => {
        listeners.delete(setState);
      };
    }, []);
    return state;
  }

  return { get, update, useValue };
}
