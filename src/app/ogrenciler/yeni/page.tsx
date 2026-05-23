'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function YeniOgrenciPage() {
  const router = useRouter()
  const [yukleniyor, setYukleniyor] = useState(false)
  const [form, setForm] = useState({
    ad_soyad: '',
    sinif: '5',
    ogrenci_tipi: 'kurs',
    kayit_tarihi: new Date().toISOString().split('T')[0],
    notlar: '',
    veli_ad_soyad: '',
    veli_telefon: '',
    veli_telefon_2: '',
    veli_email: '',
  })

  async function kaydet() {
    if (!form.ad_soyad || !form.veli_ad_soyad || !form.veli_telefon) {
      alert('Öğrenci adı, veli adı ve veli telefonu zorunludur.')
      return
    }
    setYukleniyor(true)

    const { data: veli, error: veliHata } = await supabase
      .from('veliler')
      .insert({ ad_soyad: form.veli_ad_soyad, telefon: form.veli_telefon, telefon_2: form.veli_telefon_2, email: form.veli_email })
      .select()
      .single()

    if (veliHata) { alert('Veli kaydedilemedi: ' + veliHata.message); setYukleniyor(false); return }

    const { error: ogrHata } = await supabase
      .from('ogrenciler')
      .insert({
        ad_soyad: form.ad_soyad,
        sinif: parseInt(form.sinif),
        ogrenci_tipi: form.ogrenci_tipi,
        kayit_tarihi: form.kayit_tarihi,
        notlar: form.notlar,
        veli_id: veli.id,
      })

    if (ogrHata) { alert('Öğrenci kaydedilemedi: ' + ogrHata.message); setYukleniyor(false); return }

    router.push('/ogrenciler')
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/ogrenciler" className="text-sm text-gray-400 hover:text-gray-600">← Öğrenciler</Link>
        <h1 className="text-2xl font-bold text-gray-800 mt-1 mb-6">Yeni Öğrenci Kaydı</h1>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
          <h2 className="font-semibold text-gray-700 mb-4">Öğrenci Bilgileri</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500">Ad Soyad *</label>
              <input value={form.ad_soyad} onChange={e => set('ad_soyad', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Sınıf *</label>
                <select value={form.sinif} onChange={e => set('sinif', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                  {[2,3,4,5,6,7,8].map(s => <option key={s} value={s}>{s}. Sınıf</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-500">Öğrenci Tipi *</label>
                <select value={form.ogrenci_tipi} onChange={e => set('ogrenci_tipi', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                  <option value="kurs">Kurs Öğrencisi</option>
                  <option value="deneme_kulubu">Deneme Kulübü</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-500">Kayıt Tarihi</label>
              <input type="date" value={form.kayit_tarihi} onChange={e => set('kayit_tarihi', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-sm text-gray-500">Notlar</label>
              <textarea value={form.notlar} onChange={e => set('notlar', e.target.value)} rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="font-semibold text-gray-700 mb-4">Veli Bilgileri</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500">Veli Ad Soyad *</label>
              <input value={form.veli_ad_soyad} onChange={e => set('veli_ad_soyad', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Telefon *</label>
                <input value={form.veli_telefon} onChange={e => set('veli_telefon', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-sm text-gray-500">Telefon 2</label>
                <input value={form.veli_telefon_2} onChange={e => set('veli_telefon_2', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-500">E-posta</label>
              <input value={form.veli_email} onChange={e => set('veli_email', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>
        </div>

        <button onClick={kaydet} disabled={yukleniyor}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
          {yukleniyor ? 'Kaydediliyor...' : 'Öğrenciyi Kaydet'}
        </button>
      </div>
    </main>
  )
}
