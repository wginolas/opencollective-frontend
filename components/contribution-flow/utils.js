import React from 'react';
import { find, get, isEmpty, sortBy, uniqBy } from 'lodash';
import { defineMessages, FormattedMessage } from 'react-intl';

import { CollectiveType } from '../../lib/constants/collectives';
import INTERVALS from '../../lib/constants/intervals';
import {
  GQLV2_SUPPORTED_PAYMENT_METHOD_TYPES,
  PAYMENT_METHOD_SERVICE,
  PAYMENT_METHOD_TYPE,
} from '../../lib/constants/payment-methods';
import roles from '../../lib/constants/roles';
import { getPaymentMethodName } from '../../lib/payment_method_label';
import {
  getPaymentMethodIcon,
  getPaymentMethodMetadata,
  isPaymentMethodDisabled,
} from '../../lib/payment-method-utils';

import CreditCardInactive from '../icons/CreditCardInactive';

export const NEW_CREDIT_CARD_KEY = 'newCreditCard';
const PAYPAL_MAX_AMOUNT = 999999999; // See MAX_VALUE_EXCEEDED https://developer.paypal.com/api/rest/reference/orders/v2/errors/#link-createorder

const memberCanBeUsedToContribute = (member, account, canUseIncognito) => {
  if (member.role !== roles.ADMIN) {
    return false;
  } else if (!canUseIncognito && member.collective.isIncognito) {
    // Incognito can't be used to contribute if not allowed
    return false;
  } else if (
    [CollectiveType.COLLECTIVE, CollectiveType.FUND].includes(member.collective.type) &&
    member.collective.host?.id !== account.host.legacyId
  ) {
    // If the contributing account is fiscally hosted, the host must be the same as the one you're contributing to
    return false;
  } else {
    return true;
  }
};

export const getContributeProfiles = (loggedInUser, collective, tier) => {
  if (!loggedInUser) {
    return [];
  } else {
    const canUseIncognito = collective.type !== CollectiveType.EVENT && (!tier || tier.type !== 'TICKET');
    const filteredMembers = loggedInUser.memberOf.filter(member =>
      memberCanBeUsedToContribute(member, collective, canUseIncognito),
    );
    const personalProfile = { email: loggedInUser.email, image: loggedInUser.image, ...loggedInUser.collective };
    const contributorProfiles = [personalProfile];
    filteredMembers.forEach(member => {
      // Account can't contribute to itself
      if (member.collective.id !== collective.legacyId) {
        contributorProfiles.push(member.collective);
      }
      if (!isEmpty(member.collective.children)) {
        const childrenOfSameHost = member.collective.children.filter(
          child => child.host.id === collective.host.legacyId,
        );
        contributorProfiles.push(...childrenOfSameHost);
      }
    });
    return uniqBy([personalProfile, ...contributorProfiles], 'id');
  }
};

