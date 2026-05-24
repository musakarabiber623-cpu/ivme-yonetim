'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AdminPanel from '@/components/AdminPanel'

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

        const { data: taksitler } = await supabase
          .from('taksitler').select('id, taksit_no')
          .eq('odeme_plan_id', duzenleForm.plan_id).order('taksit_no')

        if (taksitler && taksitler.length > 0) {
          const cnt = taksitler.length
          const base = Math.floor(yeniUcret / cnt)
          const son = Math.round(yeniUcret - base * (cnt - 1))
          for (let i = 0; i < cnt; i++) {
            await supabase.from('taksitler')
              .update({ tutar: i === cnt - 1 ? son : base })
              .eq('id', taksitler[i].id)
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
    <main className="min-h-screen bg-gray-50 p-8">
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

        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Ana Sayfa</Link>
            <h1 className="text-2xl font-bold text-gray-800 mt-1">Öğrenciler</h1>
          </div>
          <div className="flex items-center gap-3">
            <AdminPanel onDegis={setYetki} />
            {yetki && (
              <Link href="/ogrenciler/yeni"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                + Yeni Öğrenci
              </Link>
            )}
          </div>
        </div>

        <div className="flex gap-3 mb-3">
          <input
            type="text" placeholder="İsme göre ara..."
            value={arama} onChange={e => setArama(e.target.value)}
            className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
          <div className="flex gap-2">
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

        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setSinifFiltre(0)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              sinifFiltre === 0 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
            }`}>
            Tüm Sınıflar
          </button>
          {sinifSayilari.map(({ sinif, sayi }) => (
            <button key={sinif} onClick={() => setSinifFiltre(sinif)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                sinifFiltre === sinif ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}>
              {sinif}. Sınıf
              {sayi > 0 && <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${sinifFiltre === sinif ? 'bg-blue-500' : 'bg-gray-100 text-gray-500'}`}>{sayi}</span>}
            </button>
          ))}
        </div>

        {yukleniyor ? (
          <p className="text-gray-400 text-center py-12">Yükleniyor...</p>
        ) : filtrelendi.length === 0 ? (
          <p className="text-gray-400 text-center py-12">Öğrenci bulunamadı.</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Ad Soyad</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Sınıf</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Tip</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Veli</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Telefon</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtrelendi.map((o, i) => {
                  const tamOdendi = odenmeBitti(o)
                  return (
                    <tr key={o.id} className={`transition-colors ${
                      tamOdendi ? 'bg-green-50 hover:bg-green-100' : i % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'
                    }`}>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {o.ad_soyad}
                        {tamOdendi && <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-normal">✓ ödendi</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{o.sinif}. Sınıf</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          o.ogrenci_tipi === 'kurs' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {o.ogrenci_tipi === 'kurs' ? 'Kurs' : 'Deneme Kulübü'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{o.veliler?.ad_soyad || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{o.veliler?.telefon || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Link href={`/ogrenciler/${o.id}`}
                            className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-lg hover:bg-blue-100 hover:text-blue-700">
                            Detay
                          </Link>
                          {yetki && (
                            <>
                              <button onClick={() => duzenleAc(o)}
                                className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-3 py-1 rounded-lg hover:bg-yellow-100">
                                Düzenle
                              </button>
                              <button onClick={() => sil(o.id, o.ad_soyad)}
                                className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded-lg hover:bg-red-100">
                                Sil
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-4">Toplam: {filtrelendi.length} öğrenci</p>
      </div>
    </main>
  )
}
