'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AdminPanel from '@/components/AdminPanel'

function initials(isim: string) {
  return isim.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

type Ogrenci = {
  id: number
  ad_soyad: string
  sinif: number
  ogrenci_tipi: string
  aktif: boolean
  kayit_tarihi: string
  veliler: { ad_soyad: string; telefon: string } | null
  odeme_planlari?: { id: number; toplam_ucret: number; taksitler: { durum: string }[] }[]
}

export default function OgrencilerPage() {
  const [ogrenciler, setOgrenciler] = useState<Ogrenci[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [arama, setArama] = useState('')
  const [filtre, setFiltre] = useState('hepsi')
  const [sinifFiltre, setSinifFiltre] = useState(0)
  const [yetki, setYetki] = useState(false)
  const [duzenleId, setDuzenleId] = useState<number | null>(null)
  const [duzenleForm, setDuzenleForm] = useState({
    ad_soyad: '', sinif: '5', ogrenci_tipi: 'kurs', kayit_tarihi: '',
    plan_id: null as number | null, toplam_ucret: '',
  })
  const [islem, setIslem] = useState(false)

  useEffect(() => { getir() }, [])

  async function getir() {
    const { data } = await supabase
      .from('ogrenciler')
      .select('*, veliler(ad_soyad, telefon), odeme_planlari(id, toplam_ucret, taksitler(durum))')
      .eq('aktif', true)
      .order('sinif')
      .order('ad_soyad')
    setOgrenciler((data || []) as Ogrenci[])
    setYukleniyor(false)
  }

  function odenmeBitti(o: Ogrenci): boolean {
    const plans = o.odeme_planlari || []
    if (plans.length === 0) return false
    const tumTaksitler = plans.flatMap(p => p.taksitler || [])
    if (tumTaksitler.length === 0) return false
    return tumTaksitler.every(t => t.durum === 'odendi')
  }

  function duzenleAc(o: Ogrenci) {
    setDuzenleId(o.id)
    const plan = o.odeme_planlari?.[0]
    setDuzenleForm({
      ad_soyad: o.ad_soyad,
      sinif: String(o.sinif),
      ogrenci_tipi: o.ogrenci_tipi,
      kayit_tarihi: o.kayit_tarihi,
      plan_id: plan?.id ?? null,
      toplam_ucret: plan ? String(plan.toplam_ucret) : '',
    })
  }

  async function guncelle() {
    if (!duzenleForm.ad_soyad) return
    setIslem(true)

    const { error } = await supabase.from('ogrenciler').update({
      ad_soyad: duzenleForm.ad_soyad,
      sinif: parseInt(duzenleForm.sinif),
      ogrenci_tipi: duzenleForm.ogrenci_tipi,
      kayit_tarihi: duzenleForm.kayit_tarihi,
    }).eq('id', duzenleId)
    if (error) { alert('Hata: ' + error.message); setIslem(false); return }

    if (duzenleForm.plan_id && duzenleForm.toplam_ucret) {
      const yeniUcret = parseFloat(duzenleForm.toplam_ucret)
      if (yeniUcret > 0) {
        await supabase.from('odeme_planlari').update({ toplam_ucret: yeniUcret }).eq('id', duzenleForm.plan_id)

        // Sadece ödenmemiş taksitleri güncelle
        const { data: taksitler } = await supabase
          .from('taksitler').select('id, taksit_no')
          .eq('odeme_plan_id', duzenleForm.plan_id).neq('durum', 'odendi').is('odendi_tutar', null).order('taksit_no')

        if (taksitler && taksitler.length > 0) {
          const { data: odenmis } = await supabase
            .from('taksitler').select('odendi_tutar, tutar, durum')
            .eq('odeme_plan_id', duzenleForm.plan_id)
            .or('durum.eq.odendi,odendi_tutar.not.is.null')
          const odenmisTop = (odenmis || []).reduce((s, t: { odendi_tutar: number | null; tutar: number; durum: string }) =>
            s + (t.odendi_tutar != null ? t.odendi_tutar : t.tutar), 0)
          const kalanUcret = yeniUcret - odenmisTop
          const cnt = taksitler.length
          if (kalanUcret > 0) {
            const base = Math.floor(kalanUcret / cnt)
            const son = Math.round(kalanUcret - base * (cnt - 1))
            for (let i = 0; i < cnt; i++) {
              await supabase.from('taksitler')
                .update({ tutar: i === cnt - 1 ? son : base })
                .eq('id', taksitler[i].id)
            }
          }
        }
      }
    }

    setDuzenleId(null)
    getir()
    setIslem(false)
  }

  async function sil(id: number, ad: string) {
    if (!confirm(`${ad} adlı öğrenciyi silmek istediğinize emin misiniz?`)) return
    const { error } = await supabase.from('ogrenciler').update({ aktif: false }).eq('id', id)
    if (error) { alert('Hata: ' + error.message); return }
    getir()
  }

  const setD = (k: string, v: string) => setDuzenleForm(f => ({ ...f, [k]: v }))

  const filtrelendi = ogrenciler.filter(o => {
    const aramaUygun = o.ad_soyad.toLowerCase().includes(arama.toLowerCase())
    const filtreUygun = filtre === 'hepsi' || o.ogrenci_tipi === filtre
    const sinifUygun = sinifFiltre === 0 || o.sinif === sinifFiltre
    return aramaUygun && filtreUygun && sinifUygun
  })

  const sinifSayilari = [2,3,4,5,6,7,8].map(s => ({
    sinif: s,
    sayi: ogrenciler.filter(o => o.sinif === s).length
  }))

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">

        {duzenleId !== null && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
              <h2 className="font-semibold text-gray-800 mb-4">Öğrenci Düzenle</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-500">Ad Soyad</label>
                  <input value={duzenleForm.ad_soyad} onChange={e => setD('ad_soyad', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-500">Sınıf</label>
                    <select value={duzenleForm.sinif} onChange={e => setD('sinif', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                      {[2,3,4,5,6,7,8].map(s => <option key={s} value={s}>{s}. Sınıf</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Tip</label>
                    <select value={duzenleForm.ogrenci_tipi} onChange={e => setD('ogrenci_tipi', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                      <option value="kurs">Kurs</option>
                      <option value="deneme_kulubu">Deneme Kulübü</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Kayıt Tarihi</label>
                  <input type="date" value={duzenleForm.kayit_tarihi} onChange={e => setD('kayit_tarihi', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                {duzenleForm.plan_id && (
                  <div>
                    <label className="text-sm text-gray-500">Toplam Ücret (₺)</label>
                    <input type="number" value={duzenleForm.toplam_ucret} onChange={e => setD('toplam_ucret', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                    <p className="text-xs text-gray-400 mt-1">Değiştirilirse taksit tutarları otomatik güncellenir</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={guncelle} disabled={islem}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {islem ? 'Kaydediliyor...' : 'Güncelle'}
                </button>
                <button onClick={() => setDuzenleId(null)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
                  İptal
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Ana Sayfa</Link>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">Öğrenciler</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <AdminPanel onDegis={setYetki} />
            {yetki && (
              <Link href="/ogrenciler/yeni"
                className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700">
                + Yeni
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            type="text" placeholder="İsme göre ara..."
            value={arama} onChange={e => setArama(e.target.value)}
            className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
          <div className="flex gap-1.5 flex-wrap">
            {(['hepsi', 'kurs', 'deneme_kulubu'] as const).map(f => (
              <button key={f} onClick={() => setFiltre(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  filtre === f ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}>
                {f === 'hepsi' ? 'Hepsi' : f === 'kurs' ? 'Kurs' : 'Deneme Kulübü'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          <button onClick={() => setSinifFiltre(0)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              sinifFiltre === 0 ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-gray-200 hover:bg-slate-50'
            }`}>
            Tüm Sınıflar
          </button>
          {sinifSayilari.filter(x => x.sayi > 0).map(({ sinif, sayi }) => (
            <button key={sinif} onClick={() => setSinifFiltre(sinif)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                sinifFiltre === sinif ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-gray-200 hover:bg-slate-50'
              }`}>
              {sinif}. Sınıf
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${sinifFiltre === sinif ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{sayi}</span>
            </button>
          ))}
        </div>

        {yukleniyor ? (
          <p className="text-gray-400 text-center py-12">Yükleniyor...</p>
        ) : filtrelendi.length === 0 ? (
          <p className="text-gray-400 text-center py-12">Öğrenci bulunamadı.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtrelendi.map(o => {
              const tamOdendi = odenmeBitti(o)
              const tumTaksitler = (o.odeme_planlari || []).flatMap(p => p.taksitler || [])
              const odenenSayi = tumTaksitler.filter(t => t.durum === 'odendi').length
              const toplamSayi = tumTaksitler.length
              const progress = toplamSayi > 0 ? Math.round((odenenSayi / toplamSayi) * 100) : 0
              return (
                <div key={o.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-semibold shrink-0">
                        {initials(o.ad_soyad)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium text-slate-700 text-sm truncate">{o.ad_soyad}</p>
                          {tamOdendi && <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded-md shrink-0">Ödendi</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-400">{o.sinif}. Sınıf</span>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs text-slate-400">
                            {o.ogrenci_tipi === 'kurs' ? 'Kurs' : 'Deneme'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {o.veliler && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                        <span>👤</span>
                        <span className="truncate">{o.veliler.ad_soyad}</span>
                        {o.veliler.telefon && <span className="text-gray-400">· {o.veliler.telefon}</span>}
                      </div>
                    )}

                    {toplamSayi > 0 && (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>Ödeme</span>
                          <span>{odenenSayi}/{toplamSayi} taksit</span>
                        </div>
                        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${tamOdendi ? 'bg-emerald-400' : 'bg-slate-400'}`} style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="flex gap-1.5">
                      <Link href={`/ogrenciler/${o.id}`}
                        className="flex-1 text-center text-xs bg-slate-800 text-white py-1.5 rounded-lg hover:bg-slate-700 font-medium">
                        Detay
                      </Link>
                      {yetki && (
                        <>
                          <button onClick={() => duzenleAc(o)}
                            className="text-xs text-slate-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-slate-50">
                            Düzenle
                          </button>
                          <button onClick={() => sil(o.id, o.ad_soyad)}
                            className="text-xs text-red-400 border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-50">
                            Sil
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-4">Toplam: {filtrelendi.length} öğrenci</p>
      </div>
    </main>
  )
}
