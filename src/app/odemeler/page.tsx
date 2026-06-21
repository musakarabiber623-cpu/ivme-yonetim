'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AdminPanel from '@/components/AdminPanel'
import { ChevronDown, ChevronRight, RefreshCw, CreditCard, AlertTriangle } from 'lucide-react'

type Taksit = {
  id: number; taksit_no: number; tutar: number; odendi_tutar: number | null
  vade_tarihi: string; odeme_tarihi: string | null; durum: string
  odeme_yontemi: string | null; makbuz_no: string | null; odeme_plan_id: number
}
type Plan = { id: number; odeme_turu: string; donem: string; toplam_ucret: number; taksitler: Taksit[] }
type Ogrenci = { id: number; ad_soyad: string; sinif: number; ogrenci_tipi: string; planlar: Plan[] }

const SINIF_RENK: Record<number, string> = {
  2: 'border-l-violet-400', 3: 'border-l-blue-400', 4: 'border-l-teal-400',
  5: 'border-l-emerald-400', 6: 'border-l-amber-400', 7: 'border-l-orange-400', 8: 'border-l-rose-400',
}

const SINIF_BAR: Record<number, string> = {
  2: 'bg-violet-400', 3: 'bg-blue-400', 4: 'bg-teal-400',
  5: 'bg-emerald-400', 6: 'bg-amber-400', 7: 'bg-orange-400', 8: 'bg-rose-400',
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
  const [sinifFiltre, setSinifFiltre] = useState(0)
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

  const sinifSayilari = useMemo(() =>
    [2,3,4,5,6,7,8].map(s => ({ sinif: s, sayi: ogrenciler.filter(o => o.sinif === s).length }))
      .filter(x => x.sayi > 0)
  , [ogrenciler])

  const filtrelenmis = useMemo(() =>
    ogrenciler.filter(o => {
      if (arama && !o.ad_soyad.toLowerCase().includes(arama.toLowerCase())) return false
      if (durumFiltre !== 'hepsi' && ogrenciDurum(o) !== durumFiltre) return false
      if (sinifFiltre !== 0 && o.sinif !== sinifFiltre) return false
      return true
    })
  , [ogrenciler, arama, durumFiltre, sinifFiltre])

  const gruplar = useMemo(() => {
    const map = new Map<number, Ogrenci[]>()
    for (const o of filtrelenmis) { const l = map.get(o.sinif)||[]; l.push(o); map.set(o.sinif, l) }
    return [...map.entries()].sort((a,b) => b[0]-a[0])
  }, [filtrelenmis])

  function toggleAcik(id: number) {
    setAciklar(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const DURUM_BADGE: Record<string, string> = {
    odendi:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
    kismi:    'bg-blue-50 text-blue-600 border border-blue-200',
    gecikti:  'bg-red-50 text-red-600 border border-red-200',
    bekliyor: 'bg-slate-50 text-slate-500 border border-slate-200',
  }
  const DURUM_LABEL: Record<string, string> = {
    odendi:'Ödendi', kismi:'Kısmi', gecikti:'Gecikti', bekliyor:'Bekliyor'
  }

  return (
    <main className="min-h-screen bg-slate-50">

      {/* Düzenleme Modalı */}
      {editId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm border border-gray-100">
            <h2 className="font-semibold text-slate-800 mb-4 text-sm">Taksit Düzenle</h2>
            <div className="space-y-3">
              {[
                { label:'Tutar (₺)', type:'number', field:'tutar' },
                { label:'Vade Tarihi', type:'date', field:'vade_tarihi' },
              ].map(({label, type, field}) => (
                <div key={field}>
                  <label className="text-xs text-slate-500">{label}</label>
                  <input type={type} value={editForm[field as keyof typeof editForm]}
                    onChange={e => setEditForm(f=>({...f,[field]:e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-slate-400" />
                </div>
              ))}
              <div>
                <label className="text-xs text-slate-500">Durum</label>
                <select value={editForm.durum} onChange={e => setEditForm(f=>({...f,durum:e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-slate-400">
                  <option value="bekliyor">Bekliyor</option>
                  <option value="odendi">Ödendi</option>
                </select>
              </div>
              {editForm.durum === 'odendi' && (<>
                <div>
                  <label className="text-xs text-slate-500">Ödeme Tarihi</label>
                  <input type="date" value={editForm.odeme_tarihi} onChange={e => setEditForm(f=>({...f,odeme_tarihi:e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Yöntem</label>
                  <select value={editForm.odeme_yontemi} onChange={e => setEditForm(f=>({...f,odeme_yontemi:e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-slate-400">
                    <option value="nakit">Nakit</option>
                    <option value="havale">Havale</option>
                    <option value="kredi_karti">Kredi Kartı</option>
                  </select>
                </div>
              </>)}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={editKaydet} disabled={editYukleniyor}
                className="flex-1 bg-slate-800 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50">
                {editYukleniyor ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              <button onClick={() => setEditId(null)}
                className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Üst başlık */}
      <div className="bg-slate-900 px-4 sm:px-8 pt-6 pb-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/" className="text-slate-500 text-xs hover:text-slate-300 transition-colors">← Ana Sayfa</Link>
              <h1 className="text-lg font-semibold text-white mt-1 tracking-tight">Tahsilat Yönetimi</h1>
            </div>
            <div className="flex items-center gap-2">
              <AdminPanel onDegis={setYetki} />
              <button onClick={getir} disabled={yukleniyor}
                className="flex items-center gap-1.5 text-xs text-slate-400 border border-slate-700 rounded-lg px-3 py-1.5 hover:text-white hover:border-slate-500 transition-colors">
                <RefreshCw size={11} className={yukleniyor ? 'animate-spin' : ''} />
                Yenile
              </button>
            </div>
          </div>

          <div className="flex gap-6 mt-5 border-t border-slate-800 pt-4">
            <div>
              <p className="text-slate-500 text-xs">Bu Ay</p>
              <p className="text-white font-semibold text-base mt-0.5 tabular-nums">{tl(buAy)}</p>
            </div>
            {gecikenToplam > 0 && (
              <div>
                <p className="text-red-400 text-xs flex items-center gap-1"><AlertTriangle size={10}/> Geciken</p>
                <p className="text-red-300 font-semibold text-base mt-0.5 tabular-nums">{tl(gecikenToplam)}</p>
              </div>
            )}
            <div>
              <p className="text-slate-500 text-xs">Öğrenci</p>
              <p className="text-white font-semibold text-base mt-0.5">{ogrenciler.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 -mt-4 pb-12">

        {/* Arama + Filtre */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2.5 mb-4 flex flex-col sm:flex-row gap-2">
          <input type="text" placeholder="Öğrenci ara..." value={arama} onChange={e => setArama(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-300 placeholder:text-slate-400" />
          <div className="flex gap-1 flex-wrap">
            {[
              {k:'hepsi', l:'Hepsi'},
              {k:'gecikti', l:'Gecikti'},
              {k:'kismi', l:'Kısmi'},
              {k:'bekliyor', l:'Bekliyor'},
              {k:'odendi', l:'Ödendi'},
            ].map(({k,l}) => (
              <button key={k} onClick={() => setDurumFiltre(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  durumFiltre===k
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}>{l}</button>
            ))}
          </div>
        </div>

        {/* Sınıf sekmeleri */}
        {sinifSayilari.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button onClick={() => setSinifFiltre(0)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                sinifFiltre === 0 ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-gray-200 hover:bg-slate-50'
              }`}>
              Tüm Sınıflar
            </button>
            {sinifSayilari.map(({ sinif, sayi }) => (
              <button key={sinif} onClick={() => setSinifFiltre(sinif)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  sinifFiltre === sinif ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-gray-200 hover:bg-slate-50'
                }`}>
                {sinif}. Sınıf
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${sinifFiltre === sinif ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{sayi}</span>
              </button>
            ))}
          </div>
        )}

        {yukleniyor ? (
          <p className="text-center text-slate-400 py-16 text-sm">Yükleniyor...</p>
        ) : gruplar.length === 0 ? (
          <p className="text-center text-slate-400 py-16 text-sm">Öğrenci bulunamadı.</p>
        ) : (
          <div className="space-y-3">
            {gruplar.map(([sinif, liste]) => {
              const borderRenk = SINIF_RENK[sinif] || SINIF_RENK[8]
              const barRenk = SINIF_BAR[sinif] || SINIF_BAR[8]
              const sinifOdenen = liste.reduce((s,o) => s+odenenHesapla(o), 0)
              const sinifToplam = liste.reduce((s,o) => s+o.planlar.reduce((x,p)=>x+p.toplam_ucret,0), 0)
              const sinifYuzde = sinifToplam>0 ? Math.round((sinifOdenen/sinifToplam)*100) : 0
              const sinifGeciken = liste.filter(o => ogrenciDurum(o)==='gecikti').length

              return (
                <div key={sinif} className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden border-l-4 ${borderRenk}`}>

                  {/* Sınıf başlığı */}
                  <div className="px-5 py-3 bg-slate-50 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-700 text-sm">{sinif}. Sınıf</span>
                      <span className="text-slate-400 text-xs">{liste.length} öğrenci</span>
                      {sinifGeciken > 0 && (
                        <span className="text-xs text-red-500 flex items-center gap-1">
                          <AlertTriangle size={10}/> {sinifGeciken} gecikmiş
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 text-xs tabular-nums">{tl(sinifOdenen)} / {tl(sinifToplam)}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1 w-16 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barRenk} opacity-70`} style={{width:`${sinifYuzde}%`}} />
                        </div>
                        <span className="text-slate-400 text-xs">{sinifYuzde}%</span>
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

                      return (
                        <div key={o.id}>
                          <button onClick={() => toggleAcik(o.id)}
                            className="w-full text-left px-5 py-3 hover:bg-slate-50/60 transition-colors flex items-center gap-3">

                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-semibold shrink-0">
                              {initials(o.ad_soyad)}
                            </div>

                            {/* İsim */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-700 text-sm truncate">{o.ad_soyad}</span>
                                <span className="text-slate-400 text-xs shrink-0">
                                  {o.ogrenci_tipi==='kurs' ? 'Kurs' : 'Deneme'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="h-1 bg-slate-100 rounded-full overflow-hidden w-20 sm:w-28">
                                  <div className={`h-full rounded-full ${
                                    durum==='odendi' ? 'bg-emerald-400' : durum==='gecikti' ? 'bg-red-400' : barRenk+' opacity-60'
                                  }`} style={{width:`${yuzde}%`}} />
                                </div>
                                <span className="text-xs text-slate-400">{yuzde}%</span>
                              </div>
                            </div>

                            {/* Tutar */}
                            <div className="text-right shrink-0 hidden sm:block">
                              <p className="text-sm font-semibold text-slate-700 tabular-nums">{tl(odenen)}</p>
                              <p className="text-xs text-slate-400 tabular-nums">{tl(toplam)}</p>
                            </div>

                            {/* Durum */}
                            <span className={`text-xs px-2 py-0.5 rounded-md font-medium shrink-0 ${DURUM_BADGE[durum]}`}>
                              {DURUM_LABEL[durum]}
                            </span>

                            {acik
                              ? <ChevronDown size={15} className="text-slate-300 shrink-0" />
                              : <ChevronRight size={15} className="text-slate-300 shrink-0" />}
                          </button>

                          {/* Açılır detay */}
                          {acik && (
                            <div className="border-t border-gray-100 bg-slate-50/50 p-4">
                              {o.planlar.length===0 ? (
                                <p className="text-sm text-slate-400 text-center py-4">Ödeme planı yok.</p>
                              ) : o.planlar.map(plan => {
                                const odenmemis = plan.taksitler.filter(t => t.durum!=='odendi')
                                const tahsilAcik = tahsilPlanId===plan.id
                                const turuYazi: Record<string,string> = {
                                  kurs_taksitli:'Taksitli Kurs', kurs_pesin:'Peşin Kurs',
                                  deneme_paket:'Deneme Paket', deneme_tekil:'Deneme Tekil'
                                }

                                return (
                                  <div key={plan.id} className="mb-4 last:mb-0">
                                    <div className="flex items-center justify-between mb-2.5">
                                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                                        {turuYazi[plan.odeme_turu]||plan.odeme_turu}
                                        <span className="ml-1.5 normal-case font-normal text-slate-400">— {tl(plan.toplam_ucret)}</span>
                                      </p>
                                      <Link href={`/ogrenciler/${o.id}`} className="text-xs text-slate-400 hover:text-slate-600">
                                        Profil →
                                      </Link>
                                    </div>

                                    {/* Taksit tablosu */}
                                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-3">
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-xs min-w-[460px]">
                                          <thead>
                                            <tr className="border-b border-gray-100 text-slate-400">
                                              <th className="text-left px-3 py-2 font-medium">#</th>
                                              <th className="text-left px-3 py-2 font-medium">Vade</th>
                                              <th className="text-left px-3 py-2 font-medium">Tutar</th>
                                              <th className="text-left px-3 py-2 font-medium">Durum</th>
                                              <th className="text-left px-3 py-2 font-medium">Ödeme Tarihi</th>
                                              {yetki && <th className="px-3 py-2"></th>}
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-50">
                                            {plan.taksitler.map(t => {
                                              const td = taksitDurum(t)
                                              return (
                                                <tr key={t.id} className={
                                                  td==='odendi' ? 'bg-emerald-50/30'
                                                  : td==='gecikti' ? 'bg-red-50/30'
                                                  : 'bg-white'
                                                }>
                                                  <td className="px-3 py-2 text-slate-400">{t.taksit_no}</td>
                                                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{tarihStr(t.vade_tarihi)}</td>
                                                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                                                    {td==='kismi' ? (
                                                      <span>
                                                        <span className="font-semibold text-slate-700">{tl(t.odendi_tutar!)}</span>
                                                        <span className="text-slate-400 ml-1">ödendi · {tl(t.tutar)} kalan</span>
                                                      </span>
                                                    ) : td==='odendi' ? (
                                                      <span className="font-semibold text-emerald-700">{tl(t.odendi_tutar||t.tutar)}</span>
                                                    ) : (
                                                      <span className="text-slate-700">{tl(t.tutar)}</span>
                                                    )}
                                                  </td>
                                                  <td className="px-3 py-2">
                                                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${DURUM_BADGE[td]}`}>
                                                      {DURUM_LABEL[td]}
                                                    </span>
                                                  </td>
                                                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                                                    {t.odeme_tarihi ? (
                                                      <span>{tarihStr(t.odeme_tarihi)}
                                                        {t.odeme_yontemi && (
                                                          <span className="ml-1 text-slate-300">
                                                            · {t.odeme_yontemi==='nakit'?'Nakit':t.odeme_yontemi==='havale'?'Havale':'KK'}
                                                          </span>
                                                        )}
                                                      </span>
                                                    ) : '—'}
                                                  </td>
                                                  {yetki && (
                                                    <td className="px-3 py-2">
                                                      <button onClick={e => { e.stopPropagation(); setEditId(t.id); setEditForm({ tutar:String(t.tutar), vade_tarihi:t.vade_tarihi, durum:t.durum, odeme_tarihi:t.odeme_tarihi||today, odeme_yontemi:t.odeme_yontemi||'nakit' }) }}
                                                        className="text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-100 transition-colors text-xs">
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
                                          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-300 bg-white rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors">
                                          <CreditCard size={13} /> Tahsilat Yap
                                        </button>
                                      ) : (
                                        <div className="bg-white rounded-lg border border-slate-200 p-3">
                                          <p className="text-xs font-medium text-slate-500 mb-2.5">Tahsilat Girişi</p>
                                          <div className="flex flex-wrap gap-2 items-center">
                                            <input type="number" value={tahsilTutar} onChange={e=>setTahsilTutar(e.target.value)}
                                              placeholder="Tutar (₺)" autoFocus
                                              className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-slate-400" />
                                            <input type="date" value={tahsilForm.tarih} onChange={e=>setTahsilForm(f=>({...f,tarih:e.target.value}))}
                                              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-slate-400" />
                                            <select value={tahsilForm.yontem} onChange={e=>setTahsilForm(f=>({...f,yontem:e.target.value}))}
                                              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-slate-400">
                                              <option value="nakit">Nakit</option>
                                              <option value="havale">Havale</option>
                                              <option value="kredi_karti">Kredi Kartı</option>
                                            </select>
                                            <input value={tahsilForm.makbuz} onChange={e=>setTahsilForm(f=>({...f,makbuz:e.target.value}))}
                                              placeholder="Makbuz no"
                                              className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-slate-400" />
                                            <button onClick={e => { e.stopPropagation(); tahsilEt(plan.id) }} disabled={tahsilYukleniyor}
                                              className="bg-slate-800 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50">
                                              {tahsilYukleniyor ? '...' : 'Tahsil Et'}
                                            </button>
                                            <button onClick={e => { e.stopPropagation(); setTahsilPlanId(null) }}
                                              className="text-slate-400 hover:text-slate-600 px-2 py-1.5 text-sm">
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
