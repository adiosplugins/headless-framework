import { GetServerSidePropsResult, GetStaticPropsContext } from 'next';
import { getUriInfo, getPosts, getContentNode } from './services';
import { initializeApollo, addApolloState } from '../provider';
import { headlessConfig } from '../config';
import { ContentNodeIdType, UriInfo } from '../types';
import { resolvePrefixedUrlPath } from '../utils';
import getCurrentPath from '../utils/getCurrentPath';
import { ensureAuthorization } from '../auth';
import { isPreview, isPreviewPath } from '../utils/preview';

/**
 * Must be called from getServerSideProps within a Next app in order to support SSR. It will
 * initialized cookies and prefetch/cache the page content and bundle it with the page for
 * rehydration on the frontend.
 *
 * @param {GetStaticPropsContext} context The Next SSR context
 */
export async function initializeNextStaticProps(
  context: GetStaticPropsContext,
): Promise<GetServerSidePropsResult<unknown>> {
  const apolloClient = initializeApollo();

  const wpeConfig = headlessConfig();

  const currentUrlPath = resolvePrefixedUrlPath(
    getCurrentPath(context),
    wpeConfig.uriPrefix,
  );

  const pageInfo = (await getUriInfo(
    apolloClient,
    currentUrlPath,
    isPreview(context),
  )) as UriInfo;

  if (isPreview(context)) {
    const path = Array.isArray(context.params?.page)
      ? context.params?.page ?? []
      : [context.params?.page];

    /**
     * @todo make this host dynamic... unfortunately it's not available in static
     */
    const response = ensureAuthorization(
      `http://localhost:3000/${path.join('/') ?? ''}`,
    );

    if (typeof response !== 'string' && response?.redirect) {
      return {
        redirect: {
          permanent: false,
          destination: response.redirect,
        },
      };
    }
  } else if (isPreviewPath(context)) {
    return {
      notFound: true,
      props: {},
    };
  }

  if (pageInfo.isPostsPage) {
    await getPosts(apolloClient);
  } else {
    await getContentNode(
      apolloClient,
      pageInfo.uriPath,
      ContentNodeIdType.URI,
      isPreview(context),
    );
  }

  return addApolloState(apolloClient, {
    props: { preview: context.preview ?? false },
    revalidate: 1,
  });
}