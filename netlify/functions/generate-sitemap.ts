import type { Handler } from "@netlify/functions";
import { getFirebaseAdmin } from "../lib/firebase-admin";

const PUBLIC_STATUSES = ['ACTIVE', 'APPROVED'];

const handler: Handler = async () => {
  try {
    // Netlify garantiza URL en las funciones: al cambiar el dominio principal, cambia sola.
    const domain = process.env.URL || 'https://e-souvenirs.netlify.app';

    // Con el Admin SDK: el SDK del navegador lee import.meta.env, que aquí no existe.
    const snapshot = await getFirebaseAdmin()
      .firestore()
      .collection('companies')
      .where('status', 'in', PUBLIC_STATUSES)
      .get();
    const slugs = snapshot.docs
      .map((doc) => doc.data().slug)
      .filter((slug): slug is string => typeof slug === 'string' && slug !== '');

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${domain}</loc>
    <priority>1.0</priority>
  </url>
  ${slugs
    .map((slug) => `
  <url>
    <loc>${domain}/${encodeURIComponent(slug)}</loc>
    <priority>0.8</priority>
  </url>`)
    .join('')}
</urlset>`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml'
      },
      body: sitemap,
    };
  } catch (error) {
    console.error("Error generating sitemap:", (error as Error).message);
    return {
      statusCode: 500,
      body: "Internal Server Error: Could not generate sitemap.",
    };
  }
};

export { handler };
