// FYI: this was originally copy-pasted from what the marketing website uses
// https://github.com/quadratichq/quadratic-website/blob/main/lib/sanity-fetch.ts

function sanityFetch(groqQueryString: string) {
  const encodedQuery = encodeURIComponent(groqQueryString);
  // If it's production, use the freshest stuff. Otherwise use the cached CDN (less $$$)
  const subdomain = 'api'; // process.env.NODE_ENV === 'production' ? 'api' : 'apicdn';
  const version = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return fetch(`https://b24dbxy9.${subdomain}.sanity.io/v${version}/data/query/production?query=${encodedQuery}`)
    .then((res) => res.json())
    .then((res) => res.result);
}

const fields = `{
  name,
  description,
  priority,
  url,
  slug,
  tags,
  "thumbnail": thumbnail.asset->url,
  _createdAt,
  _updatedAt,
}`;

export const sanityClient = {
  examples: {
    list: async (): Promise<Example[]> => sanityFetch(`*[_type == "gallery"] | order(priority asc) ${fields}`),
    get: async (slug: string): Promise<Example> => sanityFetch(`*[slug == "${slug}"][0] ${fields}`),
  },
  educationWhitelist: {
    get: async (): Promise<EducationWhitelist> => sanityFetch(`*[_type == "educationWhitelist"]`),
  },
};

type Example = {
  name: string;
  description: string;
  priority: number;
  url: string;
  thumbnail: string | null;
  slug: string;
  tags: Array<string>;
  _createdAt: string;
  _updatedAt: string;
};

type EducationWhitelist = {
  emailSuffix: string;
}[];
