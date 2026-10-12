import { PB_URL, pb } from "@/lib/pocketbase";

export interface UploadProgress {
  /** 0 ile 100 arasında yüzde. */
  percent: number;
  /** Yüklenen miktar (ör. "14.2 MB"). */
  loadedMb: string;
  /** Toplam dosya boyutu (ör. "28.5 MB"). */
  totalMb: string;
  /** Yükleme hızı (ör. "2.4 MB/s"). */
  speedMb: string;
  /** Tahmini kalan süre (saniye). */
  remainingSec: number;
}

/**
 * Gönderilen gövdede yüklenmeyi bekleyen dosya (File/Blob) var mı kontrol eder.
 */
export function hasFileField(body: Record<string, any>): boolean {
  return Object.values(body).some(
    (v) => v instanceof File || (typeof Blob !== "undefined" && v instanceof Blob)
  );
}

/**
 * PocketBase uyumlu FormData nesnesi oluşturur.
 * Primitifler ve dosyalar doğrudan eklenir, JSON alanları (translations vb.)
 * ve diziler @jsonPayload ile paketlenir.
 */
export function buildFormData(body: Record<string, any>): FormData {
  const formData = new FormData();
  const jsonPayload: Record<string, any> = {};

  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    if (value instanceof File || (typeof Blob !== "undefined" && value instanceof Blob)) {
      let fileToAppend = value;
      if (value instanceof File) {
        const nameLower = value.name.toLowerCase();
        if (nameLower.endsWith(".usdz") && value.type !== "model/vnd.usdz+zip") {
          fileToAppend = new File([value], value.name, { type: "model/vnd.usdz+zip" });
        } else if (nameLower.endsWith(".glb") && value.type !== "model/gltf-binary") {
          fileToAppend = new File([value], value.name, { type: "model/gltf-binary" });
        }
      }
      formData.append(key, fileToAppend);
    } else if (value === null) {
      jsonPayload[key] = null;
    } else if (typeof value === "object") {
      jsonPayload[key] = value;
    } else {
      formData.append(key, String(value));
    }
  }

  if (Object.keys(jsonPayload).length > 0) {
    formData.append("@jsonPayload", JSON.stringify(jsonPayload));
  }

  return formData;
}

/**
 * PocketBase koleksiyonuna FormData ile gerçek zamanlı yükleme ilerlemesini (XHR)
 * takip ederek kayıt oluşturan veya güncelleyen yardımcı fonksiyon.
 */
export function uploadWithProgress<T = any>(
  collection: string,
  recordId: string | undefined,
  body: Record<string, any>,
  onProgress?: (progress: UploadProgress) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const formData = buildFormData(body);
    const xhr = new XMLHttpRequest();
    const isUpdate = Boolean(recordId);
    const url = isUpdate
      ? `${PB_URL}/api/collections/${collection}/records/${recordId}`
      : `${PB_URL}/api/collections/${collection}/records`;
    const method = isUpdate ? "PATCH" : "POST";

    xhr.open(method, url);

    // PocketBase istemcisinin geçerli oturum token'ı
    const token = pb.authStore.token;
    if (token) {
      xhr.setRequestHeader("Authorization", token);
    }

    const startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;
    let currentSpeed = 0;

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || event.total === 0) return;

        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000;

        if (timeDiff >= 0.15) {
          const speedBytes = (event.loaded - lastLoaded) / timeDiff;
          currentSpeed = currentSpeed === 0 ? speedBytes : currentSpeed * 0.4 + speedBytes * 0.6;
          lastLoaded = event.loaded;
          lastTime = now;
        }

        const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
        const remainingBytes = Math.max(0, event.total - event.loaded);
        const remainingSec = currentSpeed > 0 ? Math.ceil(remainingBytes / currentSpeed) : 0;

        const loadedMb = (event.loaded / (1024 * 1024)).toFixed(1);
        const totalMb = (event.total / (1024 * 1024)).toFixed(1);
        const speedMb =
          currentSpeed > 0 ? `${(currentSpeed / (1024 * 1024)).toFixed(1)} MB/s` : "Hesaplanıyor…";

        onProgress({
          percent,
          loadedMb: `${loadedMb} MB`,
          totalMb: `${totalMb} MB`,
          speedMb,
          remainingSec,
        });
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) {
          onProgress({
            percent: 100,
            loadedMb: "Tamamlandı",
            totalMb: "",
            speedMb: "",
            remainingSec: 0,
          });
        }
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve(xhr.response as any);
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject({
            status: xhr.status,
            data: errData,
            message: errData.message || xhr.statusText,
          });
        } catch {
          reject({
            status: xhr.status,
            message: xhr.statusText || "Sunucu hatası",
          });
        }
      }
    };

    xhr.onerror = () => {
      reject({
        status: 0,
        message: "Ağ bağlantısı hatası. Sunucuya ulaşılamadı.",
      });
    };

    xhr.ontimeout = () => {
      reject({
        status: 408,
        message: "Yükleme zaman aşımına uğradı. Lütfen tekrar deneyin.",
      });
    };

    xhr.send(formData);
  });
}

/**
 * PocketBase ve sunucu hata yanıtlarını insan okunur Türkçe metne çevirir.
 */
export function formatPbErrorMessage(err: any): string {
  if (err?.status === 413) {
    return "Dosya boyutu çok büyük: Sunucu isteği reddetti (413 Payload Too Large). Maksimum dosya boyutu 50MB'dir.";
  }
  if (err?.status === 408) {
    return "Yükleme zaman aşımına uğradı. İnternet bağlantınızı kontrol edin.";
  }
  if (err?.status === 0) {
    return "Ağ bağlantısı koptu veya sunucuya ulaşılamadı.";
  }

  const data = err?.data?.data || err?.response?.data || err?.data;
  if (data && typeof data === "object") {
    const fieldMap: Record<string, string> = {
      ar_model_glb: "3D GLB Modeli",
      ar_model_usdz: "Apple USDZ Modeli",
      image: "Ürün Görseli",
      name: "Ürün Adı",
      price: "Fiyat",
      category: "Kategori",
      description: "Açıklama",
    };

    const fieldErrors = Object.entries(data)
      .filter(([k]) => k !== "code" && k !== "message")
      .map(([field, item]: any) => {
        const fieldName = fieldMap[field] || field;
        const msg = typeof item === "string" ? item : item?.message || JSON.stringify(item);
        return `${fieldName}: ${msg}`;
      })
      .filter(Boolean);

    if (fieldErrors.length > 0) {
      return `Kayıt hatası — ${fieldErrors.join(" · ")}`;
    }
  }

  return err?.data?.message || err?.message || "Kaydedilemedi, alanları kontrol edip tekrar dene.";
}
