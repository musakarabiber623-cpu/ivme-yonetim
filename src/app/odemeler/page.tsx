'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

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
    ogrenciler: { ad_soyad: string; sinif: number }
  }
}

export default function OdemelerPage() {
  const [taksitler, setTaksitler] = useState<Taksit[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [filtre, setFiltre] = useState('hepsi')

  useEffect(() => { getir() }, [])

  async function getir() {
    const { data } = await supabase
      .from('taksitler')
      .select('*, odeme_planlari(odeme_turu, donem, ogrenciler(ad_soyad, sinif))')
      .order('vade_tarihi', { ascending: false })
    setTaksitler(data || [])
    setYukleniyor(false)
  }

  async function odemeAl(id: number) {
    const makbuz = prompt('Makbuz no (opsiyonel):') ?? ''
    const { error } = await supabase
      .from('taksitler')
      .update({
        durum: 'odendi',
        odeme_tarihi: new Date().toISOString().split('T')[0],
        odeme_yontemi: 'nakit',
        makbuz_no: makbuz || null,
      })
      .eq('id', id)
    if (error) { alert('Hata: ' + error.message); return }
    getir()
  }

  const filtrelendi = taksitler.filter(t => {
    if (filtre === 'hepsi') return true
    return t.durum === filtre
  })

  const toplamBeklenen = taksitler.filter(t => t.durum !== 'odendi').reduce((s, t) => s + t.tutar, 0)
  const toplamGeciken = taksitler.filter(t => t.durum === 'gecikti').reduce((s, t) => s + t.tutar, 0)
  const buAyTahsil = taksitler.filter(t => {
    if (t.durum !== 'odendi' || !t.odeme_tarihi) return false
    const ay = new Date().toISOString().slice(0, 7)
    return t.odeme_tarihi.startsWith(ay)
  }).reduce((s, t) => s + t.tutar, 0)

  const durumRenk = (d: string) => {
    if (d === 'odendi') return 'bg-green-100 text-green-700'
    if (d === 'gecikti') return 'bg-red-100 text-red-700'
    return 'bg-orange-100 text-orange-700'
  }

  const durumYazi = (d: string) => {
    if (d === 'odendi') return 'Ödendi'
    if (d === 'gecikti') return 'Gecikti'
    return 'Bekliyor'
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Ana Sayfa</Link>
            <h1 className="text-2xl font-bold text-gray-800 mt-1">Ödemeler & Taksitler</h1>
          </div>
          <Link href="/odemeler/yeni-plan" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
            + Yeni Ödeme Planı
          </Link>
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

        <div className="flex gap-2 mb-4">
          {['hepsi','bekliyor','gecikti','odendi'].map(f => (
            <button key={f} onClick={() => setFiltre(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                filtre === f ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}>
              {f === 'hepsi' ? 'Hepsi' : f === 'bekliyor' ? 'Bekliyor' : f === 'gecikti' ? 'Gecikti' : 'Ödendi'}
            </button>
          ))}
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
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {t.odeme_planlari?.ogrenciler?.ad_soyad}
                      <span className="text-xs text-gray-400 ml-1">{t.odeme_planlari?.ogrenciler?.sinif}. Sınıf</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.odeme_planlari?.donem}</td>
                    <td className="px-4 py-3 text-gray-600">{t.taksit_no}. Taksit</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">₺{t.tutar.toLocaleString('tr-TR')}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(t.vade_tarihi).toLocaleDateString('tr-TR')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${durumRenk(t.durum)}`}>
                        {durumYazi(t.durum)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.durum !== 'odendi' && (
                        <button onClick={() => odemeAl(t.id)}
                          className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-lg hover:bg-green-100">
                          Tahsil Et
                        </button>
                      )}
                      {t.durum === 'odendi' && (
                        <span className="text-xs text-gray-400">{t.odeme_tarihi && new Date(t.odeme_tarihi).toLocaleDateString('tr-TR')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