export const generatePaymentMethodOptions = (
  paymentMethods,
  stepProfile,
  stepDetails,
  stepSummary,
  collective,
  isEmbed,
  disabledPaymentMethodTypes,
) => {
  const supportedPaymentMethods = get(collective, 'host.supportedPaymentMethods', []);
  const hostHasManual = supportedPaymentMethods.includes(GQLV2_SUPPORTED_PAYMENT_METHOD_TYPES.BANK_TRANSFER);
  const hostHasPaypal = supportedPaymentMethods.includes(GQLV2_SUPPORTED_PAYMENT_METHOD_TYPES.PAYPAL);
  const hostHasStripe = supportedPaymentMethods.includes(GQLV2_SUPPORTED_PAYMENT_METHOD_TYPES.CREDIT_CARD);
  const totalAmount = getTotalAmount(stepDetails, stepSummary);
  const interval = get(stepDetails, 'interval', null);

  const paymentMethodsOptions = paymentMethods.map(pm => ({
    id: pm.id,
    key: `pm-${pm.id}`,
    title: getPaymentMethodName(pm),
    subtitle: getPaymentMethodMetadata(pm, totalAmount),
    icon: getPaymentMethodIcon(pm),
    disabled: isPaymentMethodDisabled(pm, totalAmount),
    paymentMethod: pm,
  }));

  let uniquePMs = uniqBy(paymentMethodsOptions, 'id');

  uniquePMs = uniquePMs.filter(
    ({ paymentMethod }) =>
      paymentMethod.type !== PAYMENT_METHOD_TYPE.COLLECTIVE || collective.host.legacyId === stepProfile.host?.id,
  );

  // prepaid budget: limited to a specific host
  const matchesHostCollectiveIdPrepaid = prepaid => {
    const hostCollectiveLegacyId = get(collective, 'host.legacyId');
    const prepaidLimitedToHostCollectiveIds = get(prepaid, 'limitedToHosts');
    if (prepaidLimitedToHostCollectiveIds?.length) {
      return find(prepaidLimitedToHostCollectiveIds, { legacyId: hostCollectiveLegacyId });
    } else {
      return prepaid.data?.HostCollectiveId && prepaid.data.HostCollectiveId === hostCollectiveLegacyId;
    }
  };

  // gift card: can be limited to a specific host, see limitedToHosts
  const matchesHostCollectiveId = giftcard => {
    const hostCollectiveId = get(collective, 'host.id');
    const giftcardLimitedToHostCollectiveIds = get(giftcard, 'limitedToHosts');
    return find(giftcardLimitedToHostCollectiveIds, { id: hostCollectiveId });
  };

  uniquePMs = uniquePMs.filter(({ paymentMethod }) => {
    const sourcePaymentMethod = paymentMethod.sourcePaymentMethod || paymentMethod;
    const sourceType = sourcePaymentMethod.type;

    const isGiftCard = paymentMethod.type === PAYMENT_METHOD_TYPE.GIFTCARD;
    const isSourcePrepaid = sourceType === PAYMENT_METHOD_TYPE.PREPAID;
    const isSourceCreditCard = sourceType === PAYMENT_METHOD_TYPE.CREDITCARD;

    if (disabledPaymentMethodTypes?.includes(paymentMethod.type)) {
      return false;
    } else if (isGiftCard && paymentMethod.limitedToHosts) {
      return matchesHostCollectiveId(paymentMethod);
    } else if (isSourcePrepaid) {
      return matchesHostCollectiveIdPrepaid(sourcePaymentMethod);
    } else if (!hostHasStripe && isSourceCreditCard) {
      return false;
    } else {
      return true;
    }
  });

  // Put disabled PMs at the end
  uniquePMs = sortBy(uniquePMs, ['disabled', 'paymentMethod.providerType', 'id']);

  const balanceOnlyCollectiveTypes = [
    CollectiveType.COLLECTIVE,
    CollectiveType.EVENT,
    CollectiveType.PROJECT,
    CollectiveType.FUND,
  ];

  // adding payment methods
  if (!balanceOnlyCollectiveTypes.includes(stepProfile.type)) {
    if (hostHasStripe) {
      // New credit card
      uniquePMs.push({
        key: NEW_CREDIT_CARD_KEY,
        title: <FormattedMessage id="contribute.newcreditcard" defaultMessage="New credit/debit card" />,
        icon: <CreditCardInactive />,
      });
    }

    // Paypal
    if (hostHasPaypal && !disabledPaymentMethodTypes?.includes(PAYMENT_METHOD_TYPE.PAYMENT)) {
      const isDisabled = totalAmount > PAYPAL_MAX_AMOUNT;
      uniquePMs.push({
        key: 'paypal',
        title: 'PayPal',
        disabled: isDisabled,
        subtitle: isDisabled ? 'Maximum amount exceeded' : null,
        paymentMethod: {
          service: PAYMENT_METHOD_SERVICE.PAYPAL,
          type: PAYMENT_METHOD_TYPE.PAYMENT,
        },
        icon: getPaymentMethodIcon(
          { service: PAYMENT_METHOD_SERVICE.PAYPAL, type: PAYMENT_METHOD_TYPE.PAYMENT },
          collective,
        ),
      });
    }

    if (
      !interval &&
      !isEmbed &&
      supportedPaymentMethods.includes(GQLV2_SUPPORTED_PAYMENT_METHOD_TYPES.ALIPAY) &&
      !disabledPaymentMethodTypes?.includes(PAYMENT_METHOD_TYPE.ALIPAY)
    ) {
      uniquePMs.push({
        key: 'alipay',
        paymentMethod: {
          service: PAYMENT_METHOD_SERVICE.STRIPE,
          type: PAYMENT_METHOD_TYPE.ALIPAY,
        },
        title: <FormattedMessage id="Alipay" defaultMessage="Alipay" />,
        icon: getPaymentMethodIcon(
          { service: PAYMENT_METHOD_SERVICE.STRIPE, type: PAYMENT_METHOD_TYPE.ALIPAY },
          collective,
        ),
      });
    }

    // Manual (bank transfer)
    if (hostHasManual && !interval && !disabledPaymentMethodTypes?.includes(PAYMENT_METHOD_TYPE.MANUAL)) {
      uniquePMs.push({
        key: 'manual',
        title: get(collective, 'host.settings.paymentMethods.manual.title', null) || 'Bank transfer',
        paymentMethod: {
          service: PAYMENT_METHOD_SERVICE.OPENCOLLECTIVE,
          type: PAYMENT_METHOD_TYPE.MANUAL,
        },
        icon: getPaymentMethodIcon(
          { service: PAYMENT_METHOD_SERVICE.OPENCOLLECTIVE, type: PAYMENT_METHOD_TYPE.MANUAL },
          collective,
        ),
        instructions: (
          <FormattedMessage
            id="NewContributionFlow.bankInstructions"
            defaultMessage="Instructions to make a transfer will be given on the next page."
          />
        ),
      });
    }
  }

  return uniquePMs;
};

