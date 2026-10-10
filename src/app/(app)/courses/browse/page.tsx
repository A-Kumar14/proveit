import Link from "next/link";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { ListPage } from "@proveit/app/_components/shell/ListPage";
import { CatalogCard } from "@proveit/app/_components/catalog/CatalogCard";
import { browseCatalog } from "@proveit/server/courses";

export const dynamic = "force-dynamic";

export default function BrowseCoursesPage() {
  const items = browseCatalog();
  return (
    <AppShell active="courses" crumbs={[{ label: "Courses", href: "/courses" }, { label: "Browse" }]}>
      <ListPage eyebrow="Curated courses" title="Browse courses">
        <p className="m-0 max-w-xl text-[13px] text-ink-muted">Courses that come with notes, ready to study. Add one and it appears under In progress in the sidebar. The tutor, notes, practice paper and quiz all work on it. Have your own material? <Link href="/?add=1" className="text-ink">Add a course</Link>.</p>
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => <CatalogCard key={item.id} item={item} />)}
        </ul>
      </ListPage>
    </AppShell>
  );
}
