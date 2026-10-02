import { describe, expect, it } from "vitest";
import { checkMenuUrl, extractImageLinks, extractPageLinks, htmlToMenuText, isPrivateAddress } from "@/lib/ai/menu-link";

// Bağlantıdan menü okumanın güvenlik ve ayrıştırma sözleşmesi. Sunucu
// yöneticinin verdiği adrese istek atar: iç ağa çıkan her adres reddedilir.

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "%s iç ağdır",
    (address) => expect(isPrivateAddress(address)).toBe(true)
  );

  it.each(["8.8.8.8", "172.32.0.1", "2606:4700:4700::1111", "::ffff:1.1.1.1"])("%s dış ağdır", (address) =>
    expect(isPrivateAddress(address)).toBe(false)
  );

  it("IP olmayan değer güvenli tarafta kalır", () => expect(isPrivateAddress("bir-ad")).toBe(true));
});

describe("checkMenuUrl", () => {
  it("yalnızca standart portlu, kimliksiz http(s) adresleri kabul eder", () => {
    expect(checkMenuUrl("https://menu.ornek.com/kafe")).toBeInstanceOf(URL);
    expect(typeof checkMenuUrl("ftp://ornek.com")).toBe("string");
    expect(typeof checkMenuUrl("https://kullanici:sifre@ornek.com")).toBe("string");
    expect(typeof checkMenuUrl("http://ornek.com:8080")).toBe("string");
    expect(typeof checkMenuUrl("http://localhost/menu")).toBe("string");
    expect(typeof checkMenuUrl("http://127.0.0.1/menu")).toBe("string");
    expect(typeof checkMenuUrl("http://[::1]/menu")).toBe("string");
    expect(typeof checkMenuUrl("menu sayfası")).toBe("string");
  });
});

describe("htmlToMenuText", () => {
  it("görünür metni satır satır, betik/stil olmadan çıkarır", () => {
    const { text, title } = htmlToMenuText(
      "<html><head><title>Kuzey &amp; Kafe</title><style>.a{}</style></head><body><h2>Kahvaltı</h2><div>Menemen <b>180 ₺</b></div><script>track()</script></body></html>"
    );
    expect(title).toBe("Kuzey & Kafe");
    expect(text).toContain("Kahvaltı");
    expect(text).toContain("Menemen 180 ₺");
    expect(text).not.toContain("track");
  });

  it("tarayıcıda oluşan sayfanın gömülü verisini de taşır", () => {
    const html =
      '<div id="root"></div><script id="__NEXT_DATA__" type="application/json">{"props":{"menu":[{"name":"Çay","price":25}]}}</script>' +
      '<script type="application/ld+json">{"@type":"Menu","name":"Ana Menü"}</script><script>console.log(1)</script>';
    const { text } = htmlToMenuText(html);
    expect(text).toContain('"name":"Çay"');
    expect(text).toContain('"@type":"Menu"');
    expect(text).not.toContain("console.log");
  });
});

describe("extractImageLinks", () => {
  it("menü görsellerini öne alır; logo, ikon ve vektörleri eler, adresleri tamamlar", () => {
    const html =
      '<img src="/img/logo.png"><img data-src="/uploads/tatli.jpg"><img src="https://cdn.ornek.com/menu-sayfa-1.jpg">' +
      '<img src="/icons/x.svg"><meta property="og:image" content="https://cdn.ornek.com/kapak.webp">';
    expect(extractImageLinks(html, "https://kafe.ornek.com/qr")).toEqual([
      "https://cdn.ornek.com/menu-sayfa-1.jpg",
      "https://kafe.ornek.com/uploads/tatli.jpg",
      "https://cdn.ornek.com/kapak.webp",
    ]);
  });

  it("Markdown görsel bağlantılarını da okur", () => {
    expect(extractImageLinks("![Menü](https://ornek.com/menu.png) ve ![](https://ornek.com/favicon.png)", "https://ornek.com")).toEqual([
      "https://ornek.com/menu.png",
    ]);
  });
});

describe("extractPageLinks", () => {
  it("aynı sitedeki kategori sayfalarını sırasıyla verir; dosya, başka site, menü dışı ve başka dil elenir", () => {
    const html = `
      <a href="/">Ana sayfa</a>
      <a class="category-card" href="/kahvalti">Kahvaltı</a>
      <a href="https://www.ornek.com/ana-yemekler#ust">Ana Yemekler</a>
      <a href="/kahvalti">Kahvaltı (tekrar)</a>
      <a href="/iletisim">İletişim</a>
      <a href="/en/breakfast">English</a>
      <a href="/menu.pdf">PDF</a>
      <a href="https://baska.com/x">Başka</a>
      <a href="mailto:a@b.com">E-posta</a>`;
    expect(extractPageLinks(html, "https://ornek.com/")).toEqual(["https://ornek.com/kahvalti", "https://www.ornek.com/ana-yemekler"]);
  });

  it("tarayıcı okuyucusunun Markdown bağlantılarını da okur", () => {
    const markdown = "### [Tatlılar 6 ürün](https://ornek.com/tatlilar)### [Sıcak İçecekler](https://ornek.com/sicak-icecekler) ![x](https://ornek.com/a.webp)";
    expect(extractPageLinks(markdown, "https://ornek.com/")).toEqual(["https://ornek.com/tatlilar", "https://ornek.com/sicak-icecekler"]);
  });
});

describe("htmlToMenuText — nitelikteki açıklama", () => {
  it("data-description gibi niteliklerdeki ürün bilgisi metne katılır", () => {
    const html = `<button class="menu-item" data-name="Serpme Kahvaltı" data-price="1000" data-description="Muhlama, Menemen, Kolot"><h3>Serpme Kahvaltı</h3><p>1000 ₺</p></button><button data-description><h3>Çay</h3></button>`;
    const { text } = htmlToMenuText(html);
    // Ad etiketlenir: değer adın önünde durduğu için model önceki ürüne bağlamasın.
    expect(text).toContain("(Serpme Kahvaltı — açıklama: Muhlama, Menemen, Kolot)");
  });
});
