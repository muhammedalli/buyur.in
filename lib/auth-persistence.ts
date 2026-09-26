// "Beni hatırla" — giriş ekranındaki seçimin kuralı. Sözleşmesi
// tests/auth-persistence.test.ts.
//
// PocketBase oturumu tarayıcıda localStorage'da durur ve varsayılan olarak
// kalıcıdır (tarayıcı kapansa da giriş açık kalır). "Beni hatırla" işaretli
// değilse oturum yalnızca bu tarayıcı açıkken geçerli olmalı. localStorage'ı
// sessionStorage'a taşımak sekmeler arasında oturumu bölerdi (yeni sekme
// çıkış yapmış görünürdü); bunun yerine:
//   - girişte "yalnızca bu oturum" işareti localStorage'a yazılır,
//   - tarayıcı oturumu boyunca yaşayan (süresiz) bir çerez atılır; bütün
//     sekmeler görür, tarayıcı kapanınca silinir,
//   - açılışta işaret var ama çerez yoksa tarayıcı kapanıp açılmıştır →
//     oturum kapatılır.

export const SESSION_ONLY_KEY = "buyur-auth-session-only";
export const SESSION_COOKIE = "buyur_auth_session";

export interface PersistenceEnv {
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  readCookies: () => string;
  writeCookie: (cookie: string) => void;
  secure: boolean;
}

export function browserEnv(): PersistenceEnv | null {
  if (typeof window === "undefined") return null;
  return {
    storage: window.localStorage,
    readCookies: () => document.cookie,
    writeCookie: (cookie) => {
      document.cookie = cookie;
    },
    secure: window.location.protocol === "https:",
  };
}

function hasSessionCookie(env: PersistenceEnv): boolean {
  return env.readCookies().split(/;\s*/).some((part) => part.startsWith(`${SESSION_COOKIE}=`));
}

/** Başarılı girişten sonra çağrılır: seçimi kaydeder, tarayıcı oturumunu işaretler. */
export function markLogin(remember: boolean, env: PersistenceEnv | null = browserEnv()): void {
  if (!env) return;
  try {
    if (remember) env.storage.removeItem(SESSION_ONLY_KEY);
    else env.storage.setItem(SESSION_ONLY_KEY, "1");
    // Expires/Max-Age yok: tarayıcı kapanınca silinir.
    env.writeCookie(`${SESSION_COOKIE}=1; Path=/; SameSite=Lax${env.secure ? "; Secure" : ""}`);
  } catch {
    // Depolama kapalıysa seçim tutulamaz; oturum varsayılan (kalıcı) davranışta kalır.
  }
}

/** Açılışta: "beni hatırlama" seçilmiş ve tarayıcı kapanıp açılmışsa true
 *  döner ve işareti temizler — çağıran oturumu kapatır. */
export function consumeExpiredSession(env: PersistenceEnv | null = browserEnv()): boolean {
  if (!env) return false;
  try {
    if (env.storage.getItem(SESSION_ONLY_KEY) !== "1") return false;
    if (hasSessionCookie(env)) return false;
    env.storage.removeItem(SESSION_ONLY_KEY);
    return true;
  } catch {
    return false;
  }
}
