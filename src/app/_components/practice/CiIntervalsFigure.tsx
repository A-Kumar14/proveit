/** Illustration only: 10 made-up intervals, 9 cross the true-mean line, 1 misses. Not computed from the student's data. */
const BARS: [number, number][] = [[30, 34], [38, 30], [26, 32], [41, 33], [56, 28], [33, 30], [22, 34], [36, 32], [29, 30], [40, 29]];
const MISS = 4;

export function CiIntervalsFigure() {
  return (
    <figure className="m-0 flex flex-1 flex-col gap-2">
      <div role="img" aria-label="10 example intervals. 9 cross the true mean line, 1 misses it." className="relative flex flex-col gap-[7px] rounded-sm border border-line bg-surface-subtle py-2.5">
        <div className="absolute inset-y-0 left-1/2 w-0.5 bg-ink" />
        {BARS.map(([left, width], i) => (
          <div key={i} className="relative h-[5px]">
            <div style={{ left: `${left}%`, width: `${width}%` }} className={`absolute h-[5px] rounded-[3px] ${i === MISS ? "bg-needswork" : "bg-mastered"}`} />
            {i === MISS && <span className="absolute -top-[5px] text-[10px] font-semibold text-needswork-text" style={{ left: `${left + width + 2}%` }}>miss</span>}
          </div>
        ))}
      </div>
      <figcaption className="text-xs text-ink-muted">
        An example of 10 samples and 10 intervals. Black line = true mean. <strong className="text-mastered-text">9 catch it</strong>, <strong className="text-needswork-text">1 misses</strong>.
      </figcaption>
    </figure>
  );
}
