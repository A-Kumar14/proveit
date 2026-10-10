import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { ListPage } from "@proveit/app/_components/shell/ListPage";
import { buttonStyles } from "@proveit/app/_components/Button";
import { CoursesTable } from "@proveit/app/_components/courses/CoursesTable";
import { listCourses } from "@proveit/server/store";

export const dynamic = "force-dynamic";

export default function CoursesPage() {
  const rows = listCourses();
  return (
    <AppShell active="courses" crumbs={[{ label: "Courses" }]} right={<Link href="/?add=1" className={buttonStyles()}><Plus size={13} strokeWidth={2.4} aria-hidden />Add a course</Link>}>
      <ListPage eyebrow="All courses" title="Courses">
        <CoursesTable rows={rows} />
      </ListPage>
    </AppShell>
  );
}
