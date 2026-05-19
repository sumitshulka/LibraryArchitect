import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, History } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  isSubmitting?: boolean;
  onConfirm: (args: { reason: string; effectiveFrom: string }) => void;
};

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PolicyChangeDialog({ open, onOpenChange, title, description, isSubmitting, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [effectiveFromLocal, setEffectiveFromLocal] = useState(toLocalInputValue(new Date()));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setEffectiveFromLocal(toLocalInputValue(new Date()));
      setError(null);
    }
  }, [open]);

  const effDate = new Date(effectiveFromLocal);
  const isBackdated = !isNaN(effDate.getTime()) && effDate.getTime() < Date.now() - 60_000;

  const handleSubmit = () => {
    if (reason.trim().length < 3) {
      setError("Please provide a reason (min 3 characters)");
      return;
    }
    if (isNaN(effDate.getTime())) {
      setError("Effective date is invalid");
      return;
    }
    setError(null);
    onConfirm({ reason: reason.trim(), effectiveFrom: effDate.toISOString() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-policy-change">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="policy-reason">Reason for change *</Label>
            <Textarea
              id="policy-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Board approved new fine rate effective Apr 1"
              rows={3}
              data-testid="textarea-policy-reason"
            />
            <p className="text-xs text-muted-foreground">
              Recorded in the audit log and shown in the policy history.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="policy-effective-from">Effective from</Label>
            <Input
              id="policy-effective-from"
              type="datetime-local"
              value={effectiveFromLocal}
              onChange={(e) => setEffectiveFromLocal(e.target.value)}
              data-testid="input-policy-effective-from"
            />
            <p className="text-xs text-muted-foreground">
              Books due on/after this moment will use the new policy. Existing overdue items keep the policy that was effective on their due date.
            </p>
          </div>
          {isBackdated && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
              <div>
                <div className="font-medium">Back-dated change</div>
                <div className="text-xs text-muted-foreground">
                  You are applying this change with an effective date in the past. This may retroactively affect fine calculations for books whose due date falls on or after this moment. The back-date and your reason will be flagged in the audit log.
                </div>
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive" data-testid="text-policy-error">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting} data-testid="button-policy-cancel">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} data-testid="button-policy-confirm">
            {isSubmitting ? "Saving…" : "Save Policy Version"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PolicyHistoryList({ versions, currencySymbol }: { versions: { id: number; effectiveFrom: string; reason: string; createdAt: string; createdByName: string | null; policy: any }[]; currencySymbol?: string }) {
  if (!versions || versions.length === 0) {
    return <p className="text-sm text-muted-foreground">No policy changes recorded yet.</p>;
  }
  return (
    <div className="space-y-3" data-testid="list-policy-history">
      {versions.map((v) => {
        const effDate = new Date(v.effectiveFrom);
        const isBackdated = effDate.getTime() < new Date(v.createdAt).getTime() - 60_000;
        const p = v.policy || {};
        return (
          <div key={v.id} className="rounded-md border p-3 text-sm" data-testid={`row-policy-version-${v.id}`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="font-medium">
                Effective {effDate.toLocaleString()}
                {isBackdated && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3" /> back-dated
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                by {v.createdByName || "system"} on {new Date(v.createdAt).toLocaleString()}
              </div>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Reason: {v.reason}</div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {p.finePerDay !== undefined && <div>Fine/day: <span className="font-mono">{currencySymbol || ""}{p.finePerDay}</span></div>}
              {p.gracePeriodDays !== undefined && <div>Grace: <span className="font-mono">{p.gracePeriodDays}d</span></div>}
              {p.maxFineCap !== undefined && <div>Cap: <span className="font-mono">{currencySymbol || ""}{p.maxFineCap}</span></div>}
              {p.loanPeriodDays !== undefined && <div>Loan: <span className="font-mono">{p.loanPeriodDays}d</span></div>}
              {p.maxBooksPerUser !== undefined && <div>Max books: <span className="font-mono">{p.maxBooksPerUser}</span></div>}
              {p.renewalLimit !== undefined && <div>Renewals: <span className="font-mono">{p.renewalLimit}</span></div>}
              {p.reservationDays !== undefined && <div>Reservation hold: <span className="font-mono">{p.reservationDays}d</span></div>}
              {p.enableLateFines !== undefined && <div>Late fines: <span className="font-mono">{p.enableLateFines ? "on" : "off"}</span></div>}
              {p.allowRenewals !== undefined && <div>Allow renewals: <span className="font-mono">{p.allowRenewals ? "yes" : "no"}</span></div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
