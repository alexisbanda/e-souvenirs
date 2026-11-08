import React from 'react';

interface HomePageSeoProps {
    title: string;
    description: string;
    canonicalUrl: string;
    ogImageUrl?: string;
    structuredData?: object | null;
}

// React 19 sube <title>, <meta> y <link> renderizados en cualquier parte del
// árbol al <head> del documento. El JSON-LD (<script>) no se sube: queda en
// el body, lo cual está aceptado para este caso.
const HomePageSeo: React.FC<HomePageSeoProps> = ({ title, description, canonicalUrl, ogImageUrl, structuredData }) => {
    return (
        <>
            {/* --- Primary Meta Tags --- */}
            <title>{title}</title>
            <meta name="description" content={description} />

            {/* --- Canonical URL --- */}
            <link rel="canonical" href={canonicalUrl} />

            {/* --- Open Graph / Facebook --- */}
            <meta property="og:type" content="website" />
            <meta property="og:url" content={canonicalUrl} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={ogImageUrl} />

            {/* --- Twitter --- */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta property="twitter:url" content={canonicalUrl} />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta property="twitter:image" content={ogImageUrl} />

            {/* --- Structured Data --- */}
            {structuredData && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
                />
            )}
        </>
    );
};

export default HomePageSeo;
