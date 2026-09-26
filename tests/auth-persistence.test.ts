import { describe, expect, it } from "vitest";
import {
  SESSION_COOKIE,
  SESSION_ONLY_KEY,
  consumeExpiredSession,
  markLogin,
  type PersistenceEnv,
} from "@/lib/auth-persistence";

// "Beni hatırla" sözleşmesi: işaretliyse oturum kalıcıdır; değilse yalnızca
// tarayıcı açık kaldığı sürece (bütün sekmelerde) geçerlidir ve tarayıcı
// kapanıp açılınca kapanır.

function fakeEnv(): PersistenceEnv & { store: Map<string, string>; cookies: string[]; restartBrowser: () => void } {
  const store = new Map<string, string>();
  const cookies: string[] = [];
  return {
    store,
    cookies,
    storage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => void store.set(key, value),
      removeItem: (key) => void store.delete(key),
    },
    readCookies: () => cookies.map((cookie) => cookie.split(";")[0]).join("; "),
    writeCookie: (cookie) => void cookies.push(cookie),
    secure: true,
    // Oturum çerezleri (Expires'sız) tarayıcı kapanınca silinir; localStorage kalır.
    restartBrowser: () => void cookies.splice(0),
  };
}

describe("beni hatırla", () => {
  it("işaretliyse tarayıcı yeniden açılsa da oturum kapanmaz", () => {
    const env = fakeEnv();
    markLogin(true, env);
    expect(env.store.has(SESSION_ONLY_KEY)).toBe(false);
    env.restartBrowser();
    expect(consumeExpiredSession(env)).toBe(false);
  });

  it("işaretli değilse aynı tarayıcı oturumunda (her sekmede) giriş açık kalır", () => {
    const env = fakeEnv();
    markLogin(false, env);
    expect(env.store.get(SESSION_ONLY_KEY)).toBe("1");
    expect(consumeExpiredSession(env)).toBe(false);
  });

  it("işaretli değilse tarayıcı kapanıp açılınca oturum bir kez kapatılır", () => {
    const env = fakeEnv();
    markLogin(false, env);
    env.restartBrowser();
    expect(consumeExpiredSession(env)).toBe(true);
    // İşaret temizlenir: sonraki girişler yeniden seçime göre davranır.
    expect(env.store.has(SESSION_ONLY_KEY)).toBe(false);
    expect(consumeExpiredSession(env)).toBe(false);
  });

  it("sonraki girişte 'beni hatırla' seçilirse önceki kısıt kalkar", () => {
    const env = fakeEnv();
    markLogin(false, env);
    markLogin(true, env);
    env.restartBrowser();
    expect(consumeExpiredSession(env)).toBe(false);
  });

  it("oturum çerezi süresizdir, tüm yollarda geçerlidir ve güvenli bağlantıda Secure taşır", () => {
    const env = fakeEnv();
    markLogin(false, env);
    const cookie = env.cookies[0];
    expect(cookie.startsWith(`${SESSION_COOKIE}=1`)).toBe(true);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Secure");
    expect(cookie).not.toMatch(/Expires|Max-Age/i);
  });

  it("depolama erişilemezse çökmez ve oturumu kapatmaz", () => {
    const env = fakeEnv();
    env.storage.getItem = () => {
      throw new Error("erişim yok");
    };
    env.storage.setItem = () => {
      throw new Error("erişim yok");
    };
    expect(() => markLogin(false, env)).not.toThrow();
    expect(consumeExpiredSession(env)).toBe(false);
    expect(consumeExpiredSession(null)).toBe(false);
  });
});
