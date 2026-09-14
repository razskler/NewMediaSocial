import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getMedia } from "@/lib/media";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const media = await getMedia(id);
  if (!media) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(
    Readable.toWeb(media.stream) as unknown as ReadableStream<Uint8Array>,
    {
      status: 200,
      headers: {
        "Content-Type": media.contentType,
        "Content-Length": String(media.length),
        // Media ids are unique per upload, so responses never change.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
