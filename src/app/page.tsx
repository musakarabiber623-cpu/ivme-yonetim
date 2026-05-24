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

  useEffect(() => {
    const loggedIn = girisYapildiMi()
    setGirisYapildi(loggedIn)
    setIsAdmin(adminMi())
    if (loggedIn) getir()
  }, [])

  async function getir() {
    setYukleniyor(true)
    const buAy = new Date().toISOString().slice(0, 7)
    const bugun = new Date().toISOString().split('T')[0]

    const [
      ogrenci, tahsil, bekleyen, geciken,
      ggGelir, ggGider, bankaGelir, bankaGider, taksitGelir, personelGider
    ] = await Promise.all([
      supabase.from('ogrenciler').select('id', { count: 'exact' }).eq('aktif', true),
      supabase.from('taksitler').select('tutar').eq('durum', 'odendi').like('odeme_tarihi', `${buAy}%`),
      supabase.from('taksitler').select('tutar').neq('durum', 'odendi').gte('vade_tarihi', bugun),
      supabase.from('taksitler').select('tutar').neq('durum', 'odendi').lt('vade_tarihi', bugun),
      supabase.from('gelir_gider').select('tutar').eq('tur', 'gelir').not('kategori', 'in', `(${KANTIN_KATEGORILERI.join(',')})`),
      supabase.from('gelir_gider').select('tutar').eq('tur', 'gider').not('kategori', 'in', `(${KANTIN_KATEGORILERI.join(',')})`),
      supabase.from('banka_hareketleri').select('tutar').eq('tur', 'gelir'),
      supabase.from('banka_hareketleri').select('tutar').eq('tur', 'gider'),
      supabase.from('taksitler').select('tutar').eq('durum', 'odendi'),
      supabase.from('personel_odemeler').select('brut_tutar, sgk_isveren'),
    ])

    const toplamGelir =
      (taksitGelir.data || []).reduce((s, t) => s + t.tutar, 0) +
      (ggGelir.data || []).reduce((s, r) => s + r.tutar, 0) +
      (bankaGelir.data || []).reduce((s, r) => s + r.tutar, 0)

    const toplamGider =
      (personelGider.data || []).reduce((s, r) => s + r.brut_tutar + (r.sgk_isveren || 0), 0) +
      (ggGider.data || []).reduce((s, r) => s + r.tutar, 0) +
      (bankaGider.data || []).reduce((s, r) => s + r.tutar, 0)

    setIstatistik({
      toplamOgrenci: ogrenci.count || 0,
      buAyTahsilat: (tahsil.data || []).reduce((s, t) => s + t.tutar, 0),
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
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Antakya İvme Akademi</h1>
            <p className="text-gray-500 mt-1">Yönetim Paneli</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${isAdmin ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'}`}>
              {isAdmin ? '🔓 Yönetici' : '👁️ Ziyaretçi'}
            </span>
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

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-4">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Toplam Öğrenci</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">
              {yukleniyor ? '...' : istatistik.toplamOgrenci}
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Bu Ay Tahsilat</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {yukleniyor ? '...' : `₺${istatistik.buAyTahsilat.toLocaleString('tr-TR')}`}
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Bekleyen Taksit</p>
            <p className="text-3xl font-bold text-orange-500 mt-1">
              {yukleniyor ? '...' : `₺${istatistik.bekleyenTaksit.toLocaleString('tr-TR')}`}
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Geciken Taksit</p>
            <p className="text-3xl font-bold text-red-500 mt-1">
              {yukleniyor ? '...' : `₺${istatistik.gecikenTaksit.toLocaleString('tr-TR')}`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
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

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
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
