import type { z } from "zod";
import { ApiError, AssessResult, ClarifyResult, TransferResult, UploadCheck, type AssessInput } from "./schemas";

/** Client side of the API. Components call these; the route handlers behind them are the backend seam. */
async function post<T>(url: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("Can't reach the server. Check your connection and retry.");
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(ApiError.safeParse(json).data?.error ?? "Something went wrong. Retry.");
  return schema.parse(json);
}

async function checkUpload(file: File, conceptId: string) {
  const form = new FormData();
  form.set("file", file);
  form.set("conceptId", conceptId);
  const res = await fetch("/api/upload/check", { method: "POST", body: form }).catch(() => null);
  if (!res) throw new Error("Can't reach the server. Check your connection and retry.");
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(ApiError.safeParse(json).data?.error ?? "The upload check failed. Retry.");
  return UploadCheck.parse(json);
}

export const api = {
  checkUpload,
  assess: (input: AssessInput) => post("/api/assess", input, AssessResult),
  clarify: (attemptId: string) => post("/api/clarify", { attemptId }, ClarifyResult),
  transfer: (attemptId: string, answer: string) => post("/api/transfer", { attemptId, answer }, TransferResult),
};
