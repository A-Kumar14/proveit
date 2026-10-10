/** Plain scrolling page for list screens (review queue, history, logs). */
export function ListPage({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
      <div className="mx-auto flex max-w-[780px] flex-col gap-4">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="m-0 mt-1 text-[22px] font-semibold">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Rows = ({ children }: { children: React.ReactNode }) => <ul className="m-0 flex list-none flex-col overflow-hidden rounded-md border border-line p-0">{children}</ul>;
export const RowItem = ({ children }: { children: React.ReactNode }) => <li className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">{children}</li>;
