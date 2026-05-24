'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type GecikisSatiri = {
  id: number
  tutar: number
  vade_tarihi: string
  ogrenci_adi: string
  veli_adi: string
  telefon: string | null
}

type Sinav = {
  id: number
  sinav_adi: string
  sinav_tarihi: string
}

type SinavSonucSatiri = {
  id: number
  net_puan: number | null
  ogrenci_adi: string
  veli_adi: string
  telefon: string | null
}

type GonderimSonucu = {
  basarili: number
  basarisiz: number
  hatalar: string[]
}

// 3 iş günü öncesinin tarihini döner (hafta sonu dahil değil)
function ucIsGunuOnce(): string {
  const date = new Date()
  let count = 0
  while (count < 3) {
    date.setDate(date.getDate() - 1)
    const gun = date.getDay()
    if (gun !== 0 && gun !== 6) count++
  }
  return date.toISOString().split('T')[0]
}

async function smsSend(telefon: string, mesaj: string): Promise<{ ok: boolean; hata?: string }> {
  const res = await fetch('/api/sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telefon, mesaj }),
  })
  const data = await res.json()
  if (data.success) return { ok: true }
  return { ok: false, hata: data.error }
}

export default function SmsPage() {
  const [sekme, setSekme] = useState<'gecikis' | 'sinav' | 'genel'>('gecikis')

  // ── Gecikmiş Taksit sekmesi ──
  const [gecikisler, setGecikisler] = useState<GecikisSatiri[]>([])
  const [gecikisYukleniyor, setGecikisYukleniyor] = useState(true)
  const [seciliGecikmisler, setSeciliGecikmisler] = useState<Set<number>>(new Set())
  const [gecikisGonderiliyor, setGecikisGonderiliyor] = useState(false)
  const [gecikisSonuc, setGecikisSonuc] = useState<GonderimSonucu | null>(null)

  // ── Sınav Sonucu sekmesi ──
  const [sinavlar, setSinavlar] = useState<Sinav[]>([])
  const [sinavYukleniyor, setSinavYukleniyor] = useState(true)
  const [seciliSinavId, setSeciliSinavId] = useState<number | null>(null)
  const [sinavSonuclari, setSinavSonuclari] = useState<SinavSonucSatiri[]>([])
  const [sonucYukleniyor, setSonucYukleniyor] = useState(false)
  const [seciliSonuclar, setSeciliSonuclar] = useState<Set<number>>(new Set())
  const [sinavGonderiliyor, setSinavGonderiliyor] = useState(false)
  const [sinavSonuc, setSinavSonuc] = useState<GonderimSonucu | null>(null)

  // ── Genel Bilgilendirme sekmesi ──
  const [genelMesaj, setGenelMesaj] = useState('')
  const [genelHedef, setGenelHedef] = useState<'aktif' | 'hepsi'>('aktif')
  const [aktifVeliSayisi, setAktifVeliSayisi] = useState<number | null>(null)
  const [tumVeliSayisi, setTumVeliSayisi] = useState<number | null>(null)
  const [genelGonderiliyor, setGenelGonderiliyor] = useState(false)
  const [genelSonuc, setGenelSonuc] = useState<GonderimSonucu | null>(null)

  useEffect(() => {
    gecikisleriGetir()
    sinavlariGetir()
    veliSayilariGetir()
  }, [])

  // ─── Gecikmiş Taksit ───────────────────────────────────────────────────────

  async function gecikisleriGetir() {
    setGecikisYukleniyor(true)
    const sinirTarih = ucIsGunuOnce()
    const { data } = await supabase
      .from('taksitler')
      .select(`
        id, tutar, vade_tarihi,
        odeme_planlari (
          ogrenciler (
            ad_soyad,
            veliler ( ad_soyad, telefon )
          )
        )
      `)
      .neq('durum', 'odendi')
      .lte('vade_tarihi', sinirTarih)
      .order('vade_tarihi')

    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const satirlar: GecikisSatiri[] = (data as any[]).map(t => ({
        id: t.id,
        tutar: t.tutar,
        vade_tarihi: t.vade_tarihi,
        ogrenci_adi: t.odeme_planlari?.ogrenciler?.ad_soyad ?? '',
        veli_adi: t.odeme_planlari?.ogrenciler?.veliler?.ad_soyad ?? '',
        telefon: t.odeme_planlari?.ogrenciler?.veliler?.telefon ?? null,
      }))
      setGecikisler(satirlar)
    }
    setGecikisYukleniyor(false)
  }

  function gecikmisToggle(id: number) {
    setSeciliGecikmisler(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function gecikmisHepsiniSec() {
    const telefonluIds = gecikisler.filter(g => g.telefon).map(g => g.id)
    if (seciliGecikmisler.size === telefonluIds.length) {
      setSeciliGecikmisler(new Set())
    } else {
      setSeciliGecikmisler(new Set(telefonluIds))
    }
  }

  async function gecikisSmsSend() {
    const liste = gecikisler.filter(g => seciliGecikmisler.has(g.id) && g.telefon)
    if (!liste.length) return
    setGecikisGonderiliyor(true)
    setGecikisSonuc(null)
    let basarili = 0
    const hatalar: string[] = []
    for (const g of liste) {
      const mesaj =
        `Sayın ${g.veli_adi}, ${g.ogrenci_adi} adlı öğrencinizin ` +
        `${g.tutar.toLocaleString('tr-TR')} TL'deki taksiti vadesi geçmiştir. ` +
        `Lütfen ödemenizi yapınız. Antakya İvme Akademi`
      const { ok, hata } = await smsSend(g.telefon!, mesaj)
      if (ok) {
        basarili++
      } else {
        hatalar.push(`${g.veli_adi} (${g.telefon}): ${hata}`)
      }
    }
    setGecikisGonderiliyor(false)
    setGecikisSonuc({ basarili, basarisiz: hatalar.length, hatalar })
  }

  // ─── Sınav Sonucu ──────────────────────────────────────────────────────────

  async function sinavlariGetir() {
    setSinavYukleniyor(true)
    const { data } = await supabase
      .from('deneme_sinavlari')
      .select('id, sinav_adi, sinav_tarihi')
      .order('sinav_tarihi', { ascending: false })
    setSinavlar(data || [])
    setSinavYukleniyor(false)
  }

  async function sinavSonuclariGetir(sinavId: number) {
    setSonucYukleniyor(true)
    setSeciliSonuclar(new Set())
    setSinavSonuc(null)
    const { data } = await supabase
      .from('sinav_sonuclari')
      .select(`
        id, net_puan,
        ogrenciler (
          ad_soyad,
          veliler ( ad_soyad, telefon )
        )
      `)
      .eq('sinav_id', sinavId)
      .order('net_puan', { ascending: false })

    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const satirlar: SinavSonucSatiri[] = (data as any[]).map(s => ({
        id: s.id,
        net_puan: s.net_puan,
        ogrenci_adi: s.ogrenciler?.ad_soyad ?? '',
        veli_adi: s.ogrenciler?.veliler?.ad_soyad ?? '',
        telefon: s.ogrenciler?.veliler?.telefon ?? null,
      }))
      setSinavSonuclari(satirlar)
    }
    setSonucYukleniyor(false)
  }

  function sonucToggle(id: number) {
    setSeciliSonuclar(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function sonucHepsiniSec() {
    const telefonluIds = sinavSonuclari.filter(s => s.telefon).map(s => s.id)
    if (seciliSonuclar.size === telefonluIds.length) {
      setSeciliSonuclar(new Set())
    } else {
      setSeciliSonuclar(new Set(telefonluIds))
    }
  }

  async function sinavSmsSend() {
    const seciliSinav = sinavlar.find(s => s.id === seciliSinavId)
    if (!seciliSinav) return
    const liste = sinavSonuclari.filter(s => seciliSonuclar.has(s.id) && s.telefon)
    if (!liste.length) return
    setSinavGonderiliyor(true)
    setSinavSonuc(null)
    let basarili = 0
    const hatalar: string[] = []
    for (const s of liste) {
      const net = s.net_puan !== null ? String(s.net_puan) : '0'
      const mesaj =
        `Sayın ${s.veli_adi}, ${s.ogrenci_adi} ${seciliSinav.sinav_adi} ` +
        `sınavında ${net} net performans sergiledi. Antakya İvme Akademi`
      const { ok, hata } = await smsSend(s.telefon!, mesaj)
      if (ok) {
        basarili++
      } else {
        hatalar.push(`${s.veli_adi} (${s.telefon}): ${hata}`)
      }
    }
    setSinavGonderiliyor(false)
    setSinavSonuc({ basarili, basarisiz: hatalar.length, hatalar })
  }

  // ─── Genel Bilgilendirme ───────────────────────────────────────────────────

  async function veliSayilariGetir() {
    const [{ data: aktifOgrenciler }, { count: tumSayisi }] = await Promise.all([
      supabase
        .from('ogrenciler')
        .select('veli_id')
        .eq('aktif', true),
      supabase
        .from('veliler')
        .select('id', { count: 'exact' })
        .not('telefon', 'is', null)
        .neq('telefon', ''),
    ])

    if (aktifOgrenciler) {
      const uniqueVeliIds = [...new Set(
        aktifOgrenciler.map(o => o.veli_id).filter(Boolean)
      )]
      const { count } = await supabase
        .from('veliler')
        .select('id', { count: 'exact' })
        .in('id', uniqueVeliIds)
        .not('telefon', 'is', null)
        .neq('telefon', '')
      setAktifVeliSayisi(count ?? 0)
    }
    setTumVeliSayisi(tumSayisi ?? 0)
  }

  async function genelSmsSend() {
    if (!genelMesaj.trim()) { alert('Mesaj boş olamaz.'); return }
    setGenelGonderiliyor(true)
    setGenelSonuc(null)

    let veliler: { id: number; ad_soyad: string; telefon: string }[] = []

    if (genelHedef === 'hepsi') {
      const { data } = await supabase
        .from('veliler')
        .select('id, ad_soyad, telefon')
        .not('telefon', 'is', null)
        .neq('telefon', '')
      veliler = (data || []).filter(v => v.telefon)
    } else {
      const { data: aktifOgrenciler } = await supabase
        .from('ogrenciler')
        .select('veli_id')
        .eq('aktif', true)
      const uniqueIds = [...new Set(
        (aktifOgrenciler || []).map(o => o.veli_id).filter(Boolean)
      )] as number[]
      const { data } = await supabase
        .from('veliler')
        .select('id, ad_soyad, telefon')
        .in('id', uniqueIds)
        .not('telefon', 'is', null)
        .neq('telefon', '')
      veliler = (data || []).filter(v => v.telefon)
    }

    let basarili = 0
    const hatalar: string[] = []
    for (const v of veliler) {
      const { ok, hata } = await smsSend(v.telefon, genelMesaj.trim())
      if (ok) {
        basarili++
      } else {
        hatalar.push(`${v.ad_soyad} (${v.telefon}): ${hata}`)
      }
    }
    setGenelGonderiliyor(false)
    setGenelSonuc({ basarili, basarisiz: hatalar.length, hatalar })
  }

  // ─── UI yardımcıları ───────────────────────────────────────────────────────

  const sekmeler: { key: 'gecikis' | 'sinav' | 'genel'; label: string }[] = [
    { key: 'gecikis', label: '⏰ Gecikmiş Taksit SMS' },
    { key: 'sinav', label: '📝 Sınav Sonucu SMS' },
    { key: 'genel', label: '📢 Genel Bilgilendirme' },
  ]

  function SonucPaneli({ sonuc, onKapat }: { sonuc: GonderimSonucu; onKapat: () => void }) {
    return (
      <div className={`rounded-xl p-4 border mt-4 ${sonuc.basarisiz === 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-gray-800">
              {sonuc.basarili} SMS başarıyla gönderildi
              {sonuc.basarisiz > 0 && `, ${sonuc.basarisiz} gönderilemedi`}.
            </p>
            {sonuc.hatalar.length > 0 && (
              <ul className="mt-2 space-y-1">
                {sonuc.hatalar.map((h, i) => (
                  <li key={i} className="text-sm text-red-600">• {h}</li>
                ))}
              </ul>
            )}
          </div>
          <button onClick={onKapat} className="text-gray-400 hover:text-gray-600 ml-4 text-lg leading-none">✕</button>
        </div>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">

        <div className="mb-6">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Ana Sayfa</Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">SMS Gönder</h1>
        </div>

        {/* Sekme butonları */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {sekmeler.map(s => (
            <button key={s.key} onClick={() => setSekme(s.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                sekme === s.key
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* ── GECİKMİŞ TAKSİT SEKMESİ ── */}
        {sekme === 'gecikis' && (
          <div className="space-y-4">
            {/* Şablon önizleme */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              <p className="font-semibold mb-1">SMS Şablonu:</p>
              <p className="italic">
                Sayın [VELİ ADI], [ÖĞRENCİ ADI] adlı öğrencinizin [TUTAR] TL&apos;deki taksiti vadesi geçmiştir.
                Lütfen ödemenizi yapınız. Antakya İvme Akademi
              </p>
            </div>

            {gecikisYukleniyor ? (
              <p className="text-gray-400 text-center py-12">Yükleniyor...</p>
            ) : gecikisler.length === 0 ? (
              <p className="text-gray-400 text-center py-12">
                3 iş günü vadesi geçmiş ödenmemiş taksit bulunamadı.
              </p>
            ) : (
              <>
                {/* Tümünü Seç + Gönder */}
                <div className="flex items-center justify-between">
                  <button onClick={gecikmisHepsiniSec}
                    className="text-sm text-blue-600 hover:underline">
                    {seciliGecikmisler.size === gecikisler.filter(g => g.telefon).length
                      ? 'Seçimi Temizle' : 'Tümünü Seç'}
                  </button>
                  <button
                    onClick={gecikisSmsSend}
                    disabled={seciliGecikmisler.size === 0 || gecikisGonderiliyor}
                    className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50">
                    {gecikisGonderiliyor
                      ? 'Gönderiliyor...'
                      : `SMS Gönder (${seciliGecikmisler.size} kişi)`}
                  </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3 w-8"></th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Öğrenci</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Veli</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Tutar</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Vade</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Telefon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gecikisler.map((g, i) => (
                        <tr
                          key={g.id}
                          className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${!g.telefon ? 'opacity-40' : 'cursor-pointer hover:bg-orange-50'}`}
                          onClick={() => g.telefon && gecikmisToggle(g.id)}
                        >
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              readOnly
                              checked={seciliGecikmisler.has(g.id)}
                              disabled={!g.telefon}
                              className="accent-orange-500"
                            />
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-800">{g.ogrenci_adi}</td>
                          <td className="px-4 py-3 text-gray-600">{g.veli_adi}</td>
                          <td className="px-4 py-3 font-semibold text-gray-800">₺{g.tutar.toLocaleString('tr-TR')}</td>
                          <td className="px-4 py-3 text-red-600">{new Date(g.vade_tarihi).toLocaleDateString('tr-TR')}</td>
                          <td className="px-4 py-3 text-gray-500">{g.telefon ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {gecikisSonuc && (
                  <SonucPaneli
                    sonuc={gecikisSonuc}
                    onKapat={() => setGecikisSonuc(null)}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* ── SINAV SONUCU SEKMESİ ── */}
        {sekme === 'sinav' && (
          <div className="space-y-4">
            {/* Şablon önizleme */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-800">
              <p className="font-semibold mb-1">SMS Şablonu:</p>
              <p className="italic">
                Sayın [VELİ ADI], [ÖĞRENCİ ADI] [SINAV ADI] sınavında [NET] net performans sergiledi. Antakya İvme Akademi
              </p>
            </div>

            {/* Sınav Seç */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <label className="text-sm text-gray-500">Sınav Seç</label>
              {sinavYukleniyor ? (
                <p className="text-gray-400 text-sm mt-2">Yükleniyor...</p>
              ) : (
                <select
                  value={seciliSinavId ?? ''}
                  onChange={e => {
                    const id = parseInt(e.target.value)
                    setSeciliSinavId(id)
                    sinavSonuclariGetir(id)
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400"
                >
                  <option value="">Sınav seçin...</option>
                  {sinavlar.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.sinav_adi} — {new Date(s.sinav_tarihi).toLocaleDateString('tr-TR')}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Sonuçlar */}
            {seciliSinavId && (
              sonucYukleniyor ? (
                <p className="text-gray-400 text-center py-8">Sonuçlar yükleniyor...</p>
              ) : sinavSonuclari.length === 0 ? (
                <p className="text-gray-400 text-center py-8">Bu sınav için sonuç kaydı bulunamadı.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <button onClick={sonucHepsiniSec}
                      className="text-sm text-blue-600 hover:underline">
                      {seciliSonuclar.size === sinavSonuclari.filter(s => s.telefon).length
                        ? 'Seçimi Temizle' : 'Tümünü Seç'}
                    </button>
                    <button
                      onClick={sinavSmsSend}
                      disabled={seciliSonuclar.size === 0 || sinavGonderiliyor}
                      className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
                      {sinavGonderiliyor
                        ? 'Gönderiliyor...'
                        : `SMS Gönder (${seciliSonuclar.size} kişi)`}
                    </button>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-4 py-3 w-8"></th>
                          <th className="text-left px-4 py-3 text-gray-500 font-medium">Öğrenci</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-medium">Veli</th>
                          <th className="text-right px-4 py-3 text-gray-500 font-medium">Net</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-medium">Telefon</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sinavSonuclari.map((s, i) => (
                          <tr
                            key={s.id}
                            className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${!s.telefon ? 'opacity-40' : 'cursor-pointer hover:bg-purple-50'}`}
                            onClick={() => s.telefon && sonucToggle(s.id)}
                          >
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                readOnly
                                checked={seciliSonuclar.has(s.id)}
                                disabled={!s.telefon}
                                className="accent-purple-600"
                              />
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-800">{s.ogrenci_adi}</td>
                            <td className="px-4 py-3 text-gray-600">{s.veli_adi}</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-800">{s.net_puan ?? '—'}</td>
                            <td className="px-4 py-3 text-gray-500">{s.telefon ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {sinavSonuc && (
                    <SonucPaneli
                      sonuc={sinavSonuc}
                      onKapat={() => setSinavSonuc(null)}
                    />
                  )}
                </>
              )
            )}
          </div>
        )}

        {/* ── GENEL BİLGİLENDİRME SEKMESİ ── */}
        {sekme === 'genel' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">

              {/* Mesaj metni */}
              <div>
                <label className="text-sm text-gray-500 font-medium">Mesaj</label>
                <textarea
                  rows={5}
                  value={genelMesaj}
                  onChange={e => setGenelMesaj(e.target.value)}
                  placeholder="Velilere gönderilecek SMS metnini buraya yazın..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{genelMesaj.length} karakter</p>
              </div>

              {/* Hedef seçimi */}
              <div>
                <p className="text-sm text-gray-500 font-medium mb-2">Alıcılar</p>
                <div className="flex gap-3">
                  <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer text-sm transition-all ${
                    genelHedef === 'aktif' ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="hedef"
                      checked={genelHedef === 'aktif'}
                      onChange={() => setGenelHedef('aktif')}
                      className="accent-blue-600"
                    />
                    <span>
                      Aktif öğrenci velileri
                      {aktifVeliSayisi !== null && (
                        <span className="ml-1 font-semibold">({aktifVeliSayisi} kişi)</span>
                      )}
                    </span>
                  </label>
                  <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer text-sm transition-all ${
                    genelHedef === 'hepsi' ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="hedef"
                      checked={genelHedef === 'hepsi'}
                      onChange={() => setGenelHedef('hepsi')}
                      className="accent-blue-600"
                    />
                    <span>
                      Tüm veliler
                      {tumVeliSayisi !== null && (
                        <span className="ml-1 font-semibold">({tumVeliSayisi} kişi)</span>
                      )}
                    </span>
                  </label>
                </div>
              </div>

              <button
                onClick={genelSmsSend}
                disabled={!genelMesaj.trim() || genelGonderiliyor}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 text-sm">
                {genelGonderiliyor
                  ? 'SMS Gönderiliyor...'
                  : `SMS Gönder → ${genelHedef === 'aktif'
                      ? (aktifVeliSayisi ?? '?')
                      : (tumVeliSayisi ?? '?')} kişi`}
              </button>
            </div>

            {genelSonuc && (
              <SonucPaneli
                sonuc={genelSonuc}
                onKapat={() => setGenelSonuc(null)}
              />
            )}
          </div>
        )}

      </div>
    </main>
  )
}
