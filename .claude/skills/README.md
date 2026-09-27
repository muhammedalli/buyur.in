# buyur Skill'leri

Bu klasördeki skill'ler, buyur'da sık tekrarlanan işlerin adım adım akışlarını
tutar. Claude ilgili iş geldiğinde bunları kendisi yükler; `/skill-adi` ile de
çağırabilirsiniz.

| Skill | Ne zaman devreye girer |
|---|---|
| **buyur-musteri-menusu** | Müşteri QR menüsünde ekran, sepet, dil veya hız işi |
| **buyur-panel-sayfasi** | Panele yeni ekran, form veya liste eklenirken |
| **buyur-veri-modeli** | Yeni alan/koleksiyon, şema göçü, yeni API ucu |
| **buyur-analitik-event** | Yeni event, metrik, rapor veya huni analizi |
| **buyur-plan-kilidi** | Bir özelliği plana bağlarken, limit değiştirirken |
| **buyur-cok-dilli-icerik** | Çevrilebilir alan, yeni dil, RTL, hreflang |
| **buyur-ai-akisi** | Menü tarama, AI çeviri, görsel bulma, yeni model çağrısı |
| **buyur-yayin-oncesi** | Commit / PR / deploy öncesi doğrulama turu |

Proje geneli kurallar: [`../../CLAUDE.md`](../../CLAUDE.md)
Alan kuralları: [`../../docs/`](../../docs/) (mimari, UI, dil, yönetim paneli, ödemeler, analitik)
Uzman ajanlar: [`../agents/`](../agents/)
