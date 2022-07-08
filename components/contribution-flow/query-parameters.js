import UrlQueryHelper from '../../lib/UrlQueryHelper';

/**
 * These attributes are documented using JSDoc to automatically generate
 * documentation for the contribution flow. You can re-generate them by running:
 * `npm run docs:generate:contribution-flow`
 */
const ContributionFlowUrlParametersConfig = {
  // ---- Public fields ----
  // -- Contribution
  /**
   * Default contribution amount
   * @example 42.42
   */
  amount: { type: 'amount' },
  /**
   * Default platform tip
   * @private
   */
  platformTip: { type: 'amount' },
  /**
   * Default number of units (for products and tickets only)
   * @default 1
   * @example 5
   */
  quantity: { type: 'integer' },
  /**
   * The contribution interval (must be supported by the selected tier, if any)
   * @example 'month'
   */
  interval: { type: 'interval' },
  /**
   * A custom description
   */
  description: { type: 'string' },
  // -- Profile
  /**
   * Slug of the default profile to use to contribute
   * @default Logged in user personal profile
   */
  contributeAs: { type: 'string' },
  /**
   * Guest contributions only: The email to use to contribute
   * @example test@opencollective.com
   */
  email: { type: 'string' },
  /**
   * Guest contributions only: The name to use to contribute
   * @example John Doe
   */
  name: { type: 'string' },
  // -- Payment
  /** @private */
  hideCreditCardPostalCode: { type: 'boolean' },
  /**
   * To disable specific payment method types
   * @example MANUAL,BANK_TRANSFER
   */
  disabledPaymentMethodTypes: { type: 'stringArray' },
  // -- Success
  /**
   * The URL to redirect to after a successful contribution
   * @example https://www.example.com/thank-you
   */
  redirect: { type: 'string' },
  // -- Misc metadata
  /** @private */
  data: { type: 'json' },
  /**
   * Some tags to attach to the contribution
   * @example tag1,tag2
   */
  tags: { type: 'stringArray' },
  // ---- Aliases for legacy compatibility ----
  /**
   * The default amount in cents
   * @deprecated Use `amount` instead
   * @example 4200
   */
  totalAmount: { type: 'alias', on: 'amount', modifier: value => Math.round(value / 100) },
  /** @deprecated Use `platformTip` instead */
  platformContribution: { type: 'alias', on: 'platformTip' },
  /** @deprecated Use `email` instead */
  defaultEmail: { type: 'alias', on: 'email' },
  /** @deprecated Use `name` instead */
  defaultName: { type: 'alias', on: 'name' },
  // ---- Deprecated fields ----
  /** @private */
  skipStepDetails: { type: 'boolean' },
};

const EmbedContributionFlowUrlParametersConfig = {
  ...ContributionFlowUrlParametersConfig,
  /**
   * Whether we need to hide the right-column FAQ
   * @default false
   * @example true
   */
  hideFAQ: { type: 'boolean' },
  /**
   * Whether we need to hide the contribution flow header
   * @default false
   * @example true
   */
  hideHeader: { type: 'boolean' },
  /**
   * A custom color to use as the background color of the contribution flow
   * @example #ff0000
   */
  backgroundColor: { type: 'color' },
  /**
   * Whether to use the collective theme (custom colors)
   * @default false
   * @example true
   */
  useTheme: { type: 'boolean' },
};

export const ContributionFlowUrlQueryHelper = new UrlQueryHelper(ContributionFlowUrlParametersConfig);
export const EmbedContributionFlowUrlQueryHelper = new UrlQueryHelper(EmbedContributionFlowUrlParametersConfig);
