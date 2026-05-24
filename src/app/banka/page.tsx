'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AdminPanel from '@/components/AdminPanel'

type Hareket = {
  id: number
  tarih: string
  tur: string
  tutar: number
  aciklama: string | null
  created_at: string
}

export default function BankaPage() {
  const [hareketler, setHareketler] = useState<Hareket[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [yetki, setYetki] = useState(false)
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
      .order('created_at', { ascending: false })
    if (error) setHata('Tablo bulunamadı.')
    setHareketler(data || [])
    setYukleniyor(false)
  }

  async function kaydet() {
    if (!form.tutar) { alert('Tutar zorunludur.'); return }
    setKaydediliyor(true)
    const { error } = await supabase.from('banka_hareketleri').insert({
      tarih: form.tarih, tur: form.tur,
      tutar: parseFloat(form.tutar), aciklama: form.aciklama || null,
    })
    if (error) { alert('Hata: ' + error.message); setKaydediliyor(false); return }
    setForm(f => ({ ...f, tutar: '', aciklama: '' }))
    getir()
    setKaydediliyor(false)
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const toplamGelir = hareketler.filter(h => h.tur === 'gelir').reduce((s, h) => s + h.tutar, 0)
  const toplamGider = hareketler.filter(h => h.tur === 'gider').reduce((s, h) => s + h.tutar, 0)

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Ana Sayfa</Link>
            <h1 className="text-2xl font-bold text-gray-800 mt-1">Banka</h1>
          </div>
          <AdminPanel onDegis={setYetki} />
        </div>

        {hata && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-700 text-sm">{hata}</p>
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
            <p className={`text-2xl font-bold mt-1 ${toplamGelir - toplamGider >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              ₺{(toplamGelir - toplamGider).toLocaleString('tr-TR')}
            </p>
          </div>
        </div>

        {yetki ? (
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
                <input type="number" value={form.tutar} onChange={e => set('tutar', e.target.value)} placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-sm text-gray-500">Tarih</label>
                <input type="date" value={form.tarih} onChange={e => set('tarih', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-sm text-gray-500">Açıklama</label>
                <input value={form.aciklama} onChange={e => set('aciklama', e.target.value)} placeholder="Örn: Kira ödemesi, faiz geliri..."
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
        ) : hareketler.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Henüz kayıt yok.</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-400">
              Toplam {hareketler.length} kayıt — kayıt tarihine göre sıralı
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Kayıt Tarihi</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">İşlem Tarihi</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Tür</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Açıklama</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {hareketler.map((h, i) => (
                  <tr key={h.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(h.created_at).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</td>
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
