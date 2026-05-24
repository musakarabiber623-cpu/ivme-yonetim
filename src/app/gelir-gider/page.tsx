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
  belge_no: string | null
  created_at: string
}

const kategoriler: Record<string, string> = {
  diger_gelir: 'Diğer Gelir',
  yayin_deneme: 'Yayın — Deneme',
  yayin_kirtasiye: 'Yayın — Kırtasiye',
  yayin_egitim_materyali: 'Yayın — Materyal',
  kira: 'Kira',
  elektrik_su_dogalgaz: 'Elektrik / Su / Gaz',
  telefon_faturasi: 'Telefon Faturası',
  bakim_onarim: 'Bakım & Onarım',
  vergi: 'Vergi',
  ssk: 'SSK / SGK',
  muhasebe: 'Muhasebe',
  temizlik: 'Temizlik',
  diger_gider: 'Diğer Gider',
}

const gelirKategorileri = ['diger_gelir']
const giderKategorileri = [
  'yayin_deneme', 'yayin_kirtasiye', 'yayin_egitim_materyali',
  'kira', 'elektrik_su_dogalgaz', 'telefon_faturasi', 'bakim_onarim',
  'vergi', 'ssk', 'muhasebe', 'temizlik', 'diger_gider',
]
const KANTIN = ['kantin_geliri', 'kantin_alis']

const bos = {
  tarih: new Date().toISOString().split('T')[0],
  tur: 'gelir', kategori: 'diger_gelir',
  tutar: '', aciklama: '', odeme_yontemi: 'nakit', belge_no: '',
}

