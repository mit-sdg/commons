"use client";

import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { api } from "@/lib/api";
import { seatRemovalRefusal, seatRemovedMessage } from "@/lib/roster-messages";

/**
 * Removing a seat is the destructive counterpart to dropping it, so the
 * confirmation spells out what actually happens rather than asking twice. Every
 * surface that offers removal — active, pending, and dropped seats — shares this
 * wording so the promise made about the person's records is identical.
 */
export function RemoveSeatDialog({
  seat,
  person,
  trigger,
  open,
  onOpenChange,
  onRemoved,
}: {
  seat: string;
  /** How the roster names this person: their display name, or their address. */
  person: string;
  /** Omit when the opener cannot host the trigger, such as a menu item. */
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onRemoved: () => void;
}) {
  async function remove() {
    const result = await api.roster.remove({ seat });
    if ("error" in result) {
      // Removal races the roster it was opened from; NOT_FOUND is the seat
      // already being gone, which is worth saying plainly.
      toast.error(seatRemovalRefusal(result.error));
      onRemoved();
      return;
    }
    // The endpoint answers the address the removal freed; naming it is the
    // useful confirmation, because that address can now be imported again.
    toast.success(seatRemovedMessage(result.email));
    onRemoved();
  }

  return (
    <ConfirmAction
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      title={`Remove ${person} from the roster?`}
      confirmLabel="Remove seat"
      destructive
      onConfirm={remove}
      description={
        <div className="space-y-2">
          <p>
            This deletes the seat and its place on the roster. It cannot be
            undone. To end an enrolment reversibly, drop the seat instead.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Their address becomes free to import or enrol again.</li>
            <li>They keep their account and can still sign in.</li>
            <li>
              Their grades, submissions, assignment releases, late-day records,
              and staff notes are all retained.
            </li>
          </ul>
        </div>
      }
    />
  );
}
