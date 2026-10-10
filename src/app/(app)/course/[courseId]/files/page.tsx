import { FileText } from "lucide-react";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { ListPage, RowItem, Rows } from "@proveit/app/_components/shell/ListPage";
import { orNotFound } from "@proveit/server/page";
import { getFiles } from "@proveit/server/store";

export const dynamic = "force-dynamic";

export default async function CourseFilesPage({ params }: PageProps<"/course/[courseId]/files">) {
  const { courseId } = await params;
  const { courseName, files } = orNotFound(() => getFiles(courseId));
  return (
    <AppShell active="files" courseId={courseId} crumbs={[{ label: courseName, href: `/course/${courseId}` }, { label: "Course files" }]}>
      <ListPage eyebrow="Grading authority" title="Course files">
        <p className="m-0 max-w-xl text-[13px] text-ink-muted">Answers are graded against these sources first. Your own uploads will list here once course upload is built.</p>
        <Rows>
          {files.map((f) => (
            <RowItem key={f.name}>
              <FileText size={16} strokeWidth={1.8} className="text-ink-muted" aria-hidden />
              <div className="flex-1"><div className="text-sm font-semibold">{f.name}</div><div className="text-xs text-ink-muted">{f.detail}</div></div>
              <span className="text-xs text-ink-faint">{f.kind}</span>
            </RowItem>
          ))}
        </Rows>
      </ListPage>
    </AppShell>
  );
}
