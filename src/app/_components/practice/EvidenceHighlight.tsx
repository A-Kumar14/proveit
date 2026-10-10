/** Highlights the exact quote inside the student's answer. Falls back to plain text if the quote isn't a substring. */
export function EvidenceHighlight({ text, quote }: { text: string; quote: string | null }) {
  const i = quote ? text.indexOf(quote) : -1;
  if (!quote || i < 0) return <>&ldquo;{text}&rdquo;</>;
  return (
    <>
      &ldquo;{text.slice(0, i)}
      <mark className="rounded-[3px] bg-needswork-line px-[3px] py-px text-ink underline decoration-needswork decoration-wavy underline-offset-4">{quote}</mark>
      {text.slice(i + quote.length)}&rdquo;
    </>
  );
}
