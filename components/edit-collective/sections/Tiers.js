import React from 'react';
import PropTypes from 'prop-types';
import { Mutation } from '@apollo/client/react/components';
import { getApplicableTaxes } from '@opencollective/taxes';
import { cloneDeep, get, set } from 'lodash';
import { defineMessages, FormattedMessage, injectIntl } from 'react-intl';
import { v4 as uuid } from 'uuid';

import { CollectiveType } from '../../../lib/constants/collectives';
import intervals from '../../../lib/constants/intervals';
import { AmountTypes, TierTypes } from '../../../lib/constants/tiers-types';
import { getCurrencySymbol } from '../../../lib/currency-utils';
import { i18nTaxDescription, i18nTaxType } from '../../../lib/i18n/taxes';
import { getCollectivePageRoute } from '../../../lib/url-helpers';
import { capitalize } from '../../../lib/utils';

import Container from '../../Container';
import ContributeCrypto from '../../contribute-cards/ContributeCrypto';
import ContributeCustom from '../../contribute-cards/ContributeCustom';
import { Box, Flex } from '../../Grid';
import InputField from '../../InputField';
import InputFieldPresets from '../../InputFieldPresets';
import Link from '../../Link';
import MessageBox from '../../MessageBox';
import StyledButton from '../../StyledButton';
import StyledCheckbox from '../../StyledCheckbox';
import StyledLink from '../../StyledLink';
import StyledLinkButton from '../../StyledLinkButton';
import { P, Span } from '../../Text';
import { editCollectiveSettingsMutation } from '../mutations';

import SettingsSectionTitle from './SettingsSectionTitle';

const { FUND, PROJECT } = CollectiveType;
const { TIER, TICKET, MEMBERSHIP, SERVICE, PRODUCT, DONATION } = TierTypes;
const { FIXED, FLEXIBLE } = AmountTypes;

const SIMPLIFIED_TIER_TYPES = [TIER, SERVICE, PRODUCT, DONATION];
const DEFAULT_TIER_TYPES = [...SIMPLIFIED_TIER_TYPES, MEMBERSHIP];

const getReceiptTemplates = host => {
  const receiptTemplates = host?.settings?.invoice?.templates;

  const receiptTemplateTitles = [];
  if (receiptTemplates?.default?.title?.length > 0) {
    receiptTemplateTitles.push({
      default: receiptTemplates?.default?.title,
    });
  }
  if (receiptTemplates?.alternative?.title?.length > 0) {
    receiptTemplateTitles.push({ alternative: receiptTemplates?.alternative?.title });
  }
  return receiptTemplateTitles;
};

class Tiers extends React.Component {
  static propTypes = {
    tiers: PropTypes.arrayOf(PropTypes.object).isRequired,
    types: PropTypes.arrayOf(PropTypes.string),
    collective: PropTypes.object,
    currency: PropTypes.string.isRequired,
    defaultType: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    intl: PropTypes.object,
    title: PropTypes.string,
  };

