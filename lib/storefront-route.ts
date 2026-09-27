// Vitrin yönlendirmesinin bağımlılıksız parçası — middleware (edge) de okur,
// bu yüzden buraya plan/veri modülü import edilmez. Ayrıntı: lib/storefront.ts.

/** Kök isteği masadaki bir QR taramasından mı geliyor? Etiketli QR'lar `?qr=<kod>`,
 *  panelin ana QR'ı `?src=qr` taşır; bu ziyaretçi vitrine değil menüye gider. */
export function isTableScan(params: URLSearchParams): boolean {
  return params.has("qr") || params.get("src")?.toLowerCase() === "qr";
}
