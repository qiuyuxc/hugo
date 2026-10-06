import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export function getStaticPaths() {
  return ['192', '512'].map(size => ({ params: { size } }));
}
export async function GET({ params }: { params: { size?: string } }) {
  if (!['192', '512'].includes(params.size || '')) return new Response(null, { status: 404 });
  const image = await readFile(resolve(`src/assets/app-icon-${params.size}.png`));
  return new Response(new Uint8Array(image), { headers: { 'Content-Type': 'image/png' } });
}