  constructor(props) {
    super(props);
    const { intl } = props;
    this.state = { tiers: [...props.tiers] || [{}] };
    this.renderTier = this.renderTier.bind(this);
    this.addTier = this.addTier.bind(this);
    this.removeTier = this.removeTier.bind(this);
    this.editTier = this.editTier.bind(this);
    this.onChange = props.onChange.bind(this);
    this.defaultType = this.props.defaultType || TIER;

    this.messages = defineMessages({
      TIER: { id: 'tier.type.tier', defaultMessage: 'generic tier' },
      MEMBERSHIP: {
        id: 'tier.type.membership',
        defaultMessage: 'membership (recurring)',
      },
      SERVICE: {
        id: 'tier.type.service',
        defaultMessage: 'service (e.g., support)',
      },
      PRODUCT: {
        id: 'tier.type.product',
        defaultMessage: 'product (e.g., t-shirt)',
      },
      DONATION: { id: 'tier.type.donation', defaultMessage: 'donation (gift)' },
      TICKET: {
        id: 'tier.type.ticket',
        defaultMessage: 'ticket (allow multiple tickets per order)',
      },
      'TIER.remove': {
        id: 'tier.type.tier.remove',
        defaultMessage: 'remove tier',
      },
      'TICKET.remove': {
        id: 'tier.type.ticket.remove',
        defaultMessage: 'remove ticket',
      },
      'BACKER.remove': {
        id: 'tier.type.tier.remove',
        defaultMessage: 'remove tier',
      },
      'SPONSOR.remove': {
        id: 'tier.type.tier.remove',
        defaultMessage: 'remove tier',
      },
      'TIER.add': {
        id: 'tier.type.tier.add',
        defaultMessage: 'add another tier',
      },
      'TICKET.add': {
        id: 'tier.type.ticket.add',
        defaultMessage: 'add another ticket',
      },
      'BACKER.add': {
        id: 'tier.type.tier.add',
        defaultMessage: 'add another tier',
      },
      'SPONSOR.add': {
        id: 'tier.type.tier.add',
        defaultMessage: 'add another tier',
      },
      CUSTOM: { id: 'tier.type.custom', defaultMessage: 'custom tier' },
      'type.label': { id: 'tier.type.label', defaultMessage: 'Type' },
      'name.label': { id: 'Fields.name', defaultMessage: 'Name' },
      'amountType.label': {
        id: 'tier.amountType.label',
        defaultMessage: 'Amount type',
      },
      'amount.label': { id: 'Fields.amount', defaultMessage: 'Amount' },
      'minimumAmount.label': { id: 'tier.minimumAmount.label', defaultMessage: 'minimum amount' },
      'defaultAmount.label': {
        id: 'tier.defaultAmount.label',
        defaultMessage: 'default amount',
      },
      'goal.label': {
        id: 'ContributionType.Goal',
        defaultMessage: 'Goal',
      },
      'button.label': {
        id: 'tier.button.label',
        defaultMessage: 'Button text',
      },
      'goal.description': {
        id: 'tier.goal.description',
        defaultMessage: 'Amount you aim to raise',
      },
      'interval.label': {
        id: 'tier.interval.label',
        defaultMessage: 'interval',
      },
      FIXED: { id: 'tier.amountType.fixed', defaultMessage: 'fixed amount' },
      FLEXIBLE: {
        id: 'tier.amountType.flexible',
        defaultMessage: 'flexible amount',
      },
      onetime: { id: 'tier.interval.onetime', defaultMessage: 'one time' },
      month: { id: 'tier.interval.month', defaultMessage: 'monthly' },
      year: { id: 'tier.interval.year', defaultMessage: 'yearly' },
      flexible: { id: 'tier.interval.flexible', defaultMessage: 'flexible' },
      'presets.label': {
        id: 'tier.presets.label',
        defaultMessage: 'suggested amounts',
      },
      'description.label': {
        id: 'Fields.description',
        defaultMessage: 'Description',
      },
      'startsAt.label': {
        id: 'startDateAndTime',
        defaultMessage: 'start date and time',
      },
      'endsAt.label': { id: 'tier.expiration.label', defaultMessage: 'Expiration' },
      'endsAt.description': {
        id: 'tier.endsAt.description',
        defaultMessage: 'Date this tier should deactivate',
      },
      'maxQuantity.label': {
        id: 'tier.maxQuantity.label',
        defaultMessage: 'Available quantity',
      },
      'maxQuantity.description': {
        id: 'tier.maxQuantity.description',
        defaultMessage: 'Leave empty for unlimited',
      },
      'customContributions.label': {
        id: 'tier.customContributions.label',
        defaultMessage: 'Enable flexible contributions',
      },
      'cryptoContributions.label': {
        id: 'tier.cryptoContributions.label',
        defaultMessage: 'Enable Crypto contributions',
      },
      standalonePage: {
        id: 'tier.standalonePage',
        defaultMessage: 'Standalone page',
      },
      chooseReceipt: {
        defaultMessage: 'Choose receipt',
      },
      chooseReceiptDescription: {
        defaultMessage: 'Choose between the receipts templates available.',
      },
      standalonePageDescription: {
        id: 'tier.standalonePageDescription',
        defaultMessage:
          "Create a <link>standalone</link> page for this tier? It's like a mini-crowdfunding campaign page that you can add a detailed description and video to, and link to directly",
      },
    });

    const getOptions = arr => {
      return arr.map(key => {
        const obj = {};
        obj[key] = intl.formatMessage(this.messages[key]);
        return obj;
      });
    };

    this.fields = [
      {
        name: 'type',
        type: 'select',
        options: collective =>
          getOptions(props.types || (collective.type === PROJECT ? SIMPLIFIED_TIER_TYPES : DEFAULT_TIER_TYPES)),
        label: intl.formatMessage(this.messages['type.label']),
        when: (tier, collective) => ![FUND].includes(collective.type) || props.types?.length === 1,
      },
      {
        name: 'name',
        label: intl.formatMessage(this.messages['name.label']),
      },
      {
        name: 'description',
        type: 'textarea',
        label: intl.formatMessage(this.messages['description.label']),
      },
      {
        name: 'interval',
        type: 'select',
        options: getOptions(['onetime', 'month', 'year', 'flexible']),
        label: intl.formatMessage(this.messages['interval.label']),
        when: tier => !tier || [DONATION, MEMBERSHIP, TIER, SERVICE].includes(tier.type),
      },
      {
        name: 'amountType',
        type: 'select',
        options: getOptions([FIXED, FLEXIBLE]),
        label: intl.formatMessage(this.messages['amountType.label']),
        when: tier => tier.interval !== intervals.flexible,
      },
      {
        name: 'amount',
        pre: getCurrencySymbol(props.currency),
        type: 'currency',
        label: intl.formatMessage(this.messages['amount.label']),
        when: tier => tier.amountType === FIXED,
      },
      {
        name: 'presets',
        pre: getCurrencySymbol(props.currency),
        type: 'component',
        component: InputFieldPresets,
        label: intl.formatMessage(this.messages['presets.label']),
        when: tier => tier.amountType === FLEXIBLE,
      },
      {
        name: 'amount',
        pre: getCurrencySymbol(props.currency),
        type: 'currency',
        label: intl.formatMessage(this.messages['defaultAmount.label']),
        when: tier => tier.amountType === FLEXIBLE,
      },
      {
        name: 'minimumAmount',
        pre: getCurrencySymbol(props.currency),
        type: 'currency',
        label: intl.formatMessage(this.messages['minimumAmount.label']),
        when: tier => tier.amountType === FLEXIBLE,
      },
      {
        name: 'maxQuantity',
        type: 'number',
        label: intl.formatMessage(this.messages['maxQuantity.label']),
        description: intl.formatMessage(this.messages['maxQuantity.description']),
        when: (tier, collective) =>
          [TICKET, PRODUCT].includes(tier.type) || (tier.type === TIER && ![FUND, PROJECT].includes(collective.type)),
      },
      {
        name: 'button',
        type: 'text',
        label: intl.formatMessage(this.messages['button.label']),
        when: (tier, collective) => ![FUND, PROJECT].includes(collective.type),
      },
      {
        name: 'goal',
        pre: getCurrencySymbol(props.currency),
        type: 'currency',
        label: intl.formatMessage(this.messages['goal.label']),
        description: intl.formatMessage(this.messages['goal.description']),
      },
      {
        name: 'useStandalonePage',
        type: 'switch',
        label: intl.formatMessage(this.messages.standalonePage),
        when: (tier, collective) => ![FUND, PROJECT].includes(collective.type),
        description: (tier, collective) =>
          intl.formatMessage(this.messages.standalonePageDescription, {
            link: function StandaloneTierPageLink(...msg) {
              if (!tier.id) {
                return msg;
              } else {
                return (
                  <StyledLink
                    as={Link}
                    openInNewTab
                    href={{ pathname: `${getCollectivePageRoute(collective)}/contribute/${tier.slug}-${tier.id}` }}
                  >
                    <span>{msg}</span>
                  </StyledLink>
                );
              }
            },
          }),
      },
      {
        name: 'invoiceTemplate',
        type: 'select',
        label: intl.formatMessage(this.messages['chooseReceipt']),
        description: intl.formatMessage(this.messages['chooseReceiptDescription']),
        options: collective => getReceiptTemplates(collective.host),
        when: (tier, collective) => getReceiptTemplates(collective.host).length > 1,
      },
    ];
  }

