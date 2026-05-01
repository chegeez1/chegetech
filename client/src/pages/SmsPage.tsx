import { useState, useEffect } from "react";
import { MessageSquare, Check, Loader2, X, Zap, Users, Globe } from "lucide-react";

interface SmsPlan { id:number; name:string; sms_count:number; price_kes:number; description:string; features:string; is_active:boolean; validity_days:number; }

export default function SmsPage() {
  const [plans, setPlans] = useState<SmsPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState<SmsPlan|null>(null);
  const [email, setEmail] = useState("");
  const [senderNote, setSenderNote] = useState("");
  const [orderLoading, setOrderLoading] = useState(false);

  useEffect(()=>{ fetch("/api/sms/plans").then(r=>r.json()).then(d=>{if(d.success)setPlans(d.plans);}).catch(()=>{}).finally(()=>setLoading(false)); },[]);

  const placeOrder = async () => {
    if(!ordering||!email.trim()) return;
    if(!/\S+@\S+\.\S+/.test(email)) return alert("Enter a valid email");
    setOrderLoading(true);
    try {
      const r = await fetch("/api/sms/order",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({planId:ordering.id,email:email.trim(),senderNote:senderNote.trim()})});
      const d = await r.json();
      if(d.success&&d.paymentUrl) window.location.href=d.paymentUrl;
      else alert(d.error||"Order failed");
    } catch { alert("Network error"); }
    setOrderLoading(false);
  };

  const feats = (f:string)=>{ try{return JSON.parse(f||"[]");}catch{return f?f.split("\n").filter(Boolean):[];} };

  const PER_SMS_COLOR = (price:number, count:number)=>{ const r=price/count; if(r<0.5)return "text-emerald-400"; if(r<1)return "text-amber-400"; return "text-white/60"; };

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-green-500/10 border border-green-500/20"><MessageSquare className="w-5 h-5 text-green-400"/></div>
          <div><h1 className="text-2xl font-bold">Bulk SMS</h1><p className="text-xs text-white/40">Send SMS campaigns to your customers across Kenya & Africa</p></div>
        </div>
        <div className="flex gap-4 mb-6 mt-4 text-xs text-white/30">
          <span className="flex items-center gap-1"><Globe className="w-3 h-3"/>Kenya, Uganda, Tanzania & more</span>
          <span className="flex items-center gap-1"><Zap className="w-3 h-3"/>Instant delivery</span>
          <span className="flex items-center gap-1"><Users className="w-3 h-3"/>Custom sender ID</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_,i)=><div key={i} className="bg-white/5 rounded-2xl p-5 animate-pulse h-48"/>)}
          </div>
        ) : plans.length===0 ? (
          <div className="text-center py-16 text-white/30"><MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30"/><p>No plans available yet — check back soon</p></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map(p=>{
              const fs=feats(p.features);
              const rate=(p.price_kes/p.sms_count).toFixed(2);
              return (
                <div key={p.id} className="bg-white/5 border border-white/8 rounded-2xl p-5 hover:bg-white/8 hover:border-green-500/20 transition-all flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div><h3 className="font-bold text-white">{p.name}</h3>{p.validity_days>0&&<p className="text-xs text-white/30 mt-0.5">Valid {p.validity_days} days</p>}</div>
                    <span className={`text-xs font-bold ${PER_SMS_COLOR(p.price_kes,p.sms_count)}`}>KES {rate}/SMS</span>
                  </div>
                  <div className="text-center my-3">
                    <p className="text-4xl font-black text-green-400">{p.sms_count.toLocaleString()}</p>
                    <p className="text-xs text-white/40 mt-0.5">SMS messages</p>
                  </div>
                  {p.description&&<p className="text-xs text-white/40 mb-3 text-center leading-relaxed">{p.description}</p>}
                  {fs.length>0&&(
                    <ul className="space-y-1 mb-4 flex-1">
                      {fs.slice(0,4).map((f:string,i:number)=>(
                        <li key={i} className="flex items-center gap-1.5 text-xs text-white/50">
                          <Check className="w-3 h-3 text-green-400 shrink-0"/>{f}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-2xl font-bold">KES {p.price_kes.toLocaleString()}</p>
                  </div>
                  <button onClick={()=>setOrdering(p)}
                    className="w-full py-2.5 rounded-xl text-sm font-medium bg-green-500/15 border border-green-500/25 text-green-400 hover:bg-green-500/25 transition-colors flex items-center justify-center gap-2">
                    <MessageSquare className="w-4 h-4"/>Get SMS Credits
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[{icon:"📱",title:"Custom Sender ID",desc:"Your brand name appears as sender (subject to approval)"},{icon:"📊",title:"Delivery Reports",desc:"Track message delivery rates for your campaign"},{icon:"🌍",title:"Pan-Africa Coverage",desc:"Reach customers in Kenya, Uganda, Tanzania, Rwanda & more"}].map(f=>(
            <div key={f.title} className="p-4 rounded-2xl bg-white/3 border border-white/8 text-center">
              <div className="text-2xl mb-2">{f.icon}</div>
              <p className="text-sm font-medium text-white mb-1">{f.title}</p>
              <p className="text-xs text-white/30 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {ordering&&(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget)setOrdering(null);}}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-green-500/10 border border-green-500/20"><MessageSquare className="w-5 h-5 text-green-400"/></div>
              <div className="flex-1"><p className="font-bold">{ordering.name}</p><p className="text-xs text-white/40">{ordering.sms_count.toLocaleString()} SMS</p></div>
              <button onClick={()=>setOrdering(null)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10"><X className="w-4 h-4"/></button>
            </div>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-green-500/40 mb-2"/>
            <input value={senderNote} onChange={e=>setSenderNote(e.target.value)} placeholder="Desired sender ID (optional, e.g. MyBrand)"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-green-500/40 mb-3"/>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between mb-4">
              <span className="text-sm text-white/60">Total</span>
              <span className="text-2xl font-bold">KES {ordering.price_kes.toLocaleString()}</span>
            </div>
            <p className="text-xs text-white/30 text-center mb-4">We'll set up your SMS account and send login details to your email within a few hours.</p>
            <div className="flex gap-2">
              <button onClick={()=>setOrdering(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm">Cancel</button>
              <button onClick={placeOrder} disabled={orderLoading||!email.trim()} className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {orderLoading?<Loader2 className="w-4 h-4 animate-spin"/>:null}{orderLoading?"Processing...":"Pay Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
