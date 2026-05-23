'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useParams } from 'next/navigation'

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
  vade_tarihi: string
  odeme_tarihi: string | null
  durum: string
  odeme_planlari: { odeme_turu: string; donem: string }
}

type Sonuc = {
  id: number
  dogru: number
  yanlis: number
  bos: number
  net_puan: number | null
  deneme_sinavlari: { sinav_adi: string; sinav_tarihi: string }
}

export default function OgrenciDetayPage() {
  const { id } = useParams()
  const [ogrenci, setOgrenci] = useState<Ogrenci | null>(null)
  const [taksitler, setTaksitler] = useState<Taksit[]>([])
  const [sonuclar, setSonuclar] = useState<Sonuc[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [sekme, setSekme] = useState<'genel' | 'odemeler' | 'sinavlar'>('genel')

  useEffect(() => {
    async function getir() {
      const [o, t, s] = await Promise.all([
        supabase.from('ogrenciler').select('*, veliler(ad_soyad, telefon, telefon_2, email)').eq('id', id).single(),
        supabase.from('taksitler').select('*, odeme_planlari(odeme_turu, donem)').eq('odeme_planlari.ogrenci_id', id).order('vade_tarihi'),
        supabase.from('sinav_sonuclari').select('*, deneme_sinavlari(sinav_adi, sinav_tarihi)').eq('ogrenci_id', id).order('created_at', { ascending: false }),
      ])
      setOgrenci(o.data)
      setTaksitler(t.data || [])
      setSonuclar(s.data || [])
      setYukleniyor(false)
    }
    getir()
  }, [id])

  async function odemeAl(taksitId: number) {
    const { error } = await supabase.from('taksitler').update({
      durum: 'odendi',
      odeme_tarihi: new Date().toISOString().split('T')[0],
      odeme_yontemi: 'nakit',
    }).eq('id', taksitId)
    if (error) { alert('Hata: ' + error.message); return }
    const t = await supabase.from('taksitler').select('*, odeme_planlari(odeme_turu, donem)').eq('odeme_planlari.ogrenci_id', id).order('vade_tarihi')
    setTaksitler(t.data || [])
  }

  if (yukleniyor) return <main className="min-h-screen bg-gray-50 p-8"><p className="text-gray-400">Yükleniyor...</p></main>
  if (!ogrenci) return <main className="min-h-screen bg-gray-50 p-8"><p className="text-gray-400">Öğrenci bulunamadı.</p></main>

  const toplamBorc = taksitler.reduce((s, t) => s + t.tutar, 0)
  const odenen = taksitler.filter(t => t.durum === 'odendi').reduce((s, t) => s + t.tutar, 0)
  const kalan = toplamBorc - odenen
  const enIyiNet = sonuclar.length > 0 ? Math.max(...sonuclar.map(s => s.net_puan || 0)) : null
  const ortNet = sonuclar.length > 0
    ? Math.round(sonuclar.reduce((s, r) => s + (r.net_puan || 0), 0) / sonuclar.length * 100) / 100
    : null

  const durumRenk = (d: string) => {
    if (d === 'odendi') return 'bg-green-100 text-green-700'
    if (d === 'gecikti') return 'bg-red-100 text-red-700'
    return 'bg-orange-100 text-orange-700'
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">

        <div className="mb-6">
          <Link href="/ogrenciler" className="text-sm text-gray-400 hover:text-gray-600">← Öğrenciler</Link>
          <div className="flex items-center justify-between mt-1">
            <h1 className="text-2xl font-bold text-gray-800">{ogrenci.ad_soyad}</h1>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${ogrenci.ogrenci_tipi === 'kurs' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
              {ogrenci.ogrenci_tipi === 'kurs' ? 'Kurs Öğrencisi' : 'Deneme Kulübü'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">Sınıf</p>
            <p className="text-xl font-bold text-gray-800 mt-1">{ogrenci.sinif}. Sınıf</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">Toplam Borç</p>
            <p className="text-xl font-bold text-gray-800 mt-1">₺{toplamBorc.toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">Kalan</p>
            <p className="text-xl font-bold text-orange-500 mt-1">₺{kalan.toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">Ortalama Net</p>
            <p className="text-xl font-bold text-purple-600 mt-1">{ortNet ?? '-'}</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {(['genel', 'odemeler', 'sinavlar'] as const).map(s => (
            <button key={s} onClick={() => setSekme(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                sekme === s ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}>
              {s === 'genel' ? 'Genel Bilgi' : s === 'odemeler' ? 'Ödemeler' : 'Sınav Sonuçları'}
            </button>
          ))}
        </div>

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

        {sekme === 'odemeler' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {taksitler.length === 0 ? (
              <p className="text-gray-400 text-center py-12">Ödeme planı bulunamadı.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Dönem</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Taksit</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Tutar</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Vade</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Durum</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {taksitler.map((t, i) => (
                    <tr key={t.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
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
            )}
          </div>
        )}

        {sekme === 'sinavlar' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {sonuclar.length === 0 ? (
              <p className="text-gray-400 text-center py-12">Henüz sınav sonucu yok.</p>
            ) : (
              <>
                {enIyiNet && (
                  <div className="px-4 py-3 bg-purple-50 border-b border-purple-100 text-sm text-purple-700">
                    En iyi net: <strong>{enIyiNet}</strong> — Ortalama: <strong>{ortNet}</strong>
                  </div>
                )}
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Sınav</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Tarih</th>
                      <th className="text-center px-4 py-3 text-gray-500 font-medium">D</th>
                      <th className="text-center px-4 py-3 text-gray-500 font-medium">Y</th>
                      <th className="text-center px-4 py-3 text-gray-500 font-medium">B</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sonuclar.map((s, i) => (
                      <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 font-medium text-gray-800">{s.deneme_sinavlari?.sinav_adi}</td>
                        <td className="px-4 py-3 text-gray-600">{new Date(s.deneme_sinavlari?.sinav_tarihi).toLocaleDateString('tr-TR')}</td>
                        <td className="px-4 py-3 text-center text-green-600">{s.dogru}</td>
                        <td className="px-4 py-3 text-center text-red-500">{s.yanlis}</td>
                        <td className="px-4 py-3 text-center text-gray-400">{s.bos}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-800">{s.net_puan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
