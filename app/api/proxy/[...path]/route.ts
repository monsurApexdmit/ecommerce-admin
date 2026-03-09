import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';

const EXT_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
};

const BACKEND_URL = process.env.BACKEND_URL || 'https://localhost:8004';
const UPLOADS_DIR = process.env.UPLOADS_DIR || '';

const backend = axios.create({
  baseURL: BACKEND_URL,
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  validateStatus: () => true,
  // Pass Buffer as-is; let axios handle everything else normally
  transformRequest: [(data, headers) => {
    if (Buffer.isBuffer(data)) return data;
    // Default axios JSON transform for non-buffer data
    if (typeof data === 'object' && data !== null) {
      if (headers) headers['Content-Type'] = 'application/json';
      return JSON.stringify(data);
    }
    return data;
  }],
  maxBodyLength: Infinity,
  maxContentLength: Infinity,
});

type Params = Promise<{ path: string[] }>;

async function proxyRequest(req: NextRequest, params: Params) {
  const { path: segments } = await params;
  const urlPath = '/' + segments.join('/');

  // Serve uploaded files directly from disk
  if (segments[0] === 'uploads' && UPLOADS_DIR) {
    const filePath = path.join(UPLOADS_DIR, ...segments);
    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      const mimeType = EXT_MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: { 'Content-Type': mimeType, 'Cache-Control': 'public, max-age=86400' },
      });
    }
    return new NextResponse('Not Found', { status: 404 });
  }
  const search = req.nextUrl.search;
  // Strip trailing slash to avoid 308 redirects from Go router
  const cleanPath = urlPath.replace(/\/+$/, '') || '/'

  const headers: Record<string, string> = {};
  const auth = req.headers.get('authorization');
  if (auth) headers['Authorization'] = auth;
  const cookie = req.headers.get('cookie');
  if (cookie) headers['Cookie'] = cookie;
  const contentType = req.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;

  let data: Buffer | object | string | undefined;
  if (!['GET', 'HEAD'].includes(req.method)) {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 0) {
      const isJson = contentType?.includes('application/json');
      if (isJson) {
        try {
          data = JSON.parse(Buffer.from(buf).toString('utf-8'));
        } catch {
          data = Buffer.from(buf);
        }
      } else {
        data = Buffer.from(buf);
      }
    }
  }

  const res = await backend.request({
    method: req.method as 'get' | 'post' | 'put' | 'patch' | 'delete',
    url: cleanPath + search,
    headers,
    data,
    responseType: 'arraybuffer',
  });

  const resContentType = res.headers['content-type'] || 'application/octet-stream';
  if (resContentType.includes('application/json')) {
    const text = Buffer.from(res.data).toString('utf-8');
    try {
      return NextResponse.json(JSON.parse(text), { status: res.status });
    } catch {
      return new NextResponse(text, { status: res.status, headers: { 'Content-Type': 'application/json' } });
    }
  }

  return new NextResponse(res.data, {
    status: res.status,
    headers: { 'Content-Type': resContentType },
  });
}

export async function GET(req: NextRequest, { params }: { params: Params }) {
  return proxyRequest(req, params);
}
export async function POST(req: NextRequest, { params }: { params: Params }) {
  return proxyRequest(req, params);
}
export async function PUT(req: NextRequest, { params }: { params: Params }) {
  return proxyRequest(req, params);
}
export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  return proxyRequest(req, params);
}
export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  return proxyRequest(req, params);
}
