import { useState, useEffect, type ReactNode } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { fetchAuthSession } from "aws-amplify/auth";
import { createCustomerMeeting } from "@/lib/api/meetings";
import { createCustomerNote } from "@/lib/api/notes";
import { createCustomerInvoice } from "@/lib/api/billing";
import { createCustomerOffering } from "@/lib/api/offerings";
import { createCustomer } from "@/lib/api/customerAnalytics";
import { createProduct } from "@/lib/api/products";

export interface QuickFormDefaultValues {
  name?: string;
  customerName?: string;
  email?: string;
  plan?: string;
  description?: string;
  customerId?: string;
  owner?: string;
}

export function QuickFormDialog({
  trigger,
  title,
  description,
  type = "general",
  defaultValues,
  customerId,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  type?: "general" | "note" | "meeting" | "customer" | "product" | "invoice" | "offering";
  defaultValues?: QuickFormDefaultValues;
  customerId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState(defaultValues?.name || "");
  const [formContent, setFormContent] = useState(defaultValues?.description || "");
  const [customerEmail, setCustomerEmail] = useState(defaultValues?.email || "");
  const [customerPlan, setCustomerPlan] = useState(defaultValues?.plan || "Growth");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingOwner, setMeetingOwner] = useState(defaultValues?.owner || "");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("Paid");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");

  useEffect(() => {
    if (open) {
      setFormName(defaultValues?.name || "");
      setFormContent(defaultValues?.description || "");
      setCustomerEmail(defaultValues?.email || "");
      setCustomerPlan(defaultValues?.plan || "Growth");
      setMeetingDate("");
      setMeetingOwner(defaultValues?.owner || "");
      setInvoiceAmount("");
      setInvoiceStatus("Paid");
      setInvoiceDueDate(new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]);
    }
  }, [open, defaultValues?.name, defaultValues?.description, defaultValues?.email, defaultValues?.plan, defaultValues?.owner]);

  const save = async () => {
    if (type === "note") {
      const targetCustomerId =
        customerId ||
        defaultValues?.customerId ||
        (typeof window !== "undefined"
          ? window.location.pathname.match(/\/customers\/([^/?#]+)/)?.[1]
          : undefined);

      if (!targetCustomerId) {
        toast.error("Customer ID is required to create a note");
        return;
      }

      if (!formContent.trim()) {
        toast.error("Note content is required");
        return;
      }

      setSaving(true);
      try {
        const createdNote = await createCustomerNote({
          customerId: targetCustomerId,
          title: formName.trim() || undefined,
          content: formContent.trim(),
        });

        toast.success("Note saved", {
          description: "Your note has been saved to the database.",
        });
        setOpen(false);
        setFormName("");
        setFormContent("");

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("customer-operations-updated", {
              detail: { customerId: targetCustomerId, note: createdNote },
            })
          );
          window.dispatchEvent(
            new CustomEvent("customer-note-created", {
              detail: { customerId: targetCustomerId, note: createdNote },
            })
          );
        }
      } catch (err: any) {
        console.error("Error creating note:", err);
        toast.error(err?.message || "Failed to save note");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (type === "meeting") {
      const targetCustomerId =
        customerId ||
        defaultValues?.customerId ||
        (typeof window !== "undefined"
          ? window.location.pathname.match(/\/customers\/([^/?#]+)/)?.[1]
          : undefined);

      if (!targetCustomerId) {
        toast.error("Customer ID is required to schedule a meeting");
        return;
      }

      if (!formName.trim()) {
        toast.error("Meeting title is required");
        return;
      }

      setSaving(true);
      try {
        const createdMeeting = await createCustomerMeeting({
          customerId: targetCustomerId,
          title: formName.trim(),
          description: formContent.trim() || undefined,
          meetingDate: meetingDate || new Date().toISOString().split("T")[0],
          createdBy: meetingOwner || undefined,
        });

        toast.success("Meeting scheduled", {
          description: "Your meeting has been saved to the database.",
        });
        setOpen(false);
        setFormName("");
        setFormContent("");
        setMeetingDate("");

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("customer-operations-updated", {
              detail: { customerId: targetCustomerId, meeting: createdMeeting },
            })
          );
          window.dispatchEvent(
            new CustomEvent("customer-meeting-created", {
              detail: { customerId: targetCustomerId, meeting: createdMeeting },
            })
          );
        }
      } catch (err: any) {
        console.error("Error creating meeting:", err);
        toast.error(err?.message || "Failed to schedule meeting");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (type === "invoice") {
      const targetCustomerId =
        customerId ||
        defaultValues?.customerId ||
        (typeof window !== "undefined"
          ? window.location.pathname.match(/\/customers\/([^/?#]+)/)?.[1]
          : undefined);

      if (!targetCustomerId) {
        toast.error("Customer ID is required to create an invoice");
        return;
      }

      const amountNum = parseFloat(invoiceAmount);
      if (isNaN(amountNum) || amountNum <= 0) {
        toast.error("Please enter a valid invoice amount");
        return;
      }

      setSaving(true);
      try {
        const createdInvoice = await createCustomerInvoice({
          customerId: targetCustomerId,
          customer: defaultValues?.customerName || undefined,
          customerName: defaultValues?.customerName || undefined,
          invoiceNumber: formName.trim() || `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
          amount: amountNum,
          description: formContent.trim() || "Growth + WhatsApp API",
          dueDate: invoiceDueDate || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
          status: invoiceStatus || "Paid",
        } as any);

        toast.success("Invoice created", {
          description: "Your invoice has been recorded in the database.",
        });
        setOpen(false);
        setFormName("");
        setFormContent("");
        setInvoiceAmount("");

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("customer-operations-updated", {
              detail: { customerId: targetCustomerId, invoice: createdInvoice },
            })
          );
          window.dispatchEvent(
            new CustomEvent("customer-invoice-created", {
              detail: { customerId: targetCustomerId, invoice: createdInvoice },
            })
          );
        }
      } catch (err: any) {
        console.error("Error creating invoice:", err);
        toast.error(err?.message || "Failed to create invoice");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (type === "offering") {
      const targetCustomerId = customerId || defaultValues?.customerId;
      if (!targetCustomerId) {
        toast.error("Customer ID is required to add an offering");
        return;
      }
      if (!formName.trim()) {
        toast.error("Please enter an offering name");
        return;
      }
      setSaving(true);
      try {
        const createdOffering = await createCustomerOffering({
          customerId: targetCustomerId,
          offeringName: formName.trim(),
          status: "Active",
        });
        toast.success("Offering provisioned", {
          description: "New offering has been recorded in the database.",
        });
        setOpen(false);
        setFormName("");
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("customer-offering-created", {
              detail: { customerId: targetCustomerId, offering: createdOffering },
            })
          );
        }
      } catch (err: any) {
        console.error("Error creating offering:", err);
        toast.error(err?.message || "Failed to create offering");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (type === "customer") {
      if (!formName.trim()) {
        toast.error("Company name is required");
        return;
      }
      setSaving(true);
      try {
        await createCustomer({
          company: formName.trim(),
          email: customerEmail.trim() || undefined,
          plan: customerPlan,
        });
      } catch (err: any) {
        const isUser = title.toLowerCase().includes("user");
        toast.error(`${isUser ? "User" : "Customer"} creation unavailable`, {
          description: isUser
            ? "User accounts are provisioned via Superblock Platform authentication. Direct user creation is not supported in Analytics Studio."
            : (err?.message || "Customer provisioning is managed directly through Superblock Platform gateway onboarding."),
        });
      } finally {
        setSaving(false);
      }
      return;
    }

    if (type === "product") {
      if (!formName.trim()) {
        toast.error("Product name is required");
        return;
      }
      setSaving(true);
      try {
        await createProduct({
          name: formName.trim(),
          description: formContent.trim() || "Superblock Platform Capability",
          status: "Active",
          price: 2999,
          category: "Channel",
          model: "Usage based",
        });
        toast.success("Product created", {
          description: "New product added to catalog.",
        });
        setOpen(false);
        setFormName("");
        setFormContent("");
      } catch (err: any) {
        toast.error(err?.message || "Failed to create product");
      } finally {
        setSaving(false);
      }
      return;
    }

    toast.error(`${title} unavailable`, {
      description: "Direct creation for this record type is not supported by the backend.",
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid gap-1.5"><Label htmlFor={`${title}-name`} className="text-xs">{type === "meeting" ? "Meeting title" : type === "note" ? "Note title" : type === "invoice" ? "Invoice number" : type === "customer" ? (title.toLowerCase().includes("user") ? "User / Account name" : "Company name") : "Name"}</Label><Input id={`${title}-name`} value={formName} onChange={(e) => setFormName(e.target.value)} placeholder={type === "meeting" ? "Q4 strategy review" : type === "note" ? "Add a clear title" : type === "invoice" ? "INV-2026-002 (optional)" : (title.toLowerCase().includes("user") ? "Enter user name" : "Enter company name")} /></div>
          {type === "customer" && <div className="grid grid-cols-2 gap-3"><div className="grid gap-1.5"><Label className="text-xs">Contact email</Label><Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="owner@company.com" /></div><div className="grid gap-1.5"><Label className="text-xs">Plan</Label><Select value={customerPlan} onValueChange={setCustomerPlan}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Starter">Starter</SelectItem><SelectItem value="Growth">Growth</SelectItem><SelectItem value="Enterprise">Enterprise</SelectItem></SelectContent></Select></div></div>}
          {type === "meeting" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Meeting host / owner</Label>
                <Input
                  placeholder="Host or team member"
                  value={meetingOwner}
                  onChange={(e) => setMeetingOwner(e.target.value)}
                />
              </div>
            </div>
          )}
          {type === "invoice" && (
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Amount (₹)</Label>
                <Input
                  type="number"
                  placeholder="15000"
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Due date</Label>
                <Input
                  type="date"
                  value={invoiceDueDate}
                  onChange={(e) => setInvoiceDueDate(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="grid gap-1.5"><Label className="text-xs">{type === "note" ? "Note" : type === "meeting" ? "Discussion summary" : type === "invoice" ? "Product / Service description" : "Description"}</Label><Textarea rows={4} value={formContent} onChange={(e) => setFormContent(e.target.value)} placeholder={type === "invoice" ? "Growth Plan + WhatsApp API Usage" : "Add context for your team…"} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{saving ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); toast.success("Copied to clipboard"); window.setTimeout(() => setCopied(false), 1200); }}>{copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}{copied ? "Copied" : label}</Button>;
}
