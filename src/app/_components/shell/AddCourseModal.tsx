import Link from "next/link";
import { Library } from "lucide-react";
import { buttonStyles } from "../Button";
import { AddCourseForm } from "./AddCourseForm";
import { Modal } from "./Modal";
import type { AppStatus } from "../apps/useConnect";

/** Opened with /?add=1. Three ways in: your own notes, a curated course, or notes pulled from a connected app. */
export function AddCourseModal({ apps, notice }: { apps: AppStatus[]; notice?: { connected?: string; error?: string } }) {
  return (
    <Modal title="Add a course" closeHref="/">
      <AddCourseForm apps={apps} notice={notice} />
      <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-xs text-ink-muted">
        <span>No notes of your own? Pick from courses that come with notes.</span>
        <Link href="/courses/browse" className={buttonStyles({ variant: "secondary", size: "sm" })}><Library size={13} strokeWidth={2} aria-hidden />Browse courses</Link>
      </div>
    </Modal>
  );
}
