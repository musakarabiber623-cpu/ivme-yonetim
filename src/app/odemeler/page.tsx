'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AdminPanel from '@/components/AdminPanel'
import { ChevronDown, ChevronRight, RefreshCw, CreditCard } from 'lucide-react'

type Taksit = {
  id: number; taksit_no: number; tutar: number; odendi_tutar: number | null
  vade_tarihi: string; odeme_tarihi: string | null; durum: string
  odeme_yontemi: string | null; makbuz_no: string | null; odeme_plan_id: number
}
type Plan = { id: number; odeme_turu: string; donem: string; toplam_ucret: number; taksitler: Taksit[] }
type Ogrenci = { id: number; ad_soyad: string; sinif: number; ogrenci_tipi: string; planlar: Plan[] }

const SINIF_RENK: Record<number, { grad: string; bar: string; pill: string; light: string }> = {
  2: { grad:'from-violet-500 to-violet-700', bar:'bg-violet-500', pill:'bg-violet-100 text-violet-700', light:'bg-violet-50/50' },
  3: { grad:'from-blue-500 to-blue-700',     bar:'bg-blue-500',   pill:'bg-blue-100 text-blue-700',     light:'bg-blue-50/50' },
  4: { grad:'from-cyan-500 to-cyan-700',     bar:'bg-cyan-500',   pill:'bg-cyan-100 text-cyan-700',     light:'bg-cyan-50/50' },
  5: { grad:'from-emerald-500 to-emerald-700',bar:'bg-emerald-500',pill:'bg-emerald-100 text-emerald-700',light:'bg-emerald-50/50'},
  6: { grad:'from-amber-400 to-amber-600',   bar:'bg-amber-500',  pill:'bg-amber-100 text-amber-700',   light:'bg-amber-50/50' },
  7: { grad:'from-orange-500 to-orange-600', bar:'bg-orange-500', pill:'bg-orange-100 text-orange-700', light:'bg-orange-50/50' },
  8: { grad:'from-rose-500 to-rose-700',     bar:'bg-rose-500',   pill:'bg-rose-100 text-rose-700',     light:'bg-rose-50/50' },
}

const DURUM_STIL: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  odendi:   { bg:'bg-emerald-100', text:'text-emerald-700', label:'Ödendi',  icon:'✓' },
  kismi:    { bg:'bg-blue-100',    text:'text-blue-700',    label:'Kısmi',   icon:'◑' },
  gecikti:  { bg:'bg-red-100',     text:'text-red-700',     label:'Gecikti', icon:'⚠' },
  bekliyor: { bg:'bg-gray-100',    text:'text-gray-600',    label:'Bekliyor',icon:'○' },
}

const bugun = new Date(); bugun.setHours(0,0,0,0)

function taksitDurum(t: Taksit): string {
  if (t.durum === 'odendi') return 'odendi'
  if (t.odendi_tutar != null) return 'kismi'
  return new Date(t.vade_tarihi) < bugun ? 'gecikti' : 'bekliyor'
}

function ogrenciDurum(o: Ogrenci): string {
  const ts = o.planlar.flatMap(p => p.taksitler)
  if (!ts.length) return 'bekliyor'
  const ds = ts.map(taksitDurum)
  if (ds.every(d => d === 'odendi')) return 'odendi'
  if (ds.some(d => d === 'gecikti')) return 'gecikti'
  if (ds.some(d => d === 'kismi')) return 'kismi'
  return 'bekliyor'
}

function odenenHesapla(o: Ogrenci) {
  return o.planlar.flatMap(p => p.taksitler).reduce((s, t) => {
    if (t.odendi_tutar != null) return s + t.odendi_tutar
    if (t.durum === 'odendi') return s + t.tutar
    return s
  }, 0)
}

function tl(n: number) { return `₺${n.toLocaleString('tr-TR')}` }

function tarihStr(s: string) {
  return new Date(s).toLocaleDateString('tr-TR', { day:'2-digit', month:'short', year:'2-digit' })
}

function initials(isim: string) {
  return isim.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()
}

