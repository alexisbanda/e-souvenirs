import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import HomePageSeo from './HomePageSeo';

const baseProps = {
    title: 'Mi Tienda - Productos Únicos',
    description: 'Encuentra recuerdos y artículos personalizados en Mi Tienda.',
    canonicalUrl: 'https://e-souvenirs.com/mi-tienda',
    ogImageUrl: 'https://e-souvenirs.com/logo.png',
};

const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Mi Tienda',
};

// Documento completo que imita index.html: React 19 sube <title>, <meta> y
// <link> renderizados en cualquier parte del árbol al <head>.
const renderDocument = (children: React.ReactNode) =>
    renderToString(
        <html>
            <head>
                <title>e-souvenirs</title>
            </head>
            <body>
                <div id="root">{children}</div>
            </body>
        </html>,
    );

const extractHead = (html: string) => {
    const match = html.match(/<head[^>]*>([\s\S]*?)<\/head>/);
    if (!match) throw new Error('No se encontró <head> en el HTML renderizado');
    return match[1];
};

describe('HomePageSeo', () => {
    it('sube al <head> las mismas meta/link que ponía Helmet, con los valores pasados', () => {
        const html = renderDocument(<HomePageSeo {...baseProps} structuredData={structuredData} />);
        const head = extractHead(html);

        // Primary
        expect(head).toContain(`<meta name="description" content="${baseProps.description}"`);

        // Canonical
        expect(head).toContain(`<link rel="canonical" href="${baseProps.canonicalUrl}"`);

        // Open Graph
        expect(head).toContain('<meta property="og:type" content="website"');
        expect(head).toContain(`<meta property="og:url" content="${baseProps.canonicalUrl}"`);
        expect(head).toContain(`<meta property="og:title" content="${baseProps.title}"`);
        expect(head).toContain(`<meta property="og:description" content="${baseProps.description}"`);
        expect(head).toContain(`<meta property="og:image" content="${baseProps.ogImageUrl}"`);

        // Twitter
        expect(head).toContain('<meta name="twitter:card" content="summary_large_image"');
        expect(head).toContain(`<meta property="twitter:url" content="${baseProps.canonicalUrl}"`);
        expect(head).toContain(`<meta name="twitter:title" content="${baseProps.title}"`);
        expect(head).toContain(`<meta name="twitter:description" content="${baseProps.description}"`);
        expect(head).toContain(`<meta property="twitter:image" content="${baseProps.ogImageUrl}"`);
    });

    it('incluye el <title> de la tienda en el head', () => {
        const html = renderDocument(<HomePageSeo {...baseProps} structuredData={null} />);
        const head = extractHead(html);

        expect(head).toContain(`<title>${baseProps.title}</title>`);
    });

    it('con structuredData renderiza el JSON-LD en un <script> con el JSON', () => {
        const html = renderDocument(<HomePageSeo {...baseProps} structuredData={structuredData} />);

        expect(html).toContain('<script type="application/ld+json">');
        expect(html).toContain('"@type":"LocalBusiness"');
    });

    it('sin structuredData (null) no renderiza el <script> de JSON-LD', () => {
        const html = renderDocument(<HomePageSeo {...baseProps} structuredData={null} />);

        expect(html).not.toContain('application/ld+json');
    });

    it('sin ogImageUrl no rompe el render', () => {
        const propsWithoutImage = {
            title: baseProps.title,
            description: baseProps.description,
            canonicalUrl: baseProps.canonicalUrl,
        };
        expect(() => renderDocument(<HomePageSeo {...propsWithoutImage} structuredData={null} />)).not.toThrow();

        const html = renderDocument(<HomePageSeo {...propsWithoutImage} structuredData={null} />);
        const head = extractHead(html);
        expect(head).toContain('<meta property="og:title"');
    });
});
