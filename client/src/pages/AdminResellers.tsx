import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Copy, ShieldOff, ShieldCheck, X } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

function authHeaders() {
  const token = localStorage.getItem("admin_token") || "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function adminFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(path, { ...opts, headers: { ...authHeaders(), ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || "Request failed");
  return data;
}

export default function AdminResellers() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [approval, setApproval] = useState<Record<number, { username: string; password: string }>>({});
  const [note, setNote] = useState("");
  const apps = useQuery<any>({ queryKey: ["/api/admin/reseller-applications"], queryFn: () => adminFetch("/api/admin/reseller-applications") });
  const withdrawals = useQuery<any>({ queryKey: ["/api/admin/reseller-withdrawals"], queryFn: () => adminFetch("/api/admin/reseller-withdrawals") });

  async function approve(id: number) {
    const values = approval[id];
    if (!values?.username || !values?.password) {
      toast({ title: "Username and password required", variant: "destructive" });
      return;
    }
    try {
      const data = await adminFetch(`/api/admin/reseller-applications/${id}/approve`, { method: "POST", body: JSON.stringify(values) });
      toast({ title: "Reseller approved", description: `Store slug: ${data.slug}` });
      qc.invalidateQueries({ queryKey: ["/api/admin/reseller-applications"] });
    } catch (err: any) {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    }
  }

  async function action(path: string, title: string) {
    try {
      await adminFetch(path, { method: "POST", body: JSON.stringify({ adminNote: note }) });
      toast({ title });
      setNote("");
      qc.invalidateQueries({ queryKey: ["/api/admin/reseller-applications"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/reseller-withdrawals"] });
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    }
  }

  const applications = apps.data?.applications || [];
  const pendingWithdrawals = withdrawals.data?.withdrawals || [];

  return (
    <div className="min-h-screen bg-background p-4 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-emerald-300">Admin</p>
            <h1 className="text-2xl font-black">Reseller Platform</h1>
            <p className="text-sm text-white/45">Approve sellers, manage access, and process withdrawal requests.</p>
          </div>
          <Button variant="outline" className="border-white/10 text-white" onClick={() => setLocation("/admin")}><ArrowLeft className="mr-2 h-4 w-4" /> Back to admin</Button>
        </div>

        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <h2 className="mb-4 text-lg font-black">Applications</h2>
          <Table>
            <TableHeader><TableRow><TableHead>Applicant</TableHead><TableHead>Business</TableHead><TableHead>Status</TableHead><TableHead>Credentials</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {applications.map((app: any) => (
                <TableRow key={app.id}>
                  <TableCell><p className="font-semibold text-white">{app.name}</p><p className="text-xs text-white/40">{app.email} - {app.phone || "no phone"}</p></TableCell>
                  <TableCell><p>{app.businessName || "-"}</p><p className="max-w-xs truncate text-xs text-white/35">{app.why || ""}</p></TableCell>
                  <TableCell><span className="rounded-full bg-white/10 px-2 py-1 text-xs capitalize">{app.status}</span></TableCell>
                  <TableCell>
                    <div className="grid gap-2">
                      <Input placeholder="username" value={approval[app.id]?.username || app.username || ""} onChange={(e) => setApproval({ ...approval, [app.id]: { ...(approval[app.id] || { password: "" }), username: e.target.value } })} />
                      <Input placeholder="temporary password" value={approval[app.id]?.password || ""} onChange={(e) => setApproval({ ...approval, [app.id]: { ...(approval[app.id] || { username: app.username || "" }), password: e.target.value } })} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {app.status === "pending" && <Button size="sm" className="bg-emerald-500 text-gray-950 hover:bg-emerald-400" onClick={() => approve(app.id)}><Check className="mr-1 h-4 w-4" /> Approve</Button>}
                      {app.status === "pending" && <Button size="sm" variant="outline" className="border-white/10 text-white" onClick={() => action(`/api/admin/reseller-applications/${app.id}/reject`, "Application rejected")}><X className="mr-1 h-4 w-4" /> Reject</Button>}
                      {app.slug && <Button size="sm" variant="outline" className="border-white/10 text-white" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/r/${app.slug}`)}><Copy className="mr-1 h-4 w-4" /> Link</Button>}
                      {app.status === "approved" && !app.suspended && <Button size="sm" variant="outline" className="border-white/10 text-white" onClick={() => action(`/api/admin/resellers/${app.id}/suspend`, "Reseller suspended")}><ShieldOff className="mr-1 h-4 w-4" /> Suspend</Button>}
                      {app.status === "approved" && app.suspended && <Button size="sm" variant="outline" className="border-white/10 text-white" onClick={() => action(`/api/admin/resellers/${app.id}/unsuspend`, "Reseller unsuspended")}><ShieldCheck className="mr-1 h-4 w-4" /> Unsuspend</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-black">Pending Withdrawals</h2>
              <p className="text-sm text-white/45">Approve after you are ready to pay the reseller via M-Pesa.</p>
            </div>
            <Textarea placeholder="Admin note" value={note} onChange={(e) => setNote(e.target.value)} className="max-w-md" />
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Reseller</TableHead><TableHead>Amount</TableHead><TableHead>Phone</TableHead><TableHead>Note</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {pendingWithdrawals.map((w: any) => (
                <TableRow key={w.id}>
                  <TableCell><p className="font-semibold text-white">{w.resellerName}</p><p className="text-xs text-white/40">{w.resellerEmail}</p></TableCell>
                  <TableCell>KES {Number(w.amount || 0).toLocaleString()}</TableCell>
                  <TableCell>{w.phone}</TableCell>
                  <TableCell>{w.note || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-emerald-500 text-gray-950 hover:bg-emerald-400" onClick={() => action(`/api/admin/reseller-withdrawals/${w.id}/approve`, "Withdrawal approved")}><Check className="mr-1 h-4 w-4" /> Approve</Button>
                      <Button size="sm" variant="outline" className="border-white/10 text-white" onClick={() => action(`/api/admin/reseller-withdrawals/${w.id}/reject`, "Withdrawal rejected")}><X className="mr-1 h-4 w-4" /> Reject</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>
    </div>
  );
}
