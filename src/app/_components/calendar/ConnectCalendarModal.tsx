import { Modal } from "../shell/Modal";
import { ConnectForm } from "./ConnectForm";

/** Opens with ?connect=1 on the dashboard and the calendar page. */
export function ConnectCalendarModal({ closeHref }: { closeHref: string }) {
  return (
    <Modal title="Connect a calendar" closeHref={closeHref}>
      <ConnectForm doneHref={closeHref} />
    </Modal>
  );
}
