import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { getCompanies } from "../../services/companyService";
import { Company } from "../../types/company";

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  try {
    const domain = "https://www.esouvenirs.app";
    
    // 1. Fetch all companies
    const allCompanies = await getCompanies();

    // 2. Filter for public companies (adjust status as needed)
    const publicCompanies = allCompanies.filter(
      (company) => company.status === 'ACTIVE' || company.status === 'APPROVED'
    );

    // 3. Start building the XML sitemap
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${domain}</loc>
    <priority>1.0</priority>
  </url>
  ${publicCompanies
    .map((company: Company) => `
  <url>
    <loc>${domain}/${company.slug}</loc>
    <priority>0.8</priority>
  </url>`)
    .join('')}
</urlset>`;

    // 4. Return the XML response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml'
      },
      body: sitemap,
    };
  } catch (error) {
    console.error("Error generating sitemap:", error);
    return {
      statusCode: 500,
      body: "Internal Server Error: Could not generate sitemap.",
    };
  }
};

export { handler };
