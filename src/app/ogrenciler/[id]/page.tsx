'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'

type Ogrenci = {
  id: number
  ad_soyad: string
  sinif: number
  ogrenci_tipi: string
  kayit_tarihi: string
  notlar: string | null
  aktif: boolean
  veliler: { ad_soyad: string; telefon: string; telefon_2: string | null; email: string | null } | null
}

type Taksit = {
  id: number
  taksit_no: number
  tutar: number
  odendi_tutar: number | null
  vade_tarihi: string
  odeme_tarihi: string | null
  durum: string
  odeme_yontemi: string | null
}

type Plan = {
  id: number
  odeme_turu: string
  donem: string
  toplam_ucret: number
  baslangic_tarihi: string
  taksitler: Taksit[]
}

const odemeTuruYazi: Record<string, string> = {
  kurs_taksitli: 'Kurs — Taksitli',
  kurs_pesin: 'Kurs — Peşin',
  deneme_paket: 'Deneme Kulübü — Paket',
  deneme_tekil: 'Deneme Kulübü — Tekil',
}

export default function OgrenciDetayPage() {
  const { id } = useParams()
  const router = useRouter()
  const [ogrenci, setOgrenci] = useState<Ogrenci | null>(null)
  const [planlar, setPlanlar] = useState<Plan[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [sekme, setSekme] = useState<'odemeler' | 'genel'>('odemeler')

  const [tahsilId, setTahsilId] = useState<number | null>(null)
  const [tahsilPlanId, setTahsilPlanId] = useState<number | null>(null)
  const [tahsilTutar, setTahsilTutar] = useState('')
  const [tahsilForm, setTahsilForm] = useState({
    tarih: new Date().toISOString().split('T')[0],
    yontem: 'nakit',
  })
  const [tahsilYukleniyor, setTahsilYukleniyor] = useState(false)

  useEffect(() => { getir() }, [id])

  async function getir() {
    const [o, p] = await Promise.all([
      supabase.from('ogrenciler').select('*, veliler(ad_soyad, telefon, telefon_2, email)').eq('id', id).single(),
      supabase.from('odeme_planlari')
        .select('id, odeme_turu, donem, toplam_ucret, baslangic_tarihi, taksitler(id, taksit_no, tutar, odendi_tutar, vade_tarihi, odeme_tarihi, durum, odeme_yontemi)')
        .eq('ogrenci_id', id)
        .order('baslangic_tarihi'),
    ])
    setOgrenci(o.data)
    setPlanlar((p.data || []) as Plan[])
    setYukleniyor(false)
  }

  async function tahsilEt() {
    if (!tahsilId || !tahsilPlanId) return
    const tutar = parseFloat(tahsilTutar)
    if (!tutar || tutar <= 0) { alert('Geçerli bir tutar giriniz.'); return }
    setTahsilYukleniyor(true)

    const { data: odenmemis, error: fetchErr } = await supabase
      .from('taksitler')
      .select('id, tutar, odendi_tutar')
      .eq('odeme_plan_id', tahsilPlanId)
      .neq('durum', 'odendi')
      .order('vade_tarihi', { ascending: true })

    if (fetchErr) { alert('Hata: ' + fetchErr.message); setTahsilYukleniyor(false); return }

    let kalan = tutar
    for (const t of (odenmemis || []) as { id: number; tutar: number; odendi_tutar: number | null }[]) {
      if (kalan <= 0) break
      if (kalan >= t.tutar) {
        const { error } = await supabase.from('taksitler').update({
          durum: 'odendi',
          odeme_tarihi: tahsilForm.tarih,
          odeme_yontemi: tahsilForm.yontem,
          odendi_tutar: (t.odendi_tutar || 0) + t.tutar,
        }).eq('id', t.id)
        if (error) { alert('Hata: ' + error.message); setTahsilYukleniyor(false); return }
        if (tahsilForm.yontem === 'kredi_karti') {
          await supabase.from('banka_hareketleri').insert({
            tur: 'gelir', tutar: t.tutar, tarih: tahsilForm.tarih,
            aciklama: 'TAKSİT: Kredi kartı taksit ödemesi',
          })
        }
        kalan -= t.tutar
      } else {
        const { error } = await supabase.from('taksitler').update({
          tutar: Math.round(t.tutar - kalan),
          odeme_tarihi: tahsilForm.tarih,
          odeme_yontemi: tahsilForm.yontem,
          odendi_tutar: Math.round(kalan),
        }).eq('id', t.id)
        if (error) { alert('Hata: ' + error.message); setTahsilYukleniyor(false); return }
        if (tahsilForm.yontem === 'kredi_karti') {
          await supabase.from('banka_hareketleri').insert({
            tur: 'gelir', tutar: Math.round(kalan), tarih: tahsilForm.tarih,
            aciklama: 'TAKSİT: Kredi kartı kısmi taksit ödemesi',
          })
        }
        kalan = 0
      }
    }

    setTahsilId(null)
    setTahsilPlanId(null)
    await getir()
    setTahsilYukleniyor(false)
  }

  if (yukleniyor) return <main className="min-h-screen bg-gray-50 p-4 sm:p-8"><p className="text-gray-400">Yükleniyor...</p></main>
  if (!ogrenci) return <main className="min-h-screen bg-gray-50 p-4 sm:p-8"><p className="text-gray-400">Öğrenci bulunamadı.</p></main>

  const tumTaksitler = planlar.flatMap(p => p.taksitler || [])
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0)
  const toplamBorc = planlar.reduce((s, p) => s + p.toplam_ucret, 0)

  // odendi_tutar kullan — toplamBorc - kalan formülü taksit tutarları değişince hatalı verir
  const odenen = tumTaksitler.reduce((s, t) => {
    if (t.odendi_tutar != null) return s + t.odendi_tutar
    if (t.durum === 'odendi') return s + t.tutar
    return s
  }, 0)
  const kalan = toplamBorc - odenen

  const odenenSayisi = tumTaksitler.filter(t => t.durum === 'odendi').length
  const bekleyenSayisi = tumTaksitler.filter(t => t.durum !== 'odendi' && t.odendi_tutar == null && new Date(t.vade_tarihi) >= bugun).length
  const gecikenSayisi = tumTaksitler.filter(t => t.durum !== 'odendi' && t.odendi_tutar == null && new Date(t.vade_tarihi) < bugun).length

  const durumRenk = (t: Taksit) => {
    if (t.durum === 'odendi') return 'bg-green-100 text-green-700'
    if (t.odendi_tutar != null) return 'bg-blue-100 text-blue-700'
    if (new Date(t.vade_tarihi) < bugun) return 'bg-red-100 text-red-700'
    return 'bg-orange-100 text-orange-700'
  }
  const durumYazi = (t: Taksit) => {
    if (t.durum === 'odendi') return 'Ödendi'
    if (t.odendi_tutar != null) return 'Kısmi Ödendi'
    if (new Date(t.vade_tarihi) < bugun) return 'Gecikti'
    return 'Bekliyor'
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">

        {tahsilId !== null && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
              <h2 className="font-semibold text-gray-800 mb-1">Tahsilat Al</h2>
              <p className="text-xs text-gray-400 mb-4">Tutar birden fazla taksiti kapsıyorsa otomatik işlenir</p>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-500">Tahsilat Tutarı (₺)</label>
                  <input type="number" value={tahsilTutar}
                    onChange={e => setTahsilTutar(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-sm text-gray-500">Ödeme Tarihi</label>
                  <input type="date" value={tahsilForm.tarih}
                    onChange={e => setTahsilForm(f => ({ ...f, tarih: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-sm text-gray-500">Ödeme Yöntemi</label>
                  <select value={tahsilForm.yontem}
                    onChange={e => setTahsilForm(f => ({ ...f, yontem: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                    <option value="nakit">Nakit</option>
                    <option value="kredi_karti">Kredi Kartı</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={tahsilEt} disabled={tahsilYukleniyor}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  {tahsilYukleniyor ? 'Kaydediliyor...' : 'Tahsil Et'}
                </button>
                <button onClick={() => { setTahsilId(null); setTahsilPlanId(null) }}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
                  İptal
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <div className="flex gap-4 mb-2">
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Ana Sayfa</Link>
            <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-600">← Geri</button>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-2 mt-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{ogrenci.ad_soyad}</h1>
            <span className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${ogrenci.ogrenci_tipi === 'kurs' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
              {ogrenci.ogrenci_tipi === 'kurs' ? 'Kurs' : 'Deneme'} — {ogrenci.sinif}. Sınıf
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">Toplam Ücret</p>
            <p className="text-lg font-bold text-gray-800 mt-1">₺{toplamBorc.toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-green-100">
            <p className="text-xs text-gray-500">Ödenen</p>
            <p className="text-lg font-bold text-green-600 mt-1">₺{odenen.toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-orange-100">
            <p className="text-xs text-gray-500">Kalan</p>
            <p className="text-lg font-bold text-orange-500 mt-1">₺{kalan.toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">Taksit Durumu</p>
            <p className="text-lg font-bold text-gray-800 mt-1">
              <span className="text-green-600">{odenenSayisi}</span>
              <span className="text-gray-400 text-sm font-normal">/{tumTaksitler.length} ödendi</span>
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">Bekleyen / Geciken</p>
            <p className="text-lg font-bold mt-1">
              <span className="text-orange-500">{bekleyenSayisi}</span>
              <span className="text-gray-300 mx-1">/</span>
              <span className="text-red-500">{gecikenSayisi}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {(['odemeler', 'genel'] as const).map(s => (
            <button key={s} onClick={() => setSekme(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                sekme === s ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}>
              {s === 'genel' ? 'Genel Bilgi' : 'Ödeme Planı'}
            </button>
          ))}
        </div>

        {sekme === 'odemeler' && (
          <div className="space-y-4">
            {planlar.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
                <p className="text-gray-400">Ödeme planı bulunamadı.</p>
                <Link href="/odemeler/yeni-plan" className="inline-block mt-3 text-sm text-blue-600 hover:underline">
                  + Ödeme planı oluştur
                </Link>
              </div>
            ) : planlar.map(plan => {
              const planOdenen = (plan.taksitler || []).filter(t => t.durum === 'odendi').length
              const planToplam = (plan.taksitler || []).length
              const planOdenenTutar = (plan.taksitler || []).reduce((s, t) => {
                if (t.odendi_tutar != null) return s + t.odendi_tutar
                if (t.durum === 'odendi') return s + t.tutar
                return s
              }, 0)
              const progress = planToplam > 0 ? Math.min((planOdenenTutar / plan.toplam_ucret) * 100, 100) : 0

              return (
                <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">{odemeTuruYazi[plan.odeme_turu] || plan.odeme_turu}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{plan.donem}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-800">₺{plan.toplam_ucret.toLocaleString('tr-TR')}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        <span className="text-green-600 font-medium">{planOdenen}/{planToplam}</span> taksit •{' '}
                        <span className="text-green-600">₺{planOdenenTutar.toLocaleString('tr-TR')}</span> tahsil edildi
                      </p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100">
                    <div className="h-full bg-green-500 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead className="border-b border-gray-100">
                      <tr>
                        <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs">Taksit</th>
                        <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs">Tutar</th>
                        <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs">Vade</th>
                        <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs">Durum</th>
                        <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs">Ödeme</th>
                        <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(plan.taksitler || []).sort((a, b) => a.taksit_no - b.taksit_no).map((t, i) => (
                        <tr key={t.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{t.taksit_no}. Taksit</td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="font-semibold text-gray-800">₺{t.tutar.toLocaleString('tr-TR')}</span>
                            {t.odendi_tutar != null && t.durum !== 'odendi' && (
                              <span className="block text-xs text-blue-600">₺{t.odendi_tutar.toLocaleString('tr-TR')} ödendi</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{new Date(t.vade_tarihi).toLocaleDateString('tr-TR')}</td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${durumRenk(t)}`}>
                              {durumYazi(t)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">
                            {(t.durum === 'odendi' || t.odendi_tutar != null) && t.odeme_tarihi
                              ? `${new Date(t.odeme_tarihi).toLocaleDateString('tr-TR')} · ${t.odeme_yontemi || 'nakit'}`
                              : '-'}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {t.durum !== 'odendi' && (
                              <button onClick={() => {
                                setTahsilId(t.id)
                                setTahsilPlanId(plan.id)
                                setTahsilTutar(String(t.tutar))
                                setTahsilForm({ tarih: new Date().toISOString().split('T')[0], yontem: 'nakit' })
                              }}
                                className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-lg hover:bg-green-100">
                                Tahsil Et
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {sekme === 'genel' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-700 mb-4">Öğrenci & Veli Bilgileri</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Kayıt Tarihi</p>
                <p className="font-medium text-gray-800 mt-1">{new Date(ogrenci.kayit_tarihi).toLocaleDateString('tr-TR')}</p>
              </div>
              <div>
                <p className="text-gray-500">Durum</p>
                <p className="font-medium text-gray-800 mt-1">{ogrenci.aktif ? 'Aktif' : 'Pasif'}</p>
              </div>
              {ogrenci.notlar && (
                <div className="col-span-2">
                  <p className="text-gray-500">Notlar</p>
                  <p className="font-medium text-gray-800 mt-1">{ogrenci.notlar}</p>
                </div>
              )}
              <div className="col-span-2 border-t border-gray-100 pt-4 mt-2">
                <p className="font-semibold text-gray-700 mb-3">Veli Bilgileri</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-500">Ad Soyad</p>
                    <p className="font-medium text-gray-800 mt-1">{ogrenci.veliler?.ad_soyad || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Telefon</p>
                    <p className="font-medium text-gray-800 mt-1">{ogrenci.veliler?.telefon || '-'}</p>
                  </div>
                  {ogrenci.veliler?.telefon_2 && (
                    <div>
                      <p className="text-gray-500">Telefon 2</p>
                      <p className="font-medium text-gray-800 mt-1">{ogrenci.veliler.telefon_2}</p>
                    </div>
                  )}
                  {ogrenci.veliler?.email && (
                    <div>
                      <p className="text-gray-500">E-posta</p>
                      <p className="font-medium text-gray-800 mt-1">{ogrenci.veliler.email}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
