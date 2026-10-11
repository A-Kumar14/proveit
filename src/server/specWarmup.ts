import "server-only";
import { aiEnabled } from "./ai";
import { ensureConceptLearningSpec } from "./learningSpecGenerator";
import { getCourse, isRuntimeCourse } from "./store";
import { scopedUserId } from "./userScope";

const running = new Set<string>();

/**
 * Writes the learning content for every concept of a course you added, ahead of the first click.
 * Without it the first "Test this concept" on each concept waits about eight seconds for the model.
 * Content that already exists comes back at once, and one sweep runs per account and course at a time.
 */
export async function warmCourseSpecs(courseId: string, concurrency = 4): Promise<void> {
  if (!aiEnabled()) return;
  const key = `${scopedUserId()}:${courseId}`;
  if (running.has(key)) return;
  running.add(key);
  try {
    // Only user-added/runtime courses are prewarmed. Built-in courses with shipped notes
    // generate a missing concept on first use so opening a map never fans out model calls.
    if (!isRuntimeCourse(courseId)) return;
    const course = getCourse(courseId);
    const todo = course.concepts.map((c) => c.id);
    await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, async () => {
      for (let id = todo.shift(); id !== undefined; id = todo.shift()) {
        await ensureConceptLearningSpec(courseId, id).catch(() => undefined);
      }
    }));
  } catch {
    // A course that was removed or isn't readable mid-sweep has nothing left to warm.
  } finally {
    running.delete(key);
  }
}