export default function OdemelerPage() {
  const today = new Date().toISOString().split('T')[0]
  const [ogrenciler, setOgrenciler] = useState<Ogrenci[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [yetki, setYetki] = useState(false)
  const [arama, setArama] = useState('')
  const [durumFiltre, setDurumFiltre] = useState('hepsi')
  const [aciklar, setAciklar] = useState<Set<number>>(new Set())
  const [tahsilPlanId, setTahsilPlanId] = useState<number|null>(null)
  const [tahsilTutar, setTahsilTutar] = useState('')
  const [tahsilForm, setTahsilForm] = useState({ tarih: today, yontem: 'nakit', makbuz: '' })
  const [tahsilYukleniyor, setTahsilYukleniyor] = useState(false)
  const [editId, setEditId] = useState<number|null>(null)
  const [editForm, setEditForm] = useState({ tutar:'', vade_tarihi:'', durum:'bekliyor', odeme_tarihi:'', odeme_yontemi:'nakit' })
  const [editYukleniyor, setEditYukleniyor] = useState(false)

  useEffect(() => { getir() }, [])

  async function getir() {
    setYukleniyor(true)
    const { data } = await supabase
      .from('ogrenciler')
      .select(`id, ad_soyad, sinif, ogrenci_tipi,
        odeme_planlari(id, odeme_turu, donem, toplam_ucret,
          taksitler(id, taksit_no, tutar, odendi_tutar, vade_tarihi, odeme_tarihi, durum, odeme_yontemi, makbuz_no, odeme_plan_id))`)
      .eq('aktif', true).order('ad_soyad')
    const fmt = (data || []).map(o => ({
      ...o,
      planlar: (o.odeme_planlari || []).map(p => ({
        ...p,
        taksitler: [...(p.taksitler || [])].sort((a, b) => a.taksit_no - b.taksit_no)
      }))
    }))
    setOgrenciler(fmt as Ogrenci[])
    setYukleniyor(false)
  }

  async function tahsilEt(planId: number) {
    const tutar = parseFloat(tahsilTutar)
    if (!tutar || tutar <= 0) { alert('Geçerli bir tutar giriniz.'); return }
    setTahsilYukleniyor(true)
    const { data: odenmemis } = await supabase
      .from('taksitler').select('id, tutar, odendi_tutar')
      .eq('odeme_plan_id', planId).neq('durum', 'odendi')
      .order('vade_tarihi', { ascending: true })
    let kalan = tutar
    for (const t of (odenmemis || []) as { id: number; tutar: number; odendi_tutar: number | null }[]) {
      if (kalan <= 0) break
      if (kalan >= t.tutar) {
        await supabase.from('taksitler').update({
          durum: 'odendi', odeme_tarihi: tahsilForm.tarih,
          odeme_yontemi: tahsilForm.yontem, makbuz_no: tahsilForm.makbuz || null,
          odendi_tutar: (t.odendi_tutar || 0) + t.tutar,
        }).eq('id', t.id)
        if (tahsilForm.yontem === 'kredi_karti') {
          await supabase.from('banka_hareketleri').insert({ tur:'gelir', tutar:t.tutar, tarih:tahsilForm.tarih, aciklama:'TAKSİT: Kredi kartı taksit ödemesi' })
        }
        kalan -= t.tutar
      } else {
        await supabase.from('taksitler').update({
          tutar: Math.round(t.tutar - kalan), odeme_tarihi: tahsilForm.tarih,
          odeme_yontemi: tahsilForm.yontem,
          odendi_tutar: (t.odendi_tutar || 0) + Math.round(kalan),
        }).eq('id', t.id)
        if (tahsilForm.yontem === 'kredi_karti') {
          await supabase.from('banka_hareketleri').insert({ tur:'gelir', tutar:Math.round(kalan), tarih:tahsilForm.tarih, aciklama:'TAKSİT: Kredi kartı kısmi taksit ödemesi' })
        }
        kalan = 0
      }
    }
    setTahsilPlanId(null); setTahsilTutar('')
    await getir(); setTahsilYukleniyor(false)
  }

  async function editKaydet() {
    if (!editId) return
    setEditYukleniyor(true)
    const g: Record<string, unknown> = { tutar: parseFloat(editForm.tutar), vade_tarihi: editForm.vade_tarihi, durum: editForm.durum }
    if (editForm.durum === 'odendi') { g.odeme_tarihi = editForm.odeme_tarihi; g.odeme_yontemi = editForm.odeme_yontemi }
    else g.odeme_tarihi = null
    const { error } = await supabase.from('taksitler').update(g).eq('id', editId)
    if (error) { alert('Hata: ' + error.message); setEditYukleniyor(false); return }
    setEditId(null); await getir(); setEditYukleniyor(false)
  }

  const buAy = useMemo(() => {
    const now = new Date(); const m = now.getMonth(); const y = now.getFullYear()
    return ogrenciler.flatMap(o => o.planlar.flatMap(p => p.taksitler))
      .filter(t => { if (!t.odeme_tarihi) return false; const d = new Date(t.odeme_tarihi); return d.getMonth()===m && d.getFullYear()===y })
      .reduce((s, t) => s + (t.odendi_tutar != null ? t.odendi_tutar : t.tutar), 0)
  }, [ogrenciler])

  const gecikenToplam = useMemo(() =>
    ogrenciler.flatMap(o => o.planlar.flatMap(p => p.taksitler))
      .filter(t => taksitDurum(t) === 'gecikti')
      .reduce((s, t) => s + t.tutar, 0)
  , [ogrenciler])

  const filtrelenmis = useMemo(() =>
    ogrenciler.filter(o => {
      if (arama && !o.ad_soyad.toLowerCase().includes(arama.toLowerCase())) return false
      if (durumFiltre !== 'hepsi' && ogrenciDurum(o) !== durumFiltre) return false
      return true
    })
  , [ogrenciler, arama, durumFiltre])

  const gruplar = useMemo(() => {
    const map = new Map<number, Ogrenci[]>()
    for (const o of filtrelenmis) { const l = map.get(o.sinif)||[]; l.push(o); map.set(o.sinif, l) }
    return [...map.entries()].sort((a,b) => b[0]-a[0])
  }, [filtrelenmis])

  function toggleAcik(id: number) {
    setAciklar(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Edit Modal */}
      {editId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="font-semibold text-gray-800 mb-4">Taksit Düzenle</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Tutar (₺)</label>
                <input type="number" value={editForm.tutar} onChange={e => setEditForm(f=>({...f,tutar:e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Vade Tarihi</label>
                <input type="date" value={editForm.vade_tarihi} onChange={e => setEditForm(f=>({...f,vade_tarihi:e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Durum</label>
                <select value={editForm.durum} onChange={e => setEditForm(f=>({...f,durum:e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                  <option value="bekliyor">Bekliyor</option>
                  <option value="odendi">Ödendi</option>
                </select>
              </div>
              {editForm.durum === 'odendi' && (<>
                <div>
                  <label className="text-xs text-gray-500">Ödeme Tarihi</label>
                  <input type="date" value={editForm.odeme_tarihi} onChange={e => setEditForm(f=>({...f,odeme_tarihi:e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Yöntem</label>
                  <select value={editForm.odeme_yontemi} onChange={e => setEditForm(f=>({...f,odeme_yontemi:e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                    <option value="nakit">Nakit</option>
                    <option value="havale">Havale</option>
                    <option value="kredi_karti">Kredi Kartı</option>
                  </select>
                </div>
              </>)}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={editKaydet} disabled={editYukleniyor}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {editYukleniyor ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              <button onClick={() => setEditId(null)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 sm:px-8 pt-8 pb-14">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link href="/" className="text-slate-400 text-xs hover:text-slate-200 transition-colors">← Ana Sayfa</Link>
              <h1 className="text-2xl font-bold text-white mt-1">Ödemeler</h1>
            </div>
            <div className="flex items-center gap-2">
              <AdminPanel onDegis={setYetki} />
              <button onClick={getir} disabled={yukleniyor}
                className="flex items-center gap-1.5 text-xs bg-white/10 text-white border border-white/20 rounded-lg px-3 py-1.5 hover:bg-white/20">
                <RefreshCw size={12} className={yukleniyor ? 'animate-spin' : ''} />
                Yenile
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-5">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
              <p className="text-xs text-slate-400">Bu Ay Tahsilat</p>
              <p className="text-xl font-bold text-white mt-0.5">{tl(buAy)}</p>
            </div>
            <div className={`backdrop-blur-sm rounded-xl px-4 py-3 border ${gecikenToplam>0 ? 'bg-red-500/20 border-red-400/30':'bg-white/10 border-white/10'}`}>
              <p className={`text-xs ${gecikenToplam>0 ? 'text-red-300':'text-slate-400'}`}>Geciken</p>
              <p className={`text-xl font-bold mt-0.5 ${gecikenToplam>0 ? 'text-red-200':'text-white'}`}>{tl(gecikenToplam)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
              <p className="text-xs text-slate-400">Toplam Öğrenci</p>
              <p className="text-xl font-bold text-white mt-0.5">{ogrenciler.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-8 -mt-6 pb-10">

        {/* Arama + Filtre */}
        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-gray-100 p-3 mb-5 flex flex-col sm:flex-row gap-2">
          <input type="text" placeholder="Öğrenci ara..." value={arama} onChange={e => setArama(e.target.value)}
            className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
          <div className="flex gap-1.5 flex-wrap">
            {[
              {k:'hepsi', l:'Hepsi'},
              {k:'gecikti', l:'⚠ Gecikti'},
              {k:'kismi', l:'◑ Kısmi'},
              {k:'bekliyor', l:'○ Bekliyor'},
              {k:'odendi', l:'✓ Ödendi'},
            ].map(({k,l}) => (
              <button key={k} onClick={() => setDurumFiltre(k)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                  durumFiltre===k
                    ? k==='gecikti' ? 'bg-red-600 text-white border-red-600'
                      : k==='odendi' ? 'bg-emerald-600 text-white border-emerald-600'
                      : k==='kismi'  ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}>{l}</button>
            ))}
          </div>
        </div>

        {yukleniyor ? (
          <p className="text-center text-gray-400 py-16">Yükleniyor...</p>
        ) : gruplar.length === 0 ? (
          <p className="text-center text-gray-400 py-16">Öğrenci bulunamadı.</p>
        ) : (
          <div className="space-y-4">
            {gruplar.map(([sinif, liste]) => {
              const renk = SINIF_RENK[sinif] || SINIF_RENK[8]
              const sinifOdenen = liste.reduce((s,o) => s+odenenHesapla(o), 0)
              const sinifToplam = liste.reduce((s,o) => s+o.planlar.reduce((x,p)=>x+p.toplam_ucret,0), 0)
              const sinifYuzde = sinifToplam>0 ? Math.round((sinifOdenen/sinifToplam)*100) : 0
              const sinifGeciken = liste.filter(o => ogrenciDurum(o)==='gecikti').length

              return (
                <div key={sinif} className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">

                  {/* Sınıf başlığı */}
                  <div className={`bg-gradient-to-r ${renk.grad} px-5 py-3.5`}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <span className="text-white font-bold text-xl">{sinif}. Sınıf</span>
                        <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full font-medium">
                          {liste.length} öğrenci
                        </span>
                        {sinifGeciken>0 && (
                          <span className="bg-red-500/40 text-white text-xs px-2.5 py-1 rounded-full font-medium">
                            ⚠ {sinifGeciken} gecikmiş
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-white/80 text-xs">{tl(sinifOdenen)} / {tl(sinifToplam)}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="h-1.5 bg-white/20 rounded-full w-20">
                              <div className="h-full bg-white/80 rounded-full transition-all" style={{width:`${sinifYuzde}%`}} />
                            </div>
                            <span className="text-white/70 text-xs">{sinifYuzde}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Öğrenci satırları */}
                  <div className="divide-y divide-gray-50">
                    {liste.map(o => {
                      const durum = ogrenciDurum(o)
                      const odenen = odenenHesapla(o)
                      const toplam = o.planlar.reduce((s,p)=>s+p.toplam_ucret,0)
                      const yuzde = toplam>0 ? Math.min(100, Math.round((odenen/toplam)*100)) : 0
                      const acik = aciklar.has(o.id)
                      const ds = DURUM_STIL[durum]

                      return (
                        <div key={o.id}>
                          <button onClick={() => toggleAcik(o.id)}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50/80 transition-colors flex items-center gap-3">

                            {/* Avatar */}
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${renk.grad} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}>
                              {initials(o.ad_soyad)}
                            </div>

                            {/* İsim + progress */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-gray-800 text-sm">{o.ad_soyad}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${renk.pill}`}>
                                  {o.ogrenci_tipi==='kurs' ? 'Kurs' : 'Deneme'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-24 sm:w-32">
                                  <div className={`h-full rounded-full transition-all ${
                                    durum==='odendi' ? 'bg-emerald-500' : durum==='gecikti' ? 'bg-red-400' : renk.bar
                                  }`} style={{width:`${yuzde}%`}} />
                                </div>
                                <span className="text-xs text-gray-400">{yuzde}%</span>
                              </div>
                            </div>

                            {/* Tutar */}
                            <div className="text-right shrink-0 hidden sm:block">
                              <p className="text-sm font-bold text-gray-700">{tl(odenen)}</p>
                              <p className="text-xs text-gray-400">{tl(toplam)}</p>
                            </div>

                            {/* Durum badge */}
                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${ds.bg} ${ds.text}`}>
                              {ds.icon} {ds.label}
                            </span>

                            {acik ? <ChevronDown size={17} className="text-gray-300 shrink-0" /> : <ChevronRight size={17} className="text-gray-300 shrink-0" />}
                          </button>

                          {/* Açılır detay */}
                          {acik && (
                            <div className={`border-t border-gray-100 ${renk.light} p-4`}>
                              {o.planlar.length===0 ? (
                                <p className="text-sm text-gray-400 text-center py-4">Ödeme planı yok.</p>
                              ) : o.planlar.map(plan => {
                                const odenmemis = plan.taksitler.filter(t => t.durum!=='odendi')
                                const tahsilAcik = tahsilPlanId===plan.id
                                const turuYazi: Record<string,string> = { kurs_taksitli:'Taksitli Kurs', kurs_pesin:'Peşin Kurs', deneme_paket:'Deneme Paket', deneme_tekil:'Deneme Tekil' }

                                return (
                                  <div key={plan.id} className="mb-4 last:mb-0">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        {turuYazi[plan.odeme_turu]||plan.odeme_turu} · {tl(plan.toplam_ucret)}
                                      </p>
                                      <Link href={`/ogrenciler/${o.id}`} className="text-xs text-blue-600 hover:underline">
                                        Profil →
                                      </Link>
                                    </div>

                                    {/* Taksit tablosu */}
                                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-3">
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-xs min-w-[460px]">
                                          <thead className="bg-gray-50 border-b border-gray-100">
                                            <tr>
                                              <th className="text-left px-3 py-2 text-gray-400 font-medium">#</th>
                                              <th className="text-left px-3 py-2 text-gray-400 font-medium">Vade</th>
                                              <th className="text-left px-3 py-2 text-gray-400 font-medium">Tutar</th>
                                              <th className="text-left px-3 py-2 text-gray-400 font-medium">Durum</th>
                                              <th className="text-left px-3 py-2 text-gray-400 font-medium">Ödeme</th>
                                              {yetki && <th className="px-3 py-2"></th>}
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-50">
                                            {plan.taksitler.map(t => {
                                              const td = taksitDurum(t)
                                              const ts = DURUM_STIL[td]
                                              return (
                                                <tr key={t.id} className={
                                                  td==='odendi' ? 'bg-emerald-50/40'
                                                  : td==='gecikti' ? 'bg-red-50/40'
                                                  : td==='kismi' ? 'bg-blue-50/30'
                                                  : 'bg-white'
                                                }>
                                                  <td className="px-3 py-2.5 text-gray-400 font-medium">{t.taksit_no}</td>
                                                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{tarihStr(t.vade_tarihi)}</td>
                                                  <td className="px-3 py-2.5 whitespace-nowrap">
                                                    {td==='kismi' ? (
                                                      <span>
                                                        <span className="font-semibold text-blue-700">{tl(t.odendi_tutar!)}</span>
                                                        <span className="text-gray-400 ml-1">ödendi · {tl(t.tutar)} kalan</span>
                                                      </span>
                                                    ) : td==='odendi' ? (
                                                      <span className="font-semibold text-emerald-700">{tl(t.odendi_tutar||t.tutar)}</span>
                                                    ) : (
                                                      <span className="font-semibold text-gray-800">{tl(t.tutar)}</span>
                                                    )}
                                                  </td>
                                                  <td className="px-3 py-2.5">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ts.bg} ${ts.text}`}>
                                                      {ts.icon} {ts.label}
                                                    </span>
                                                  </td>
                                                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                                                    {t.odeme_tarihi ? (
                                                      <span>{tarihStr(t.odeme_tarihi)}
                                                        {t.odeme_yontemi && <span className="ml-1 text-gray-400">· {t.odeme_yontemi==='nakit'?'Nakit':t.odeme_yontemi==='havale'?'Havale':'KK'}</span>}
                                                      </span>
                                                    ) : '—'}
                                                  </td>
                                                  {yetki && (
                                                    <td className="px-3 py-2.5">
                                                      <button onClick={e => { e.stopPropagation(); setEditId(t.id); setEditForm({ tutar:String(t.tutar), vade_tarihi:t.vade_tarihi, durum:t.durum, odeme_tarihi:t.odeme_tarihi||today, odeme_yontemi:t.odeme_yontemi||'nakit' }) }}
                                                        className="text-gray-400 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors text-xs">
                                                        Düzenle
                                                      </button>
                                                    </td>
                                                  )}
                                                </tr>
                                              )
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>

                                    {/* Tahsilat */}
                                    {yetki && odenmemis.length>0 && (
                                      !tahsilAcik ? (
                                        <button onClick={e => { e.stopPropagation(); setTahsilPlanId(plan.id); setTahsilTutar('') }}
                                          className={`w-full bg-gradient-to-r ${renk.grad} text-white text-sm font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2`}>
                                          <CreditCard size={15} /> Tahsilat Yap
                                        </button>
                                      ) : (
                                        <div className="bg-white rounded-xl border border-gray-200 p-3">
                                          <p className="text-xs font-semibold text-gray-500 mb-2">Tahsilat Girişi</p>
                                          <div className="flex flex-wrap gap-2 items-center">
                                            <input type="number" value={tahsilTutar} onChange={e=>setTahsilTutar(e.target.value)}
                                              placeholder="Tutar (₺)" autoFocus
                                              className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                                            <input type="date" value={tahsilForm.tarih} onChange={e=>setTahsilForm(f=>({...f,tarih:e.target.value}))}
                                              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                                            <select value={tahsilForm.yontem} onChange={e=>setTahsilForm(f=>({...f,yontem:e.target.value}))}
                                              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                                              <option value="nakit">Nakit</option>
                                              <option value="havale">Havale</option>
                                              <option value="kredi_karti">Kredi Kartı</option>
                                            </select>
                                            <input value={tahsilForm.makbuz} onChange={e=>setTahsilForm(f=>({...f,makbuz:e.target.value}))}
                                              placeholder="Makbuz no"
                                              className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                                            <button onClick={e => { e.stopPropagation(); tahsilEt(plan.id) }} disabled={tahsilYukleniyor}
                                              className={`bg-gradient-to-r ${renk.grad} text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50`}>
                                              {tahsilYukleniyor ? '...' : 'Tahsil Et'}
                                            </button>
                                            <button onClick={e => { e.stopPropagation(); setTahsilPlanId(null) }}
                                              className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-200">
                                              İptal
                                            </button>
                                          </div>
                                        </div>
                                      )
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
