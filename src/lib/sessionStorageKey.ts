/** Server-supplied identity scopes the shared typing/speech transcript. Never read legacy global keys. */
export function sessionStorageKey(userId: string, courseId: string, conceptId: string): string {
  return `proveit.session.v2:${JSON.stringify([userId, courseId, conceptId])}`;
}
