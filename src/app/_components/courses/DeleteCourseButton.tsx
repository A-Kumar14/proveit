"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { cn } from "@proveit/lib/cn";
import { buttonStyles } from "../Button";
import { DeleteCourseDialog } from "./DeleteCourseDialog";

/** The delete control at the bottom of a course page. After it deletes, the student lands on the course list. */
export function DeleteCourseButton({ course }: { course: { id: string; name: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <section aria-label="Delete this course" className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-4 py-3 text-[0.8125rem]">
      <div className="min-w-0"><div className="font-semibold">Delete this course</div><div className="text-ink-muted">Removes the map, files, quizzes and your answers for it.</div></div>
      <button type="button" onClick={() => setOpen(true)} className={cn(buttonStyles({ variant: "secondary" }), "shrink-0 cursor-pointer")}><Trash2 size={14} aria-hidden />Delete</button>
      {open && <DeleteCourseDialog course={course} onClose={() => setOpen(false)} onDeleted={() => { setOpen(false); router.push("/courses"); router.refresh(); }} />}
    </section>
  );
}
