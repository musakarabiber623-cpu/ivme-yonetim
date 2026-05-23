'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type AylikTaksit = {
  ay: string
  taksit_sayisi: number
  beklenen_toplam: number
  tahsil_edilen: number
  bekleyen: number
  geciken: number
}

type AylikGelirGider = {
  ay: string
  toplam_gelir: number
  toplam_gider: number
  net: number
}

type BorcluOgrenci = {
  ogrenci_id: number
  ad_soyad: string
  sinif: number
  ogrenci_tipi: string
  kalan: number
  geciken: number
  geciken_taksit_sayisi: number
}

export default function RaporlarPage() {
  const [taksitTakvimi, setTaksitTakvimi] = useState<AylikTaksit[]>([])
  const [gelirGider, setGelirGider] = useState<AylikGelirGider[]>([])
  const [borcluOgrenciler, setBorcluOgrenciler] = useState<BorcluOgrenci[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [sekme, setSekme] = useState<'nakit' | 'gelir-gider' | 'borclar'>('nakit')

  useEffect(() => { getir() }, [])

  async function getir() {
    const [t, g, b] = await Promise.all([
      supabase.from('v_aylik_taksit_takvimi').select('*'),
      supabase.from('v_aylik_gelir_gider').select('*'),
      supabase.from('v_ogrenci_borc_durumu').select('*').gt('kalan', 0).order('geciken', { ascending: false }),
    ])
    setTaksitTakvimi(t.data || [])
    setGelirGider(g.data || [])
    setBorcluOgrenciler(b.data || [])
    setYukleniyor(false)
  }

  const buAy = new Date().toISOString().slice(0, 7)
  const buAyTaksit = taksitTakvimi.find(t => t.ay === buAy)
  const toplamGeciken = borcluOgrenciler.reduce((s, o) => s + o.geciken, 0)
  const toplamKalan = borcluOgrenciler.reduce((s, o) => s + o.kalan, 0)

  const ayYazi = (ay: string) => {
    const [yil, ay2] = ay.split('-')
    const aylar = ['', 'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
    return `${aylar[parseInt(ay2)]} ${yil}`
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Ana Sayfa</Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">Raporlar</h1>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Bu Ay Beklenen Taksit</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">₺{(buAyTaksit?.beklenen_toplam || 0).toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Toplam Kalan Borç</p>
            <p className="text-2xl font-bold text-orange-500 mt-1">₺{toplamKalan.toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Toplam Geciken</p>
            <p className="text-2xl font-bold text-red-500 mt-1">₺{toplamGeciken.toLocaleString('tr-TR')}</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {(['nakit', 'gelir-gider', 'borclar'] as const).map(s => (
            <button key={s} onClick={() => setSekme(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                sekme === s ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}>
              {s === 'nakit' ? 'Nakit Akış Takvimi' : s === 'gelir-gider' ? 'Gelir / Gider Özeti' : 'Borçlu Öğrenciler'}
            </button>
          ))}
        </div>

        {yukleniyor ? <p className="text-gray-400 text-center py-12">Yükleniyor...</p> : (
          <>
            {sekme === 'nakit' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Ay</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium">Beklenen</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium">Tahsil</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium">Bekleyen</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium">Geciken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taksitTakvimi.map((t, i) => (
                      <tr key={t.ay} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${t.ay === buAy ? 'ring-1 ring-blue-200' : ''}`}>
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {ayYazi(t.ay)}
                          {t.ay === buAy && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Bu ay</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">₺{Number(t.beklenen_toplam).toLocaleString('tr-TR')}</td>
                        <td className="px-4 py-3 text-right text-green-600 font-medium">₺{Number(t.tahsil_edilen).toLocaleString('tr-TR')}</td>
                        <td className="px-4 py-3 text-right text-orange-500">₺{Number(t.bekleyen).toLocaleString('tr-TR')}</td>
                        <td className="px-4 py-3 text-right text-red-500">
                          {Number(t.geciken) > 0 ? `₺${Number(t.geciken).toLocaleString('tr-TR')}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {sekme === 'gelir-gider' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Ay</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium">Gelir</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium">Gider</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gelirGider.map((g, i) => (
                      <tr key={g.ay} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 font-medium text-gray-800">{ayYazi(g.ay)}</td>
                        <td className="px-4 py-3 text-right text-green-600">₺{Number(g.toplam_gelir).toLocaleString('tr-TR')}</td>
                        <td className="px-4 py-3 text-right text-red-500">₺{Number(g.toplam_gider).toLocaleString('tr-TR')}</td>
                        <td className={`px-4 py-3 text-right font-bold ${Number(g.net) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          ₺{Number(g.net).toLocaleString('tr-TR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {sekme === 'borclar' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Öğrenci</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Sınıf</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium">Kalan Borç</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium">Geciken</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium">Geciken Taksit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {borcluOgrenciler.map((o, i) => (
                      <tr key={o.ogrenci_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 font-medium text-gray-800">{o.ad_soyad}</td>
                        <td className="px-4 py-3 text-gray-600">{o.sinif}. Sınıf</td>
                        <td className="px-4 py-3 text-right text-orange-500 font-medium">₺{Number(o.kalan).toLocaleString('tr-TR')}</td>
                        <td className="px-4 py-3 text-right text-red-500 font-medium">
                          {Number(o.geciken) > 0 ? `₺${Number(o.geciken).toLocaleString('tr-TR')}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {o.geciken_taksit_sayisi > 0
                            ? <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">{o.geciken_taksit_sayisi} taksit</span>
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
