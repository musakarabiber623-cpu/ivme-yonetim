'use client'
import { useState, useEffect } from 'react'
import { adminMi, girisYap, adminCikis } from '@/lib/auth'

type Props = {
  onDegis: (yetki: boolean) => void
}

export default function AdminPanel({ onDegis }: Props) {
  const [modal, setModal] = useState(false)
  const [kullanici, setKullanici] = useState('')
  const [sifre, setSifre] = useState('')
  const [admin, setAdmin] = useState(false)

  useEffect(() => {
    const y = adminMi()
    setAdmin(y)
    onDegis(y)
  }, [])

  function giris() {
    if (girisYap(kullanici, sifre)) {
      setAdmin(true)
      onDegis(true)
      setModal(false)
      setKullanici('')
      setSifre('')
    } else {
      alert('Kullanıcı adı veya şifre hatalı!')
      setSifre('')
    }
  }

  function cikis() {
    adminCikis()
    setAdmin(false)
    onDegis(false)
  }

  return (
    <>
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xs">
            <h2 className="font-semibold text-gray-800 mb-1">Yönetici Girişi</h2>
            <p className="text-xs text-gray-400 mb-4">Veri girişi için giriş yapınız</p>
            <input
              type="text"
              value={kullanici}
              onChange={e => setKullanici(e.target.value)}
              placeholder="Kullanıcı Adı"
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 mb-2"
            />
            <input
              type="password"
              value={sifre}
              onChange={e => setSifre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && giris()}
              placeholder="Şifre"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={giris}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                Giriş Yap
              </button>
              <button onClick={() => { setModal(false); setKullanici(''); setSifre('') }}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {admin ? (
        <div className="flex items-center gap-3">
          <span className="text-xs text-green-600 font-medium">🔓 Yönetici Modu</span>
          <button onClick={cikis}
            className="text-xs text-gray-400 hover:text-red-500 border border-gray-200 rounded px-2 py-1">
            Çıkış
          </button>
        </div>
      ) : (
        <button onClick={() => setModal(true)}
          className="text-xs text-gray-400 hover:text-blue-600 border border-gray-200 rounded px-3 py-1.5 flex items-center gap-1">
          🔒 Yönetici Girişi
        </button>
      )}
    </>
  )
}