export const getTotalAmount = (stepDetails, stepSummary = null) => {
  const quantity = get(stepDetails, 'quantity') || 1;
  const amount = get(stepDetails, 'amount') || 0;
  const taxAmount = get(stepSummary, 'amount') || 0;
  const platformFeeAmount = get(stepDetails, 'platformContribution') || 0;
  return quantity * amount + platformFeeAmount + taxAmount;
};

export const getGQLV2AmountInput = (valueInCents, defaultValue) => {
  if (valueInCents) {
    return { valueInCents };
  } else if (typeof defaultValue === 'number') {
    return { valueInCents: defaultValue };
  } else {
    return defaultValue;
  }
};

const getCanonicalURL = (collective, tier) => {
  if (!tier) {
    return `${process.env.WEBSITE_URL}/${collective.slug}/donate`;
  } else if (collective.type === CollectiveType.EVENT) {
    const parentSlug = get(collective.parent, 'slug', collective.slug);
    return `${process.env.WEBSITE_URL}/${parentSlug}/events/${collective.slug}/order/${tier.id}`;
  } else {
    return `${process.env.WEBSITE_URL}/${collective.slug}/contribute/${tier.slug}-${tier.id}/checkout`;
  }
};

const PAGE_META_MSGS = defineMessages({
  collectiveTitle: {
    id: 'CreateOrder.Title',
    defaultMessage: 'Contribute to {collective}',
  },
  eventTitle: {
    id: 'CreateOrder.TitleForEvent',
    defaultMessage: 'Order tickets for {event}',
  },
});

export const getContributionFlowMetadata = (intl, account, tier) => {
  if (!account) {
    return { title: 'Contribute' };
  }

  return {
    canonicalURL: getCanonicalURL(account, tier),
    description: account.description,
    twitterHandle: account.twitterHandle,
    image: account.imageUrl || account.backgroundImageUrl,
    title:
      account.type === CollectiveType.EVENT
        ? intl.formatMessage(PAGE_META_MSGS.eventTitle, { event: account.name })
        : intl.formatMessage(PAGE_META_MSGS.collectiveTitle, { collective: account.name }),
  };
};

const getTotalYearlyAmount = stepDetails => {
  const totalAmount = getTotalAmount(stepDetails);
  return totalAmount && stepDetails?.interval === INTERVALS.month ? totalAmount * 12 : totalAmount;
};

/**
 * Whether this contribution requires us to collect the address of the user
 */
export const contributionRequiresAddress = stepDetails => {
  return stepDetails?.currency === 'USD' && getTotalYearlyAmount(stepDetails) >= 5000e2;
};

/**
 * Whether this contribution requires us to collect the address and legal name of the user
 */
export const contributionRequiresLegalName = stepDetails => {
  return stepDetails?.currency === 'USD' && getTotalYearlyAmount(stepDetails) >= 500e2;
};
