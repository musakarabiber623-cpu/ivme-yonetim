'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AdminPanel from '@/components/AdminPanel'

export default function YeniOgrenciPage() {
  const router = useRouter()
  const [yukleniyor, setYukleniyor] = useState(false)
  const [yetki, setYetki] = useState(false)
  const buYil = new Date().getFullYear()
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
  const [planForm, setPlanForm] = useState({
    aktif: true,
    odeme_turu: 'kurs_taksitli',
    toplam_ucret: '',
    taksit_sayisi: '3',
    donem: `${buYil}-${buYil + 1}`,
    baslangic_tarihi: new Date().toISOString().split('T')[0],
    odeme_tarihi: new Date().toISOString().split('T')[0],
  })

  const pesin = planForm.odeme_turu === 'kurs_pesin' || planForm.odeme_turu === 'deneme_tekil'

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

    const { data: ogrenci, error: ogrHata } = await supabase
      .from('ogrenciler')
      .insert({
        ad_soyad: form.ad_soyad,
        sinif: parseInt(form.sinif),
        ogrenci_tipi: form.ogrenci_tipi,
        kayit_tarihi: form.kayit_tarihi,
        notlar: form.notlar,
        veli_id: veli.id,
      })
      .select()
      .single()

    if (ogrHata) { alert('Öğrenci kaydedilemedi: ' + ogrHata.message); setYukleniyor(false); return }

    if (planForm.aktif && planForm.toplam_ucret) {
      const taksitSayisi = pesin ? 1 : parseInt(planForm.taksit_sayisi)
      const taksitTutari = parseFloat(planForm.toplam_ucret) / taksitSayisi

      const { data: plan, error: planHata } = await supabase
        .from('odeme_planlari')
        .insert({
          ogrenci_id: ogrenci.id,
          odeme_turu: planForm.odeme_turu,
          toplam_ucret: parseFloat(planForm.toplam_ucret),
          donem: planForm.donem,
          baslangic_tarihi: pesin ? planForm.odeme_tarihi : planForm.baslangic_tarihi,
        })
        .select()
        .single()

      if (planHata) { alert('Ödeme planı kaydedilemedi: ' + planHata.message); setYukleniyor(false); return }

      const taksitler = []
      for (let i = 0; i < taksitSayisi; i++) {
        let vadeTarihi: string
        if (pesin) {
          vadeTarihi = planForm.odeme_tarihi
        } else {
          const vade = new Date(planForm.baslangic_tarihi)
          vade.setMonth(vade.getMonth() + i)
          vadeTarihi = vade.toISOString().split('T')[0]
        }
        taksitler.push({
          odeme_plan_id: plan.id,
          taksit_no: i + 1,
          tutar: Math.round(taksitTutari * 100) / 100,
          vade_tarihi: vadeTarihi,
          durum: 'bekliyor',
        })
      }

      const { error: taksitHata } = await supabase.from('taksitler').insert(taksitler)
      if (taksitHata) { alert('Taksitler kaydedilemedi: ' + taksitHata.message); setYukleniyor(false); return }
    }

    router.push('/ogrenciler')
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const setP = (k: string, v: string) => setPlanForm(f => ({ ...f, [k]: v }))

  const taksitTutari = planForm.toplam_ucret && planForm.taksit_sayisi && !pesin
    ? (parseFloat(planForm.toplam_ucret) / parseInt(planForm.taksit_sayisi)).toFixed(2)
    : null

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <Link href="/ogrenciler" className="text-sm text-gray-400 hover:text-gray-600">← Öğrenciler</Link>
          <AdminPanel onDegis={setYetki} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mt-1 mb-6">Yeni Öğrenci Kaydı</h1>

        {!yetki ? (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
            <p className="text-4xl mb-3">🔒</p>
            <p className="text-gray-500 text-sm">Yeni öğrenci eklemek için yönetici girişi gereklidir.</p>
          </div>
        ) : (<>

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

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700">Ödeme Planı</h2>
            <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
              <input type="checkbox" checked={planForm.aktif}
                onChange={e => setPlanForm(f => ({ ...f, aktif: e.target.checked }))}
                className="w-4 h-4" />
              Ödeme planı oluştur
            </label>
          </div>
          {planForm.aktif && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Ödeme Türü</label>
                  <select value={planForm.odeme_turu} onChange={e => setP('odeme_turu', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                    <option value="kurs_taksitli">Kurs — Taksitli</option>
                    <option value="kurs_pesin">Kurs — Peşin</option>
                    <option value="deneme_paket">Deneme Kulübü — Paket</option>
                    <option value="deneme_tekil">Deneme Kulübü — Tekil</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Dönem</label>
                  <input value={planForm.donem} onChange={e => setP('donem', e.target.value)}
                    placeholder="2024-2025"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Toplam Ücret (₺)</label>
                  <input type="number" value={planForm.toplam_ucret} onChange={e => setP('toplam_ucret', e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                {!pesin && (
                  <div>
                    <label className="text-sm text-gray-500">Taksit Sayısı</label>
                    <select value={planForm.taksit_sayisi} onChange={e => setP('taksit_sayisi', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                        <option key={n} value={n}>{n} Taksit</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              {taksitTutari && (
                <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-700">
                  Her taksit: <strong>₺{parseFloat(taksitTutari).toLocaleString('tr-TR')}</strong>
                </div>
              )}
              <div>
                <label className="text-sm text-gray-500">
                  {pesin ? 'Ödeme Tarihi' : 'İlk Taksit Tarihi'}
                </label>
                <input type="date"
                  value={pesin ? planForm.odeme_tarihi : planForm.baslangic_tarihi}
                  onChange={e => setP(pesin ? 'odeme_tarihi' : 'baslangic_tarihi', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            </div>
          )}
        </div>

        <button onClick={kaydet} disabled={yukleniyor}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
          {yukleniyor ? 'Kaydediliyor...' : 'Öğrenciyi Kaydet'}
        </button>
        </>)}
      </div>
    </main>
  )
}
