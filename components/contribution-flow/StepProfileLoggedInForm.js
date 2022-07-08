import React, { Fragment, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';

import useLoggedInUser from '../../lib/hooks/useLoggedInUser';

import { Box, Flex } from '../Grid';
import PrivateInfoIcon from '../icons/PrivateInfoIcon';
import StyledHr from '../StyledHr';
import StyledInput from '../StyledInput';
import StyledInputField from '../StyledInputField';
import StyledInputLocation from '../StyledInputLocation';
import { P, Span } from '../Text';

import ContributeProfilePicker from './ContributeProfilePicker';
import StepProfileInfoMessage from './StepProfileInfoMessage';
import { contributionRequiresAddress, contributionRequiresLegalName } from './utils';

export const NEW_ORGANIZATION_KEY = 'newOrg';

// const getDefaultProfile = (stepProfile, profiles, defaultProfileSlug) => {
//   // If there's a default profile slug, enforce it
//   if (defaultProfileSlug) {
//     const contributorProfile = profiles.find(({ slug }) => slug === defaultProfileSlug);
//     if (contributorProfile) {
//       return contributorProfile;
//     }
//   }

//   // Otherwise use the state-defined profile
//   if (stepProfile) {
//     return stepProfile;
//   }

//   // If none defined yet, fallback to the logged-in user personal profile, if any
//   return profiles?.[0] || null;
// };

const getProfileInfo = (stepProfile, profiles) => {
  if (stepProfile?.isIncognito) {
    const profileLocation = stepProfile.location || {};
    const isEmptyLocation = !profileLocation.address && !profileLocation.country && !profileLocation.structured;
    return {
      name: '', // Can't change name for incognito
      legalName: stepProfile.legalName ?? (profiles[0].legalName || profiles[0].name || ''), // Default to user's legal name
      location: (isEmptyLocation ? profiles[0].location : stepProfile.location) || {}, // Default to user's location
    };
  } else {
    return {
      name: stepProfile?.name || '',
      legalName: stepProfile?.legalName || '',
      location: stepProfile?.location || {},
    };
  }
};

const StepProfileLoggedInForm = ({ profiles, onChange, canUseIncognito, collective, data, stepDetails }) => {
  // const { LoggedInUser } = useLoggedInUser();
  // const getProfileArgs = [LoggedInUser, collective, canUseIncognito];
  // const profiles = React.useMemo(() => getContributorProfiles(...getProfileArgs), getProfileArgs); // TODO move to upper component
  // const defaultProfile = getDefaultProfile(data, profiles, defaultProfileSlug); // TODO move to upper component
  const profileInfo = getProfileInfo(data, profiles);
  const isContributingFromSameHost = data?.host?.id === collective.host.legacyId;

  return (
    <Fragment>
      <Box mb={4}>
        <ContributeProfilePicker
          profiles={profiles}
          canUseIncognito={canUseIncognito}
          selectedProfile={data}
          onChange={profile => onChange({ stepProfile: profile })}
        />
      </Box>
      {!isContributingFromSameHost && contributionRequiresLegalName(stepDetails) && (
        <React.Fragment>
          {!data?.isIncognito && (
            <StyledInputField
              htmlFor="name"
              label={<FormattedMessage defaultMessage="Your name" />}
              labelFontSize="16px"
              labelFontWeight="700"
              hint={<FormattedMessage defaultMessage="This is your display name or alias." />}
            >
              {inputProps => (
                <StyledInput
                  {...inputProps}
                  value={profileInfo.name}
                  placeholder="Thomas Anderson"
                  onChange={e => onChange({ stepProfile: { ...data, name: e.target.value } })}
                  maxLength="255"
                />
              )}
            </StyledInputField>
          )}
          <StyledInputField
            htmlFor="legalName"
            label={<FormattedMessage defaultMessage="Legal name" />}
            required={!profileInfo.name}
            labelFontSize="16px"
            labelFontWeight="700"
            isPrivate
            mt={20}
            hint={
              <FormattedMessage defaultMessage="If different from your display name. Not public. Important for receipts, invoices, payments, and official documentation." />
            }
          >
            {inputProps => (
              <StyledInput
                {...inputProps}
                value={profileInfo.legalName}
                placeholder={profileInfo.name}
                onChange={e => onChange({ stepProfile: { ...data, legalName: e.target.value } })}
                maxLength="255"
              />
            )}
          </StyledInputField>
        </React.Fragment>
      )}
      {!isContributingFromSameHost && contributionRequiresAddress(stepDetails) && (
        <React.Fragment>
          <Flex alignItems="center" my="14px">
            <P fontSize="24px" lineHeight="32px" fontWeight="500" mr={2}>
              <FormattedMessage id="collective.address.label" defaultMessage="Address" />
            </P>
            <Span mr={2} lineHeight="0">
              <PrivateInfoIcon size="14px" tooltipProps={{ containerLineHeight: '0' }} />
            </Span>
            <StyledHr my="18px" borderColor="black.300" width="100%" />
          </Flex>
          <StyledInputLocation
            autoDetectCountry
            location={profileInfo.location}
            onChange={value => onChange({ stepProfile: { ...data, location: value } })}
            labelFontSize="16px"
            labelFontWeight="700"
          />
        </React.Fragment>
      )}
      <StepProfileInfoMessage hasIncognito />
    </Fragment>
  );
};

StepProfileLoggedInForm.propTypes = {
  data: PropTypes.object,
  stepDetails: PropTypes.object,
  onChange: PropTypes.func,
  // defaultProfileSlug: PropTypes.string,
  profiles: PropTypes.arrayOf(PropTypes.object),
  canUseIncognito: PropTypes.bool,
  collective: PropTypes.shape({
    host: PropTypes.shape({
      legacyId: PropTypes.number,
    }),
  }),
};

export default StepProfileLoggedInForm;
