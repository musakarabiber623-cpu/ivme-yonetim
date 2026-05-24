'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AdminPanel from '@/components/AdminPanel'

type Taksit = {
  id: number
  odeme_plan_id: number
  taksit_no: number
  tutar: number
  vade_tarihi: string
  odeme_tarihi: string | null
  odeme_yontemi: string | null
  durum: string
  makbuz_no: string | null
  odeme_planlari: {
    odeme_turu: string
    donem: string
    toplam_ucret: number
    ogrenciler: { id: number; ad_soyad: string; sinif: number }
  }
}

export default function OdemelerPage() {
  const [taksitler, setTaksitler] = useState<Taksit[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [durum, setDurum] = useState('hepsi')
  const [arama, setArama] = useState('')
  const [yetki, setYetki] = useState(false)

  // Tahsilat
  const [tahsilId, setTahsilId] = useState<number | null>(null)
  const [tahsilTutar, setTahsilTutar] = useState('')
  const [tahsilForm, setTahsilForm] = useState({ tarih: new Date().toISOString().split('T')[0], yontem: 'nakit', makbuz: '' })
  const [tahsilYukleniyor, setTahsilYukleniyor] = useState(false)
  const [tahsilPlanId, setTahsilPlanId] = useState<number | null>(null)

  // Düzenle
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({
    tutar: '', vade_tarihi: '', durum: 'bekliyor',
    odeme_tarihi: '', odeme_yontemi: 'nakit',
  })
  const [editYukleniyor, setEditYukleniyor] = useState(false)

  useEffect(() => { getir() }, [])

  async function getir() {
    const { data } = await supabase
      .from('taksitler')
      .select('*, odeme_plan_id, odeme_planlari(odeme_turu, donem, toplam_ucret, ogrenciler(id, ad_soyad, sinif))')
      .order('vade_tarihi', { ascending: false })
    setTaksitler(data || [])
    setYukleniyor(false)
  }

  function tahsilAc(t: Taksit) {
    setTahsilId(t.id)
    setTahsilPlanId(t.odeme_plan_id)
    setTahsilTutar(String(t.tutar))
    setTahsilForm({ tarih: new Date().toISOString().split('T')[0], yontem: 'nakit', makbuz: '' })
  }

  async function tahsilEt() {
    if (!tahsilId || !tahsilPlanId) return
    const tutar = parseFloat(tahsilTutar)
    if (!tutar || tutar <= 0) { alert('Geçerli bir tutar giriniz.'); return }
    setTahsilYukleniyor(true)

    const { data: odenmemis, error: fetchErr } = await supabase
      .from('taksitler').select('id, tutar')
      .eq('odeme_plan_id', tahsilPlanId).neq('durum', 'odendi')
      .order('taksit_no', { ascending: true })

    if (fetchErr) { alert('Hata: ' + fetchErr.message); setTahsilYukleniyor(false); return }

    // Tıklanan taksit ile başla, fazla ödeme sonraki taksitlere aktarılır
    const liste = odenmemis || []
    const baslangic = liste.findIndex(t => t.id === tahsilId)
    const sira = baslangic >= 0 ? liste.slice(baslangic) : liste

    let kalan = tutar
    for (const t of sira) {
      if (kalan <= 0) break
      if (kalan >= t.tutar) {
        const { error } = await supabase.from('taksitler').update({
          durum: 'odendi', odeme_tarihi: tahsilForm.tarih,
          odeme_yontemi: tahsilForm.yontem, makbuz_no: tahsilForm.makbuz || null,
        }).eq('id', t.id)
        if (error) { alert('Hata: ' + error.message); setTahsilYukleniyor(false); return }
        kalan -= t.tutar
      } else {
        const { error } = await supabase.from('taksitler')
          .update({ tutar: Math.round(t.tutar - kalan) })
          .eq('id', t.id)
        if (error) { alert('Hata: ' + error.message); setTahsilYukleniyor(false); return }
        kalan = 0
      }
    }
    setTahsilId(null); setTahsilPlanId(null)
    await getir(); setTahsilYukleniyor(false)
  }

  function editAc(t: Taksit) {
    setEditId(t.id)
    setEditForm({
      tutar: String(t.tutar),
      vade_tarihi: t.vade_tarihi,
      durum: t.durum,
      odeme_tarihi: t.odeme_tarihi || new Date().toISOString().split('T')[0],
      odeme_yontemi: t.odeme_yontemi || 'nakit',
    })
  }

  async function editKaydet() {
    if (!editId) return
    setEditYukleniyor(true)
    const guncelleme: Record<string, unknown> = {
      tutar: parseFloat(editForm.tutar),
      vade_tarihi: editForm.vade_tarihi,
      durum: editForm.durum,
    }
    if (editForm.durum === 'odendi') {
      guncelleme.odeme_tarihi = editForm.odeme_tarihi
      guncelleme.odeme_yontemi = editForm.odeme_yontemi
    } else {
      guncelleme.odeme_tarihi = null
    }
    const { error } = await supabase.from('taksitler').update(guncelleme).eq('id', editId)
    if (error) { alert('Hata: ' + error.message); setEditYukleniyor(false); return }
    setEditId(null)
    getir(); setEditYukleniyor(false)
  }

  const bugun = new Date(); bugun.setHours(0, 0, 0, 0)
  const hesaplaDurum = (t: Taksit) => {
    if (t.durum === 'odendi') return 'odendi'
    return new Date(t.vade_tarihi) < bugun ? 'gecikti' : 'bekliyor'
  }

  const filtrelendi = taksitler.filter(t => {
    const hDurum = hesaplaDurum(t)
    const durumUygun = durum === 'hepsi' || hDurum === durum
    const adSoyad = t.odeme_planlari?.ogrenciler?.ad_soyad?.toLowerCase() || ''
    const aramaUygun = !arama || adSoyad.includes(arama.toLowerCase())
    return durumUygun && aramaUygun
  })

  const toplamBeklenen = taksitler.filter(t => t.durum !== 'odendi' && new Date(t.vade_tarihi) >= bugun).reduce((s, t) => s + t.tutar, 0)
  const toplamGeciken = taksitler.filter(t => t.durum !== 'odendi' && new Date(t.vade_tarihi) < bugun).reduce((s, t) => s + t.tutar, 0)
  const buAyTahsil = taksitler.filter(t => t.durum === 'odendi' && t.odeme_tarihi?.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, t) => s + t.tutar, 0)

  const durumRenk = (t: Taksit) => {
    const d = hesaplaDurum(t)
    if (d === 'odendi') return 'bg-green-100 text-green-700'
    if (d === 'gecikti') return 'bg-red-100 text-red-700'
    return 'bg-orange-100 text-orange-700'
  }

  const tahsilEdilen = tahsilId ? taksitler.find(t => t.id === tahsilId) : null
  const editTaksit = editId ? taksitler.find(t => t.id === editId) : null

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">

        {/* Tahsilat Modalı */}
        {tahsilId !== null && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
              <h2 className="font-semibold text-gray-800 mb-1">Tahsilat Al</h2>
              {tahsilEdilen && (
                <p className="text-sm text-gray-500 mb-4">
                  {tahsilEdilen.odeme_planlari?.ogrenciler?.ad_soyad} — {tahsilEdilen.taksit_no}. Taksit
                </p>
              )}
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-500">Tutar (₺)</label>
                  <input type="number" value={tahsilTutar} onChange={e => setTahsilTutar(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-sm text-gray-500">Ödeme Tarihi</label>
                  <input type="date" value={tahsilForm.tarih} onChange={e => setTahsilForm(f => ({ ...f, tarih: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-sm text-gray-500">Ödeme Yöntemi</label>
                  <select value={tahsilForm.yontem} onChange={e => setTahsilForm(f => ({ ...f, yontem: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                    <option value="nakit">Nakit</option>
                    <option value="kart">Kart</option>
                    <option value="havale">Havale / EFT</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Makbuz No (opsiyonel)</label>
                  <input value={tahsilForm.makbuz} onChange={e => setTahsilForm(f => ({ ...f, makbuz: e.target.value }))}
                    placeholder="—" className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={tahsilEt} disabled={tahsilYukleniyor}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  {tahsilYukleniyor ? 'Kaydediliyor...' : 'Tahsil Et'}
                </button>
                <button onClick={() => setTahsilId(null)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
                  İptal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Düzenle Modalı */}
        {editId !== null && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
              <h2 className="font-semibold text-gray-800 mb-1">Taksit Düzenle</h2>
              {editTaksit && (
                <div className="text-sm text-gray-500 mb-4 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="font-medium text-gray-700">{editTaksit.odeme_planlari?.ogrenciler?.ad_soyad}</span>
                  <span className="ml-2 text-xs">{editTaksit.odeme_planlari?.ogrenciler?.sinif}. Sınıf</span>
                  <span className="ml-2 text-xs text-gray-400">· Toplam: ₺{editTaksit.odeme_planlari?.toplam_ucret?.toLocaleString('tr-TR')}</span>
                </div>
              )}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-500">Taksit Tutarı (₺)</label>
                    <input type="number" value={editForm.tutar} onChange={e => setEditForm(f => ({ ...f, tutar: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Vade Tarihi</label>
                    <input type="date" value={editForm.vade_tarihi} onChange={e => setEditForm(f => ({ ...f, vade_tarihi: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Durum</label>
                  <select value={editForm.durum} onChange={e => setEditForm(f => ({ ...f, durum: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                    <option value="bekliyor">Bekliyor</option>
                    <option value="odendi">Ödendi</option>
                  </select>
                </div>
                {editForm.durum === 'odendi' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-gray-500">Ödeme Tarihi</label>
                      <input type="date" value={editForm.odeme_tarihi} onChange={e => setEditForm(f => ({ ...f, odeme_tarihi: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Yöntem</label>
                      <select value={editForm.odeme_yontemi} onChange={e => setEditForm(f => ({ ...f, odeme_yontemi: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                        <option value="nakit">Nakit</option>
                        <option value="kart">Kart</option>
                        <option value="havale">Havale / EFT</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={editKaydet} disabled={editYukleniyor}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {editYukleniyor ? 'Kaydediliyor...' : 'Güncelle'}
                </button>
                <button onClick={() => setEditId(null)}
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
            <h1 className="text-2xl font-bold text-gray-800 mt-1">Ödemeler & Taksitler</h1>
          </div>
          <div className="flex items-center gap-3">
            <AdminPanel onDegis={setYetki} />
            {yetki && (
              <Link href="/odemeler/yeni-plan" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                + Yeni Ödeme Planı
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Bu Ay Tahsilat</p>
            <p className="text-2xl font-bold text-green-600 mt-1">₺{Math.round(buAyTahsil).toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Bekleyen</p>
            <p className="text-2xl font-bold text-orange-500 mt-1">₺{Math.round(toplamBeklenen).toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Geciken</p>
            <p className="text-2xl font-bold text-red-500 mt-1">₺{Math.round(toplamGeciken).toLocaleString('tr-TR')}</p>
          </div>
        </div>

        <div className="flex gap-3 mb-4">
          <input type="text" placeholder="Öğrenci adına göre ara..."
            value={arama} onChange={e => setArama(e.target.value)}
            className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400" />
          <div className="flex gap-2">
            {['hepsi','bekliyor','gecikti','odendi'].map(f => (
              <button key={f} onClick={() => setDurum(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  durum === f ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}>
                {f === 'hepsi' ? 'Hepsi' : f === 'bekliyor' ? 'Bekliyor' : f === 'gecikti' ? 'Gecikti' : 'Ödendi'}
              </button>
            ))}
          </div>
        </div>

        {yukleniyor ? (
          <p className="text-gray-400 text-center py-12">Yükleniyor...</p>
        ) : filtrelendi.length === 0 ? (
          <p className="text-gray-400 text-center py-12">Kayıt bulunamadı.</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Öğrenci</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Dönem / Ücret</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Taksit</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Tutar</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Vade</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Durum</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filtrelendi.map((t, i) => (
                  <tr key={t.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3">
                      <Link href={`/ogrenciler/${t.odeme_planlari?.ogrenciler?.id}`}
                        className="font-medium text-gray-800 hover:text-blue-600">
                        {t.odeme_planlari?.ogrenciler?.ad_soyad}
                      </Link>
                      <span className="text-xs text-gray-400 ml-1">{t.odeme_planlari?.ogrenciler?.sinif}. Sınıf</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      <div>{t.odeme_planlari?.donem}</div>
                      <div className="text-gray-400">₺{Math.round(t.odeme_planlari?.toplam_ucret || 0).toLocaleString('tr-TR')}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.taksit_no}. Taksit</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">₺{Math.round(t.tutar).toLocaleString('tr-TR')}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(t.vade_tarihi).toLocaleDateString('tr-TR')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${durumRenk(t)}`}>
                        {hesaplaDurum(t) === 'odendi' ? 'Ödendi' : hesaplaDurum(t) === 'gecikti' ? 'Gecikti' : 'Bekliyor'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {t.durum !== 'odendi' && yetki && (
                          <button onClick={() => tahsilAc(t)}
                            className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-100">
                            Tahsil
                          </button>
                        )}
                        {yetki && (
                          <button onClick={() => editAc(t)}
                            className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-1 rounded-lg hover:bg-yellow-100">
                            Düzenle
                          </button>
                        )}
                        {t.durum === 'odendi' && (
                          <span className="text-xs text-gray-400">
                            {t.odeme_tarihi ? new Date(t.odeme_tarihi).toLocaleDateString('tr-TR') : ''}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
              {filtrelendi.length} kayıt
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
