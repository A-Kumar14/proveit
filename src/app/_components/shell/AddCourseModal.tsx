import Link from "next/link";
import { Upload } from "lucide-react";
import { buttonStyles } from "../Button";
import { Modal } from "./Modal";

/** Course ingestion is still intentionally disabled until file-to-concept extraction is wired. */
export function AddCourseModal() {
  return (
    <Modal title="Add a course" closeHref="/">
      <fieldset disabled className="m-0 flex flex-col gap-2.5 border-0 p-0 opacity-60">
        <label htmlFor="cname" className="text-[13px] font-semibold">Course name</label>
        <input id="cname" placeholder="e.g. Linear Algebra" className="rounded-sm border border-line bg-surface px-3 py-2.5 text-sm" />
        <div className="flex flex-col items-center gap-1.5 rounded-md border-[1.5px] border-dashed border-line bg-surface-subtle px-3.5 py-[18px] text-center">
          <Upload size={22} strokeWidth={1.8} aria-hidden />
          <span className="text-[13px] font-semibold">Drop syllabus, slides, or study guides</span>
          <span className="text-xs text-ink-faint">Course ingestion is the next backend milestone.</span>
        </div>
        <label className="flex items-start gap-2 text-xs text-ink-muted"><input type="checkbox" className="mt-0.5 accent-ink" />I have the right to use these files for my own studying.</label>
      </fieldset>
      <div className="flex justify-end gap-2">
        <Link href="/" className={buttonStyles({ variant: "secondary" })}>Cancel</Link>
        <span aria-disabled className={`${buttonStyles()} cursor-not-allowed opacity-50`}>Build concept map</span>
      </div>
    </Modal>
  );
}
