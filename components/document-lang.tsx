"use client";

import { useEffect } from "react";

// Kök layout <html lang="tr"> sabittir (tek kök layout). Başka dilde bir sayfa
// (ör. /en) açıkken belge dili ekran okuyucular ve tarayıcı çevirisi için
// eşitlenir; ayrılınca eski değere döner. Görünen metnin dili ayrıca en yakın
// `lang` sarmalayıcısından okunur (ilk boyamada doğru olsun diye).
export function DocumentLang({ lang }: { lang: string }) {
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [lang]);
  return null;
}
