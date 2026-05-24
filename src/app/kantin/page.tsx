'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AdminPanel from '@/components/AdminPanel'

type Kayit = {
  id: number
  tarih: string
  tur: string
  kategori: string
  tutar: number
  aciklama: string | null
  odeme_yontemi: string | null
  created_at: string
}

const kategoriYazi: Record<string, string> = {
  kantin_geliri: 'Kantin Geliri',
  kantin_alis: 'Kantin Alışı',
}

export default function KantinPage() {
  const [kayitlar, setKayitlar] = useState<Kayit[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [yetki, setYetki] = useState(false)
  const [form, setForm] = useState({
    tarih: new Date().toISOString().split('T')[0],
    tur: 'gelir',
    kategori: 'kantin_geliri',
    tutar: '',
    aciklama: '',
    odeme_yontemi: 'nakit',
  })
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => { getir() }, [])

  async function getir() {
    const { data } = await supabase
      .from('gelir_gider')
      .select('*')
      .in('kategori', ['kantin_geliri', 'kantin_alis'])
      .order('created_at', { ascending: false })
    setKayitlar(data || [])
    setYukleniyor(false)
  }

  async function kaydet() {
    if (!form.tutar) { alert('Tutar zorunludur.'); return }
    setKaydediliyor(true)
    const { error } = await supabase.from('gelir_gider').insert({
      tarih: form.tarih, tur: form.tur, kategori: form.kategori,
      tutar: parseFloat(form.tutar), aciklama: form.aciklama || null,
      odeme_yontemi: form.odeme_yontemi,
    })
    if (error) { alert('Hata: ' + error.message); setKaydediliyor(false); return }
    setForm(f => ({ ...f, tutar: '', aciklama: '' }))
    getir()
    setKaydediliyor(false)
  }

  const set = (k: string, v: string) => {
    setForm(f => {
      const yeni = { ...f, [k]: v }
      if (k === 'tur') yeni.kategori = v === 'gelir' ? 'kantin_geliri' : 'kantin_alis'
      return yeni
    })
  }

  const toplamGelir = kayitlar.filter(k => k.kategori === 'kantin_geliri').reduce((s, k) => s + k.tutar, 0)
  const toplamGider = kayitlar.filter(k => k.kategori === 'kantin_alis').reduce((s, k) => s + k.tutar, 0)

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Ana Sayfa</Link>
            <h1 className="text-2xl font-bold text-gray-800 mt-1">Kantin</h1>
          </div>
          <AdminPanel onDegis={setYetki} />
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Kantin Geliri</p>
            <p className="text-2xl font-bold text-green-600 mt-1">₺{toplamGelir.toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Kantin Alışı</p>
            <p className="text-2xl font-bold text-red-500 mt-1">₺{toplamGider.toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Net</p>
            <p className={`text-2xl font-bold mt-1 ${toplamGelir - toplamGider >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              ₺{(toplamGelir - toplamGider).toLocaleString('tr-TR')}
            </p>
          </div>
        </div>

        {yetki ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="font-semibold text-gray-700 mb-4">Yeni Kayıt Ekle</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Tür</label>
                <select value={form.tur} onChange={e => set('tur', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                  <option value="gelir">Kantin Geliri</option>
                  <option value="gider">Kantin Alışı</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-500">Tutar (₺)</label>
                <input type="number" value={form.tutar} onChange={e => set('tutar', e.target.value)} placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-sm text-gray-500">Tarih</label>
                <input type="date" value={form.tarih} onChange={e => set('tarih', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-sm text-gray-500">Ödeme Yöntemi</label>
                <select value={form.odeme_yontemi} onChange={e => set('odeme_yontemi', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                  <option value="nakit">Nakit</option>
                  <option value="kart">Kart</option>
                  <option value="havale">Havale</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-sm text-gray-500">Açıklama</label>
                <input value={form.aciklama} onChange={e => set('aciklama', e.target.value)} placeholder="Örn: Salı günü kantin cirosu"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            </div>
            <button onClick={kaydet} disabled={kaydediliyor}
              className="mt-4 w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
              {kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6 flex items-center justify-between">
            <p className="text-sm text-gray-400">🔒 Kayıt eklemek için yönetici girişi gereklidir</p>
          </div>
        )}

        {yukleniyor ? (
          <p className="text-gray-400 text-center py-8">Yükleniyor...</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-400">
              Toplam {kayitlar.length} kayıt — kayıt tarihine göre sıralı
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Kayıt Tarihi</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">İşlem Tarihi</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Kategori</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Açıklama</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {kayitlar.map((k, i) => (
                  <tr key={k.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(k.created_at).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(k.tarih).toLocaleDateString('tr-TR')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${k.kategori === 'kantin_geliri' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {kategoriYazi[k.kategori]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{k.aciklama || '-'}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${k.kategori === 'kantin_geliri' ? 'text-green-600' : 'text-red-500'}`}>
                      {k.kategori === 'kantin_geliri' ? '+' : '-'}₺{k.tutar.toLocaleString('tr-TR')}
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
