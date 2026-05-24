'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AdminPanel from '@/components/AdminPanel'

type Personel = {
  id: number
  ad_soyad: string
  personel_tipi: string
  telefon: string | null
  aktif: boolean
  baslangic_tarihi: string
  notlar: string | null
}

type Odeme = {
  id: number
  personel_id: number
  donem: string
  odeme_turu: string
  brut_tutar: number
  sgk_isci: number | null
  sgk_isveren: number | null
  net_tutar: number
  ek_ders_saati: number | null
  odeme_tarihi: string | null
}

const tipYazi: Record<string, string> = {
  meb_ogretmen: 'MEB Öğretmeni',
  aylik_ogretmen: 'Aylık Öğretmen',
  mudur: 'Müdür',
  yardimci_personel: 'Yardımcı Personel',
}

const tipRenk: Record<string, string> = {
  meb_ogretmen: 'bg-blue-100 text-blue-700',
  aylik_ogretmen: 'bg-purple-100 text-purple-700',
  mudur: 'bg-amber-100 text-amber-700',
  yardimci_personel: 'bg-gray-100 text-gray-700',
}

export default function PersonelPage() {
  const [personeller, setPersoneller] = useState<Personel[]>([])
  const [odemeler, setOdemeler] = useState<Odeme[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [sekme, setSekme] = useState<'liste' | 'odeme' | 'yeni'>('liste')

  const [pForm, setPForm] = useState({
    ad_soyad: '', personel_tipi: 'meb_ogretmen', telefon: '', baslangic_tarihi: new Date().toISOString().split('T')[0], notlar: ''
  })
  const [oForm, setOForm] = useState({
    personel_id: '', donem: new Date().toISOString().slice(0, 7),
    odeme_turu: 'maas', brut_tutar: '', sgk_isci: '', sgk_isveren: '',
    net_tutar: '', ek_ders_saati: '', odeme_tarihi: new Date().toISOString().split('T')[0]
  })
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [yetki, setYetki] = useState(false)

  const [duzenleId, setDuzenleId] = useState<number | null>(null)
  const [duzenleForm, setDuzenleForm] = useState({
    ad_soyad: '', personel_tipi: 'meb_ogretmen', telefon: '', baslangic_tarihi: '', notlar: ''
  })
  const [islem, setIslem] = useState(false)

  useEffect(() => { getir() }, [])

  async function getir() {
    const [p, o] = await Promise.all([
      supabase.from('personel').select('*').order('ad_soyad'),
      supabase.from('personel_odemeler').select('*').order('donem', { ascending: false })
    ])
    setPersoneller(p.data || [])
    setOdemeler(o.data || [])
    setYukleniyor(false)
  }

  async function personelKaydet() {
    if (!pForm.ad_soyad) { alert('Ad soyad zorunludur.'); return }
    setKaydediliyor(true)
    const { error } = await supabase.from('personel').insert({
      ad_soyad: pForm.ad_soyad, personel_tipi: pForm.personel_tipi,
      telefon: pForm.telefon || null, baslangic_tarihi: pForm.baslangic_tarihi, notlar: pForm.notlar || null
    })
    if (error) { alert('Hata: ' + error.message); setKaydediliyor(false); return }
    setPForm({ ad_soyad: '', personel_tipi: 'meb_ogretmen', telefon: '', baslangic_tarihi: new Date().toISOString().split('T')[0], notlar: '' })
    getir()
    setSekme('liste')
    setKaydediliyor(false)
  }

  async function odemeKaydet() {
    if (!oForm.personel_id || !oForm.brut_tutar || !oForm.net_tutar) { alert('Personel, brüt ve net tutar zorunludur.'); return }
    setKaydediliyor(true)
    const { error } = await supabase.from('personel_odemeler').insert({
      personel_id: parseInt(oForm.personel_id), donem: oForm.donem, odeme_turu: oForm.odeme_turu,
      brut_tutar: parseFloat(oForm.brut_tutar),
      sgk_isci: oForm.sgk_isci ? parseFloat(oForm.sgk_isci) : null,
      sgk_isveren: oForm.sgk_isveren ? parseFloat(oForm.sgk_isveren) : null,
      net_tutar: parseFloat(oForm.net_tutar),
      ek_ders_saati: oForm.ek_ders_saati ? parseInt(oForm.ek_ders_saati) : null,
      odeme_tarihi: oForm.odeme_tarihi || null,
    })
    if (error) { alert('Hata: ' + error.message); setKaydediliyor(false); return }
    setOForm(f => ({ ...f, brut_tutar: '', sgk_isci: '', sgk_isveren: '', net_tutar: '', ek_ders_saati: '' }))
    getir()
    setKaydediliyor(false)
  }

  function duzenleAc(p: Personel) {
    setDuzenleId(p.id)
    setDuzenleForm({
      ad_soyad: p.ad_soyad,
      personel_tipi: p.personel_tipi,
      telefon: p.telefon || '',
      baslangic_tarihi: p.baslangic_tarihi,
      notlar: p.notlar || '',
    })
  }

  async function guncelle() {
    if (!duzenleForm.ad_soyad) return
    setIslem(true)
    const { error } = await supabase.from('personel').update({
      ad_soyad: duzenleForm.ad_soyad,
      personel_tipi: duzenleForm.personel_tipi,
      telefon: duzenleForm.telefon || null,
      baslangic_tarihi: duzenleForm.baslangic_tarihi,
      notlar: duzenleForm.notlar || null,
    }).eq('id', duzenleId)
    if (error) { alert('Hata: ' + error.message); setIslem(false); return }
    setDuzenleId(null)
    getir()
    setIslem(false)
  }

  async function sil(id: number, ad: string) {
    if (!confirm(`${ad} adlı personeli silmek istediğinize emin misiniz?`)) return
    const { error } = await supabase.from('personel').update({ aktif: false }).eq('id', id)
    if (error) { alert('Hata: ' + error.message); return }
    getir()
  }

  const setP = (k: string, v: string) => setPForm(f => ({ ...f, [k]: v }))
  const setO = (k: string, v: string) => setOForm(f => ({ ...f, [k]: v }))
  const setD = (k: string, v: string) => setDuzenleForm(f => ({ ...f, [k]: v }))

  const buAyGider = odemeler.filter(o => o.donem === new Date().toISOString().slice(0, 7))
    .reduce((s, o) => s + o.brut_tutar + (o.sgk_isveren || 0), 0)

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">

        {duzenleId !== null && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
              <h2 className="font-semibold text-gray-800 mb-4">Personel Düzenle</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-500">Ad Soyad</label>
                  <input value={duzenleForm.ad_soyad} onChange={e => setD('ad_soyad', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-500">Personel Tipi</label>
                    <select value={duzenleForm.personel_tipi} onChange={e => setD('personel_tipi', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                      <option value="meb_ogretmen">MEB Öğretmeni</option>
                      <option value="aylik_ogretmen">Aylık Öğretmen</option>
                      <option value="mudur">Müdür</option>
                      <option value="yardimci_personel">Yardımcı Personel</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Telefon</label>
                    <input value={duzenleForm.telefon} onChange={e => setD('telefon', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Başlangıç Tarihi</label>
                  <input type="date" value={duzenleForm.baslangic_tarihi} onChange={e => setD('baslangic_tarihi', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-sm text-gray-500">Notlar</label>
                  <input value={duzenleForm.notlar} onChange={e => setD('notlar', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={guncelle} disabled={islem}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {islem ? 'Kaydediliyor...' : 'Güncelle'}
                </button>
                <button onClick={() => setDuzenleId(null)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
                  İptal
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Ana Sayfa</Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">Personel</h1>
        </div>
        <AdminPanel onDegis={setYetki} />

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6 inline-block">
          <p className="text-sm text-gray-500">Bu Ay Personel Gideri</p>
          <p className="text-2xl font-bold text-red-500 mt-1">₺{buAyGider.toLocaleString('tr-TR')}</p>
        </div>

        <div className="flex gap-2 mb-6">
          {(yetki ? ['liste', 'odeme', 'yeni'] : ['liste'] as const).map(s => (
            <button key={s} onClick={() => setSekme(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                sekme === s ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}>
              {s === 'liste' ? 'Personel Listesi' : s === 'odeme' ? 'Ödeme Ekle' : '+ Yeni Personel'}
            </button>
          ))}
        </div>

        {yukleniyor ? <p className="text-gray-400 text-center py-12">Yükleniyor...</p> : (
          <>
            {sekme === 'liste' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Ad Soyad</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Tip</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Telefon</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Başlangıç</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {personeller.filter(p => p.aktif).map((p, i) => (
                      <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 font-medium text-gray-800">{p.ad_soyad}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${tipRenk[p.personel_tipi]}`}>
                            {tipYazi[p.personel_tipi]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{p.telefon || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">{new Date(p.baslangic_tarihi).toLocaleDateString('tr-TR')}</td>
                        <td className="px-4 py-3">
                          {yetki && (
                            <div className="flex gap-2">
                              <button onClick={() => duzenleAc(p)}
                                className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-3 py-1 rounded-lg hover:bg-yellow-100">
                                Düzenle
                              </button>
                              <button onClick={() => sil(p.id, p.ad_soyad)}
                                className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded-lg hover:bg-red-100">
                                Sil
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {sekme === 'odeme' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-700 mb-4">Ödeme Kaydı Ekle</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Personel *</label>
                    <select value={oForm.personel_id} onChange={e => setO('personel_id', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                      <option value="">Seçin...</option>
                      {personeller.map(p => <option key={p.id} value={p.id}>{p.ad_soyad}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Dönem</label>
                    <input type="month" value={oForm.donem} onChange={e => setO('donem', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Ödeme Türü</label>
                    <select value={oForm.odeme_turu} onChange={e => setO('odeme_turu', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                      <option value="maas">Maaş</option>
                      <option value="ek_ders">Ek Ders</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Brüt Tutar (₺) *</label>
                    <input type="number" value={oForm.brut_tutar} onChange={e => setO('brut_tutar', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">SGK İşçi Payı (₺)</label>
                    <input type="number" value={oForm.sgk_isci} onChange={e => setO('sgk_isci', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">SGK İşveren Payı (₺)</label>
                    <input type="number" value={oForm.sgk_isveren} onChange={e => setO('sgk_isveren', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Net Tutar (₺) *</label>
                    <input type="number" value={oForm.net_tutar} onChange={e => setO('net_tutar', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Ek Ders Saati</label>
                    <input type="number" value={oForm.ek_ders_saati} onChange={e => setO('ek_ders_saati', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
                <button onClick={odemeKaydet} disabled={kaydediliyor}
                  className="mt-4 w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {kaydediliyor ? 'Kaydediliyor...' : 'Ödeme Kaydet'}
                </button>
              </div>
            )}

            {sekme === 'yeni' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-700 mb-4">Yeni Personel Ekle</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-sm text-gray-500">Ad Soyad *</label>
                    <input value={pForm.ad_soyad} onChange={e => setP('ad_soyad', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Personel Tipi</label>
                    <select value={pForm.personel_tipi} onChange={e => setP('personel_tipi', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                      <option value="meb_ogretmen">MEB Öğretmeni</option>
                      <option value="aylik_ogretmen">Aylık Öğretmen</option>
                      <option value="mudur">Müdür</option>
                      <option value="yardimci_personel">Yardımcı Personel</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Telefon</label>
                    <input value={pForm.telefon} onChange={e => setP('telefon', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Başlangıç Tarihi</label>
                    <input type="date" value={pForm.baslangic_tarihi} onChange={e => setP('baslangic_tarihi', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Notlar</label>
                    <input value={pForm.notlar} onChange={e => setP('notlar', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
                <button onClick={personelKaydet} disabled={kaydediliyor}
                  className="mt-4 w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {kaydediliyor ? 'Kaydediliyor...' : 'Personeli Kaydet'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
