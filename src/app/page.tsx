'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function Home() {
  const [istatistik, setIstatistik] = useState({
    toplamOgrenci: 0,
    buAyTahsilat: 0,
    bekleyenTaksit: 0,
    gecikenTaksit: 0,
  })
  const [yukleniyor, setYukleniyor] = useState(true)

  useEffect(() => {
    async function getir() {
      const buAy = new Date().toISOString().slice(0, 7)

      const [ogrenci, tahsil, bekleyen, geciken] = await Promise.all([
        supabase.from('ogrenciler').select('id', { count: 'exact' }).eq('aktif', true),
        supabase.from('taksitler').select('tutar').eq('durum', 'odendi').like('odeme_tarihi', `${buAy}%`),
        supabase.from('taksitler').select('tutar').eq('durum', 'bekliyor'),
        supabase.from('taksitler').select('tutar').eq('durum', 'gecikti'),
      ])

      const toplamTahsil = (tahsil.data || []).reduce((s, t) => s + t.tutar, 0)
      const toplamBekleyen = (bekleyen.data || []).reduce((s, t) => s + t.tutar, 0)
      const toplamGeciken = (geciken.data || []).reduce((s, t) => s + t.tutar, 0)

      setIstatistik({
        toplamOgrenci: ogrenci.count || 0,
        buAyTahsilat: toplamTahsil,
        bekleyenTaksit: toplamBekleyen,
        gecikenTaksit: toplamGeciken,
      })
      setYukleniyor(false)
    }
    getir()
  }, [])

  const menuler = [
    { href: '/ogrenciler', icon: '👨‍🎓', baslik: 'Öğrenciler', aciklama: 'Kayıt, listeleme, detay', renk: 'hover:border-blue-300' },
    { href: '/odemeler', icon: '💰', baslik: 'Ödemeler', aciklama: 'Taksit takip, tahsilat', renk: 'hover:border-green-300' },
    { href: '/sinavlar', icon: '📝', baslik: 'Sınavlar', aciklama: 'Deneme sonuçları', renk: 'hover:border-purple-300' },
    { href: '/personel', icon: '👩‍🏫', baslik: 'Personel', aciklama: 'Maaş, SGK, ek ders', renk: 'hover:border-yellow-300' },
    { href: '/gelir-gider', icon: '📊', baslik: 'Gelir / Gider', aciklama: 'Kantin, giderler', renk: 'hover:border-red-300' },
    { href: '/raporlar', icon: '📈', baslik: 'Raporlar', aciklama: 'Nakit akış, özet', renk: 'hover:border-gray-300' },
  ]

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Antakya İvme Akademi</h1>
          <p className="text-gray-500 mt-1">Yönetim Paneli</p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Toplam Öğrenci</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">
              {yukleniyor ? '...' : istatistik.toplamOgrenci}
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Bu Ay Tahsilat</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {yukleniyor ? '...' : `₺${istatistik.buAyTahsilat.toLocaleString('tr-TR')}`}
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Bekleyen Taksit</p>
            <p className="text-3xl font-bold text-orange-500 mt-1">
              {yukleniyor ? '...' : `₺${istatistik.bekleyenTaksit.toLocaleString('tr-TR')}`}
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Geciken Taksit</p>
            <p className="text-3xl font-bold text-red-500 mt-1">
              {yukleniyor ? '...' : `₺${istatistik.gecikenTaksit.toLocaleString('tr-TR')}`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {menuler.map(m => (
            <Link key={m.href} href={m.href}
              className={`bg-white rounded-xl p-6 shadow-sm border border-gray-100 ${m.renk} hover:shadow-md transition-all`}>
              <div className="text-2xl mb-2">{m.icon}</div>
              <p className="font-semibold text-gray-800">{m.baslik}</p>
              <p className="text-sm text-gray-500 mt-1">{m.aciklama}</p>
            </Link>
          ))}
        </div>

      </div>
    </main>
  )
}
