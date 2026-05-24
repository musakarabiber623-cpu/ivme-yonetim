const ADMIN_KULLANICI = 'AYSEİVME'
const ADMIN_SIFRE = '9741267'

export function girisYapildiMi(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem('ivme_rol') !== null
}

export function adminMi(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem('ivme_rol') === 'admin'
}

export function girisYap(kullanici: string, sifre: string): boolean {
  if (kullanici === ADMIN_KULLANICI && sifre === ADMIN_SIFRE) {
    sessionStorage.setItem('ivme_rol', 'admin')
    return true
  }
  return false
}

export function ziyaretciGiris(): void {
  sessionStorage.setItem('ivme_rol', 'ziyaretci')
}

// AdminPanel'de kullanılır: admin → ziyaretçi (sayfadan çıkmaz)
export function adminCikis(): void {
  sessionStorage.setItem('ivme_rol', 'ziyaretci')
}

// Ana sayfada kullanılır: tam oturum kapatma
export function cikisYap(): void {
  sessionStorage.removeItem('ivme_rol')
}
