import "server-only";
import { notFound } from "next/navigation";
import { NotFoundError } from "./store";

/** Run a store read inside a page; unknown ids become a 404. Keeps JSX out of try/catch. */
export function orNotFound<T>(read: () => T): T {
  try {
    return read();
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
}


export async function orNotFoundAsync<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
}
