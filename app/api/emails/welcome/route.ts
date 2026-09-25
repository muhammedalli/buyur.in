import { NextResponse, type NextRequest } from "next/server";
import { authenticateBusiness, isBusinessSetUp } from "@/lib/business-auth";
import { isEmailConfigured, sendWelcomeEmail } from "@/lib/email";

// İşletme kurulduktan sonra tetiklenen karşılama maili. Alıcı adresi istemciden
// alınmaz; oturumun kendi kaydından (işletme hesabı) okunur — aksi halde uç,
// herkese mail atan bir kapıya dönüşürdü.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "E-posta servisi yapılandırılmamış." }, { status: 503 });
  }

  const session = await authenticateBusiness(req.headers.get("authorization"));
  if (!session) {
    return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
  }
  const { business } = session;
  if (!isBusinessSetUp(business) || !business.email) {
    return NextResponse.json({ error: "İşletme kurulumu tamamlanmamış." }, { status: 409 });
  }

  try {
    await sendWelcomeEmail(business.email, { businessName: business.name, slug: business.slug });
  } catch (err) {
    // Mail gitmemesi kurulumu bozmaz; kullanıcı zaten panelde.
    console.error("[welcome] mail gönderilemedi", business.id, err);
    return NextResponse.json({ error: "Karşılama e-postası gönderilemedi." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
