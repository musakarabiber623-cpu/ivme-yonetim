'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { girisYapildiMi, adminMi, cikisYap } from '@/lib/auth'
import {
  LayoutDashboard, GraduationCap, CreditCard, Users,
  Landmark, BarChart3, ShoppingBag, FileText, TrendingUp,
  MessageSquare, LogOut, ChevronRight,
} from 'lucide-react'

const linkler = [
  { href: '/',            ikon: LayoutDashboard, etiket: 'Ana Sayfa'   },
  { href: '/ogrenciler',  ikon: GraduationCap,   etiket: 'Öğrenciler'  },
  { href: '/odemeler',    ikon: CreditCard,       etiket: 'Ödemeler'    },
  { href: '/personel',    ikon: Users,            etiket: 'Personel'    },
  { href: '/banka',       ikon: Landmark,         etiket: 'Banka'       },
  { href: '/gelir-gider', ikon: BarChart3,        etiket: 'Gelir/Gider' },
  { href: '/kantin',      ikon: ShoppingBag,      etiket: 'Kantin'      },
  { href: '/sinavlar',    ikon: FileText,         etiket: 'Sınavlar'    },
  { href: '/raporlar',    ikon: TrendingUp,       etiket: 'Raporlar'    },
  { href: '/sms',         ikon: MessageSquare,    etiket: 'SMS'         },
]

const altLinkler = linkler.slice(0, 4)

export default function AppNav() {
  const pathname = usePathname()
  const [girisYapildi, setGirisYapildi] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    function kontrol() {
      setGirisYapildi(girisYapildiMi())
      setIsAdmin(adminMi())
    }
    kontrol()
    window.addEventListener('ivme-auth', kontrol)
    return () => window.removeEventListener('ivme-auth', kontrol)
  }, [])

  if (!girisYapildi) return null

  const aktif = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <>
      {/* ── Masaüstü Sidebar ───────────────────────────────────── */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-56 flex-col bg-gradient-to-b from-slate-900 to-slate-800 z-40 shadow-xl">
        {/* Logo */}
        <div className="px-5 pt-6 pb-4 border-b border-slate-700">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">İvme Akademi</p>
          <p className="text-white font-bold text-lg leading-tight mt-0.5">Yönetim</p>
          <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${isAdmin ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
            {isAdmin ? '🔓 Yönetici' : '👁 Ziyaretçi'}
          </span>
        </div>

        {/* Linkler */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {linkler.map(({ href, ikon: Ikon, etiket }) => (
            <Link key={href} href={href}
              className={`flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${
                aktif(href)
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}>
              <Ikon size={17} />
              {etiket}
              {aktif(href) && <ChevronRight size={14} className="ml-auto opacity-60" />}
            </Link>
          ))}
        </nav>

        {/* Çıkış */}
        <div className="px-4 pb-6 border-t border-slate-700 pt-4">
          <button onClick={() => { cikisYap(); window.location.href = '/' }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut size={17} />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* ── Mobil Alt Navigasyon ───────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-lg">
        <div className="flex">
          {altLinkler.map(({ href, ikon: Ikon, etiket }) => (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center py-2.5 gap-1 text-xs font-medium transition-colors ${
                aktif(href) ? 'text-blue-600' : 'text-gray-400'
              }`}>
              <Ikon size={22} strokeWidth={aktif(href) ? 2.5 : 1.8} />
              <span className="text-[10px]">{etiket}</span>
            </Link>
          ))}
          {/* Daha fazla — diğer linkler için basit dropdown yerine /raporlar */}
          <Link href="/raporlar"
            className={`flex-1 flex flex-col items-center py-2.5 gap-1 text-xs font-medium transition-colors ${
              !['/','ogrenciler','odemeler','personel'].some(p => pathname.startsWith('/'+p) || pathname === '/') && pathname !== '/'
                ? 'text-blue-600' : 'text-gray-400'
            }`}>
            <BarChart3 size={22} strokeWidth={1.8} />
            <span className="text-[10px]">Daha Fazla</span>
          </Link>
        </div>
      </nav>
    </>
  )
}