export default function GelirGiderPage() {
  const [kayitlar, setKayitlar] = useState<Kayit[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [yetki, setYetki] = useState(false)
  const [sekme, setSekme] = useState<'gelir' | 'gider'>('gelir')

  // Yeni kayıt formu
  const [form, setForm] = useState({ ...bos })
  const [kaydediliyor, setKaydediliyor] = useState(false)

  // Düzenle
  const [duzenleId, setDuzenleId] = useState<number | null>(null)
  const [duzenleForm, setDuzenleForm] = useState({ ...bos })
  const [duzenleYukleniyor, setDuzenleYukleniyor] = useState(false)

  useEffect(() => { getir() }, [])

  async function getir() {
    const { data } = await supabase
      .from('gelir_gider').select('*')
      .not('kategori', 'in', `(${KANTIN.join(',')})`)
      .order('tarih', { ascending: false })
      .order('created_at', { ascending: false })
    setKayitlar(data || [])
    setYukleniyor(false)
  }

  const set = (k: string, v: string) =>
    setForm(f => {
      const yeni = { ...f, [k]: v }
      if (k === 'tur') yeni.kategori = v === 'gelir' ? 'diger_gelir' : 'yayin_deneme'
      return yeni
    })

  const setD = (k: string, v: string) =>
    setDuzenleForm(f => {
      const yeni = { ...f, [k]: v }
      if (k === 'tur') yeni.kategori = v === 'gelir' ? 'diger_gelir' : 'yayin_deneme'
      return yeni
    })

  async function kaydet() {
    if (!form.tutar || !form.kategori) { alert('Tutar ve kategori zorunludur.'); return }
    setKaydediliyor(true)
    const { error } = await supabase.from('gelir_gider').insert({
      tarih: form.tarih, tur: form.tur, kategori: form.kategori,
      tutar: parseFloat(form.tutar), aciklama: form.aciklama || null,
      odeme_yontemi: form.odeme_yontemi, belge_no: form.belge_no || null,
    })
    if (error) { alert('Hata: ' + error.message); setKaydediliyor(false); return }
    setForm({ ...bos })
    getir(); setKaydediliyor(false)
  }

  function duzenleAc(k: Kayit) {
    setDuzenleId(k.id)
    setDuzenleForm({
      tarih: k.tarih, tur: k.tur, kategori: k.kategori,
      tutar: String(k.tutar), aciklama: k.aciklama || '',
      odeme_yontemi: k.odeme_yontemi || 'nakit', belge_no: k.belge_no || '',
    })
  }

  async function guncelle() {
    if (!duzenleId || !duzenleForm.tutar) return
    setDuzenleYukleniyor(true)
    const { error } = await supabase.from('gelir_gider').update({
      tarih: duzenleForm.tarih, tur: duzenleForm.tur, kategori: duzenleForm.kategori,
      tutar: parseFloat(duzenleForm.tutar), aciklama: duzenleForm.aciklama || null,
      odeme_yontemi: duzenleForm.odeme_yontemi, belge_no: duzenleForm.belge_no || null,
    }).eq('id', duzenleId)
    if (error) { alert('Hata: ' + error.message); setDuzenleYukleniyor(false); return }
    setDuzenleId(null); getir(); setDuzenleYukleniyor(false)
  }

  async function sil(id: number) {
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return
    const { error } = await supabase.from('gelir_gider').delete().eq('id', id)
    if (error) { alert('Hata: ' + error.message); return }
    getir()
  }

  const gelirler = kayitlar.filter(k => k.tur === 'gelir')
  const giderler = kayitlar.filter(k => k.tur === 'gider')
  const toplamGelir = gelirler.reduce((s, k) => s + k.tutar, 0)
  const toplamGider = giderler.reduce((s, k) => s + k.tutar, 0)
  const liste = sekme === 'gelir' ? gelirler : giderler

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">

        {/* Düzenle Modalı */}
        {duzenleId !== null && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
              <h2 className="font-semibold text-gray-800 mb-4">Kaydı Düzenle</h2>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-500">Tür</label>
                    <select value={duzenleForm.tur} onChange={e => setD('tur', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                      <option value="gelir">Gelir</option>
                      <option value="gider">Gider</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Kategori</label>
                    <select value={duzenleForm.kategori} onChange={e => setD('kategori', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                      {(duzenleForm.tur === 'gelir' ? gelirKategorileri : giderKategorileri).map(k => (
                        <option key={k} value={k}>{kategoriler[k]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-500">Tutar (₺)</label>
                    <input type="number" value={duzenleForm.tutar} onChange={e => setD('tutar', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Tarih</label>
                    <input type="date" value={duzenleForm.tarih} onChange={e => setD('tarih', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Açıklama</label>
                  <input value={duzenleForm.aciklama} onChange={e => setD('aciklama', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-500">Ödeme Yöntemi</label>
                    <select value={duzenleForm.odeme_yontemi} onChange={e => setD('odeme_yontemi', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                      <option value="nakit">Nakit</option>
                      <option value="kart">Kart</option>
                      <option value="havale">Havale</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Belge No</label>
                    <input value={duzenleForm.belge_no} onChange={e => setD('belge_no', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={guncelle} disabled={duzenleYukleniyor}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {duzenleYukleniyor ? 'Kaydediliyor...' : 'Güncelle'}
                </button>
                <button onClick={() => setDuzenleId(null)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
                  İptal
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Ana Sayfa</Link>
            <h1 className="text-2xl font-bold text-gray-800 mt-1">Gelir / Gider</h1>
            <p className="text-xs text-gray-400 mt-0.5">Kurum giderleri ve diğer gelirler (kantin/banka hariç)</p>
          </div>
          <AdminPanel onDegis={setYetki} />
        </div>

        {/* Özet kartlar */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-green-100">
            <p className="text-sm text-gray-500">Toplam Gelir</p>
            <p className="text-2xl font-bold text-green-600 mt-1">₺{toplamGelir.toLocaleString('tr-TR')}</p>
            <p className="text-xs text-gray-400 mt-1">{gelirler.length} kayıt</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-red-100">
            <p className="text-sm text-gray-500">Toplam Gider</p>
            <p className="text-2xl font-bold text-red-500 mt-1">₺{toplamGider.toLocaleString('tr-TR')}</p>
            <p className="text-xs text-gray-400 mt-1">{giderler.length} kayıt</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Net</p>
            <p className={`text-2xl font-bold mt-1 ${toplamGelir - toplamGider >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              ₺{(toplamGelir - toplamGider).toLocaleString('tr-TR')}
            </p>
          </div>
        </div>

        {/* Yeni kayıt formu */}
        {yetki && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="font-semibold text-gray-700 mb-4">Yeni Kayıt Ekle</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                    <option key={k} value={k}>{kategoriler[k]}</option>
                  ))}
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
                <input value={form.aciklama} onChange={e => set('aciklama', e.target.value)} placeholder="Açıklama..."
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
        )}

        {/* Sekme seçici */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setSekme('gelir')}
            className={`px-5 py-2 rounded-lg text-sm font-medium border transition-all ${
              sekme === 'gelir' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'
            }`}>
            Gelirler ({gelirler.length})
          </button>
          <button onClick={() => setSekme('gider')}
            className={`px-5 py-2 rounded-lg text-sm font-medium border transition-all ${
              sekme === 'gider' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-200 hover:border-red-400'
            }`}>
            Giderler ({giderler.length})
          </button>
        </div>

        {/* Liste */}
        {yukleniyor ? (
          <p className="text-gray-400 text-center py-8">Yükleniyor...</p>
        ) : liste.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Kayıt bulunamadı.</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {liste.length} kayıt — Toplam:{' '}
                <span className={`font-semibold ${sekme === 'gelir' ? 'text-green-600' : 'text-red-500'}`}>
                  ₺{liste.reduce((s, k) => s + k.tutar, 0).toLocaleString('tr-TR')}
                </span>
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Tarih</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Kategori</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Açıklama</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Yöntem</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Tutar</th>
                  {yetki && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody>
                {liste.map((k, i) => (
                  <tr key={k.id} className={i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'}>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(k.tarih).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {kategoriler[k.kategori] || k.kategori}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{k.aciklama || '-'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs capitalize">{k.odeme_yontemi || '-'}</td>
                    <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${sekme === 'gelir' ? 'text-green-600' : 'text-red-500'}`}>
                      {sekme === 'gelir' ? '+' : '-'}₺{k.tutar.toLocaleString('tr-TR')}
                    </td>
                    {yetki && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => duzenleAc(k)}
                            className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-3 py-1 rounded-lg hover:bg-yellow-100">
                            Düzenle
                          </button>
                          <button onClick={() => sil(k.id)}
                            className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded-lg hover:bg-red-100">
                            Sil
                          </button>
                        </div>
                      </td>
                    )}
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
