import { z } from "zod";
import { ApiError, AssessResult, AuditResult, CatalogAddResult, ConnectResult, CreateCourseResult, FileUploadResult, CatalogRemoveResult, ConverseResult, PracticeResult, QuizResult, QuizStartResult, ClarifyResult, CourseCompleteResult, CourseUploadResult, Ok, ReviewSubmitResult, TransferResult, UploadCheck, type AssessInput, type ConverseInput } from "./schemas";

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

async function uploadFiles(courseId: string, files: File[]) {
  const form = new FormData();
  form.set("courseId", courseId);
  for (const f of files) form.append("files", f);
  const res = await fetch("/api/courses/files", { method: "POST", body: form }).catch(() => null);
  if (!res) throw new Error("Can't reach the server. Check your connection and retry.");
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(ApiError.safeParse(json).data?.error ?? "The upload failed. Retry.");
  return FileUploadResult.parse(json);
}

async function uploadCourse(name: string, files: File[]) {
  const form = new FormData();
  form.set("name", name);
  form.set("rights", "1");
  for (const f of files) form.append("files", f);
  const res = await fetch("/api/courses/upload", { method: "POST", body: form }).catch(() => null);
  if (!res) throw new Error("Can't reach the server. Check your connection and retry.");
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(ApiError.safeParse(json).data?.error ?? "Building the concept map failed. Retry.");
  return CourseUploadResult.parse(json);
}

export const api = {
  uploadFiles,
  uploadCourse,
  connectApp: (provider: "granola" | "wispr", returnTo: string) => post(`/api/integrations/${provider}/connect`, { returnTo }, ConnectResult),
  disconnectApp: (provider: "granola" | "wispr") => post("/api/integrations/disconnect", { provider }, Ok),
  importFromApp: (provider: "granola" | "wispr", topic: string, name?: string) => post("/api/integrations/import", { provider, topic, name }, CreateCourseResult),
  removeFile: (courseId: string, id: string) => post("/api/courses/files/remove", { courseId, id }, z.object({ removed: z.boolean() })),
  checkUpload,
  setTaskDone: (id: string, done: boolean) => post("/api/todos/complete", { id, done }, Ok),
  connectCalendar: (url: string) => post("/api/calendar/connect", { url }, Ok),
  refreshCalendar: () => post("/api/calendar/refresh", {}, Ok),
  disconnectCalendar: () => post("/api/calendar/disconnect", {}, Ok),
  setCoursesCompleted: (ids: string[], completed: boolean) => post("/api/courses/complete", { ids, completed }, CourseCompleteResult),
  assess: (input: AssessInput) => post("/api/assess", input, AssessResult),
  converse: (input: ConverseInput) => post("/api/converse", input, ConverseResult),
  audit: (input: ConverseInput) => post("/api/audit", input, AuditResult),
  samplePaper: (courseId: string) => post("/api/practice/paper", { courseId }, PracticeResult),
  studyNotes: (courseId: string) => post("/api/practice/notes", { courseId }, PracticeResult),
  addCatalogCourse: (id: string) => post("/api/catalog/add", { id }, CatalogAddResult),
  removeCatalogCourse: (id: string) => post("/api/catalog/remove", { id }, CatalogRemoveResult),
  startQuiz: (courseId: string, count?: number) => post("/api/quiz/start", { courseId, count }, QuizStartResult),
  submitQuiz: (quizId: string, answers: (number | null)[]) => post("/api/quiz/submit", { quizId, answers }, QuizResult),
  clarify: (attemptId: string) => post("/api/clarify", { attemptId }, ClarifyResult),
  transfer: (attemptId: string, answer: string) => post("/api/transfer", { attemptId, answer }, TransferResult),
  review: (courseId: string, conceptId: string, answer: string) => post("/api/review/submit", { courseId, conceptId, answer }, ReviewSubmitResult),
};
