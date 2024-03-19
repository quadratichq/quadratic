import { sanityClient } from '@/api/sanityClient';
import { ROUTES } from '@/constants/routes';
import { LoaderFunctionArgs, redirect } from 'react-router-dom';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { slug } = params;

  if (!slug) {
    return redirect(ROUTES.EXAMPLES);
  }

  try {
    const example = await sanityClient.getExample(slug);
    // Validate is uuid
    // const uuid = example.url.split('/').pop() || '';

    console.log(example);
    return redirect(example.url);
  } catch (e) {
    return redirect(ROUTES.EXAMPLES);
  }
};
