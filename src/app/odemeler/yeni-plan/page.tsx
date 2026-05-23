'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Ogrenci = { id: number; ad_soyad: string; sinif: number }

export default function YeniPlanPage() {
  const router = useRouter()
  const [ogrenciler, setOgrenciler] = useState<Ogrenci[]>([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [form, setForm] = useState({
    ogrenci_id: '',
    odeme_turu: 'kurs_taksitli',
    toplam_ucret: '',
    taksit_sayisi: '1',
    donem: '2024-2025',
    baslangic_tarihi: new Date().toISOString().split('T')[0],
    notlar: '',
  })

  useEffect(() => {
    supabase.from('ogrenciler').select('id, ad_soyad, sinif').eq('aktif', true).order('ad_soyad')
      .then(({ data }) => setOgrenciler(data || []))
  }, [])

  async function kaydet() {
    if (!form.ogrenci_id || !form.toplam_ucret) {
      alert('Öğrenci ve toplam ücret zorunludur.')
      return
    }
    setYukleniyor(true)

    const { data: plan, error: planHata } = await supabase
      .from('odeme_planlari')
      .insert({
        ogrenci_id: parseInt(form.ogrenci_id),
        odeme_turu: form.odeme_turu,
        toplam_ucret: parseFloat(form.toplam_ucret),
        donem: form.donem,
        baslangic_tarihi: form.baslangic_tarihi,
        notlar: form.notlar,
      })
      .select().single()

    if (planHata) { alert('Plan kaydedilemedi: ' + planHata.message); setYukleniyor(false); return }

    const taksitSayisi = parseInt(form.taksit_sayisi)
    const taksitTutari = parseFloat(form.toplam_ucret) / taksitSayisi
    const taksitler = []

    for (let i = 0; i < taksitSayisi; i++) {
      const vade = new Date(form.baslangic_tarihi)
      vade.setMonth(vade.getMonth() + i)
      taksitler.push({
        odeme_plan_id: plan.id,
        taksit_no: i + 1,
        tutar: Math.round(taksitTutari * 100) / 100,
        vade_tarihi: vade.toISOString().split('T')[0],
        durum: 'bekliyor',
      })
    }

    const { error: taksitHata } = await supabase.from('taksitler').insert(taksitler)
    if (taksitHata) { alert('Taksitler kaydedilemedi: ' + taksitHata.message); setYukleniyor(false); return }

    router.push('/odemeler')
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const taksitTutari = form.toplam_ucret && form.taksit_sayisi
    ? (parseFloat(form.toplam_ucret) / parseInt(form.taksit_sayisi)).toFixed(2)
    : '0'

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/odemeler" className="text-sm text-gray-400 hover:text-gray-600">← Ödemeler</Link>
        <h1 className="text-2xl font-bold text-gray-800 mt-1 mb-6">Yeni Ödeme Planı</h1>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500">Öğrenci *</label>
              <select value={form.ogrenci_id} onChange={e => set('ogrenci_id', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                <option value="">Öğrenci seçin...</option>
                {ogrenciler.map(o => (
                  <option key={o.id} value={o.id}>{o.ad_soyad} — {o.sinif}. Sınıf</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-500">Ödeme Türü *</label>
              <select value={form.odeme_turu} onChange={e => set('odeme_turu', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                <option value="kurs_taksitli">Kurs — Taksitli</option>
                <option value="kurs_pesin">Kurs — Peşin</option>
                <option value="deneme_paket">Deneme Kulübü — Paket</option>
                <option value="deneme_tekil">Deneme Kulübü — Tekil</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Toplam Ücret (₺) *</label>
                <input type="number" value={form.toplam_ucret} onChange={e => set('toplam_ucret', e.target.value)}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-sm text-gray-500">Taksit Sayısı</label>
                <select value={form.taksit_sayisi} onChange={e => set('taksit_sayisi', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                    <option key={n} value={n}>{n} Taksit</option>
                  ))}
                </select>
              </div>
            </div>

            {form.toplam_ucret && (
              <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-700">
                Her taksit: <strong>₺{parseFloat(taksitTutari).toLocaleString('tr-TR')}</strong>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Dönem</label>
                <input value={form.donem} onChange={e => set('donem', e.target.value)}
                  placeholder="2024-2025"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-sm text-gray-500">İlk Taksit Tarihi</label>
                <input type="date" value={form.baslangic_tarihi} onChange={e => set('baslangic_tarihi', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500">Notlar</label>
              <textarea value={form.notlar} onChange={e => set('notlar', e.target.value)} rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>
        </div>

        <button onClick={kaydet} disabled={yukleniyor}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
          {yukleniyor ? 'Kaydediliyor...' : 'Ödeme Planını Oluştur'}
        </button>
      </div>
    </main>
  )
}
