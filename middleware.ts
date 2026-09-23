import { NextResponse, type NextRequest } from "next/server";
import { RESERVED_SLUGS } from "@/lib/slug";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "buyur.in";

const ADMIN_COOKIE_NAME = "buyur_admin_auth";

function getSubdomain(hostname: string): string | null {
  if (hostname === "localhost" || hostname === "127.0.0.1") return null;
  if (hostname.endsWith(".localhost")) {
    const sub = hostname.slice(0, -".localhost".length);
    return sub === "www" ? null : sub;
  }
  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) return null;
  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
    return sub === "www" ? null : sub;
  }
  // Bilinmeyen host (vercel.app preview'ları vb.) kök gibi davranır.
  return null;
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const hostname = host.split(":")[0];
  const sub = getSubdomain(hostname);

  if (!sub) {
    // Kök alan adında /admin izole tutulur: prod'da admin subdomain'ine
    // yönlendirilir (admin, panel gibi kök altında "yaşamaz"). Dev'de
    // localhost:3000/admin doğrudan çalışmaya devam eder — admin.localhost:3000
    // kurmak istemeyen biri için kolaylık; gerçek erişim kontrolü zaten
    // requireAdmin() ile layout seviyesinde yapılıyor. Path /admin önekiyle
    // birlikte taşınır (subdomain'de de aynı önek kullanılıyor, aşağıya bkz.).
    const pathname = req.nextUrl.pathname;
    if (process.env.NODE_ENV === "production" && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
      const url = req.nextUrl.clone();
      url.host = `admin.${ROOT_DOMAIN}`;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  const port = host.includes(":") ? `:${host.split(":")[1]}` : "";
  const rootHost = `${hostname.endsWith(".localhost") ? "localhost" : ROOT_DOMAIN}${port}`;

  // admin.buyur.in kendi başına bir uygulama: panel/menü gibi kök alan adına
  // yönlendirilmez. Uygulamanın tüm Link/redirect'leri zaten /admin önekiyle
  // yazıldığı için (menü sisteminin slug rewrite'ının aksine burada değişken
  // bir segment yok) subdomain'de de path olduğu gibi bırakılıyor — sadece kök
  // "/" isteği /admin'e yazılıyor. Önce bunu deneyip sonradan öneki client
  // tarafında gizlemeye çalışmak (menüdeki gibi) çift /admin/admin çakışmasına
  // ve 404'e yol açıyordu.
  if (sub === "admin") {
    const isLoginPath = url.pathname === "/admin/login" || url.pathname.startsWith("/admin/login/");

    if (!isLoginPath && !req.cookies.has(ADMIN_COOKIE_NAME)) {
      // Hızlı kolaylık yönlendirmesi — asıl doğrulama requireAdmin() içinde,
      // cookie burada sadece var/yok diye bakılıyor, geçerliliği kontrol edilmiyor.
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      return NextResponse.redirect(loginUrl);
    }

    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
      return NextResponse.next();
    }

    url.pathname = url.pathname === "/" ? "/admin" : `/admin${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // Rezerve subdomain'ler (panel, api, www benzeri) işletme adresi değildir;
  // kök alan adına gönder. panel/app doğrudan panele düşsün.
  if (RESERVED_SLUGS.has(sub)) {
    url.host = rootHost;
    if (sub === "panel" || sub === "app") {
      url.pathname = url.pathname === "/" ? "/panel" : `/panel${url.pathname}`;
    }
    return NextResponse.redirect(url);
  }

  // Panel subdomain'de yaşamaz; kök alan adına gönder.
  if (url.pathname === "/panel" || url.pathname.startsWith("/panel/")) {
    url.host = rootHost;
    return NextResponse.redirect(url);
  }

  // Otomatik web sitesi ayrı bir rota ağacında yaşar (menü kabuğunu miras
  // almasın diye): {slug}.buyur.in/site → /site/{slug}
  if (url.pathname === "/site" || url.pathname.startsWith("/site/")) {
    url.pathname = `/site/${sub}`;
    return NextResponse.rewrite(url);
  }

  url.pathname = url.pathname === "/" ? `/${sub}/menu` : `/${sub}${url.pathname}`;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-buyur-rewrite", "subdomain");
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  // Statik dosyalar, Next iç yolları ve API hariç her şey.
  matcher: ["/((?!api/|_next/|.*\\.).*)"],
};
