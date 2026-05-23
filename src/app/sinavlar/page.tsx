'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import * as XLSX from 'xlsx'

type Sinav = {
  id: number
  sinav_adi: string
  sinav_tarihi: string
  sinif_seviyesi: number | null
  sinav_turu: string
  toplam_soru: number | null
}

type Sonuc = {
  id: number
  sinav_id: number
  ogrenci_id: number
  dogru: number
  yanlis: number
  bos: number
  net_puan: number | null
  ogrenciler: { ad_soyad: string; sinif: number }
}

export default function SinavlarPage() {
  const [sinavlar, setSinavlar] = useState<Sinav[]>([])
  const [sonuclar, setSonuclar] = useState<Sonuc[]>([])
  const [ogrenciler, setOgrenciler] = useState<{id:number;ad_soyad:string;sinif:number}[]>([])
  const [seciliSinav, setSeciliSinav] = useState<number | null>(null)
  const [sekme, setSekme] = useState<'liste' | 'yeni-sinav' | 'sonuc-gir'>('liste')
  const [yukleniyor, setYukleniyor] = useState(true)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [yuklemeMesaj, setYuklemeMesaj] = useState('')
  const dosyaRef = useRef<HTMLInputElement>(null)

  const [sForm, setSForm] = useState({
    sinav_adi: '', sinav_tarihi: new Date().toISOString().split('T')[0],
    sinif_seviyesi: '', sinav_turu: 'deneme', toplam_soru: '90'
  })
  const [sonucForm, setSonucForm] = useState({
    ogrenci_id: '', dogru: '', yanlis: '', bos: ''
  })

  useEffect(() => { getir() }, [])

  async function getir() {
    const [s, o] = await Promise.all([
      supabase.from('deneme_sinavlari').select('*').order('sinav_tarihi', { ascending: false }),
      supabase.from('ogrenciler').select('id, ad_soyad, sinif').eq('aktif', true).order('ad_soyad')
    ])
    setSinavlar(s.data || [])
    setOgrenciler(o.data || [])
    setYukleniyor(false)
  }

  async function sonuclariGetir(sinavId: number) {
    const { data } = await supabase
      .from('sinav_sonuclari')
      .select('*, ogrenciler(ad_soyad, sinif)')
      .eq('sinav_id', sinavId)
      .order('net_puan', { ascending: false })
    setSonuclar(data || [])
    setSeciliSinav(sinavId)
  }

  async function sinavKaydet() {
    if (!sForm.sinav_adi) { alert('Sınav adı zorunludur.'); return }
    setKaydediliyor(true)
    const { error } = await supabase.from('deneme_sinavlari').insert({
      sinav_adi: sForm.sinav_adi,
      sinav_tarihi: sForm.sinav_tarihi,
      sinif_seviyesi: sForm.sinif_seviyesi ? parseInt(sForm.sinif_seviyesi) : null,
      sinav_turu: sForm.sinav_turu,
      toplam_soru: sForm.toplam_soru ? parseInt(sForm.toplam_soru) : null,
    })
    if (error) { alert('Hata: ' + error.message); setKaydediliyor(false); return }
    setSForm({ sinav_adi: '', sinav_tarihi: new Date().toISOString().split('T')[0], sinif_seviyesi: '', sinav_turu: 'deneme', toplam_soru: '90' })
    getir()
    setSekme('liste')
    setKaydediliyor(false)
  }

  async function sonucKaydet() {
    if (!seciliSinav || !sonucForm.ogrenci_id) { alert('Sınav ve öğrenci seçilmeli.'); return }
    const d = parseInt(sonucForm.dogru) || 0
    const y = parseInt(sonucForm.yanlis) || 0
    const b = parseInt(sonucForm.bos) || 0
    const net = Math.round((d - y / 3) * 100) / 100
    setKaydediliyor(true)
    const { error } = await supabase.from('sinav_sonuclari').upsert({
      sinav_id: seciliSinav,
      ogrenci_id: parseInt(sonucForm.ogrenci_id),
      dogru: d, yanlis: y, bos: b, net_puan: net,
    }, { onConflict: 'sinav_id,ogrenci_id' })
    if (error) { alert('Hata: ' + error.message); setKaydediliyor(false); return }
    setSonucForm({ ogrenci_id: '', dogru: '', yanlis: '', bos: '' })
    sonuclariGetir(seciliSinav)
    setKaydediliyor(false)
  }

  function sablonIndir() {
    const veri = [
      ['ad_soyad', 'dogru', 'yanlis', 'bos'],
      ...ogrenciler.map(o => [o.ad_soyad, '', '', ''])
    ]
    const ws = XLSX.utils.aoa_to_sheet(veri)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sonuclar')
    XLSX.writeFile(wb, 'sinav_sonuc_sablonu.xlsx')
  }

  async function excelYukle(e: React.ChangeEvent<HTMLInputElement>) {
    if (!seciliSinav) { alert('Önce sınav seçin.'); return }
    const dosya = e.target.files?.[0]
    if (!dosya) return
    setYuklemeMesaj('Dosya okunuyor...')

    const buffer = await dosya.arrayBuffer()
    const wb = XLSX.read(buffer)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const satirlar: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

    const baslik = satirlar[0]?.map((h: string) => h?.toString().toLowerCase().trim())
    const adIdx = baslik?.indexOf('ad_soyad') ?? -1
    const dIdx = baslik?.indexOf('dogru') ?? -1
    const yIdx = baslik?.indexOf('yanlis') ?? -1
    const bIdx = baslik?.indexOf('bos') ?? -1

    if (adIdx === -1 || dIdx === -1) {
      setYuklemeMesaj('Hata: Dosyada ad_soyad ve dogru sütunları olmalı.')
      return
    }

    const kayitlar = []
    let eslesmeyen = 0

    for (let i = 1; i < satirlar.length; i++) {
      const satir = satirlar[i]
      if (!satir || !satir[adIdx]) continue
      const ad = satir[adIdx]?.toString().trim().toLowerCase()
      const ogr = ogrenciler.find(o => o.ad_soyad.toLowerCase().trim() === ad)
      if (!ogr) { eslesmeyen++; continue }

      const d = parseInt(satir[dIdx]?.toString()) || 0
      const y = yIdx >= 0 ? parseInt(satir[yIdx]?.toString()) || 0 : 0
      const b = bIdx >= 0 ? parseInt(satir[bIdx]?.toString()) || 0 : 0
      const net = Math.round((d - y / 3) * 100) / 100

      kayitlar.push({
        sinav_id: seciliSinav,
        ogrenci_id: ogr.id,
        dogru: d, yanlis: y, bos: b, net_puan: net,
      })
    }

    if (kayitlar.length === 0) {
      setYuklemeMesaj('Hiç eşleşen öğrenci bulunamadı. İsimleri kontrol edin.')
      return
    }

    setYuklemeMesaj(`${kayitlar.length} öğrenci kaydediliyor...`)
    const { error } = await supabase.from('sinav_sonuclari')
      .upsert(kayitlar, { onConflict: 'sinav_id,ogrenci_id' })

    if (error) { setYuklemeMesaj('Hata: ' + error.message); return }

    const mesaj = eslesmeyen > 0
      ? `${kayitlar.length} kayıt eklendi. ${eslesmeyen} öğrenci eşleşmedi.`
      : `${kayitlar.length} öğrenci sonucu başarıyla kaydedildi!`
    setYuklemeMesaj(mesaj)
    sonuclariGetir(seciliSinav)
    if (dosyaRef.current) dosyaRef.current.value = ''
  }

  const setS = (k: string, v: string) => setSForm(f => ({ ...f, [k]: v }))
  const setSo = (k: string, v: string) => setSonucForm(f => ({ ...f, [k]: v }))
  const netHesapla = () => Math.round(((parseInt(sonucForm.dogru)||0) - (parseInt(sonucForm.yanlis)||0) / 3) * 100) / 100

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Ana Sayfa</Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">Sınavlar</h1>
        </div>

        <div className="flex gap-2 mb-6">
          {(['liste', 'yeni-sinav', 'sonuc-gir'] as const).map(s => (
            <button key={s} onClick={() => setSekme(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                sekme === s ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}>
              {s === 'liste' ? 'Sınav Listesi' : s === 'yeni-sinav' ? '+ Yeni Sınav' : 'Sonuç Gir'}
            </button>
          ))}
        </div>

        {yukleniyor ? <p className="text-gray-400 text-center py-12">Yükleniyor...</p> : (
          <>
            {sekme === 'liste' && (
              <div className="space-y-3">
                {sinavlar.length === 0 ? (
                  <p className="text-gray-400 text-center py-12">Henüz sınav eklenmedi.</p>
                ) : sinavlar.map(s => (
                  <div key={s.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">{s.sinav_adi}</p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {new Date(s.sinav_tarihi).toLocaleDateString('tr-TR')}
                        {s.sinif_seviyesi && ` · ${s.sinif_seviyesi}. Sınıf`}
                        {s.toplam_soru && ` · ${s.toplam_soru} soru`}
                      </p>
                    </div>
                    <button onClick={() => { sonuclariGetir(s.id); setSekme('sonuc-gir') }}
                      className="text-sm bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100">
                      Sonuçları Gör / Gir
                    </button>
                  </div>
                ))}
              </div>
            )}

            {sekme === 'yeni-sinav' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-700 mb-4">Yeni Sınav Ekle</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-sm text-gray-500">Sınav Adı *</label>
                    <input value={sForm.sinav_adi} onChange={e => setS('sinav_adi', e.target.value)}
                      placeholder="Örn: Aralık LGS Denemesi #3"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Tarih</label>
                    <input type="date" value={sForm.sinav_tarihi} onChange={e => setS('sinav_tarihi', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Sınıf Seviyesi</label>
                    <select value={sForm.sinif_seviyesi} onChange={e => setS('sinif_seviyesi', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                      <option value="">Tüm Sınıflar</option>
                      {[2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}. Sınıf</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Sınav Türü</label>
                    <select value={sForm.sinav_turu} onChange={e => setS('sinav_turu', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                      <option value="deneme">Deneme</option>
                      <option value="kazanim">Kazanım</option>
                      <option value="genel">Genel</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Toplam Soru</label>
                    <input type="number" value={sForm.toplam_soru} onChange={e => setS('toplam_soru', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
                <button onClick={sinavKaydet} disabled={kaydediliyor}
                  className="mt-4 w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {kaydediliyor ? 'Kaydediliyor...' : 'Sınavı Kaydet'}
                </button>
              </div>
            )}

            {sekme === 'sonuc-gir' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <label className="text-sm text-gray-500">Sınav Seç</label>
                  <select value={seciliSinav || ''} onChange={e => sonuclariGetir(parseInt(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                    <option value="">Sınav seçin...</option>
                    {sinavlar.map(s => <option key={s.id} value={s.id}>{s.sinav_adi} — {new Date(s.sinav_tarihi).toLocaleDateString('tr-TR')}</option>)}
                  </select>
                </div>

                {seciliSinav && (
                  <>
                    {/* Excel Yükleme */}
                    <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                      <p className="font-semibold text-green-800 mb-1">Excel ile Toplu Yükleme</p>
                      <p className="text-sm text-green-700 mb-3">Önce şablonu indir, öğrenci sonuçlarını doldur, geri yükle.</p>
                      <div className="flex gap-3 flex-wrap">
                        <button onClick={sablonIndir}
                          className="text-sm bg-white border border-green-300 text-green-700 px-4 py-2 rounded-lg hover:bg-green-50">
                          Şablonu İndir (Excel)
                        </button>
                        <label className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 cursor-pointer">
                          Doldurulmuş Dosyayı Yükle
                          <input ref={dosyaRef} type="file" accept=".xlsx,.xls" onChange={excelYukle} className="hidden" />
                        </label>
                      </div>
                      {yuklemeMesaj && (
                        <p className={`mt-3 text-sm font-medium ${yuklemeMesaj.includes('Hata') ? 'text-red-600' : 'text-green-700'}`}>
                          {yuklemeMesaj}
                        </p>
                      )}
                    </div>

                    {/* Tekil Sonuç Gir */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                      <h2 className="font-semibold text-gray-700 mb-4">Tekil Sonuç Gir</h2>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="text-sm text-gray-500">Öğrenci</label>
                          <select value={sonucForm.ogrenci_id} onChange={e => setSo('ogrenci_id', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400">
                            <option value="">Seçin...</option>
                            {ogrenciler.map(o => <option key={o.id} value={o.id}>{o.ad_soyad} — {o.sinif}. Sınıf</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Doğru</label>
                          <input type="number" value={sonucForm.dogru} onChange={e => setSo('dogru', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Yanlış</label>
                          <input type="number" value={sonucForm.yanlis} onChange={e => setSo('yanlis', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Boş</label>
                          <input type="number" value={sonucForm.bos} onChange={e => setSo('bos', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-blue-400" />
                        </div>
                        <div className="flex items-end">
                          <div className="bg-blue-50 rounded-lg px-4 py-2 w-full text-sm text-blue-700">
                            Net: <strong>{netHesapla()}</strong>
                          </div>
                        </div>
                      </div>
                      <button onClick={sonucKaydet} disabled={kaydediliyor}
                        className="mt-4 w-full bg-purple-600 text-white py-2.5 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50">
                        {kaydediliyor ? 'Kaydediliyor...' : 'Sonucu Kaydet'}
                      </button>
                    </div>

                    {sonuclar.length > 0 && (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100">
                          <p className="font-semibold text-gray-700">Sınav Sonuçları — {sonuclar.length} öğrenci</p>
                        </div>
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left px-4 py-3 text-gray-500 font-medium">Sıra</th>
                              <th className="text-left px-4 py-3 text-gray-500 font-medium">Öğrenci</th>
                              <th className="text-center px-4 py-3 text-gray-500 font-medium">D</th>
                              <th className="text-center px-4 py-3 text-gray-500 font-medium">Y</th>
                              <th className="text-center px-4 py-3 text-gray-500 font-medium">B</th>
                              <th className="text-right px-4 py-3 text-gray-500 font-medium">Net</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sonuclar.map((s, i) => (
                              <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-4 py-3 text-gray-500">{i + 1}.</td>
                                <td className="px-4 py-3 font-medium text-gray-800">
                                  {s.ogrenciler?.ad_soyad}
                                  <span className="text-xs text-gray-400 ml-1">{s.ogrenciler?.sinif}. Sınıf</span>
                                </td>
                                <td className="px-4 py-3 text-center text-green-600">{s.dogru}</td>
                                <td className="px-4 py-3 text-center text-red-500">{s.yanlis}</td>
                                <td className="px-4 py-3 text-center text-gray-400">{s.bos}</td>
                                <td className="px-4 py-3 text-right font-bold text-gray-800">{s.net_puan}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
