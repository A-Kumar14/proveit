import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { authEnabled, LOCAL_USER, UnauthorizedError } from "./auth";

// Share the context across server bundles and hot reloads, never a mutable current-user variable.
const g = globalThis as unknown as {
  __proveitUserContext?: AsyncLocalStorage<string>;
  __proveitUserCaches?: Map<string, Map<string, unknown>>;
};
const context = (g.__proveitUserContext ??= new AsyncLocalStorage<string>());

/** Server-only entry point. Identity must come from Clerk, not request input. */
export function runAsUser<T>(userId: string, run: () => T): T {
  if (!userId) throw new UnauthorizedError();
  return context.run(userId, run);
}

export function scopedUserId(): string {
  const user = context.getStore();
  if (user) return user;
  if (!authEnabled()) return LOCAL_USER;
  throw new UnauthorizedError();
}

/** Legacy local keys remain owned by local mode; they are never inherited by accounts. */
export function userStorageKey(key: string): string {
  const user = scopedUserId();
  return user === LOCAL_USER ? key : `user:${JSON.stringify([user, key])}`;
}

/** Preserve local cache/reset hooks while isolating account caches in both memory and disk. */
export function userCache<T>(name: string, local: () => T, create: () => T): T {
  const user = scopedUserId();
  if (user === LOCAL_USER) return local();
  const users = (g.__proveitUserCaches ??= new Map());
  let caches = users.get(user);
  if (!caches) { caches = new Map(); users.set(user, caches); }
  if (!caches.has(name)) caches.set(name, create());
  return caches.get(name) as T;
}

export function clearUserCachesForTests(): void {
  g.__proveitUserCaches?.clear();
}

/** Drops the current account's in-memory copy of one cache, so the next read loads from storage again. */
export function dropUserCache(name: string): void {
  const user = scopedUserId();
  if (user !== LOCAL_USER) g.__proveitUserCaches?.get(user)?.delete(name);
}
