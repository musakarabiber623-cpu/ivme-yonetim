const ADMIN_KULLANICI = 'AYSEİVME'
const ADMIN_SIFRE = '9741267'

export function adminMi(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem('ivme_admin') === '1'
}

export function girisYap(kullanici: string, sifre: string): boolean {
  if (kullanici === ADMIN_KULLANICI && sifre === ADMIN_SIFRE) {
    sessionStorage.setItem('ivme_admin', '1')
    return true
  }
  return false
}

export function cikisYap(): void {
  sessionStorage.removeItem('ivme_admin')
}