  editTier(index, fieldname, value) {
    const tiers = cloneDeep(this.state.tiers);

    if (fieldname === 'interval') {
      if (value === 'onetime') {
        value = null;
      }
      if (value === intervals.flexible) {
        tiers[index].amountType = FLEXIBLE;
      }
    }

    if (fieldname === 'type') {
      if (value === TierTypes.PRODUCT) {
        tiers[index].interval = null;
        tiers[index].amountType = FIXED;
      }
    }

    tiers[index] = {
      ...tiers[index],
      type: tiers[index]['type'] || this.defaultType,
      [fieldname]: value,
    };

    this.setState({ tiers });
    this.onChange(tiers);
  }

  addTier(tier) {
    const tiers = this.state.tiers;
    tiers.push({ ...(tier || {}), __uuid: uuid() });
    this.setState({ tiers });
  }

  removeTier(index) {
    let tiers = this.state.tiers;
    if (index < 0 || index > tiers.length) {
      return;
    }
    tiers = [...tiers.slice(0, index), ...tiers.slice(index + 1)];
    this.setState({ tiers });
    this.onChange(tiers);
  }

  renderLabel(field, hasTax) {
    if (['presets', 'amount'].includes(field.name) && hasTax) {
      return (
        <Flex flexDirection="column">
          <Span>{capitalize(field.label)}</Span>
          <Span fontSize="10px" color="black.400">
            (without tax)
          </Span>
        </Flex>
      );
    }
    return field.label;
  }

