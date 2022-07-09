import React from 'react';
import { useQuery } from '@apollo/client';
import { useRouter } from 'next/router';
import { FormattedMessage } from 'react-intl';

import { API_V2_CONTEXT, gqlV2 } from '../../lib/graphql/helpers';
import useLoggedInUser from '../../lib/hooks/useLoggedInUser';

import EmbeddedPage from '../../components/EmbeddedPage';
import { Flex } from '../../components/Grid';
import Loading from '../../components/Loading';
import MessageBox from '../../components/MessageBox';
import MessageBoxGraphqlError from '../../components/MessageBoxGraphqlError';
import { ApplicationApproveScreen } from '../../components/oauth/ApplicationApproveScreen';
import SignInOrJoinFree from '../../components/SignInOrJoinFree';

const applicationQuery = gqlV2`
  query OAuthAuthorization($clientId: String!) {
    application(clientId: $clientId) {
      id
      name
      clientId
      redirectUri
      account {
        id
        name
        slug
        type
        imageUrl(height: 192)
      }
      oAuthAuthorization {
        id
        expiresAt
      }
    }
  }
`;

// See https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.1
const REQUIRED_URL_PARAMS = ['response_type', 'client_id'];

const isValidAuthorization = authorization => {
  return authorization && new Date(authorization.expiresAt) > new Date();
};

const OAuthAuthorizePage = () => {
  const { query } = useRouter();
  const { loadingLoggedInUser, LoggedInUser } = useLoggedInUser();
  const missingParams = REQUIRED_URL_PARAMS.filter(key => !query[key]);
  const skipQuery = missingParams.length;
  const queryVariables = { clientId: query['client_id'] };
  const queryParams = { skip: skipQuery, variables: queryVariables, context: API_V2_CONTEXT };
  const { data, error, loading: isLoadingAuthorization } = useQuery(applicationQuery, queryParams);
  const isLoading = loadingLoggedInUser || isLoadingAuthorization;
  const hasExistingAuthorization = isValidAuthorization(data?.application?.oAuthAuthorization);
  return (
    <EmbeddedPage title="Authorize application">
      <Flex justifyContent="center" alignItems="center" py={[90, null, null, 180]} px={2}>
        {isLoading ? (
          <Loading />
        ) : !LoggedInUser ? (
          <SignInOrJoinFree
            isOAuth
            oAuthAppName={data?.application?.name}
            oAuthAppImage={data?.application?.account?.imageUrl}
          />
        ) : missingParams.length ? (
          <MessageBox withIcon type="error">
            <FormattedMessage
              defaultMessage="Missing parameters: {parameters}"
              values={{ parameters: missingParams.join(', ') }}
            />
          </MessageBox>
        ) : query['response_type'] !== 'code' ? (
          <MessageBox withIcon type="error">
            <FormattedMessage
              defaultMessage='{field} has invalid value "{value}". Expected: "{expected}"'
              values={{ field: 'response_type', value: query['response_type'], expected: 'code' }}
            />
          </MessageBox>
        ) : error ? (
          <MessageBoxGraphqlError error={error} />
        ) : (
          <ApplicationApproveScreen
            application={data.application}
            redirectUri={query['redirect_uri']}
            autoApprove={hasExistingAuthorization}
            state={query['state']}
            scope={query['scope']}
          />
        )}
      </Flex>
    </EmbeddedPage>
  );
};

export default OAuthAuthorizePage;
