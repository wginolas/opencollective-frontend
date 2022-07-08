import React from 'react';
import PropTypes from 'prop-types';
import { defineMessages, injectIntl } from 'react-intl';

import { CollectiveType } from '../../lib/constants/collectives';

import { Flex } from '../Grid';
import StyledCard from '../StyledCard';
import StyledHr from '../StyledHr';
import { H4 } from '../Text';
import { withUser } from '../UserProvider';

import StepCheckout from './StepCheckout';
import StepDetails from './StepDetails';
import StepDetailsCrypto from './StepDetailsCrypto';
import StepPayment from './StepPayment';
import StepProfile from './StepProfile';
import StepSummary from './StepSummary';

class ContributionFlowStepContainer extends React.Component {
  static propTypes = {
    intl: PropTypes.object,
    LoggedInUser: PropTypes.object,
    collective: PropTypes.object,
    tier: PropTypes.object,
    onChange: PropTypes.func,
    showFeesOnTop: PropTypes.bool,
    onNewCardFormReady: PropTypes.func,
    onSignInClick: PropTypes.func,
    defaultEmail: PropTypes.string,
    isEmbed: PropTypes.bool,
    defaultName: PropTypes.string,
    disabledPaymentMethodTypes: PropTypes.array,
    isSubmitting: PropTypes.bool,
    hideCreditCardPostalCode: PropTypes.bool,
    taxes: PropTypes.array,
    step: PropTypes.shape({
      name: PropTypes.string,
    }),
    isCrypto: PropTypes.bool,
    contributeProfiles: PropTypes.arrayOf(PropTypes.object),
    mainState: PropTypes.shape({
      stepDetails: PropTypes.object,
      stepProfile: PropTypes.shape({
        contributorRejectedCategories: PropTypes.array,
      }),
      stepSummary: PropTypes.object,
      stepPayment: PropTypes.object,
    }),
    order: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.headerMessages = defineMessages({
      details: { id: 'NewContributionFlow.ContributionDetailsTitle', defaultMessage: 'Contribution details' },
      profile: { id: 'contribute.step.contributeAs', defaultMessage: 'Contribute as' },
      'profile.guest': { id: 'NewContributionFlow.step.contributeAsGuest', defaultMessage: 'Contribute as a guest' },
      payment: { id: 'NewContributionFlow.ChoosePaymentMethod', defaultMessage: 'Choose payment method' },
      summary: { id: 'Summary', defaultMessage: 'Summary' },
      blockedContributor: {
        id: 'NewContributionFlow.BlockedContributor.Header',
        defaultMessage: 'Unable to contribute',
      },
    });
  }

  renderHeader = (step, LoggedInUser) => {
    const { intl } = this.props;
    if (step === 'profile' && !LoggedInUser) {
      return intl.formatMessage(this.headerMessages[`profile.guest`]);
    } else if (step === 'payment' && this.props.mainState.stepProfile.contributorRejectedCategories) {
      return intl.formatMessage(this.headerMessages.blockedContributor);
    } else if (this.headerMessages[step]) {
      return intl.formatMessage(this.headerMessages[step]);
    } else {
      return step;
    }
  };

  renderStep = step => {
    const { collective, mainState, tier, isEmbed, isCrypto, order } = this.props;
    const { stepProfile, stepDetails, stepSummary, stepPayment } = mainState;
    switch (step) {
      case 'details':
        return !isCrypto ? (
          <StepDetails
            collective={collective}
            tier={tier}
            onChange={this.props.onChange}
            data={stepDetails}
            showFeesOnTop={this.props.showFeesOnTop}
            isEmbed={isEmbed}
          />
        ) : (
          <StepDetailsCrypto onChange={this.props.onChange} data={stepDetails} collective={collective} />
        );
      case 'profile': {
        return (
          <StepProfile
            profiles={this.props.contributeProfiles}
            collective={collective}
            stepDetails={stepDetails}
            defaultEmail={this.props.defaultEmail}
            defaultName={this.props.defaultName}
            onChange={this.props.onChange}
            data={stepProfile}
            canUseIncognito={collective.type !== CollectiveType.EVENT && (!tier || tier.type !== 'TICKET')}
            onSignInClick={this.props.onSignInClick}
            isEmbed={isEmbed}
          />
        );
      }
      case 'payment':
        return (
          <StepPayment
            collective={this.props.collective}
            stepDetails={this.props.mainState.stepDetails}
            stepProfile={this.props.mainState.stepProfile}
            stepSummary={this.props.mainState.stepSummary}
            onChange={this.props.onChange}
            stepPayment={stepPayment}
            onNewCardFormReady={this.props.onNewCardFormReady}
            isSubmitting={this.props.isSubmitting}
            isEmbed={isEmbed}
            isCrypto={isCrypto}
            disabledPaymentMethodTypes={this.props.disabledPaymentMethodTypes}
            hideCreditCardPostalCode={
              this.props.hideCreditCardPostalCode || Boolean(collective.settings?.hideCreditCardPostalCode)
            }
          />
        );
      case 'checkout':
        return <StepCheckout stepDetails={this.props.mainState.stepDetails} order={order} />;
      case 'summary':
        return (
          <StepSummary
            collective={collective}
            tier={tier}
            stepProfile={stepProfile}
            stepDetails={stepDetails}
            data={stepSummary}
            onChange={this.props.onChange}
            taxes={this.props.taxes}
            applyTaxes
          />
        );
      default:
        return null;
    }
  };

  render() {
    const { LoggedInUser, step } = this.props;

    return (
      <StyledCard p={[16, 32]} mx={[16, 'none']} borderRadius={15}>
        <Flex flexDirection="column" alignItems="center">
          {step.name !== 'checkout' && (
            <Flex width="100%" mb={3}>
              <Flex alignItems="center">
                <H4 fontSize={['20px', '24px']} fontWeight={500} py={2}>
                  {this.renderHeader(step.name, LoggedInUser)}
                </H4>
              </Flex>
              <Flex flexGrow={1} alignItems="center" justifyContent="center">
                <StyledHr width="100%" ml={3} borderColor="black.300" />
              </Flex>
            </Flex>
          )}
          {this.renderStep(step.name)}
        </Flex>
      </StyledCard>
    );
  }
}

export default injectIntl(withUser(ContributionFlowStepContainer));