  renderTier(tier, index) {
    const { intl, collective } = this.props;
    const key = tier.id ? `tier-${tier.id}` : `newTier-${tier.__uuid};`;
    const taxes = getApplicableTaxes(collective, collective.host, tier.type);
    if (!tier.amountType) {
      tier.amountType = tier.presets ? FLEXIBLE : FIXED;
    }

    // Set the default value of preset
    if (tier.amountType === FLEXIBLE && !tier.presets) {
      tier.presets = [1000];
    }

    if (!tier.name) {
      tier.name = '';
    }
    const defaultValues = {
      ...tier,
      type: tier.type || this.defaultType,
      invoiceTemplate: tier.data.invoiceTemplate,
    };

    return (
      <Container margin="3rem 0" className={`tier ${tier.slug}`} key={key}>
        <Container textAlign="right" fontSize="1.3rem" pr={1}>
          <StyledLinkButton className="removeTier" onClick={() => this.removeTier(index)}>
            {intl.formatMessage(this.messages[`${this.defaultType}.remove`])}
          </StyledLinkButton>
        </Container>
        <form>
          {this.fields.map(
            field =>
              (!field.when || field.when(defaultValues, collective)) && (
                <Box key={field.name} data-cy={`tier-input-field-${field.name}`}>
                  <InputField
                    className="horizontal"
                    name={field.name}
                    label={this.renderLabel(field, Boolean(taxes.length))}
                    component={field.component}
                    type={field.type}
                    defaultValue={defaultValues[field.name]}
                    options={typeof field.options === 'function' ? field.options(collective) : field.options}
                    pre={field.pre}
                    placeholder={field.placeholder}
                    onChange={value => this.editTier(index, field.name, value)}
                    description={
                      typeof field.description === 'function' ? field.description(tier, collective) : field.description
                    }
                  />
                  {field.name === 'type' &&
                    taxes.map(({ type, percentage }) => (
                      <Flex key={`${type}-${percentage}`} mb={4}>
                        <Box width={0.166} px={15} />
                        <MessageBox type="info" withIcon css={{ flexGrow: 1 }} fontSize="12px">
                          <Span fontWeight="bold">
                            <FormattedMessage
                              id="withColon"
                              defaultMessage="{item}:"
                              values={{ item: i18nTaxType(intl, type) }}
                            />{' '}
                            {percentage}%
                          </Span>
                          <Box mt={2}>{i18nTaxDescription(intl, type)}</Box>
                        </MessageBox>
                      </Flex>
                    ))}
                </Box>
              ),
          )}
        </form>
      </Container>
    );
  }

