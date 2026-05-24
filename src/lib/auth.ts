// Yönetici şifresini buradan değiştirin
export const ADMIN_SIFRE = '1234'

export function adminMi(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem('ivme_admin') === '1'
}

export function girisYap(sifre: string): boolean {
  if (sifre === ADMIN_SIFRE) {
    sessionStorage.setItem('ivme_admin', '1')
    return true
  }
  return false
}

export function cikisYap(): void {
  sessionStorage.removeItem('ivme_admin')
}
