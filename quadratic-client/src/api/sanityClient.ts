export type SanityExample = {
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

function sanityFetch(groqQueryString: string) {
  // If it's production, use the freshest stuff. Otherwise use the cached CDN (less $$$)
  const subdomain = 'api'; // process.env.NODE_ENV === 'production' ? 'api' : 'apicdn';
  const version = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return fetch(`https://b24dbxy9.${subdomain}.sanity.io/v${version}/data/query/production?query=${groqQueryString}`)
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
  getExamples: async (): Promise<SanityExample[]> =>
    sanityFetch(`*[_type == "gallery"] | order(priority asc) ${fields}`),
  getExample: async (slug: string): Promise<SanityExample> => sanityFetch(`*[slug == "${slug}"][0] ${fields}`),
};
