'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Hareket = {
  id: number
  tarih: string
  tur: string
  tutar: number
  aciklama: string | null
}

export default function BankaPage() {
  const [hareketler, setHareketler] = useState<Hareket[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [form, setForm] = useState({
    tarih: new Date().toISOString().split('T')[0],
    tur: 'gelir',
    tutar: '',
    aciklama: '',
  })
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [hata, setHata] = useState('')

  useEffect(() => { getir() }, [])

  async function getir() {
    const { data, error } = await supabase
      .from('banka_hareketleri')
      .select('*')
      .order('tarih', { ascending: false })
    if (error) {
      setHata('Tablo bulunamadı. Lütfen Supabase\'de banka_hareketleri tablosunu oluşturun.')
    }
    setHareketler(data || [])
    setYukleniyor(false)
  }

  async function kaydet() {
    if (!form.tutar) { alert('Tutar zorunludur.'); return }
    setKaydediliyor(true)
    const { error } = await supabase.from('banka_hareketleri').insert({
      tarih: form.tarih,
      tur: form.tur,
      tutar: parseFloat(form.tutar),
      aciklama: form.aciklama || null,
    })
    if (error) { alert('Hata: ' + error.message); setKaydediliyor(false); return }
    setForm(f => ({ ...f, tutar: '', aciklama: '' }))
    getir()
    setKaydediliyor(false)
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const toplamGelir = hareketler.filter(h => h.tur === 'gelir').reduce((s, h) => s + h.tutar, 0)
  const toplamGider = hareketler.filter(h => h.tur === 'gider').reduce((s, h) => s + h.tutar, 0)
  const net = toplamGelir - toplamGider

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">

        <div className="mb-6">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Ana Sayfa</Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">Banka</h1>
        </div>

        {hata && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-700 text-sm font-medium">{hata}</p>
            <p className="text-red-600 text-xs mt-2">Supabase SQL Editöründe şu komutu çalıştırın:</p>
            <pre className="text-xs bg-red-100 rounded p-2 mt-1 overflow-x-auto">
{`create table banka_hareketleri (
  id serial primary key,
  tarih date not null default current_date,
  tur text not null check (tur in ('gelir', 'gider')),
  tutar numeric(10,2) not null,
  aciklama text,
  created_at timestamptz default now()
);`}
            </pre>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Banka Geliri</p>
            <p className="text-2xl font-bold text-green-600 mt-1">₺{toplamGelir.toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Banka Gideri</p>
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
          <h2 className="font-semibold text-gray-700 mb-4">Yeni Hareket Ekle</h2>
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
                placeholder="Örn: Kira ödemesi, faiz geliri..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>
          <button onClick={kaydet} disabled={kaydediliyor}
            className="mt-4 w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
            {kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>

        {yukleniyor ? (
          <p className="text-gray-400 text-center py-8">Yükleniyor...</p>
        ) : hareketler.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Henüz kayıt yok.</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Tarih</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Tür</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Açıklama</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {hareketler.map((h, i) => (
                  <tr key={h.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-gray-600">{new Date(h.tarih).toLocaleDateString('tr-TR')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${h.tur === 'gelir' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {h.tur === 'gelir' ? 'Gelir' : 'Gider'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{h.aciklama || '-'}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${h.tur === 'gelir' ? 'text-green-600' : 'text-red-500'}`}>
                      {h.tur === 'gelir' ? '+' : '-'}₺{h.tutar.toLocaleString('tr-TR')}
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
