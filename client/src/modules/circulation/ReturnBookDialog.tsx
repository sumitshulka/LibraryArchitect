import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { circulationApi, paymentMethodsApi, type PaymentSplit, type ReturnPayload } from "@/lib/api";
import { useCurrency } from "@/lib/useCurrency";
import { useAuth } from "@/lib/auth";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Loader2, Plus, Trash2, BookCopy } from "lucide-react";
import { toast } from "sonner";

interface ReturnBookDialogProps {
  circulationId: number | null;
  bookTitle?: string;
  borrowerName?: string;
  onClose: () => void;
}

export function ReturnBookDialog({ circulationId, bookTitle, borrowerName, onClose }: ReturnBookDialogProps) {
  const open = circulationId !== null;
  const { format, currency } = useCurrency();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "ADMIN";

  const { data: preview, isLoading: isLoadingPreview } = useQuery({
    queryKey: ["fine-preview", circulationId],
    queryFn: () => circulationApi.finePreview(circulationId!),
    enabled: circulationId !== null,
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["payment-methods", "active"],
    queryFn: () => paymentMethodsApi.getAll(true),
  });

  const [hasDamage, setHasDamage] = useState(false);
  const [damageMajor, setDamageMajor] = useState("");
  const [damageNotes, setDamageNotes] = useState("");
  const [splits, setSplits] = useState<Array<{ paymentMethodId: number | null; amountMajor: string; paymentType: "FINE" | "DAMAGE"; referenceNumber: string }>>([]);
  const [waiveFineMajor, setWaiveFineMajor] = useState("");
  const [waiveDamageMajor, setWaiveDamageMajor] = useState("");
  const [waiveReason, setWaiveReason] = useState("");

  useEffect(() => {
    if (open) {
      setHasDamage(false);
      setDamageMajor("");
      setDamageNotes("");
      setSplits([]);
      setWaiveFineMajor("");
      setWaiveDamageMajor("");
      setWaiveReason("");
    }
  }, [open, circulationId]);

  const fineCents = preview?.fineOutstanding ?? 0;
  const damageCostCents = hasDamage ? Math.round(parseFloat(damageMajor || "0") * 100) : 0;
  const waiveFineCents = Math.round(parseFloat(waiveFineMajor || "0") * 100);
  const waiveDamageCents = Math.round(parseFloat(waiveDamageMajor || "0") * 100);

  const splitTotalCents = useMemo(() => {
    return splits.reduce((sum, s) => sum + Math.round(parseFloat(s.amountMajor || "0") * 100), 0);
  }, [splits]);

  const fineSplitsCents = useMemo(() => splits.filter(s => s.paymentType === "FINE").reduce((sum, s) => sum + Math.round(parseFloat(s.amountMajor || "0") * 100), 0), [splits]);
  const damageSplitsCents = useMemo(() => splits.filter(s => s.paymentType === "DAMAGE").reduce((sum, s) => sum + Math.round(parseFloat(s.amountMajor || "0") * 100), 0), [splits]);

  const fineRemaining = Math.max(0, fineCents - fineSplitsCents - waiveFineCents);
  const damageRemaining = Math.max(0, damageCostCents - damageSplitsCents - waiveDamageCents);

  const fineOver = fineSplitsCents + waiveFineCents > fineCents;
  const damageOver = damageSplitsCents + waiveDamageCents > damageCostCents;

  const returnMutation = useMutation({
    mutationFn: (payload: ReturnPayload) => circulationApi.returnBook(circulationId!, payload),
    onSuccess: (_, variables) => {
      const isWaiverRequest = !isAdmin && (variables.waiveFineAmount || 0) + (variables.waiveDamageAmount || 0) > 0;
      toast.success(isWaiverRequest ? "Book returned. Waiver request submitted for approval." : "Book returned successfully");
      queryClient.invalidateQueries({ queryKey: ["circulation"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["fine-waiver-requests"] });
      queryClient.invalidateQueries({ queryKey: ["pending-fines"] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addSplit = (paymentType: "FINE" | "DAMAGE") => {
    const defaultMethod = paymentMethods[0]?.id ?? null;
    const remaining = paymentType === "FINE" ? fineRemaining : damageRemaining;
    setSplits([...splits, {
      paymentMethodId: defaultMethod,
      amountMajor: remaining > 0 ? (remaining / 100).toFixed(2) : "",
      paymentType,
      referenceNumber: "",
    }]);
  };

  const updateSplit = (idx: number, field: string, value: any) => {
    setSplits(splits.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const removeSplit = (idx: number) => setSplits(splits.filter((_, i) => i !== idx));

  const handleSubmit = () => {
    if (fineOver) { toast.error("Fine payments + waiver exceed outstanding fine"); return; }
    if (damageOver) { toast.error("Damage payments + waiver exceed damage cost"); return; }
    const validSplits = splits.filter(s => s.paymentMethodId && parseFloat(s.amountMajor || "0") > 0);
    for (const s of validSplits) {
      if (!s.paymentMethodId) { toast.error("Choose a payment method for every payment"); return; }
    }
    if ((waiveFineCents > 0 || waiveDamageCents > 0) && !waiveReason.trim()) {
      toast.error("Please provide a reason for the waiver");
      return;
    }

    const payload: ReturnPayload = {
      damageCost: damageCostCents,
      damageNotes: damageNotes || undefined,
      payments: validSplits.map<PaymentSplit>(s => ({
        paymentMethodId: s.paymentMethodId!,
        amount: Math.round(parseFloat(s.amountMajor) * 100),
        paymentType: s.paymentType,
        referenceNumber: s.referenceNumber || undefined,
      })),
      waiveFineAmount: waiveFineCents || undefined,
      waiveDamageAmount: waiveDamageCents || undefined,
      waiveReason: (waiveFineCents > 0 || waiveDamageCents > 0) ? waiveReason : undefined,
    };
    returnMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-return-book">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BookCopy className="h-5 w-5" /> Return Book</DialogTitle>
          <DialogDescription>{bookTitle ? `${bookTitle} · ${borrowerName ?? ""}` : "Process the return"}</DialogDescription>
        </DialogHeader>

        {isLoadingPreview || !preview ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-5">
            {/* Status summary */}
            <div className="rounded-lg border p-4 bg-muted/30 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Days overdue</div>
                <div className={preview.isOverdue ? "text-red-600 font-semibold" : "font-medium"} data-testid="text-days-overdue">
                  {preview.isOverdue ? `${preview.daysOverdue} day${preview.daysOverdue === 1 ? "" : "s"}` : "Not overdue"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Accrued fine</div>
                <div className="font-semibold" data-testid="text-accrued-fine">{format(preview.assessedFineCents)}</div>
              </div>
              {preview.finePaid + preview.fineWaived > 0 && (
                <>
                  <div className="text-xs text-muted-foreground">Already paid: <span className="font-medium text-foreground">{format(preview.finePaid)}</span></div>
                  <div className="text-xs text-muted-foreground">Already waived: <span className="font-medium text-foreground">{format(preview.fineWaived)}</span></div>
                </>
              )}
              <div className="col-span-2 pt-1 border-t">
                <div className="text-muted-foreground text-xs">Fine outstanding</div>
                <div className="font-bold text-base" data-testid="text-fine-outstanding">{format(preview.fineOutstanding)}</div>
              </div>
            </div>

            {/* Damage section */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Book damage</Label>
                  <p className="text-xs text-muted-foreground">Toggle on if the returned book is damaged</p>
                </div>
                <Switch checked={hasDamage} onCheckedChange={(c) => {
                setHasDamage(c);
                if (c && !damageMajor && preview?.bookUnitPrice) {
                  setDamageMajor((preview.bookUnitPrice / 100).toFixed(2));
                }
              }} data-testid="switch-damage" />
              </div>
              {hasDamage && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-32">Damage cost ({currency.symbol})</Label>
                    <Input type="number" step="0.01" min="0" value={damageMajor}
                      onChange={(e) => setDamageMajor(e.target.value)}
                      className="h-8" data-testid="input-damage-cost"
                      placeholder={preview?.bookUnitPrice ? (preview.bookUnitPrice / 100).toFixed(2) : undefined} />
                  {preview?.bookUnitPrice ? (
                    <span className="text-xs text-muted-foreground">List price: {format(preview.bookUnitPrice)}</span>
                  ) : null}
                  </div>
                  <Textarea placeholder="Damage description / notes" rows={2}
                    value={damageNotes} onChange={(e) => setDamageNotes(e.target.value)}
                    data-testid="textarea-damage-notes" />
                </div>
              )}
            </div>

            {/* Payments */}
            {(preview.fineOutstanding > 0 || damageCostCents > 0) && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Payments</Label>
                  <div className="flex gap-2">
                    {preview.fineOutstanding > 0 && (
                      <Button type="button" variant="outline" size="sm" onClick={() => addSplit("FINE")} data-testid="button-add-fine-payment">
                        <Plus className="h-3 w-3 mr-1" /> Fine
                      </Button>
                    )}
                    {damageCostCents > 0 && (
                      <Button type="button" variant="outline" size="sm" onClick={() => addSplit("DAMAGE")} data-testid="button-add-damage-payment">
                        <Plus className="h-3 w-3 mr-1" /> Damage
                      </Button>
                    )}
                  </div>
                </div>
                {splits.length === 0 && <p className="text-xs text-muted-foreground">No payments added</p>}
                {splits.map((s, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center" data-testid={`row-payment-${idx}`}>
                    <Badge variant={s.paymentType === "FINE" ? "default" : "secondary"} className="col-span-2 justify-center">{s.paymentType}</Badge>
                    <div className="col-span-4">
                      <Select value={s.paymentMethodId?.toString() ?? ""} onValueChange={(v) => updateSplit(idx, "paymentMethodId", parseInt(v))}>
                        <SelectTrigger className="h-8" data-testid={`select-method-${idx}`}><SelectValue placeholder="Method" /></SelectTrigger>
                        <SelectContent>
                          {paymentMethods.map(m => <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input type="number" step="0.01" min="0" placeholder={currency.symbol}
                      value={s.amountMajor} onChange={(e) => updateSplit(idx, "amountMajor", e.target.value)}
                      className="col-span-3 h-8" data-testid={`input-amount-${idx}`} />
                    <Input placeholder="Ref #" value={s.referenceNumber}
                      onChange={(e) => updateSplit(idx, "referenceNumber", e.target.value)}
                      className="col-span-2 h-8" data-testid={`input-ref-${idx}`} />
                    <Button type="button" variant="ghost" size="icon" className="col-span-1 h-8 w-8" onClick={() => removeSplit(idx)} data-testid={`button-remove-payment-${idx}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {splits.length > 0 && (
                  <div className="text-xs text-muted-foreground pt-2 border-t flex flex-wrap gap-x-4 gap-y-1">
                    <span>Fine total: <strong className={fineOver ? "text-red-600" : "text-foreground"}>{format(fineSplitsCents)}</strong> / {format(preview.fineOutstanding)}</span>
                    {damageCostCents > 0 && <span>Damage total: <strong className={damageOver ? "text-red-600" : "text-foreground"}>{format(damageSplitsCents)}</strong> / {format(damageCostCents)}</span>}
                  </div>
                )}
              </div>
            )}

            {/* Waiver */}
            {(preview.fineOutstanding > 0 || damageCostCents > 0) && (
              <div className="rounded-lg border p-4 space-y-3">
                <div>
                  <Label className="text-sm font-medium">{isAdmin ? "Waive amount" : "Request waiver"}</Label>
                  <p className="text-xs text-muted-foreground">
                    {isAdmin ? "As an admin, waivers are applied immediately." : "Your request will be sent to an admin for approval."}
                  </p>
                </div>
                {preview.fineOutstanding > 0 && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-32">Fine waiver ({currency.symbol})</Label>
                    <Input type="number" step="0.01" min="0" value={waiveFineMajor}
                      onChange={(e) => setWaiveFineMajor(e.target.value)}
                      className="h-8" data-testid="input-waive-fine" />
                  </div>
                )}
                {damageCostCents > 0 && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-32">Damage waiver ({currency.symbol})</Label>
                    <Input type="number" step="0.01" min="0" value={waiveDamageMajor}
                      onChange={(e) => setWaiveDamageMajor(e.target.value)}
                      className="h-8" data-testid="input-waive-damage" />
                  </div>
                )}
                {(waiveFineCents > 0 || waiveDamageCents > 0) && (
                  <Textarea placeholder="Reason for waiver (required)" rows={2}
                    value={waiveReason} onChange={(e) => setWaiveReason(e.target.value)}
                    data-testid="textarea-waive-reason" />
                )}
              </div>
            )}

            {/* Final summary */}
            <Separator />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Fine remaining after this return:</span><span className={fineRemaining > 0 ? "text-amber-600 font-medium" : "text-green-600 font-medium"}>{format(fineRemaining)}</span></div>
              {damageCostCents > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Damage remaining:</span><span className={damageRemaining > 0 ? "text-amber-600 font-medium" : "text-green-600 font-medium"}>{format(damageRemaining)}</span></div>
              )}
              {(fineRemaining > 0 || damageRemaining > 0) && (
                <p className="text-xs text-muted-foreground flex items-start gap-1 pt-1">
                  <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" /> Outstanding amount stays on the borrower's account and can be collected later.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-return">Cancel</Button>
          <Button onClick={handleSubmit} disabled={returnMutation.isPending || isLoadingPreview || fineOver || damageOver} data-testid="button-confirm-return">
            {returnMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Return Book
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
