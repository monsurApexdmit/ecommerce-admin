import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Backend uploads directory — adjust if the Go server runs from a different location
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/home/monsur/Documents/Go/go-crud';

export async function GET(req: NextRequest) {
  const imageUrl = req.nextUrl.searchParams.get('url');
  if (!imageUrl) {
    return new NextResponse('Missing url param', { status: 400 });
  }

  // Prevent path traversal attacks
  const safePath = imageUrl.replace(/\.\./g, '').replace(/^\/+/, '');
  const filePath = path.join(UPLOADS_DIR, safePath);

  if (!fs.existsSync(filePath)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentTypeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  };
  const contentType = contentTypeMap[ext] || 'application/octet-stream';

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
