import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Check, Copy, ExternalLink, RefreshCw, Search,
  ShieldOff, ShieldCheck, TrendingUp, Users, Wallet, X, AlertCircle
} from "lucide-react";
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

function money(v: number) { return `KES ${(v || 0).toLocaleString()}`; }

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-400/15 text-amber-300",
    approved: "bg-emerald-400/15 text-emerald-300",
    rejected: "bg-red-400/15 text-red-300",
    processing: "bg-blue-400/15 text-blue-300",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${map[status] || "bg-white/10 text-white/60"}`}>
      {status}
    </span>
  );
}

type AdminTab = "applications" | "resellers" | "withdrawals";

export default function AdminResellers() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<AdminTab>("applications");
  const [approval, setApproval] = useState<Record<number, { username: string; password: string }>>({});
  const [searchApps, setSearchApps] = useState("");
  const [searchResellers, setSearchResellers] = useState("");
  const [withdrawNotes, setWithdrawNotes] = useState<Record<number, string>>({});

  const apps = useQuery<any>({ queryKey: ["/api/admin/reseller-applications"], queryFn: () => adminFetch("/api/admin/reseller-applications") });
  const resellers = useQuery<any>({ queryKey: ["/api/admin/resellers"], queryFn: () => adminFetch("/api/admin/resellers"), enabled: tab === "resellers" });
  const withdrawals = useQuery<any>({ queryKey: ["/api/admin/reseller-withdrawals"], queryFn: () => adminFetch("/api/admin/reseller-withdrawals") });

  const allApps: any[] = apps.data?.applications || [];
  const allResellers: any[] = resellers.data?.resellers || [];
  const allWithdrawals: any[] = withdrawals.data?.withdrawals || [];

  const pendingApps = allApps.filter((a: any) => a.status === "pending");
  const pendingWithdrawals = allWithdrawals.filter((w: any) => w.status === "pending");
  const pendingWithdrawalTotal = pendingWithdrawals.reduce((s: number, w: any) => s + (w.amount || 0), 0);

  const filteredApps = allApps.filter((a: any) =>
    `${a.name} ${a.email} ${a.businessName}`.toLowerCase().includes(searchApps.toLowerCase())
  );
  const filteredResellers = allResellers.filter((r: any) =>
    `${r.name} ${r.email} ${r.storeName} ${r.slug}`.toLowerCase().includes(searchResellers.toLowerCase())
  );

  async function approve(id: number) {
    const values = approval[id];
    if (!values?.username || !values?.password) {
      toast({ title: "Username and password required", variant: "destructive" });
      return;
    }
    try {
      const data = await adminFetch(`/api/admin/reseller-applications/${id}/approve`, { method: "POST", body: JSON.stringify(values) });
      toast({ title: "Reseller approved ✅", description: `Store slug: ${data.slug}` });
      qc.invalidateQueries({ queryKey: ["/api/admin/reseller-applications"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/resellers"] });
    } catch (err: any) {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    }
  }

  async function action(path: string, title: string, note?: string) {
    try {
      await adminFetch(path, { method: "POST", body: JSON.stringify({ adminNote: note || "" }) });
      toast({ title });
      qc.invalidateQueries({ queryKey: ["/api/admin/reseller-applications"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/reseller-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/resellers"] });
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    }
  }

  const tabs: { id: AdminTab; label: string; count?: number }[] = [
    { id: "applications", label: "Applications", count: pendingApps.length },
    { id: "resellers", label: "Active Resellers" },
    { id: "withdrawals", label: "Withdrawals", count: pendingWithdrawals.length },
  ];

  return (
    <div className="min-h-screen bg-background p-4 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Admin</p>
            <h1 className="text-2xl font-black">Reseller Platform</h1>
            <p className="text-sm text-white/45">Approve sellers, manage access, and process payouts.</p>
          </div>
          <Button variant="outline" className="border-white/10 text-white" onClick={() => setLocation("/admin")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to admin
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { icon: Users, label: "Total resellers", value: allApps.filter((a: any) => a.status === "approved").length },
            { icon: AlertCircle, label: "Pending applications", value: pendingApps.length, highlight: pendingApps.length > 0 },
            { icon: Wallet, label: "Pending payouts", value: pendingWithdrawals.length, highlight: pendingWithdrawals.length > 0 },
            { icon: TrendingUp, label: "Pending payout total", value: money(pendingWithdrawalTotal) },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.highlight ? "border-amber-400/30 bg-amber-400/5" : "border-white/10 bg-white/[0.03]"}`}>
              <s.icon className={`mb-3 h-4 w-4 ${s.highlight ? "text-amber-300" : "text-cyan-300"}`} />
              <p className="text-xs text-white/45">{s.label}</p>
              <p className="mt-0.5 text-xl font-black">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-black/20 p-1 w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === t.id ? "bg-white text-gray-950" : "text-white/55 hover:text-white"}`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab === t.id ? "bg-amber-400 text-gray-950" : "bg-amber-400/20 text-amber-300"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Applications tab */}
        {tab === "applications" && (
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">All Applications</h2>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-white/35" />
                <Input className="w-60 pl-8 h-9 text-sm" placeholder="Search applicants..." value={searchApps} onChange={(e) => setSearchApps(e.target.value)} />
              </div>
            </div>
            <div className="overflow-auto">
              <div className="overflow-x-auto w-full"><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Why they want in</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Set credentials</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApps.map((app: any) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <p className="font-semibold text-white">{app.name}</p>
                        <p className="text-xs text-white/40">{app.email}</p>
                        <p className="text-xs text-white/30">{app.phone || "—"}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{app.businessName || "—"}</p>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-[200px] text-xs text-white/50 line-clamp-3">{app.why || "—"}</p>
                      </TableCell>
                      <TableCell><StatusBadge status={app.status} /></TableCell>
                      <TableCell>
                        <div className="grid gap-2 min-w-[180px]">
                          <Input
                            className="h-8 text-xs"
                            placeholder="username"
                            value={approval[app.id]?.username ?? app.username ?? ""}
                            onChange={(e) => setApproval({ ...approval, [app.id]: { ...(approval[app.id] || { password: "" }), username: e.target.value } })}
                          />
                          <Input
                            className="h-8 text-xs"
                            type="password"
                            placeholder="temp password"
                            value={approval[app.id]?.password ?? ""}
                            onChange={(e) => setApproval({ ...approval, [app.id]: { ...(approval[app.id] || { username: app.username || "" }), password: e.target.value } })}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {app.status === "pending" && (
                            <>
                              <Button size="sm" className="bg-emerald-500 text-gray-950 hover:bg-emerald-400" onClick={() => approve(app.id)}>
                                <Check className="mr-1 h-3.5 w-3.5" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="border-white/10 text-white" onClick={() => action(`/api/admin/reseller-applications/${app.id}/reject`, "Application rejected")}>
                                <X className="mr-1 h-3.5 w-3.5" /> Reject
                              </Button>
                            </>
                          )}
                          {app.slug && (
                            <Button size="sm" variant="outline" className="border-white/10 text-white" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/r/${app.slug}`)}>
                              <Copy className="mr-1 h-3.5 w-3.5" /> Link
                            </Button>
                          )}
                          {app.status === "approved" && !app.suspended && (
                            <Button size="sm" variant="outline" className="border-red-400/20 text-red-300 hover:bg-red-400/10" onClick={() => action(`/api/admin/resellers/${app.id}/suspend`, "Reseller suspended")}>
                              <ShieldOff className="mr-1 h-3.5 w-3.5" /> Suspend
                            </Button>
                          )}
                          {app.status === "approved" && app.suspended && (
                            <Button size="sm" variant="outline" className="border-emerald-400/20 text-emerald-300 hover:bg-emerald-400/10" onClick={() => action(`/api/admin/resellers/${app.id}/unsuspend`, "Reseller unsuspended")}>
                              <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Unsuspend
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredApps.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-white/35 py-8">No applications found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table></div>
            </div>
          </section>
        )}

        {/* Active Resellers tab */}
        {tab === "resellers" && (
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">Active Resellers</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-white/35" />
                  <Input className="w-60 pl-8 h-9 text-sm" placeholder="Search resellers..." value={searchResellers} onChange={(e) => setSearchResellers(e.target.value)} />
                </div>
                <Button size="sm" variant="outline" className="border-white/10 text-white" onClick={() => qc.invalidateQueries({ queryKey: ["/api/admin/resellers"] })}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="overflow-auto">
              <div className="overflow-x-auto w-full"><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reseller</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Wallet balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResellers.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <p className="font-semibold text-white">{r.name}</p>
                        <p className="text-xs text-white/40">{r.email}</p>
                        <p className="text-xs text-white/30">@{r.username || "—"}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{r.storeName || r.businessName || "—"}</p>
                        {r.slug && <p className="text-xs text-cyan-400/70">/r/{r.slug}</p>}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-emerald-300">{money(r.walletBalance || 0)}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.suspended ? "suspended" : r.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {r.slug && (
                            <Button size="sm" variant="outline" className="border-white/10 text-white" onClick={() => window.open(`/r/${r.slug}`, "_blank")}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {!r.suspended ? (
                            <Button size="sm" variant="outline" className="border-red-400/20 text-red-300 hover:bg-red-400/10" onClick={() => action(`/api/admin/resellers/${r.id}/suspend`, "Reseller suspended")}>
                              <ShieldOff className="mr-1 h-3.5 w-3.5" /> Suspend
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="border-emerald-400/20 text-emerald-300 hover:bg-emerald-400/10" onClick={() => action(`/api/admin/resellers/${r.id}/unsuspend`, "Reseller unsuspended")}>
                              <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Unsuspend
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredResellers.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-white/35 py-8">No resellers found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table></div>
            </div>
          </section>
        )}

        {/* Withdrawals tab */}
        {tab === "withdrawals" && (
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-4">
              <h2 className="text-lg font-black">Withdrawal Requests</h2>
              <p className="text-sm text-white/45">Approve after confirming M-Pesa payment. Add a note per request.</p>
            </div>
            <div className="overflow-auto">
              <div className="overflow-x-auto w-full"><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reseller</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>M-Pesa phone</TableHead>
                    <TableHead>Their note</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Admin note</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allWithdrawals.map((w: any) => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <p className="font-semibold text-white">{w.resellerName}</p>
                        <p className="text-xs text-white/40">{w.resellerEmail}</p>
                      </TableCell>
                      <TableCell className="font-mono font-bold">{money(Number(w.amount || 0))}</TableCell>
                      <TableCell className="font-mono text-sm">{w.phone}</TableCell>
                      <TableCell><p className="max-w-[140px] text-xs text-white/50">{w.note || "—"}</p></TableCell>
                      <TableCell><StatusBadge status={w.status} /></TableCell>
                      <TableCell>
                        {w.status === "pending" ? (
                          <Textarea
                            placeholder="Add note..."
                            value={withdrawNotes[w.id] ?? ""}
                            onChange={(e) => setWithdrawNotes({ ...withdrawNotes, [w.id]: e.target.value })}
                            className="h-16 w-48 text-xs"
                          />
                        ) : (
                          <p className="max-w-[140px] text-xs text-white/50">{w.adminNote || "—"}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {w.status === "pending" && (
                          <div className="flex gap-2">
                            <Button size="sm" className="bg-emerald-500 text-gray-950 hover:bg-emerald-400" onClick={() => action(`/api/admin/reseller-withdrawals/${w.id}/approve`, "Withdrawal approved ✅", withdrawNotes[w.id])}>
                              <Check className="mr-1 h-3.5 w-3.5" /> Pay
                            </Button>
                            <Button size="sm" variant="outline" className="border-red-400/20 text-red-300 hover:bg-red-400/10" onClick={() => action(`/api/admin/reseller-withdrawals/${w.id}/reject`, "Withdrawal rejected", withdrawNotes[w.id])}>
                              <X className="mr-1 h-3.5 w-3.5" /> Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {allWithdrawals.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-white/35 py-8">No withdrawal requests</TableCell></TableRow>
                  )}
                </TableBody>
              </Table></div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
