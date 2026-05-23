'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Kayit = {
  id: number
  tarih: string
  tur: string
  kategori: string
  tutar: number
  aciklama: string | null
  odeme_yontemi: string | null
  belge_no: string | null
}

const kategoriler = {
  kantin_geliri: 'Kantin Geliri',
  diger_gelir: 'Diğer Gelir',
  kantin_alis: 'Kantin Alışı',
  yayin_deneme: 'Yayın — Deneme',
  yayin_kirtasiye: 'Yayın — Kırtasiye',
  yayin_egitim_materyali: 'Yayın — Materyal',
  kira: 'Kira',
  elektrik_su_dogalgaz: 'Elektrik / Su / Gaz',
  bakim_onarim: 'Bakım & Onarım',
  diger_gider: 'Diğer Gider',
}

export default function GelirGiderPage() {
  const [kayitlar, setKayitlar] = useState<Kayit[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [form, setForm] = useState({
    tarih: new Date().toISOString().split('T')[0],
    tur: 'gelir',
    kategori: 'kantin_geliri',
    tutar: '',
    aciklama: '',
    odeme_yontemi: 'nakit',
    belge_no: '',
  })
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => { getir() }, [])

  async function getir() {
    const { data } = await supabase
      .from('gelir_gider')
      .select('*')
      .order('tarih', { ascending: false })
    setKayitlar(data || [])
    setYukleniyor(false)
  }

  async function kaydet() {
    if (!form.tutar || !form.kategori) { alert('Tutar ve kategori zorunludur.'); return }
    setKaydediliyor(true)
    const { error } = await supabase.from('gelir_gider').insert({
      tarih: form.tarih,
      tur: form.tur,
      kategori: form.kategori,
      tutar: parseFloat(form.tutar),
      aciklama: form.aciklama || null,
      odeme_yontemi: form.odeme_yontemi,
      belge_no: form.belge_no || null,
    })
    if (error) { alert('Hata: ' + error.message); setKaydediliyor(false); return }
    setForm(f => ({ ...f, tutar: '', aciklama: '', belge_no: '' }))
    getir()
    setKaydediliyor(false)
  }

  const set = (k: string, v: string) => {
    setForm(f => {
      const yeni = { ...f, [k]: v }
      if (k === 'tur') {
        yeni.kategori = v === 'gelir' ? 'kantin_geliri' : 'kantin_alis'
      }
      return yeni
    })
  }

  const toplamGelir = kayitlar.filter(k => k.tur === 'gelir').reduce((s, k) => s + k.tutar, 0)
  const toplamGider = kayitlar.filter(k => k.tur === 'gider').reduce((s, k) => s + k.tutar, 0)
  const net = toplamGelir - toplamGider

  const gelirKategorileri = ['kantin_geliri', 'diger_gelir']
  const giderKategorileri = ['kantin_alis', 'yayin_deneme', 'yayin_kirtasiye', 'yayin_egitim_materyali', 'kira', 'elektrik_su_dogalgaz', 'bakim_onarim', 'diger_gider']

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">

        <div className="mb-6">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Ana Sayfa</Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">Gelir / Gider</h1>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Toplam Gelir</p>
            <p className="text-2xl font-bold text-green-600 mt-1">₺{toplamGelir.toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Toplam Gider</p>
            <p className="text-2xl font-bold text-red-500 mt-1">₺{toplamGider.toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Net</p>
            <p className={`text-2xl font-bold mt-1 ${net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              ₺{net.toLocaleString('tr-TR')}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="font-semibold text-gray-700 mb-4">Yeni Kayıt Ekle</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-500">Tür</label>
              <select value={form.tur} onChange={e => set('tur', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                <option value="gelir">Gelir</option>
                <option value="gider">Gider</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-500">Kategori</label>
              <select value={form.kategori} onChange={e => set('kategori', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                {(form.tur === 'gelir' ? gelirKategorileri : giderKategorileri).map(k => (
                  <option key={k} value={k}>{kategoriler[k as keyof typeof kategoriler]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-500">Tutar (₺)</label>
              <input type="number" value={form.tutar} onChange={e => set('tutar', e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-sm text-gray-500">Tarih</label>
              <input type="date" value={form.tarih} onChange={e => set('tarih', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-sm text-gray-500">Açıklama</label>
              <input value={form.aciklama} onChange={e => set('aciklama', e.target.value)}
                placeholder="Örn: Salı günü kantin cirosu"
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
          </div>
          <button onClick={kaydet} disabled={kaydediliyor}
            className="mt-4 w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
            {kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>

        {yukleniyor ? (
          <p className="text-gray-400 text-center py-8">Yükleniyor...</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Tarih</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Tür</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Kategori</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Açıklama</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {kayitlar.map((k, i) => (
                  <tr key={k.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-gray-600">{new Date(k.tarih).toLocaleDateString('tr-TR')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${k.tur === 'gelir' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {k.tur === 'gelir' ? 'Gelir' : 'Gider'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{kategoriler[k.kategori as keyof typeof kategoriler] || k.kategori}</td>
                    <td className="px-4 py-3 text-gray-500">{k.aciklama || '-'}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${k.tur === 'gelir' ? 'text-green-600' : 'text-red-500'}`}>
                      {k.tur === 'gelir' ? '+' : '-'}₺{k.tutar.toLocaleString('tr-TR')}
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
