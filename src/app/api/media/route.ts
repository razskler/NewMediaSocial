import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ALLOWED_MEDIA_TYPES,
  MEDIA_MAX_BYTES,
  saveMedia,
} from "@/lib/media";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in to upload photos." },
      { status: 401 },
    );
  }

  let file: File | null = null;
  try {
    const formData = await request.formData();
    const entry = formData.get("file");
    file = entry instanceof File ? entry : null;
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json(
      { error: "No photo provided." },
      { status: 400 },
    );
  }

  if (!ALLOWED_MEDIA_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Photos must be JPEG, PNG, WebP, or GIF." },
      { status: 400 },
    );
  }

  if (file.size > MEDIA_MAX_BYTES) {
    return NextResponse.json(
      { error: "Photos must be 8MB or smaller." },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const mediaId = await saveMedia(buffer, file.type, user.id);
    return NextResponse.json({ mediaId });
  } catch {
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 },
    );
  }
}
