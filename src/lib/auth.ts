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

function yayinla() {
  window.dispatchEvent(new Event('ivme-auth'))
}

export function girisYap(kullanici: string, sifre: string): boolean {
  if (kullanici === ADMIN_KULLANICI && sifre === ADMIN_SIFRE) {
    sessionStorage.setItem('ivme_rol', 'admin')
    yayinla()
    return true
  }
  return false
}

export function ziyaretciGiris(): void {
  sessionStorage.setItem('ivme_rol', 'ziyaretci')
  yayinla()
}

export function adminCikis(): void {
  sessionStorage.setItem('ivme_rol', 'ziyaretci')
  yayinla()
}

export function cikisYap(): void {
  sessionStorage.removeItem('ivme_rol')
  yayinla()
}
