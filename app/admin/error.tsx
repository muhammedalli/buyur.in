"use client";

import { Button, Card } from "@/components/panel/ui";

// PocketBase'e ulaşılamadığında (AdminAuthUnavailableError) ya da sayfa
// verisi okunamadığında. Oturum düşürülmez: sorun geçiciyse yeniden denemek yeter.
export default function AdminConsoleError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-5">
      <Card className="max-w-md text-center">
        <p className="font-display text-lg font-bold">Yönetim paneline şu anda ulaşılamıyor</p>
        <p className="mt-1 text-sm text-ink-soft">Veritabanı bağlantısında geçici bir sorun olabilir. Veriler güvende.</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => reset()}>
          Tekrar dene
        </Button>
      </Card>
    </div>
  );
}
