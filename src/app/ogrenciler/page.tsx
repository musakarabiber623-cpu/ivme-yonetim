'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Ogrenci = {
  id: number
  ad_soyad: string
  sinif: number
  ogrenci_tipi: string
  aktif: boolean
  kayit_tarihi: string
  veliler: { ad_soyad: string; telefon: string } | null
}

export default function OgrencilerPage() {
  const [ogrenciler, setOgrenciler] = useState<Ogrenci[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [arama, setArama] = useState('')
  const [filtre, setFiltre] = useState('hepsi')

  useEffect(() => {
    async function getir() {
      const { data } = await supabase
        .from('ogrenciler')
        .select('*, veliler(ad_soyad, telefon)')
        .eq('aktif', true)
        .order('ad_soyad')
      setOgrenciler(data || [])
      setYukleniyor(false)
    }
    getir()
  }, [])

  const filtrelendi = ogrenciler.filter(o => {
    const aramaUygun = o.ad_soyad.toLowerCase().includes(arama.toLowerCase())
    const filtreUygun = filtre === 'hepsi' || o.ogrenci_tipi === filtre
    return aramaUygun && filtreUygun
  })

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Ana Sayfa</Link>
            <h1 className="text-2xl font-bold text-gray-800 mt-1">Öğrenciler</h1>
          </div>
          <Link href="/ogrenciler/yeni"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
            + Yeni Öğrenci
          </Link>
        </div>

        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="İsme göre ara..."
            value={arama}
            onChange={e => setArama(e.target.value)}
            className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
          <div className="flex gap-2">
            {['hepsi', 'kurs', 'deneme_kulubu'].map(f => (
              <button key={f} onClick={() => setFiltre(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  filtre === f ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}>
                {f === 'hepsi' ? 'Hepsi' : f === 'kurs' ? 'Kurs' : 'Deneme Kulübü'}
              </button>
            ))}
          </div>
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
                {filtrelendi.map((o, i) => (
                  <tr key={o.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                    <td className="px-4 py-3 font-medium text-gray-800">{o.ad_soyad}</td>
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
                      <Link href={`/ogrenciler/${o.id}`}
                        className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-lg hover:bg-blue-100 hover:text-blue-700">
                        Detay →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-4">Toplam: {filtrelendi.length} öğrenci</p>
      </div>
    </main>
  )
}
