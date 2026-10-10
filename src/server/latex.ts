import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Escapes text from the model or the student so it can't add LaTeX commands to a document. */
export function esc(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\\&%$#_{}~^]/g, (c) => ({
      "\\": "\\textbackslash{}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}",
    } as Record<string, string>)[c] ?? `\\${c}`);
}

const PREAMBLE = `\\documentclass[11pt]{article}
\\usepackage[margin=1in]{geometry}
\\usepackage{enumitem}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{6pt}
`;

export type Paper = { title: string; courseName: string; questions: { concept: string; prompt: string; marks: number }[]; key: { answer: string; marking: string }[] };
export type Notes = {
  title: string; courseName: string;
  sections: { concept: string; summary: string; points: string[] }[];
  mistakes: { concept: string; said: string | null; why: string; fix: string }[];
};

const total = (p: Paper) => p.questions.reduce((n, q) => n + q.marks, 0);

export function paperTex(p: Paper): string {
  const qs = p.questions.map((q, i) => `\\item[\\textbf{Q${i + 1}.}] ${esc(q.prompt)} \\hfill \\textit{[${q.marks} marks]}\n\\vspace{3.2cm}`).join("\n");
  return `${PREAMBLE}\\begin{document}
{\\Large\\textbf{${esc(p.title)}}}\\\\
${esc(p.courseName)} \\hfill Total: ${total(p)} marks\\\\[2pt]
Name: \\underline{\\hspace{6cm}} \\hfill Date: \\underline{\\hspace{3cm}}
\\hrule
\\vspace{6pt}
\\begin{enumerate}[leftmargin=2.2em,itemsep=10pt]
${qs}
\\end{enumerate}
\\end{document}
`;
}

export function keyTex(p: Paper): string {
  const items = p.questions.map((q, i) => {
    const k = p.key[i];
    return `\\item[\\textbf{Q${i + 1}.}] \\textit{${esc(q.concept)}, ${q.marks} marks}\\\\
${esc(q.prompt)}\\\\
\\textbf{Answer.} ${esc(k?.answer ?? "")}\\\\
\\textbf{Marking.} ${esc(k?.marking ?? "")}`;
  }).join("\n");
  return `${PREAMBLE}\\begin{document}
{\\Large\\textbf{${esc(p.title)}, answer key}}\\\\
${esc(p.courseName)} \\hfill Total: ${total(p)} marks
\\hrule
\\vspace{6pt}
\\begin{enumerate}[leftmargin=2.2em,itemsep=10pt]
${items}
\\end{enumerate}
\\end{document}
`;
}

export function notesTex(n: Notes): string {
  const sections = n.sections.map((s) => `\\subsection*{${esc(s.concept)}}
${esc(s.summary)}
${s.points.length ? `\\begin{itemize}[itemsep=2pt]\n${s.points.map((p) => `\\item ${esc(p)}`).join("\n")}\n\\end{itemize}` : ""}`).join("\n\n");
  const mistakes = n.mistakes.length
    ? n.mistakes.map((m) => `\\subsection*{${esc(m.concept)}}
${m.said ? `\\textbf{What you said.} \\textit{${esc(m.said)}}\\\\\n` : ""}\\textbf{Why it's off.} ${esc(m.why)}\\\\
\\textbf{How to fix it.} ${esc(m.fix)}`).join("\n\n")
    : "Nothing flagged yet. Mistakes show up here once an answer has one.";
  return `${PREAMBLE}\\begin{document}
{\\Large\\textbf{${esc(n.title)}}}\\\\
${esc(n.courseName)}
\\hrule
\\section*{What you keep getting wrong}
${mistakes}
\\section*{Notes by concept}
${sections}
\\end{document}
`;
}

/** Compiles with tectonic. It downloads TeX packages on first use, so the first run needs the network. */
export async function compile(tex: string): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "mastery-tex-"));
  try {
    await writeFile(join(dir, "doc.tex"), tex);
    await run(process.env.TECTONIC_BIN ?? "tectonic", ["--chatter", "minimal", "--outdir", dir, join(dir, "doc.tex")], { timeout: 120_000, cwd: dir });
    return await readFile(join(dir, "doc.pdf"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