  render() {
    const { intl, collective, defaultType = TICKET } = this.props;
    const hasCustomContributionsDisabled = get(collective, 'settings.disableCustomContributions', false);
    const hasCryptoContributionsDisabled = get(collective, 'settings.disableCryptoContributions', true);
    const cryptoContributionsEnabledByHost = get(collective, 'host.settings.cryptoEnabled', false);
    const displayContributionSettings = collective.id && defaultType !== TICKET;

    return (
      <div className="EditTiers">
        {displayContributionSettings && (
          <React.Fragment>
            <SettingsSectionTitle>
              <FormattedMessage id="ContributionsType.Flexible" defaultMessage="Flexible Contributions" />
            </SettingsSectionTitle>
            <Mutation mutation={editCollectiveSettingsMutation}>
              {(editSettings, { loading }) => (
                <Flex flexWrap="wrap">
                  <Box mr={[0, null, 4]} css={{ pointerEvents: 'none', zoom: 0.75, filter: 'grayscale(0.3)' }}>
                    <ContributeCustom collective={collective} hideContributors />
                  </Box>
                  <Flex flexDirection="column" minWidth={200} maxWidth={550} mt={2}>
                    <P mb={2}>
                      <FormattedMessage
                        id="Tiers.CustomTierDescription"
                        defaultMessage="A default tier that enables freely customizable contributions, so people can set their own amount and frequency without limitations. You cannot change the settings or description of this tier, but you can disable it."
                      />
                    </P>
                    <StyledCheckbox
                      name="custom-contributions"
                      label={intl.formatMessage(this.messages['customContributions.label'])}
                      defaultChecked={!hasCustomContributionsDisabled}
                      width="auto"
                      isLoading={loading}
                      onChange={({ target }) => {
                        const updatedCollective = cloneDeep(this.props.collective);
                        editSettings({
                          variables: {
                            id: this.props.collective.id,
                            settings: set(updatedCollective.settings, 'disableCustomContributions', !target.value),
                          },
                        });
                      }}
                    />
                  </Flex>
                </Flex>
              )}
            </Mutation>
            {cryptoContributionsEnabledByHost && (
              <React.Fragment>
                <SettingsSectionTitle mt={50}>
                  <FormattedMessage id="ContributionsType.Crypto" defaultMessage="Crypto Contributions" />
                </SettingsSectionTitle>
                <Mutation mutation={editCollectiveSettingsMutation}>
                  {(editSettings, { loading }) => (
                    <Flex flexWrap="wrap">
                      <Box mr={[0, null, 4]} css={{ pointerEvents: 'none', zoom: 0.75, filter: 'grayscale(0.3)' }}>
                        <ContributeCrypto collective={collective} hideContributors />
                      </Box>
                      <Flex flexDirection="column" minWidth={200} maxWidth={550} mt={2}>
                        <P mb={2}>
                          <FormattedMessage
                            id="Tiers.CryptoTierDescription"
                            defaultMessage="Enabling this will enable support for donations with Cryptocurrencies such as Bitcoin or Ethereum."
                          />
                        </P>
                        <StyledCheckbox
                          name="crypto-contributions"
                          label={intl.formatMessage(this.messages['cryptoContributions.label'])}
                          defaultChecked={!hasCryptoContributionsDisabled}
                          width="auto"
                          isLoading={loading}
                          onChange={({ target }) => {
                            const updatedCollective = cloneDeep(this.props.collective);
                            editSettings({
                              variables: {
                                id: this.props.collective.id,
                                settings: set(updatedCollective.settings, 'disableCryptoContributions', !target.value),
                              },
                            });
                          }}
                        />
                      </Flex>
                    </Flex>
                  )}
                </Mutation>
              </React.Fragment>
            )}
            <SettingsSectionTitle mt={50}>
              <FormattedMessage id="createCustomTiers" defaultMessage="Create your own tiers" />
            </SettingsSectionTitle>
          </React.Fragment>
        )}

        <div className="tiers">{this.state.tiers.map(this.renderTier)}</div>
        <Container textAlign="right" marginTop="-10px">
          <StyledButton
            className="addTier"
            data-cy="add-tier-button"
            buttonStyle="primary"
            onClick={() => this.addTier({})}
          >
            {intl.formatMessage(this.messages[`${defaultType}.add`])}
          </StyledButton>
        </Container>
      </div>
    );
  }
}

export default injectIntl(Tiers);
