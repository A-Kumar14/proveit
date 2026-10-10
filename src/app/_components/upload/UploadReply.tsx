import { CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "../Button";
import { AssistantMessage } from "../chat/AssistantMessage";

export type UploadState = { name: string; ok: boolean; summary: string; reason: string };

/** Assistant reply to an upload. A rejected file is shown here and never reaches evaluate. */
export function UploadReply({ upload, onRetry, onDismiss }: { upload: UploadState; onRetry: () => void; onDismiss: () => void }) {
  return (
    <AssistantMessage>
      {upload.ok ? (
        <div role="status" className="flex items-start gap-2 rounded-md border border-mastered-line bg-mastered-bg px-3.5 py-3 text-[13px] text-ink-2">
          <CheckCircle2 size={16} className="mt-px shrink-0 text-mastered-text" aria-hidden />
          <span><span className="font-semibold">{upload.name}</span> looks like your own work. I&apos;ll read it with your answer.</span>
        </div>
      ) : (
        <div role="alert" className="flex flex-col gap-2.5 rounded-md border border-needswork-line bg-needswork-bg px-3.5 py-3 text-[13px] text-ink-2">
          <div className="flex items-start gap-2">
            <ShieldAlert size={16} className="mt-px shrink-0 text-needswork-text" aria-hidden />
            <span><span className="font-semibold text-needswork-text">Upload not used · {upload.name}</span><br />{upload.reason}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={onRetry}>Upload my work</Button>
            <Button size="sm" variant="secondary" onClick={onDismiss}>Dismiss</Button>
          </div>
        </div>
      )}
    </AssistantMessage>
  );
}
