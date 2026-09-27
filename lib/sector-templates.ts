import type { Template } from "@/lib/types";
import { msg } from "@/lib/ui-i18n";

// İlk girişte örnek veri yerine sektör şablonu: işletme boş bir panelle değil,
// kendi sektörünün kategori iskeletiyle başlar. Ürün eklenmemiş kategoriler
// müşteri menüsünde görünmez (bkz. MenuProvider), yani yarım menü yayına çıkmaz.

export type SectorKey = "kafe" | "restoran" | "pastane" | "bar" | "bos";

export interface SectorTemplate {
  key: SectorKey;
  /** Kurulum ekranındaki ad/açıklama — panel diline çevrilir (msg). Kategori ve
   *  ürün adları ise menü içeriğidir, işletmenin ana dilinde (Türkçe) oluşur. */
  label: string;
  description: string;
  /** Menü görünümü: görsel ağırlıklı sektörlerde grid. */
  template: Template;
  categories: {
    name: string;
    products: { name: string; description: string; price: number }[];
  }[];
}

export const SECTOR_TEMPLATES: SectorTemplate[] = [
  {
    key: "kafe",
    label: msg("Kafe"),
    description: msg("Kahve, tatlı ve atıştırmalık"),
    template: "liste",
    categories: [
      {
        name: "Sıcak Kahveler",
        products: [
          { name: "Filtre Kahve", description: "Taze demlenmiş yöresel filtre kahve", price: 120 },
          { name: "Caffe Latte", description: "Espresso ve sıcak süt", price: 145 },
          { name: "Americano", description: "Espresso ve sıcak su", price: 130 },
        ],
      },
      {
        name: "Soğuk Kahveler",
        products: [
          { name: "Iced Latte", description: "Buzlu espresso ve süt", price: 150 },
          { name: "Iced Americano", description: "Buzlu americano", price: 135 },
        ],
      },
      {
        name: "Çaylar",
        products: [
          { name: "Fincan Çay", description: "Taze demlenmiş Türk çayı", price: 60 },
          { name: "Bitki Çayı", description: "Günün bitki çayı (Nane limon, Adaçayı vb.)", price: 125 },
        ],
      },
      { name: "Soğuk İçecekler", products: [] },
      {
        name: "Tatlılar",
        products: [
          { name: "San Sebastian Cheesecake", description: "Özel peynirli İspanyol keki", price: 180 },
          { name: "Brownie", description: "Belçika çikolatalı yoğun kek", price: 160 },
        ],
      },
      { name: "Atıştırmalıklar", products: [] },
    ],
  },
  {
    key: "restoran",
    label: msg("Restoran"),
    description: msg("Başlangıçtan tatlıya tam menü"),
    template: "liste",
    categories: [
      {
        name: "Başlangıçlar",
        products: [
          { name: "Günün Çorbası", description: "Şefin özel tarifiyle taze çorba", price: 120 },
          { name: "Paçanga Böreği", description: "Pastırmalı ve kaşarlı çıtır börek", price: 160 },
        ],
      },
      { name: "Salatalar", products: [] },
      {
        name: "Ana Yemekler",
        products: [
          { name: "Izgara Köfte", description: "Közlenmiş biber ve pilav ile", price: 280 },
          { name: "Tavuk Şinitzel", description: "Patates kızartması ve özel sos ile", price: 240 },
        ],
      },
      {
        name: "Tatlılar",
        products: [
          { name: "Sütlaç", description: "Fırınlanmış geleneksel sütlaç", price: 130 },
        ],
      },
      {
        name: "İçecekler",
        products: [
          { name: "Ayran", description: "Köpüklü yayık ayranı", price: 60 },
          { name: "Kola / Fanta / Sprite", description: "Kutu meşrubat 330ml", price: 75 },
        ],
      },
    ],
  },
  {
    key: "pastane",
    label: msg("Pastane"),
    description: msg("Görsel ağırlıklı vitrin menüsü"),
    template: "grid",
    categories: [
      {
        name: "Pastalar",
        products: [
          { name: "Çikolatalı Pasta", description: "Yoğun çikolata kremalı yaş pasta", price: 180 },
          { name: "Meyveli Pasta", description: "Mevsim meyveli hafif pasta", price: 175 },
        ],
      },
      {
        name: "Börek & Poğaça",
        products: [
          { name: "Su Böreği", description: "Peynirli el açması su böreği (Porsiyon)", price: 140 },
          { name: "Kaşarlı Poğaça", description: "Sıcak taze poğaça", price: 50 },
        ],
      },
      { name: "Kurabiye & Kuru Pasta", products: [] },
      { name: "Sıcak İçecekler", products: [] },
    ],
  },
  {
    key: "bos",
    label: msg("Boş başla"),
    description: msg("Kategorileri kendim oluşturacağım"),
    template: "liste",
    categories: [],
  },
];

export function sectorTemplate(key: string | null | undefined): SectorTemplate {
  return SECTOR_TEMPLATES.find((item) => item.key === key) ?? SECTOR_TEMPLATES[SECTOR_TEMPLATES.length - 1]!;
}
