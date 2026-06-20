'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { girisYapildiMi, adminMi, girisYap, ziyaretciGiris, cikisYap } from '@/lib/auth'

const KANTIN_KATEGORILERI = ['kantin_geliri', 'kantin_alis']

export default function Home() {
  const [girisYapildi, setGirisYapildi] = useState(false)
  const [loginAcik, setLoginAcik] = useState(false)
  const [loginKullanici, setLoginKullanici] = useState('')
  const [loginSifre, setLoginSifre] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  const [istatistik, setIstatistik] = useState({
    toplamOgrenci: 0,
    buAyTahsilat: 0,
    bekleyenTaksit: 0,
    gecikenTaksit: 0,
    toplamGelir: 0,
    toplamGider: 0,
  })
  const [yukleniyor, setYukleniyor] = useState(false)
  const [duzeltYukleniyor, setDuzeltYukleniyor] = useState(false)

  useEffect(() => {
    const loggedIn = girisYapildiMi()
    setGirisYapildi(loggedIn)
    setIsAdmin(adminMi())
    if (loggedIn) getir()

    const handleVisibility = () => {
      if (!document.hidden && girisYapildiMi()) getir()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  async function getir() {
    setYukleniyor(true)
    const simdi = new Date()
    const bugun = simdi.toISOString().split('T')[0]
    const buAyBaslangic = `${simdi.getFullYear()}-${String(simdi.getMonth() + 1).padStart(2, '0')}-01`
    const sonrakiAy = new Date(simdi.getFullYear(), simdi.getMonth() + 1, 1)
    const buAySon = `${sonrakiAy.getFullYear()}-${String(sonrakiAy.getMonth() + 1).padStart(2, '0')}-01`

    const [
      ogrenci, tahsil, bekleyen, geciken,
      ggGelir, ggGider, bankaGelir, bankaGider, taksitGelir, personelGider
    ] = await Promise.all([
      supabase.from('ogrenciler').select('id', { count: 'exact' }).eq('aktif', true),
      // odeme_tarihi olan tüm taksitler (hem tam hem kısmi ödeme)
      supabase.from('taksitler').select('tutar, odendi_tutar').gte('odeme_tarihi', buAyBaslangic).lt('odeme_tarihi', buAySon),
      supabase.from('taksitler').select('tutar').neq('durum', 'odendi').gte('vade_tarihi', bugun),
      supabase.from('taksitler').select('tutar').neq('durum', 'odendi').lt('vade_tarihi', bugun),
      supabase.from('gelir_gider').select('tutar').eq('tur', 'gelir').not('kategori', 'in', `(${KANTIN_KATEGORILERI.join(',')})`),
      supabase.from('gelir_gider').select('tutar').eq('tur', 'gider').not('kategori', 'in', `(${KANTIN_KATEGORILERI.join(',')})`),
      supabase.from('banka_hareketleri').select('tutar').eq('tur', 'gelir').not('aciklama', 'like', 'TAKSİT:%'),
      supabase.from('banka_hareketleri').select('tutar').eq('tur', 'gider'),
      // Toplam gelir için: tam ödendi olanlar + kısmi ödeme odendi_tutar'ı
      supabase.from('taksitler').select('tutar, odendi_tutar, durum'),
      supabase.from('personel_odemeler').select('brut_tutar, sgk_isveren, personel!inner(aktif)').eq('personel.aktif', true),
    ])

    // odendi_tutar varsa onu kullan (yeni kayıtlar), yoksa tutar (eski tam ödemeler)
    const taksitToplamGelir = (taksitGelir.data || []).reduce((s, t: { tutar: number; odendi_tutar: number | null; durum: string }) => {
      if (t.odendi_tutar !== null && t.odendi_tutar !== undefined) return s + t.odendi_tutar
      if (t.durum === 'odendi') return s + t.tutar
      return s
    }, 0)

    const toplamGelir =
      taksitToplamGelir +
      (ggGelir.data || []).reduce((s, r) => s + r.tutar, 0) +
      (bankaGelir.data || []).reduce((s, r) => s + r.tutar, 0)

    const toplamGider =
      (personelGider.data || []).reduce((s, r) => s + r.brut_tutar + (r.sgk_isveren || 0), 0) +
      (ggGider.data || []).reduce((s, r) => s + r.tutar, 0) +
      (bankaGider.data || []).reduce((s, r) => s + r.tutar, 0)

    setIstatistik({
      toplamOgrenci: ogrenci.count || 0,
      buAyTahsilat: (tahsil.data || []).reduce((s, t: { tutar: number; odendi_tutar: number | null }) =>
        s + (t.odendi_tutar !== null && t.odendi_tutar !== undefined ? t.odendi_tutar : t.tutar), 0),
      bekleyenTaksit: (bekleyen.data || []).reduce((s, t) => s + t.tutar, 0),
      gecikenTaksit: (geciken.data || []).reduce((s, t) => s + t.tutar, 0),
      toplamGelir,
      toplamGider,
    })
    setYukleniyor(false)
  }

  function ziyaretciOlarak() {
    ziyaretciGiris()
    setGirisYapildi(true)
    setIsAdmin(false)
    getir()
  }

  function adminOlarak() {
    if (girisYap(loginKullanici, loginSifre)) {
      setGirisYapildi(true)
      setIsAdmin(true)
      setLoginAcik(false)
      setLoginKullanici('')
      setLoginSifre('')
      getir()
    } else {
      alert('Kullanıcı adı veya şifre hatalı!')
      setLoginSifre('')
    }
  }

  async function taksitDuzelt() {
    if (!confirm('Tüm taksit tutarları tam sayıya yuvarlanacak. Devam edilsin mi?')) return
    setDuzeltYukleniyor(true)
    const { data: planlar } = await supabase.from('odeme_planlari').select('id, toplam_ucret')
    let guncellenen = 0
    for (const plan of planlar || []) {
      // Sadece ödenmemiş taksitleri güncelle
      const { data: taksitler } = await supabase
        .from('taksitler').select('id, taksit_no')
        .eq('odeme_plan_id', plan.id).neq('durum', 'odendi').is('odendi_tutar', null).order('taksit_no')
      if (!taksitler || taksitler.length === 0) continue
      // Ödenmiş taksitlerin toplamını düş
      const { data: odenmis } = await supabase
        .from('taksitler').select('odendi_tutar, tutar, durum')
        .eq('odeme_plan_id', plan.id)
        .or('durum.eq.odendi,odendi_tutar.not.is.null')
      const odenmisTop = (odenmis || []).reduce((s: number, t: { odendi_tutar: number | null; tutar: number; durum: string }) =>
        s + (t.odendi_tutar != null ? t.odendi_tutar : t.tutar), 0)
      const kalanUcret = plan.toplam_ucret - odenmisTop
      const cnt = taksitler.length
      if (cnt === 0 || kalanUcret <= 0) continue
      const base = Math.floor(kalanUcret / cnt)
      const son = Math.round(kalanUcret - base * (cnt - 1))
      for (let i = 0; i < cnt; i++) {
        await supabase.from('taksitler')
          .update({ tutar: i === cnt - 1 ? son : base })
          .eq('id', taksitler[i].id)
      }
      guncellenen++
    }
    setDuzeltYukleniyor(false)
    alert(`${guncellenen} ödeme planı güncellendi. Taksit tutarları tam sayıya yuvarlandı.`)
    getir()
  }

  function tamCikis() {
    cikisYap()
    setGirisYapildi(false)
    setIsAdmin(false)
    setLoginAcik(false)
  }

  const net = istatistik.toplamGelir - istatistik.toplamGider

  const menuler = [
    { href: '/ogrenciler', icon: '👨‍🎓', baslik: 'Öğrenciler', aciklama: 'Kayıt, listeleme, detay', renk: 'hover:border-blue-300' },
    { href: '/odemeler', icon: '💰', baslik: 'Ödemeler', aciklama: 'Taksit takip, tahsilat', renk: 'hover:border-green-300' },
    { href: '/sinavlar', icon: '📝', baslik: 'Sınavlar', aciklama: 'Deneme sonuçları', renk: 'hover:border-purple-300' },
    { href: '/personel', icon: '👩‍🏫', baslik: 'Personel', aciklama: 'Maaş, SGK, ek ders', renk: 'hover:border-yellow-300' },
    { href: '/kantin', icon: '🏪', baslik: 'Kantin', aciklama: 'Kantin gelir ve giderleri', renk: 'hover:border-orange-300' },
    { href: '/banka', icon: '🏦', baslik: 'Banka', aciklama: 'Banka gelir ve giderleri', renk: 'hover:border-cyan-300' },
    { href: '/gelir-gider', icon: '📊', baslik: 'Gelir / Gider', aciklama: 'Kurum giderleri, faturalar', renk: 'hover:border-red-300' },
    { href: '/raporlar', icon: '📈', baslik: 'Raporlar', aciklama: 'Nakit akış, özet', renk: 'hover:border-gray-300' },
    { href: '/sms', icon: '💬', baslik: 'SMS', aciklama: 'Veli bilgilendirme, taksit, sınav', renk: 'hover:border-teal-300' },
  ]

  // ─── Giriş Ekranı ──────────────────────────────────────────────────────────
  if (!girisYapildi) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="text-6xl mb-4">🎓</div>
            <h1 className="text-3xl font-bold text-gray-800">Antakya İvme Akademi</h1>
            <p className="text-gray-500 mt-2">Yönetim Paneline Hoş Geldiniz</p>
          </div>

          {!loginAcik ? (
            <div className="grid grid-cols-2 gap-4">
              <button onClick={ziyaretciOlarak}
                className="bg-white rounded-2xl p-8 shadow-sm border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all text-center group cursor-pointer">
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform inline-block">👁️</div>
                <p className="font-bold text-gray-800 text-lg">Ziyaretçi</p>
                <p className="text-xs text-gray-500 mt-2">Verileri görüntüle</p>
              </button>
              <button onClick={() => setLoginAcik(true)}
                className="bg-white rounded-2xl p-8 shadow-sm border-2 border-gray-200 hover:border-blue-600 hover:shadow-lg transition-all text-center group cursor-pointer">
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform inline-block">🔐</div>
                <p className="font-bold text-gray-800 text-lg">Yönetici</p>
                <p className="text-xs text-gray-500 mt-2">Tam yetki ile giriş</p>
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              <h2 className="font-bold text-gray-800 text-xl mb-1">Yönetici Girişi</h2>
              <p className="text-sm text-gray-400 mb-5">Kullanıcı adı ve şifrenizi giriniz</p>
              <div className="space-y-3">
                <input
                  type="text"
                  value={loginKullanici}
                  onChange={e => setLoginKullanici(e.target.value)}
                  placeholder="Kullanıcı Adı"
                  autoFocus
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400"
                />
                <input
                  type="password"
                  value={loginSifre}
                  onChange={e => setLoginSifre(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && adminOlarak()}
                  placeholder="Şifre"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={adminOlarak}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700">
                  Giriş Yap
                </button>
                <button onClick={() => { setLoginAcik(false); setLoginKullanici(''); setLoginSifre('') }}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl text-sm font-semibold hover:bg-gray-200">
                  Geri
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    )
  }

  // ─── Ana Sayfa / Dashboard ─────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">

        <div className="flex flex-wrap items-start justify-between gap-3 mb-6 sm:mb-8">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-800">Antakya İvme Akademi</h1>
            <p className="text-gray-500 mt-1 text-sm">Yönetim Paneli</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${isAdmin ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'}`}>
              {isAdmin ? '🔓 Yönetici' : '👁️ Ziyaretçi'}
            </span>
            <button onClick={getir} disabled={yukleniyor}
              className="text-xs text-gray-400 hover:text-blue-600 border border-gray-200 rounded-lg px-3 py-1.5 disabled:opacity-50">
              {yukleniyor ? '...' : '↻ Yenile'}
            </button>
            {isAdmin && (
              <button onClick={taksitDuzelt} disabled={duzeltYukleniyor}
                className="text-xs text-orange-500 hover:text-orange-700 border border-orange-200 rounded-lg px-3 py-1.5 disabled:opacity-50">
                {duzeltYukleniyor ? 'Düzeltiliyor...' : 'Taksit Düzelt'}
              </button>
            )}
            {!isAdmin && (
              <button onClick={() => setLoginAcik(true)}
                className="text-xs text-gray-400 hover:text-blue-600 border border-gray-200 rounded-lg px-3 py-1.5">
                Yönetici Girişi
              </button>
            )}
            <button onClick={tamCikis}
              className="text-xs text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg px-3 py-1.5">
              Çıkış
            </button>
          </div>
        </div>

        {/* Ziyaretçi iken yönetici girişi modalı */}
        {loginAcik && !isAdmin && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
              <h2 className="font-bold text-gray-800 text-xl mb-1">Yönetici Girişi</h2>
              <p className="text-sm text-gray-400 mb-5">Kullanıcı adı ve şifrenizi giriniz</p>
              <div className="space-y-3">
                <input type="text" value={loginKullanici} onChange={e => setLoginKullanici(e.target.value)}
                  placeholder="Kullanıcı Adı" autoFocus
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
                <input type="password" value={loginSifre} onChange={e => setLoginSifre(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && adminOlarak()}
                  placeholder="Şifre"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={adminOlarak}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700">
                  Giriş Yap
                </button>
                <button onClick={() => { setLoginAcik(false); setLoginKullanici(''); setLoginSifre('') }}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl text-sm font-semibold hover:bg-gray-200">
                  İptal
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 mb-3 sm:mb-4">
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <p className="text-xs sm:text-sm text-gray-500">Toplam Öğrenci</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-800 mt-1">
              {yukleniyor ? '...' : istatistik.toplamOgrenci}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <p className="text-xs sm:text-sm text-gray-500">Bu Ay Tahsilat</p>
            <p className="text-xl sm:text-3xl font-bold text-green-600 mt-1">
              {yukleniyor ? '...' : `₺${istatistik.buAyTahsilat.toLocaleString('tr-TR')}`}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <p className="text-xs sm:text-sm text-gray-500">Bekleyen Taksit</p>
            <p className="text-xl sm:text-3xl font-bold text-orange-500 mt-1">
              {yukleniyor ? '...' : `₺${istatistik.bekleyenTaksit.toLocaleString('tr-TR')}`}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <p className="text-xs sm:text-sm text-gray-500">Geciken Taksit</p>
            <p className="text-xl sm:text-3xl font-bold text-red-500 mt-1">
              {yukleniyor ? '...' : `₺${istatistik.gecikenTaksit.toLocaleString('tr-TR')}`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-green-100">
            <p className="text-sm text-gray-500">Toplam Gelir <span className="text-xs text-gray-400">(kantin hariç)</span></p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {yukleniyor ? '...' : `₺${istatistik.toplamGelir.toLocaleString('tr-TR')}`}
            </p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-red-100">
            <p className="text-sm text-gray-500">Toplam Gider <span className="text-xs text-gray-400">(kantin hariç)</span></p>
            <p className="text-2xl font-bold text-red-500 mt-1">
              {yukleniyor ? '...' : `₺${istatistik.toplamGider.toLocaleString('tr-TR')}`}
            </p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Net Bakiye</p>
            <p className={`text-2xl font-bold mt-1 ${net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {yukleniyor ? '...' : `₺${net.toLocaleString('tr-TR')}`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
          {menuler.map(m => (
            <Link key={m.href} href={m.href}
              className={`bg-white rounded-xl p-6 shadow-sm border border-gray-100 ${m.renk} hover:shadow-md transition-all`}>
              <div className="text-2xl mb-2">{m.icon}</div>
              <p className="font-semibold text-gray-800">{m.baslik}</p>
              <p className="text-sm text-gray-500 mt-1">{m.aciklama}</p>
            </Link>
          ))}
        </div>

      </div>
    </main>
  )
}
