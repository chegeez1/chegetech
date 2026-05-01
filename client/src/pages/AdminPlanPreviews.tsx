import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, ArrowLeft, Image as ImageIcon, Video, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

interface PreviewMeta {
  plan_id: string;
  media_type: "image" | "video";
  mime_type: string;
  file_name: string | null;
  size_bytes: number;
  updated_at: string;
}

interface PlanRow { id: string; name: string; price: number; category: string; }

function getAdminToken() { try { return localStorage.getItem("admin_token") || ""; } catch { return ""; } }

export default function AdminPlanPreviews() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [token] = useState(getAdminToken());
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [previews, setPreviews] = useState<Record<string, PreviewMeta>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [thumbs, setThumbs] = useState<Record<string, string>>({}); // planId -> dataUrl

  async function load() {
    setLoading(true);
    try {
      const [pRes, prRes, botsRes] = await Promise.all([
        fetch("/api/plans").then(r => r.json()),
        fetch("/api/admin/plans/previews", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch("/api/admin/bots", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ success: false })),
      ]);
      if (pRes.success) {
        const flat: PlanRow[] = [];
        for (const cat of pRes.categories || []) {
          for (const p of cat.plans || []) flat.push({ id: p.planId, name: p.name, price: p.price, category: cat.category });
        }
        if (botsRes?.success && Array.isArray(botsRes.bots)) {
          for (const b of botsRes.bots) flat.push({ id: `bot:${b.id}`, name: `🤖 ${b.name}`, price: b.price || 0, category: "WhatsApp Bots" });
        }
        setPlans(flat);
      }
      if (prRes.success) {
        const map: Record<string, PreviewMeta> = {};
        for (const r of prRes.previews || []) map[r.plan_id] = r;
        setPreviews(map);
      }
    } catch (e: any) {
      toast({ title: "Failed to load", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (!token) { setLocation("/admin"); return; }
    load();
  }, []);

  async function loadThumb(planId: string) {
    try {
      const r = await fetch(`/api/plans/${planId}/preview`).then(r => r.json());
      if (r.success && r.preview) setThumbs(t => ({ ...t, [planId]: r.preview.dataUrl }));
    } catch {}
  }

  // Lazy-load thumbnails for plans that have a preview
  useEffect(() => {
    Object.keys(previews).forEach(pid => { if (!thumbs[pid]) loadThumb(pid); });
  }, [previews]);

  async function handleUpload(planId: string, file: File) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 8 MB. Compress or use a shorter clip.", variant: "destructive" });
      return;
    }
    setUploading(planId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/plans/${planId}/preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error || "Upload failed");
      toast({ title: "Uploaded", description: `${file.name} for ${planId}` });
      // Reload preview thumbnail
      setThumbs(t => { const c = { ...t }; delete c[planId]; return c; });
      await load();
      await loadThumb(planId);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally { setUploading(null); }
  }

  async function handleDelete(planId: string) {
    if (!confirm(`Remove custom preview for ${planId}?`)) return;
    try {
      const res = await fetch(`/api/admin/plans/${planId}/preview`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error || "Delete failed");
      toast({ title: "Removed" });
      setThumbs(t => { const c = { ...t }; delete c[planId]; return c; });
      await load();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter(p => p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [plans, search]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-40 bg-zinc-900/80 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")} className="text-white/70 hover:bg-white/10" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="font-bold">Plan Checkout Previews</h1>
          <div className="ml-auto flex items-center gap-2">
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search plans..." className="h-8 w-56 bg-white/5 border-white/10 text-sm" data-testid="input-search" />
            <Button variant="ghost" size="sm" onClick={load} className="text-white/70 hover:bg-white/10" data-testid="button-refresh"><RefreshCw className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="mb-5 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-sm text-blue-100 flex gap-3">
          <ImageIcon className="w-5 h-5 shrink-0 mt-0.5 text-blue-300" />
          <div>
            <p className="font-semibold mb-1">Upload custom previews shown on the checkout page</p>
            <p className="text-blue-200/80 text-xs">Max 8 MB per file. Images: PNG, JPG, GIF, WEBP. Videos: MP4, WEBM. Custom uploads override the built-in branded preview.</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-white/40">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(plan => {
              const meta = previews[plan.id];
              const thumb = thumbs[plan.id];
              const busy = uploading === plan.id;
              return (
                <div key={plan.id} data-testid={`card-plan-${plan.id}`} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden flex flex-col">
                  <div className="relative aspect-video bg-zinc-900 flex items-center justify-center overflow-hidden">
                    {meta && thumb ? (
                      meta.media_type === "video" ? (
                        <video src={thumb} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                      ) : (
                        <img src={thumb} alt={plan.name} className="w-full h-full object-cover" />
                      )
                    ) : meta ? (
                      <div className="text-white/30 text-xs">Loading preview...</div>
                    ) : (
                      <div className="text-white/30 text-xs flex flex-col items-center gap-1">
                        <ImageIcon className="w-6 h-6" />
                        <span>No custom preview</span>
                      </div>
                    )}
                    {meta && (
                      <Badge className="absolute top-2 right-2 bg-emerald-500/90 text-white border-0 text-[10px] gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {meta.media_type.toUpperCase()}
                      </Badge>
                    )}
                  </div>

                  <div className="p-3 flex-1 flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-semibold text-sm truncate">{plan.name}</p>
                      <p className="text-xs text-white/40 font-mono shrink-0">{plan.id}</p>
                    </div>
                    <p className="text-xs text-white/50">{plan.category} · KES {plan.price}</p>
                    {meta && (
                      <p className="text-[10px] text-white/40 truncate">
                        {meta.file_name} · {(meta.size_bytes / 1024).toFixed(1)} KB
                      </p>
                    )}

                    <div className="mt-auto flex items-center gap-2 pt-2">
                      <label className="flex-1">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/gif,image/webp,image/avif,video/mp4,video/webm,video/ogg,video/quicktime"
                          className="hidden"
                          disabled={busy}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(plan.id, f); e.currentTarget.value = ""; }}
                          data-testid={`input-file-${plan.id}`}
                        />
                        <span className={`flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-semibold cursor-pointer ${busy ? "bg-white/10 text-white/40" : "bg-indigo-600 hover:bg-indigo-700 text-white"}`}>
                          {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          {busy ? "Uploading..." : meta ? "Replace" : "Upload"}
                        </span>
                      </label>
                      {meta && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(plan.id)} className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10" data-testid={`button-delete-${plan.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-12 text-white/40">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                No plans match your search.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
