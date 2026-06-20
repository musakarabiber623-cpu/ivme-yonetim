'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { girisYapildiMi, adminMi, girisYap, ziyaretciGiris } from '@/lib/auth'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { AlertTriangle, TrendingUp, TrendingDown, Users, RefreshCw, Settings } from 'lucide-react'

const KANTIN_KATEGORILERI = ['kantin_geliri', 'kantin_alis']

function ayAdi(offset: number) {
  const d = new Date()
  d.setMonth(d.getMonth() - offset)
  return d.toLocaleDateString('tr-TR', { month: 'short' })
}

function ayBaslangic(offset: number) {
  const d = new Date()
  d.setMonth(d.getMonth() - offset, 1)
  return d.toISOString().split('T')[0]
}

function ayBitis(offset: number) {
  const d = new Date()
  d.setMonth(d.getMonth() - offset + 1, 1)
  return d.toISOString().split('T')[0]
}

export default function Home() {
  const [girisYapildi, setGirisYapildi] = useState(false)
  const [loginAcik, setLoginAcik] = useState(false)
  const [loginKullanici, setLoginKullanici] = useState('')
  const [loginSifre, setLoginSifre] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [duzeltYukleniyor, setDuzeltYukleniyor] = useState(false)

  const [istatistik, setIstatistik] = useState({
    toplamOgrenci: 0,
    buAyTahsilat: 0,
    bekleyenTaksit: 0,
    gecikenTaksit: 0,
    toplamGelir: 0,
    toplamGider: 0,
  })
  const [grafik, setGrafik] = useState<{ ay: string; tahsilat: number }[]>([])

  useEffect(() => {
    const loggedIn = girisYapildiMi()
    setGirisYapildi(loggedIn)
    setIsAdmin(adminMi())
    if (loggedIn) getir()

    const handleAuth = () => {
      setGirisYapildi(girisYapildiMi())
      setIsAdmin(adminMi())
    }
    const handleVisibility = () => {
      if (!document.hidden && girisYapildiMi()) getir()
    }
    window.addEventListener('ivme-auth', handleAuth)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('ivme-auth', handleAuth)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  async function getir() {
    setYukleniyor(true)
    const simdi = new Date()
    const bugun = simdi.toISOString().split('T')[0]
    const buAyBaslangic = ayBaslangic(0)
    const buAySon = ayBitis(0)

    const aylar = [5,4,3,2,1,0]

    const [
      ogrenci, tahsil, bekleyen, geciken,
      ggGelir, ggGider, bankaGelir, bankaGider, taksitGelir, personelGider,
      ...aylikVeriler
    ] = await Promise.all([
      supabase.from('ogrenciler').select('id', { count: 'exact' }).eq('aktif', true),
      supabase.from('taksitler').select('tutar, odendi_tutar').gte('odeme_tarihi', buAyBaslangic).lt('odeme_tarihi', buAySon),
      supabase.from('taksitler').select('tutar').neq('durum', 'odendi').is('odendi_tutar', null).gte('vade_tarihi', bugun),
      supabase.from('taksitler').select('tutar').neq('durum', 'odendi').is('odendi_tutar', null).lt('vade_tarihi', bugun),
      supabase.from('gelir_gider').select('tutar').eq('tur', 'gelir').not('kategori', 'in', `(${KANTIN_KATEGORILERI.join(',')})`),
      supabase.from('gelir_gider').select('tutar').eq('tur', 'gider').not('kategori', 'in', `(${KANTIN_KATEGORILERI.join(',')})`),
      supabase.from('banka_hareketleri').select('tutar').eq('tur', 'gelir').not('aciklama', 'like', 'TAKSİT:%'),
      supabase.from('banka_hareketleri').select('tutar').eq('tur', 'gider'),
      supabase.from('taksitler').select('tutar, odendi_tutar, durum'),
      supabase.from('personel_odemeler').select('brut_tutar, sgk_isveren, personel!inner(aktif)').eq('personel.aktif', true),
      ...aylar.map(o => supabase.from('taksitler').select('tutar, odendi_tutar, durum')
        .gte('odeme_tarihi', ayBaslangic(o)).lt('odeme_tarihi', ayBitis(o))),
    ])

    const taksitToplamGelir = (taksitGelir.data || []).reduce((s, t: { tutar: number; odendi_tutar: number | null; durum: string }) => {
      if (t.odendi_tutar != null) return s + t.odendi_tutar
      if (t.durum === 'odendi') return s + t.tutar
      return s
    }, 0)

    const toplamGelir = taksitToplamGelir +
      (ggGelir.data || []).reduce((s, r) => s + r.tutar, 0) +
      (bankaGelir.data || []).reduce((s, r) => s + r.tutar, 0)

    const toplamGider =
      (personelGider.data || []).reduce((s, r) => s + r.brut_tutar + (r.sgk_isveren || 0), 0) +
      (ggGider.data || []).reduce((s, r) => s + r.tutar, 0) +
      (bankaGider.data || []).reduce((s, r) => s + r.tutar, 0)

    setIstatistik({
      toplamOgrenci: ogrenci.count || 0,
      buAyTahsilat: (tahsil.data || []).reduce((s, t: { tutar: number; odendi_tutar: number | null }) =>
        s + (t.odendi_tutar != null ? t.odendi_tutar : t.tutar), 0),
      bekleyenTaksit: (bekleyen.data || []).reduce((s, t) => s + t.tutar, 0),
      gecikenTaksit: (geciken.data || []).reduce((s, t) => s + t.tutar, 0),
      toplamGelir,
      toplamGider,
    })

    setGrafik(aylar.map((offset, i) => ({
      ay: ayAdi(offset),
      tahsilat: (aylikVeriler[i]?.data || []).reduce((s: number, t: { tutar: number; odendi_tutar: number | null; durum: string }) => {
        if (t.odendi_tutar != null) return s + t.odendi_tutar
        if (t.durum === 'odendi') return s + t.tutar
        return s
      }, 0),
    })))

    setYukleniyor(false)
  }

  async function taksitDuzelt() {
    if (!confirm('Ödenmemiş taksit tutarları tam sayıya yuvarlanacak. Devam edilsin mi?')) return
    setDuzeltYukleniyor(true)
    const { data: planlar } = await supabase.from('odeme_planlari').select('id, toplam_ucret')
    let guncellenen = 0
    for (const plan of planlar || []) {
      const { data: taksitler } = await supabase
        .from('taksitler').select('id, taksit_no')
        .eq('odeme_plan_id', plan.id).neq('durum', 'odendi').is('odendi_tutar', null).order('taksit_no')
      if (!taksitler || taksitler.length === 0) continue
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
        await supabase.from('taksitler').update({ tutar: i === cnt - 1 ? son : base }).eq('id', taksitler[i].id)
      }
      guncellenen++
    }
    setDuzeltYukleniyor(false)
    alert(`${guncellenen} plan güncellendi.`)
    getir()
  }

  const net = istatistik.toplamGelir - istatistik.toplamGider

  // ── Giriş Ekranı ──────────────────────────────────────────────
  if (!girisYapildi) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-5 backdrop-blur-sm border border-white/20">
              <span className="text-4xl">🎓</span>
            </div>
            <h1 className="text-3xl font-bold text-white">Antakya İvme Akademi</h1>
            <p className="text-blue-300 mt-2 text-sm">Yönetim Paneline Hoş Geldiniz</p>
          </div>

          {!loginAcik ? (
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => { ziyaretciGiris(); setGirisYapildi(true); setIsAdmin(false); getir() }}
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-7 border border-white/20 hover:bg-white/20 hover:border-white/40 transition-all text-center group cursor-pointer">
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform inline-block">👁️</div>
                <p className="font-bold text-white text-base">Ziyaretçi</p>
                <p className="text-xs text-blue-300 mt-1">Görüntüle</p>
              </button>
              <button onClick={() => setLoginAcik(true)}
                className="bg-blue-600 rounded-2xl p-7 border border-blue-500 hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/30 transition-all text-center group cursor-pointer">
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform inline-block">🔐</div>
                <p className="font-bold text-white text-base">Yönetici</p>
                <p className="text-xs text-blue-200 mt-1">Tam yetki</p>
              </button>
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-8">
              <h2 className="font-bold text-white text-xl mb-5">Yönetici Girişi</h2>
              <div className="space-y-3">
                <input type="text" value={loginKullanici} onChange={e => setLoginKullanici(e.target.value)}
                  placeholder="Kullanıcı Adı" autoFocus
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-blue-300 focus:outline-none focus:border-blue-400" />
                <input type="password" value={loginSifre} onChange={e => setLoginSifre(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { if (girisYap(loginKullanici, loginSifre)) { setGirisYapildi(true); setIsAdmin(true); setLoginAcik(false); setLoginKullanici(''); setLoginSifre(''); getir() } else { alert('Hatalı!'); setLoginSifre('') } } }}
                  placeholder="Şifre"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-blue-300 focus:outline-none focus:border-blue-400" />
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => { if (girisYap(loginKullanici, loginSifre)) { setGirisYapildi(true); setIsAdmin(true); setLoginAcik(false); setLoginKullanici(''); setLoginSifre(''); getir() } else { alert('Kullanıcı adı veya şifre hatalı!'); setLoginSifre('') } }}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-500">
                  Giriş Yap
                </button>
                <button onClick={() => { setLoginAcik(false); setLoginKullanici(''); setLoginSifre('') }}
                  className="flex-1 bg-white/10 text-white py-3 rounded-xl text-sm font-semibold hover:bg-white/20 border border-white/20">
                  Geri
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    )
  }

  // ── Dashboard ──────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-50">

      {/* Ziyaretçi iken yönetici girişi */}
      {loginAcik && !isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
            <h2 className="font-bold text-gray-800 text-xl mb-5">Yönetici Girişi</h2>
            <div className="space-y-3">
              <input type="text" value={loginKullanici} onChange={e => setLoginKullanici(e.target.value)}
                placeholder="Kullanıcı Adı" autoFocus
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
              <input type="password" value={loginSifre} onChange={e => setLoginSifre(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { if (girisYap(loginKullanici, loginSifre)) { setIsAdmin(true); setLoginAcik(false); setLoginKullanici(''); setLoginSifre('') } else { alert('Hatalı!'); setLoginSifre('') } } }}
                placeholder="Şifre"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { if (girisYap(loginKullanici, loginSifre)) { setIsAdmin(true); setLoginAcik(false); setLoginKullanici(''); setLoginSifre('') } else { alert('Hatalı!'); setLoginSifre('') } }}
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

      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 px-4 sm:px-8 pt-8 pb-16">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest">Antakya İvme Akademi</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">Yönetim Paneli</h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {!isAdmin && (
                <button onClick={() => setLoginAcik(true)}
                  className="text-xs bg-white/10 text-white border border-white/20 rounded-lg px-3 py-1.5 hover:bg-white/20 backdrop-blur-sm">
                  Yönetici Girişi
                </button>
              )}
              <button onClick={getir} disabled={yukleniyor}
                className="text-xs bg-white/10 text-white border border-white/20 rounded-lg px-3 py-1.5 hover:bg-white/20 disabled:opacity-50 backdrop-blur-sm flex items-center gap-1.5">
                <RefreshCw size={12} className={yukleniyor ? 'animate-spin' : ''} />
                {yukleniyor ? 'Yükleniyor' : 'Yenile'}
              </button>
              {isAdmin && (
                <button onClick={taksitDuzelt} disabled={duzeltYukleniyor}
                  className="text-xs bg-white/10 text-white border border-white/20 rounded-lg px-3 py-1.5 hover:bg-white/20 disabled:opacity-50 backdrop-blur-sm flex items-center gap-1.5">
                  <Settings size={12} />
                  {duzeltYukleniyor ? 'Düzeltiliyor...' : 'Taksit Düzelt'}
                </button>
              )}
            </div>
          </div>

          {/* Geciken ödeme uyarısı */}
          {!yukleniyor && istatistik.gecikenTaksit > 0 && (
            <div className="mt-5 bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3 flex items-center gap-3 backdrop-blur-sm">
              <AlertTriangle size={18} className="text-red-400 shrink-0" />
              <div>
                <span className="text-red-300 font-semibold text-sm">Gecikmiş ödeme uyarısı</span>
                <span className="text-red-400 text-sm ml-2">— ₺{istatistik.gecikenTaksit.toLocaleString('tr-TR')} tahsil edilmedi</span>
              </div>
              <Link href="/odemeler" className="ml-auto text-xs bg-red-500/30 text-red-300 border border-red-400/30 px-3 py-1.5 rounded-lg hover:bg-red-500/40 whitespace-nowrap">
                Görüntüle →
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 -mt-8 pb-8">

        {/* İstatistik Kartları */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-lg border-0 ring-1 ring-gray-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 font-medium">Öğrenciler</p>
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <Users size={16} className="text-blue-600" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-800">
              {yukleniyor ? '—' : istatistik.toplamOgrenci}
            </p>
            <p className="text-xs text-gray-400 mt-1">aktif kayıt</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-emerald-100 font-medium">Bu Ay Tahsilat</p>
              <TrendingUp size={16} className="text-emerald-200" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-white">
              {yukleniyor ? '—' : `₺${istatistik.buAyTahsilat.toLocaleString('tr-TR')}`}
            </p>
            <p className="text-xs text-emerald-200 mt-1">bu ay toplam</p>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-lg ring-1 ring-orange-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 font-medium">Bekleyen</p>
              <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
                <span className="text-orange-500 text-sm font-bold">!</span>
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-orange-500">
              {yukleniyor ? '—' : `₺${istatistik.bekleyenTaksit.toLocaleString('tr-TR')}`}
            </p>
            <p className="text-xs text-gray-400 mt-1">vadesi gelmedi</p>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-red-100 font-medium">Geciken</p>
              <AlertTriangle size={16} className="text-red-200" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-white">
              {yukleniyor ? '—' : `₺${istatistik.gecikenTaksit.toLocaleString('tr-TR')}`}
            </p>
            <p className="text-xs text-red-200 mt-1">tahsil edilmedi</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
          {/* Aylık Tahsilat Grafiği */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-lg ring-1 ring-gray-100">
            <p className="font-semibold text-gray-800 mb-1 text-sm">Son 6 Ay Tahsilat</p>
            <p className="text-xs text-gray-400 mb-4">Taksit ödemelerinden gerçekleşen tahsilat</p>
            {yukleniyor ? (
              <div className="h-44 flex items-center justify-center text-gray-300 text-sm">Yükleniyor...</div>
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <BarChart data={grafik} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="ay" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                  <Tooltip
                    formatter={(v: number) => [`₺${v.toLocaleString('tr-TR')}`, 'Tahsilat']}
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                  />
                  <Bar dataKey="tahsilat" radius={[6,6,0,0]} maxBarSize={48}>
                    {grafik.map((_, i) => (
                      <Cell key={i} fill={i === grafik.length - 1 ? '#3b82f6' : '#bfdbfe'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Gelir / Gider / Net */}
          <div className="flex flex-col gap-3">
            <div className="bg-white rounded-2xl p-5 shadow-lg ring-1 ring-green-100 flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">Toplam Gelir</p>
                <TrendingUp size={15} className="text-green-500" />
              </div>
              <p className="text-xl font-bold text-green-600">
                {yukleniyor ? '—' : `₺${istatistik.toplamGelir.toLocaleString('tr-TR')}`}
              </p>
              <p className="text-xs text-gray-400 mt-1">kantin hariç</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-lg ring-1 ring-red-100 flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">Toplam Gider</p>
                <TrendingDown size={15} className="text-red-400" />
              </div>
              <p className="text-xl font-bold text-red-500">
                {yukleniyor ? '—' : `₺${istatistik.toplamGider.toLocaleString('tr-TR')}`}
              </p>
              <p className="text-xs text-gray-400 mt-1">kantin hariç</p>
            </div>
            <div className={`rounded-2xl p-5 shadow-lg flex-1 ${net >= 0 ? 'bg-gradient-to-br from-blue-600 to-indigo-700' : 'bg-gradient-to-br from-red-600 to-rose-700'}`}>
              <p className="text-xs text-white/70 mb-2">Net Bakiye</p>
              <p className="text-xl font-bold text-white">
                {yukleniyor ? '—' : `₺${net.toLocaleString('tr-TR')}`}
              </p>
              <p className="text-xs text-white/50 mt-1">{net >= 0 ? 'kâr' : 'zarar'}</p>
            </div>
          </div>
        </div>

        {/* Hızlı Erişim */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/ogrenciler', label: 'Öğrenciler', sub: `${istatistik.toplamOgrenci} aktif`, color: 'from-blue-500 to-blue-600', icon: '👨‍🎓' },
            { href: '/odemeler', label: 'Ödemeler', sub: 'Tahsilat & taksit', color: 'from-emerald-500 to-green-600', icon: '💰' },
            { href: '/personel', label: 'Personel', sub: 'Maaş & ek ders', color: 'from-violet-500 to-purple-600', icon: '👩‍🏫' },
            { href: '/raporlar', label: 'Raporlar', sub: 'Özet & analiz', color: 'from-amber-500 to-orange-500', icon: '📈' },
          ].map(m => (
            <Link key={m.href} href={m.href}
              className={`bg-gradient-to-br ${m.color} rounded-2xl p-4 sm:p-5 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all`}>
              <div className="text-2xl sm:text-3xl mb-2">{m.icon}</div>
              <p className="font-bold text-white text-sm">{m.label}</p>
              <p className="text-xs text-white/70 mt-0.5">{m.sub}</p>
            </Link>
          ))}
        </div>

      </div>
    </main>
  )
}
