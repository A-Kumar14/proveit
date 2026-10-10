import { withUserPage } from "@proveit/server/userBoundary";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { ListPage } from "@proveit/app/_components/shell/ListPage";
import { CourseFiles, type FileRow } from "@proveit/app/_components/files/CourseFiles";
import { listMaterials } from "@proveit/server/materials";
import { orNotFound } from "@proveit/server/page";
import { getFiles } from "@proveit/server/store";

export const dynamic = "force-dynamic";

async function CourseFilesPage({ params }: PageProps<"/course/[courseId]/files">) {
  const { courseId } = await params;
  const { courseName, files, uploaded } = orNotFound(() => ({ ...getFiles(courseId), uploaded: listMaterials(courseId) }));
  const rows: FileRow[] = [
    ...uploaded.map((m) => ({ id: m.id, name: m.name, detail: `${m.words.toLocaleString("en-US")} words${m.readBy === "ai" ? ", read by the AI" : ""}`, kind: "Uploaded", removable: true })),
    ...files.map((f) => ({ id: `built:${f.name}`, name: f.name, detail: f.detail, kind: f.kind, removable: false })),
  ];
  return (
    <AppShell active="files" courseId={courseId} crumbs={[{ label: courseName, href: `/course/${courseId}` }, { label: "Course files" }]}>
      <ListPage eyebrow="Course material" title="Course files">
        <p className="m-0 max-w-xl text-[13px] text-ink-muted">Answers are graded against the course sources first. Anything you add here is extra context for the tutor, notes, practice paper and quiz. It never changes your mastery.</p>
        <CourseFiles courseId={courseId} files={rows} />
      </ListPage>
    </AppShell>
  );
}

export default withUserPage(CourseFilesPage);
