import { NextRequest, NextResponse } from "next/server";
import { createServerPB } from "@/lib/pocketbase";
import { pbFileUrl, PRODUCT_COLLECTION } from "@/lib/files";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * 3D ve Apple AR modellerini (USDZ / GLB) doğru MIME türleri ve inline başlıkları
 * ile istemciye aktaran proxy uç noktası.
 *
 * Apple iOS Quick Look, sunucudan `Content-Type: model/vnd.usdz+zip` ve
 * `Content-Disposition: inline` bekler. PocketBase standart olarak USDZ dosyalarını
 * zip arşivi sanıp `application/zip` ve `attachment` olarak servis ettiğinde
 * Safari AR açmak yerine zip indirme penceresi gösterir. Bu uç nokta bu sorunu çözer.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string; fileName: string }> }
) {
  const { productId, fileName } = await params;
  if (!productId || !fileName) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const isUsdz = fileName.toLowerCase().endsWith(".usdz");
  const isGlb = fileName.toLowerCase().endsWith(".glb");

  if (!isUsdz && !isGlb) {
    return new NextResponse("Desteklenmeyen dosya türü", { status: 400 });
  }

  try {
    const pb = createServerPB();
    const product = await pb.collection(PRODUCT_COLLECTION).getOne<Product>(productId);

    const actualFileName = isUsdz ? product.ar_model_usdz : product.ar_model_glb;
    if (!actualFileName) {
      return new NextResponse("Model bulunamadı", { status: 404 });
    }

    const upstreamUrl = pbFileUrl(PRODUCT_COLLECTION, product.id, actualFileName);
    const rangeHeader = req.headers.get("range");

    const fetchHeaders: HeadersInit = {};
    if (rangeHeader) {
      fetchHeaders["Range"] = rangeHeader;
    }

    const upstreamRes = await fetch(upstreamUrl, {
      headers: fetchHeaders,
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return new NextResponse("Sunucu hatası", { status: upstreamRes.status });
    }

    const contentType = isUsdz ? "model/vnd.usdz+zip" : "model/gltf-binary";
    const responseHeaders = new Headers();

    responseHeaders.set("Content-Type", contentType);
    responseHeaders.set("Content-Disposition", `inline; filename="${actualFileName}"`);
    responseHeaders.set("Accept-Ranges", "bytes");

    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) responseHeaders.set("Content-Length", contentLength);

    const contentRange = upstreamRes.headers.get("content-range");
    if (contentRange) responseHeaders.set("Content-Range", contentRange);

    responseHeaders.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=86400");

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    if (err?.status === 404) {
      return new NextResponse("Ürün bulunamadı", { status: 404 });
    }
    console.error("AR model proxy hatası:", err);
    return new NextResponse("Sunucu hatası", { status: 500 });
  }
}
