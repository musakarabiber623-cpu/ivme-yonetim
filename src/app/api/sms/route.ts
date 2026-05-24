export async function POST(request: Request) {
  try {
    const { telefon, mesaj } = await request.json()

    if (!telefon || !mesaj) {
      return Response.json(
        { success: false, error: 'Telefon ve mesaj zorunludur.' },
        { status: 400 }
      )
    }

    const usercode = process.env.NETGSM_USER
    const password = process.env.NETGSM_PASS
    const baslik = process.env.NETGSM_BASLIK || 'IVMEAKADEMI'

    if (!usercode || !password) {
      return Response.json(
        { success: false, error: '.env.local dosyasında NETGSM_USER ve NETGSM_PASS tanımlanmamış.' },
        { status: 500 }
      )
    }

    // Türk telefon numarasını normalize et: başındaki +90 veya 0 kaldır
    const tel = telefon.replace(/[\s\-()]/g, '').replace(/^(\+90|90|0)/, '')

    if (!/^5\d{9}$/.test(tel)) {
      return Response.json(
        { success: false, error: `Geçersiz telefon numarası: ${telefon}` },
        { status: 400 }
      )
    }

    const params = new URLSearchParams({
      usercode,
      password,
      gsmno: tel,
      message: mesaj,
      msgheader: baslik,
      encoding: '85',
    })

    const res = await fetch(
      `https://api.netgsm.com.tr/sms/send/get/?${params.toString()}`
    )
    const text = (await res.text()).trim()

    if (text.startsWith('00')) {
      return Response.json({ success: true, jobId: text.split(' ')[1] ?? '' })
    }

    const hataMetinleri: Record<string, string> = {
      '01': 'Mesaj başlığı (header) hatalı veya Netgsm tarafından onaylanmamış.',
      '02': 'Mesaj içeriği boş.',
      '03': 'Telefon numarası hatalı.',
      '04': 'Yetersiz kredi.',
      '20': 'Sistem hatası, tekrar deneyin.',
      '30': 'Kullanıcı adı veya şifre hatalı.',
      '40': 'Mesaj gönderim yetkisi yok.',
      '70': 'Hatalı sorgulama.',
    }

    return Response.json(
      { success: false, error: hataMetinleri[text] ?? `Netgsm hatası: ${text}` },
      { status: 400 }
    )
  } catch {
    return Response.json({ success: false, error: 'Sunucu hatası.' }, { status: 500 })
  }
}
