'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AdminPanel from '@/components/AdminPanel'

type Taksit = {
  id: number
  taksit_no: number
  tutar: number
  vade_tarihi: string
  odeme_tarihi: string | null
  durum: string
  makbuz_no: string | null
  odeme_planlari: {
    odeme_turu: string
    donem: string
    ogrenciler: { id: number; ad_soyad: string; sinif: number }
  }
}

export default function OdemelerPage() {
  const [taksitler, setTaksitler] = useState<Taksit[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [durum, setDurum] = useState('hepsi')
  const [arama, setArama] = useState('')

  const [tahsilId, setTahsilId] = useState<number | null>(null)
  const [tahsilTutar, setTahsilTutar] = useState('')
  const [tahsilForm, setTahsilForm] = useState({
    tarih: new Date().toISOString().split('T')[0],
    yontem: 'nakit',
    makbuz: '',
  })
  const [tahsilYukleniyor, setTahsilYukleniyor] = useState(false)
  const [yetki, setYetki] = useState(false)

  useEffect(() => { getir() }, [])

  async function getir() {
    const { data } = await supabase
      .from('taksitler')
      .select('*, odeme_planlari(odeme_turu, donem, ogrenciler(id, ad_soyad, sinif))')
      .order('vade_tarihi', { ascending: false })
    setTaksitler(data || [])
    setYukleniyor(false)
  }

  function tahsilAc(t: Taksit) {
    setTahsilId(t.id)
    setTahsilTutar(String(t.tutar))
    setTahsilForm({
      tarih: new Date().toISOString().split('T')[0],
      yontem: 'nakit',
      makbuz: '',
    })
  }

  async function tahsilEt() {
    if (!tahsilId) return
    setTahsilYukleniyor(true)
    const { error } = await supabase.from('taksitler').update({
      durum: 'odendi',
      tutar: parseFloat(tahsilTutar),
      odeme_tarihi: tahsilForm.tarih,
      odeme_yontemi: tahsilForm.yontem,
      makbuz_no: tahsilForm.makbuz || null,
    }).eq('id', tahsilId)
    if (error) { alert('Hata: ' + error.message); setTahsilYukleniyor(false); return }
    setTahsilId(null)
    getir()
    setTahsilYukleniyor(false)
  }

  const filtrelendi = taksitler.filter(t => {
    const durumUygun = durum === 'hepsi' || t.durum === durum
    const adSoyad = t.odeme_planlari?.ogrenciler?.ad_soyad?.toLowerCase() || ''
    const aramaUygun = !arama || adSoyad.includes(arama.toLowerCase())
    return durumUygun && aramaUygun
  })

  const toplamBeklenen = taksitler.filter(t => t.durum !== 'odendi').reduce((s, t) => s + t.tutar, 0)
  const toplamGeciken = taksitler.filter(t => t.durum === 'gecikti').reduce((s, t) => s + t.tutar, 0)
  const buAyTahsil = taksitler.filter(t => {
    if (t.durum !== 'odendi' || !t.odeme_tarihi) return false
    return t.odeme_tarihi.startsWith(new Date().toISOString().slice(0, 7))
  }).reduce((s, t) => s + t.tutar, 0)

  const durumRenk = (d: string) => {
    if (d === 'odendi') return 'bg-green-100 text-green-700'
    if (d === 'gecikti') return 'bg-red-100 text-red-700'
    return 'bg-orange-100 text-orange-700'
  }

  const tahsilEdilen = tahsilId ? taksitler.find(t => t.id === tahsilId) : null

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">

        {tahsilId !== null && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
              <h2 className="font-semibold text-gray-800 mb-1">Tahsilat Al</h2>
              {tahsilEdilen && (
                <p className="text-sm text-gray-500 mb-4">
                  {tahsilEdilen.odeme_planlari?.ogrenciler?.ad_soyad} — {tahsilEdilen.taksit_no}. Taksit
                </p>
              )}
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-500">Tutar (₺)</label>
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
                    <option value="kart">Kart</option>
                    <option value="havale">Havale / EFT</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Makbuz No (opsiyonel)</label>
                  <input value={tahsilForm.makbuz}
                    onChange={e => setTahsilForm(f => ({ ...f, makbuz: e.target.value }))}
                    placeholder="—"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={tahsilEt} disabled={tahsilYukleniyor}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  {tahsilYukleniyor ? 'Kaydediliyor...' : 'Tahsil Et'}
                </button>
                <button onClick={() => setTahsilId(null)}
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
            <h1 className="text-2xl font-bold text-gray-800 mt-1">Ödemeler & Taksitler</h1>
          </div>
          <div className="flex items-center gap-3">
            <AdminPanel onDegis={setYetki} />
            {yetki && (
              <Link href="/odemeler/yeni-plan" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                + Yeni Ödeme Planı
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Bu Ay Tahsilat</p>
            <p className="text-2xl font-bold text-green-600 mt-1">₺{buAyTahsil.toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Bekleyen</p>
            <p className="text-2xl font-bold text-orange-500 mt-1">₺{toplamBeklenen.toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Geciken</p>
            <p className="text-2xl font-bold text-red-500 mt-1">₺{toplamGeciken.toLocaleString('tr-TR')}</p>
          </div>
        </div>

        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="Öğrenci adına göre ara..."
            value={arama}
            onChange={e => setArama(e.target.value)}
            className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
          <div className="flex gap-2">
            {['hepsi','bekliyor','gecikti','odendi'].map(f => (
              <button key={f} onClick={() => setDurum(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  durum === f ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}>
                {f === 'hepsi' ? 'Hepsi' : f === 'bekliyor' ? 'Bekliyor' : f === 'gecikti' ? 'Gecikti' : 'Ödendi'}
              </button>
            ))}
          </div>
        </div>

        {yukleniyor ? (
          <p className="text-gray-400 text-center py-12">Yükleniyor...</p>
        ) : filtrelendi.length === 0 ? (
          <p className="text-gray-400 text-center py-12">Kayıt bulunamadı.</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Öğrenci</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Dönem</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Taksit</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Tutar</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Vade</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Durum</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filtrelendi.map((t, i) => (
                  <tr key={t.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3">
                      <Link href={`/ogrenciler/${t.odeme_planlari?.ogrenciler?.id}`}
                        className="font-medium text-gray-800 hover:text-blue-600">
                        {t.odeme_planlari?.ogrenciler?.ad_soyad}
                      </Link>
                      <span className="text-xs text-gray-400 ml-1">{t.odeme_planlari?.ogrenciler?.sinif}. Sınıf</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.odeme_planlari?.donem}</td>
                    <td className="px-4 py-3 text-gray-600">{t.taksit_no}. Taksit</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">₺{t.tutar.toLocaleString('tr-TR')}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(t.vade_tarihi).toLocaleDateString('tr-TR')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${durumRenk(t.durum)}`}>
                        {t.durum === 'odendi' ? 'Ödendi' : t.durum === 'gecikti' ? 'Gecikti' : 'Bekliyor'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.durum !== 'odendi' ? (
                        yetki ? (
                          <button onClick={() => tahsilAc(t)}
                            className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-lg hover:bg-green-100">
                            Tahsil Et
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )
                      ) : (
                        <span className="text-xs text-gray-400">
                          {t.odeme_tarihi ? new Date(t.odeme_tarihi).toLocaleDateString('tr-TR') : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
              {filtrelendi.length} kayıt
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
