import React from 'react';
import PropTypes from 'prop-types';
import { Undo } from '@styled-icons/fa-solid/Undo';
import { Field, FieldArray, Form, Formik } from 'formik';
import { first, isEmpty, omit, pick } from 'lodash';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import styled from 'styled-components';

import hasFeature, { FEATURES } from '../../lib/allowed-features';
import { accountSupportsGrants } from '../../lib/collective.lib';
import expenseStatus from '../../lib/constants/expense-status';
import expenseTypes from '../../lib/constants/expenseTypes';
import { PayoutMethodType } from '../../lib/constants/payout-method';
import { requireFields } from '../../lib/form-utils';
import { AmountPropTypeShape } from '../../lib/prop-types';
import { flattenObjectDeep } from '../../lib/utils';
import { checkRequiresAddress } from './lib/utils';

import ConfirmationModal from '../ConfirmationModal';
import { Box, Flex } from '../Grid';
import { serializeAddress } from '../I18nAddressFields';
import PrivateInfoIcon from '../icons/PrivateInfoIcon';
import LoadingPlaceholder from '../LoadingPlaceholder';
import StyledButton from '../StyledButton';
import StyledCard from '../StyledCard';
import StyledHr from '../StyledHr';
import StyledInput from '../StyledInput';
import StyledInputTags from '../StyledInputTags';
import { P, Span } from '../Text';

import ExpenseAttachedFilesForm from './ExpenseAttachedFilesForm';
import ExpenseFormItems, { addNewExpenseItem } from './ExpenseFormItems';
import ExpenseFormPayeeInviteNewStep from './ExpenseFormPayeeInviteNewStep';
import ExpenseFormPayeeSignUpStep from './ExpenseFormPayeeSignUpStep';
import ExpenseFormPayeeStep from './ExpenseFormPayeeStep';
import { validateExpenseItem } from './ExpenseItemForm';
import ExpensePayeeDetails from './ExpensePayeeDetails';
import ExpenseTypeRadioSelect from './ExpenseTypeRadioSelect';
import ExpenseTypeTag from './ExpenseTypeTag';
import { validatePayoutMethod } from './PayoutMethodForm';

const msg = defineMessages({
  descriptionPlaceholder: {
    id: `ExpenseForm.DescriptionPlaceholder`,
    defaultMessage: 'Enter expense title here...',
  },
  grantSubjectPlaceholder: {
    id: `ExpenseForm.GrantSubjectPlaceholder`,
    defaultMessage: 'e.g., research, software development, etc...',
  },
  addNewReceipt: {
    id: 'ExpenseForm.AddReceipt',
    defaultMessage: 'Add new receipt',
  },
  addNewItem: {
    id: 'ExpenseForm.AddLineItem',
    defaultMessage: 'Add new item',
  },
  addNewGrantItem: {
    id: 'ExpenseForm.AddGrantItem',
    defaultMessage: 'Add grant item',
  },
  stepReceipt: {
    id: 'ExpenseForm.StepExpense',
    defaultMessage: 'Upload one or multiple receipt',
  },
  stepInvoice: {
    id: 'ExpenseForm.StepExpenseInvoice',
    defaultMessage: 'Set invoice details',
  },
  stepFundingRequest: {
    id: 'ExpenseForm.StepExpenseFundingRequest',
    defaultMessage: 'Set grant details',
  },
  stepPayee: {
    id: 'ExpenseForm.StepPayeeInvoice',
    defaultMessage: 'Payee information',
  },
  cancelEditExpense: {
    defaultMessage: 'Cancel Edit',
  },
  confirmCancelEditExpense: {
    defaultMessage: 'Are you sure you want to cancel the edits?',
  },
  clearExpenseForm: {
    defaultMessage: 'Clear Form',
  },
  confirmClearExpenseForm: {
    defaultMessage: 'Are you sure you want to clear the expense form?',
  },
});

const getDefaultExpense = collective => ({
  description: '',
  longDescription: '',
  items: [],
  attachedFiles: [],
  payee: null,
  payoutMethod: undefined,
  privateMessage: '',
  invoiceInfo: '',
  currency: collective.currency,
  payeeLocation: {
    address: '',
    country: null,
  },
});

/**
 * Take the expense's data as generated by `ExpenseForm` and strips out all optional data
 * like URLs for items when the expense is an invoice.
 */
export const prepareExpenseForSubmit = expenseData => {
  // The collective picker still uses API V1 for when creating a new profile on the fly
  const payeeIdField = typeof expenseData.payee?.id === 'string' ? 'id' : 'legacyId';
  const isInvoice = expenseData.type === expenseTypes.INVOICE;
  const isGrant = expenseData.type === expenseTypes.FUNDING_REQUEST || expenseData.type === expenseTypes.GRANT;
  const payee =
    expenseData.payee?.isNewUser || expenseData.payee?.isInvite
      ? pick(expenseData.payee, ['name', 'email', 'legalName', 'organization', 'newsletterOptIn'])
      : { [payeeIdField]: expenseData.payee.id };

  const payeeLocation = checkRequiresAddress(expenseData)
    ? pick(expenseData.payeeLocation, ['address', 'country', 'structured'])
    : null;

  return {
    ...pick(expenseData, [
      'id',
      'description',
      'longDescription',
      'type',
      'privateMessage',
      'invoiceInfo',
      'tags',
      'currency',
    ]),
    payee,
    payeeLocation,
    payoutMethod: pick(expenseData.payoutMethod, ['id', 'name', 'data', 'isSaved', 'type']),
    attachedFiles: isInvoice ? expenseData.attachedFiles?.map(file => pick(file, ['id', 'url'])) : [],
    // Omit item's ids that were created for keying purposes
    items: expenseData.items.map(item => {
      return pick(item, [
        ...(item.__isNew ? [] : ['id']),
        ...(isInvoice || isGrant ? [] : ['url']), // never submit URLs for invoices or requests
        'description',
        'incurredAt',
        'amount',
      ]);
    }),
  };
};

/**
 * Validate the expense
 */
const validate = expense => {
  const isCardCharge = expense.type === expenseTypes.CHARGE;
  if (expense.payee?.isInvite) {
    return expense.payee.id
      ? requireFields(expense, ['description', 'payee', 'payee.id'])
      : requireFields(expense, ['description', 'payee', 'payee.name', 'payee.email']);
  }

  const errors = isCardCharge ? {} : requireFields(expense, ['description', 'payee', 'payoutMethod', 'currency']);

  if (expense.items.length > 0) {
    const itemsErrors = expense.items.map(item => validateExpenseItem(expense, item));
    const hasErrors = itemsErrors.some(errors => !isEmpty(errors));
    if (hasErrors) {
      errors.items = itemsErrors;
    }
  }

  if (
    expense.payoutMethod &&
    // CHARGE expenses have VirtualCard and do not have PayoutMethod
    isCardCharge
  ) {
    const payoutMethodErrors = validatePayoutMethod(expense.payoutMethod);
    if (!isEmpty(payoutMethodErrors)) {
      errors.payoutMethod = payoutMethodErrors;
    }
  }

  if (checkRequiresAddress(expense)) {
    Object.assign(errors, requireFields(expense, ['payeeLocation.country', 'payeeLocation.address']));
  }

  return errors;
};

const setLocationFromPayee = (formik, payee) => {
  formik.setFieldValue('payeeLocation.country', payee.location.country || null);
  formik.setFieldValue('payeeLocation.address', payee.location.address || '');
  formik.setFieldValue('payeeLocation.structured', payee.location.structured);
};

const HiddenFragment = styled.div`
  display: ${({ show }) => (show ? 'block' : 'none')};
`;

const STEPS = {
  PAYEE: 'PAYEE',
  EXPENSE: 'EXPENSE',
};

const checkAddressValuesAreCompleted = values => {
  if (checkRequiresAddress(values)) {
    return values.payeeLocation?.country && values.payeeLocation?.address;
  }
  return true;
};

const ExpenseFormBody = ({
  formik,
  payoutProfiles,
  collective,
  expense,
  autoFocusTitle,
  onCancel,
  formPersister,
  loggedInAccount,
  loading,
  expensesTags,
  shouldLoadValuesFromPersister,
  isDraft,
}) => {
  const intl = useIntl();
  const { formatMessage } = intl;
  const formRef = React.useRef();
  const { values, handleChange, errors, setValues, dirty, touched, resetForm, setErrors } = formik;
  const hasBaseFormFieldsCompleted = values.type && values.description;
  const isInvite = values.payee?.isInvite;
  const isNewUser = !values.payee?.id;
  const isReceipt = values.type === expenseTypes.RECEIPT;
  const isGrant = values.type === expenseTypes.FUNDING_REQUEST || values.type === expenseTypes.GRANT;
  const isCreditCardCharge = values.type === expenseTypes.CHARGE;
  const stepOneCompleted =
    values.payoutMethod &&
    isEmpty(flattenObjectDeep(omit(errors, 'payoutMethod.data.currency'))) &&
    checkAddressValuesAreCompleted(values);
  const stepTwoCompleted = isInvite
    ? true
    : (stepOneCompleted || isCreditCardCharge) && hasBaseFormFieldsCompleted && values.items.length > 0;
  const collectiveSupportsMultiCurrency =
    hasFeature(collective, FEATURES.MULTI_CURRENCY_EXPENSES) ||
    hasFeature(collective.host, FEATURES.MULTI_CURRENCY_EXPENSES);
  const isMultiCurrency =
    collectiveSupportsMultiCurrency && values.payoutMethod?.data?.currency !== collective?.currency;

  const [step, setStep] = React.useState(stepOneCompleted || isCreditCardCharge ? STEPS.EXPENSE : STEPS.PAYEE);
  // Only true when logged in and drafting the expense
  const [isOnBehalf, setOnBehalf] = React.useState(false);
  const [showResetModal, setShowResetModal] = React.useState(false);
  const editingExpense = expense !== undefined;

  // Scroll to top when step changes
  React.useEffect(() => {
    const boundingRect = formRef.current?.getBoundingClientRect();
    if (boundingRect) {
      const elemTop = boundingRect.top + window.scrollY;
      window.scroll({ top: elemTop - 75 });
    }
  }, [step]);

  // When user logs in we set its account as the default payout profile if not yet defined
  React.useEffect(() => {
    if (values?.draft?.payee && !loggedInAccount) {
      formik.setFieldValue('payee', {
        ...values.draft.payee,
        isInvite: false,
        isNewUser: true,
      });
    }
    // If creating a new expense or completing an expense submitted on your behalf, automatically select your default profile.
    else if (!isOnBehalf && (isDraft || !values.payee) && loggedInAccount && !isEmpty(payoutProfiles)) {
      formik.setFieldValue('payee', first(payoutProfiles));
    }
  }, [payoutProfiles, loggedInAccount]);

  // Pre-fill address based on the payout profile
  React.useEffect(() => {
    if (!values.payeeLocation?.address && values.payee?.location) {
      setLocationFromPayee(formik, values.payee);
    }
    if (!isDraft && values.payee?.isInvite) {
      setOnBehalf(values.payee.isInvite);
      setStep(STEPS.EXPENSE);
    }
  }, [values.payee]);

  // Return to Payee step if type is changed
  React.useEffect(() => {
    if (!isCreditCardCharge) {
      setStep(STEPS.PAYEE);
      setOnBehalf(false);

      if (!isDraft && values.payee?.isInvite) {
        formik.setFieldValue('payee', null);
      }
    }
  }, [values.type]);

  React.useEffect(() => {
    if (values.payeeLocation?.structured) {
      formik.setFieldValue('payeeLocation.address', serializeAddress(values.payeeLocation.structured));
    }
  }, [values.payeeLocation]);

  React.useEffect(() => {
    if (isMultiCurrency) {
      formik.setFieldValue('currency', undefined);
    } else {
      formik.setFieldValue('currency', collective?.currency);
    }
  }, [values.payoutMethod]);

  // Load values from localstorage
  React.useEffect(() => {
    if (shouldLoadValuesFromPersister && formPersister && !dirty) {
      const formValues = formPersister.loadValues();
      if (formValues) {
        // Reset payoutMethod if host is no longer connected to TransferWise
        if (formValues.payoutMethod?.type === PayoutMethodType.BANK_ACCOUNT && !collective.host?.transferwise) {
          formValues.payoutMethod = undefined;
        }
        setValues(
          omit(
            formValues,
            // Omit deprecated fields, otherwise it will prevent expense submission
            ['location', 'privateInfo'],
          ),
        );
      }
    }
  }, [formPersister, dirty]);

  // Save values in localstorage
  React.useEffect(() => {
    if (dirty && formPersister) {
      formPersister.saveValues(values);
    }
  }, [formPersister, dirty, values]);

  let payeeForm;
  if (loading) {
    payeeForm = <LoadingPlaceholder height={32} />;
  } else if (isDraft && !loggedInAccount) {
    payeeForm = (
      <ExpenseFormPayeeSignUpStep
        collective={collective}
        formik={formik}
        onCancel={onCancel}
        onNext={() => setStep(STEPS.EXPENSE)}
      />
    );
  } else if (isOnBehalf === true && isNewUser) {
    payeeForm = (
      <ExpenseFormPayeeInviteNewStep
        collective={collective}
        formik={formik}
        onBack={() => {
          setStep(STEPS.PAYEE);
          setOnBehalf(false);
          formik.setFieldValue('payee', null);
          formik.setFieldValue('payoutMethod', null);
          formik.setFieldValue('payeeLocation', null);
        }}
        onNext={() => {
          formik.setFieldValue('payee', { ...values.payee, isInvite: true });
        }}
        payoutProfiles={payoutProfiles}
      />
    );
  } else {
    payeeForm = (
      <ExpenseFormPayeeStep
        collective={collective}
        formik={formik}
        isOnBehalf={isOnBehalf}
        onCancel={onCancel}
        payoutProfiles={payoutProfiles}
        loggedInAccount={loggedInAccount}
        onNext={() => {
          const shouldSkipValidation = isOnBehalf && isEmpty(values.payoutMethod);
          const validation = !shouldSkipValidation && validatePayoutMethod(values.payoutMethod);
          if (isEmpty(validation)) {
            setStep(STEPS.EXPENSE);
          } else {
            setErrors({ payoutMethod: validation });
          }
        }}
        onInvite={isInvite => {
          setOnBehalf(isInvite);
          formik.setFieldValue('payeeLocation', {});
          formik.setFieldValue('payee', {});
          formik.setFieldValue('payoutMethod', {});
        }}
      />
    );
  }

  return (
    <Form>
      {!isCreditCardCharge && (
        <ExpenseTypeRadioSelect
          name="type"
          onChange={e => {
            handleChange(e);
          }}
          value={values.type}
          options={{
            fundingRequest: accountSupportsGrants(collective, collective?.host),
          }}
        />
      )}
      {values.type && (
        <StyledCard mt={4} p={[16, 16, 32]} overflow="initial" ref={formRef}>
          <HiddenFragment show={step === STEPS.PAYEE}>
            <Flex alignItems="center" mb={16}>
              <Span color="black.900" fontSize="16px" lineHeight="21px" fontWeight="bold">
                {formatMessage(msg.stepPayee)}
              </Span>
              <Box ml={2}>
                <PrivateInfoIcon size={12} color="#969BA3" tooltipProps={{ display: 'flex' }} />
              </Box>
              <StyledHr flex="1" borderColor="black.300" mx={2} />
            </Flex>
            {payeeForm}
          </HiddenFragment>

          <HiddenFragment show={step === STEPS.EXPENSE}>
            <Flex alignItems="center" mb={10}>
              <P
                as="label"
                htmlFor="expense-description"
                color="black.900"
                fontSize="16px"
                lineHeight="24px"
                fontWeight="bold"
              >
                {values.type === expenseTypes.FUNDING_REQUEST || values.type === expenseTypes.GRANT ? (
                  <FormattedMessage
                    id="Expense.EnterRequestSubject"
                    defaultMessage="Enter grant subject <small>(Public)</small>"
                    values={{
                      small(msg) {
                        return (
                          <Span fontWeight="normal" color="black.600">
                            {msg}
                          </Span>
                        );
                      },
                    }}
                  />
                ) : (
                  <FormattedMessage
                    id="Expense.EnterExpenseTitle"
                    defaultMessage="Enter expense title <small>(Public)</small>"
                    values={{
                      small(msg) {
                        return (
                          <Span fontWeight="normal" color="black.600">
                            {msg}
                          </Span>
                        );
                      },
                    }}
                  />
                )}
              </P>
              <StyledHr flex="1" borderColor="black.300" ml={2} />
            </Flex>
            <P fontSize="12px" color="black.600">
              <FormattedMessage
                id="Expense.PrivacyWarning"
                defaultMessage="This information is public. Do not put any private details in this field."
              />
            </P>
            <Field
              as={StyledInput}
              autoFocus={autoFocusTitle}
              border="0"
              error={errors.description}
              fontSize="24px"
              id="expense-description"
              maxLength={255}
              mt={3}
              name="description"
              px={2}
              py={1}
              width="100%"
              withOutline
              placeholder={
                values.type === expenseTypes.FUNDING_REQUEST || values.type === expenseTypes.GRANT
                  ? formatMessage(msg.grantSubjectPlaceholder)
                  : formatMessage(msg.descriptionPlaceholder)
              }
            />
            <HiddenFragment show={hasBaseFormFieldsCompleted || isInvite}>
              <Flex alignItems="flex-start" mt={3}>
                <ExpenseTypeTag type={values.type} mr="4px" />
                <StyledInputTags
                  suggestedTags={expensesTags}
                  onChange={tags => {
                    formik.setFieldValue(
                      'tags',
                      tags.map(t => t.value.toLowerCase()),
                    );
                  }}
                  value={values.tags}
                />
              </Flex>
              {values.type === expenseTypes.INVOICE && (
                <Box my={40}>
                  <ExpenseAttachedFilesForm
                    title={<FormattedMessage id="UploadInvoice" defaultMessage="Upload invoice" />}
                    description={
                      <FormattedMessage
                        id="UploadInvoiceDescription"
                        defaultMessage="If you already have an invoice document, you can upload it here."
                      />
                    }
                    onChange={files => formik.setFieldValue('attachedFiles', files)}
                    defaultValue={values.attachedFiles}
                  />
                </Box>
              )}

              <Flex alignItems="center" my={24}>
                <Span color="black.900" fontSize="16px" lineHeight="21px" fontWeight="bold">
                  {formatMessage(isReceipt ? msg.stepReceipt : isGrant ? msg.stepFundingRequest : msg.stepInvoice)}
                </Span>
                <StyledHr flex="1" borderColor="black.300" mx={2} />
                <StyledButton
                  buttonSize="tiny"
                  type="button"
                  onClick={() => addNewExpenseItem(formik)}
                  minWidth={135}
                  data-cy="expense-add-item-btn"
                  disabled={isCreditCardCharge}
                >
                  +&nbsp;
                  {formatMessage(isReceipt ? msg.addNewReceipt : isGrant ? msg.addNewGrantItem : msg.addNewItem)}
                </StyledButton>
              </Flex>
              <Box>
                <FieldArray name="items">
                  {fieldsArrayProps => <ExpenseFormItems {...fieldsArrayProps} collective={collective} />}
                </FieldArray>
              </Box>

              {(values.type === expenseTypes.FUNDING_REQUEST || values.type === expenseTypes.GRANT) && (
                <Box my={40}>
                  <ExpenseAttachedFilesForm
                    title={<FormattedMessage id="UploadDocumentation" defaultMessage="Upload documentation" />}
                    description={
                      <FormattedMessage
                        id="UploadDocumentationDescription"
                        defaultMessage="If you want to include any documentation, you can upload it here."
                      />
                    }
                    onChange={files => formik.setFieldValue('attachedFiles', files)}
                    defaultValue={values.attachedFiles}
                  />
                </Box>
              )}

              <StyledHr flex="1" mt={4} borderColor="black.300" />
              <Flex mt={3} flexWrap="wrap" alignItems="center">
                <StyledButton
                  type="button"
                  width={['100%', 'auto']}
                  mx={[2, 0]}
                  mr={[null, 3]}
                  mt={2}
                  whiteSpace="nowrap"
                  data-cy="expense-back"
                  onClick={() => {
                    if (isCreditCardCharge) {
                      onCancel();
                    } else {
                      setStep(STEPS.PAYEE);
                    }
                  }}
                >
                  ←&nbsp;
                  <FormattedMessage id="Back" defaultMessage="Back" />
                </StyledButton>
                <StyledButton
                  type="submit"
                  width={['100%', 'auto']}
                  mx={[2, 0]}
                  mr={[null, 3]}
                  mt={2}
                  whiteSpace="nowrap"
                  data-cy="expense-summary-btn"
                  buttonStyle="primary"
                  disabled={!stepTwoCompleted || !formik.isValid}
                  loading={formik.isSubmitting}
                >
                  {isInvite && !isDraft ? (
                    <FormattedMessage id="Expense.SendInvite" defaultMessage="Send Invite" />
                  ) : isCreditCardCharge ? (
                    <FormattedMessage id="Expense.SaveReceipt" defaultMessage="Save Receipt" />
                  ) : (
                    <FormattedMessage id="Pagination.Next" defaultMessage="Next" />
                  )}
                  &nbsp;→
                </StyledButton>
                {errors.payoutMethod?.data?.currency && touched.items?.some?.(i => i.amount) && (
                  <Box mx={[2, 0]} mt={2} color="red.500" fontSize="12px" letterSpacing={0}>
                    {errors.payoutMethod.data.currency.toString()}
                  </Box>
                )}
                <StyledHr flex="1" borderColor="white.full" mx={2} />
                {showResetModal ? (
                  <ConfirmationModal
                    onClose={() => setShowResetModal(false)}
                    header={editingExpense ? formatMessage(msg.cancelEditExpense) : formatMessage(msg.clearExpenseForm)}
                    body={
                      editingExpense
                        ? formatMessage(msg.confirmCancelEditExpense)
                        : formatMessage(msg.confirmClearExpenseForm)
                    }
                    continueHandler={() => {
                      if (editingExpense) {
                        onCancel();
                      } else {
                        setStep(STEPS.PAYEE);
                        resetForm({ values: getDefaultExpense(collective) });
                        if (formPersister) {
                          formPersister.clearValues();
                          window.scrollTo(0, 0);
                        }
                      }
                      setShowResetModal(false);
                    }}
                  />
                ) : (
                  <StyledButton
                    type="button"
                    buttonStyle="borderless"
                    width={['100%', 'auto']}
                    color="red.500"
                    mt={1}
                    mx={[2, 0]}
                    mr={[null, 3]}
                    whiteSpace="nowrap"
                    onClick={() => setShowResetModal(true)}
                  >
                    <Undo size={11} />
                    <Span mx={1}>{formatMessage(editingExpense ? msg.cancelEditExpense : msg.clearExpenseForm)}</Span>
                  </StyledButton>
                )}
              </Flex>
            </HiddenFragment>
          </HiddenFragment>
        </StyledCard>
      )}
      {step === STEPS.EXPENSE && (
        <StyledCard mt={4} p={[16, 24, 32]} overflow="initial">
          <ExpensePayeeDetails expense={formik.values} host={collective.host} borderless collective={collective} />
        </StyledCard>
      )}
    </Form>
  );
};

ExpenseFormBody.propTypes = {
  formik: PropTypes.object,
  payoutProfiles: PropTypes.array,
  autoFocusTitle: PropTypes.bool,
  shouldLoadValuesFromPersister: PropTypes.bool,
  onCancel: PropTypes.func,
  formPersister: PropTypes.object,
  loggedInAccount: PropTypes.object,
  loading: PropTypes.bool,
  isDraft: PropTypes.bool,
  expensesTags: PropTypes.arrayOf(PropTypes.string),
  collective: PropTypes.shape({
    slug: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    currency: PropTypes.string.isRequired,
    host: PropTypes.shape({
      transferwise: PropTypes.shape({
        availableCurrencies: PropTypes.arrayOf(PropTypes.object),
      }),
      settings: PropTypes.shape({
        disableGrantsByDefault: PropTypes.bool,
      }),
    }),
    settings: PropTypes.object,
    isApproved: PropTypes.bool,
  }).isRequired,
  expense: PropTypes.shape({
    type: PropTypes.oneOf(Object.values(expenseTypes)),
    currency: PropTypes.string,
    description: PropTypes.string,
    status: PropTypes.string,
    payee: PropTypes.object,
    draft: PropTypes.object,
    amountInAccountCurrency: AmountPropTypeShape,
    items: PropTypes.arrayOf(
      PropTypes.shape({
        url: PropTypes.string,
      }),
    ),
  }),
};

/**
 * Main create expense form
 */
const ExpenseForm = ({
  onSubmit,
  collective,
  expense,
  originalExpense,
  payoutProfiles,
  autoFocusTitle,
  onCancel,
  validateOnChange,
  formPersister,
  loggedInAccount,
  loading,
  expensesTags,
  shouldLoadValuesFromPersister,
}) => {
  const isDraft = expense?.status === expenseStatus.DRAFT;
  const [hasValidate, setValidate] = React.useState(validateOnChange && !isDraft);
  const initialValues = { ...getDefaultExpense(collective), ...expense };
  if (isDraft) {
    initialValues.items = expense.draft.items;
    initialValues.attachedFiles = expense.draft.attachedFiles;
    initialValues.payoutMethod = expense.draft.payoutMethod;
    initialValues.payeeLocation = expense.draft.payeeLocation;
    initialValues.payee = expense.draft.payee;
  }

  return (
    <Formik
      initialValues={initialValues}
      validate={hasValidate && validate}
      onSubmit={async (values, formik) => {
        // We initially let the browser do the validation. Then once users try to submit the
        // form at least once, we validate on each change to make sure they fix all the errors.
        const errors = validate(values);
        if (!isEmpty(errors)) {
          setValidate(true);
          formik.setErrors(errors);
        } else {
          return onSubmit(values);
        }
      }}
    >
      {formik => (
        <ExpenseFormBody
          formik={formik}
          payoutProfiles={payoutProfiles}
          collective={collective}
          expense={originalExpense}
          autoFocusTitle={autoFocusTitle}
          onCancel={onCancel}
          formPersister={formPersister}
          loggedInAccount={loggedInAccount}
          expensesTags={expensesTags}
          loading={loading}
          shouldLoadValuesFromPersister={shouldLoadValuesFromPersister}
          isDraft={isDraft}
        />
      )}
    </Formik>
  );
};

ExpenseForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  autoFocusTitle: PropTypes.bool,
  validateOnChange: PropTypes.bool,
  shouldLoadValuesFromPersister: PropTypes.bool,
  onCancel: PropTypes.func,
  /** To save draft of form values */
  formPersister: PropTypes.object,
  loggedInAccount: PropTypes.object,
  loading: PropTypes.bool,
  expensesTags: PropTypes.arrayOf(PropTypes.string),
  collective: PropTypes.shape({
    currency: PropTypes.string.isRequired,
    slug: PropTypes.string.isRequired,
    host: PropTypes.shape({
      slug: PropTypes.string.isRequired,
      transferwise: PropTypes.shape({
        availableCurrencies: PropTypes.arrayOf(PropTypes.object),
      }),
    }),
    settings: PropTypes.object,
    isApproved: PropTypes.bool,
  }).isRequired,
  /** If editing */
  expense: PropTypes.shape({
    type: PropTypes.oneOf(Object.values(expenseTypes)),
    description: PropTypes.string,
    status: PropTypes.string,
    payee: PropTypes.object,
    draft: PropTypes.object,
    items: PropTypes.arrayOf(
      PropTypes.shape({
        url: PropTypes.string,
      }),
    ),
  }),
  /** To reset form */
  originalExpense: PropTypes.shape({
    type: PropTypes.oneOf(Object.values(expenseTypes)),
    description: PropTypes.string,
    status: PropTypes.string,
    payee: PropTypes.object,
    draft: PropTypes.object,
    items: PropTypes.arrayOf(
      PropTypes.shape({
        url: PropTypes.string,
      }),
    ),
  }),
  /** Payout profiles that user has access to */
  payoutProfiles: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      slug: PropTypes.string,
      location: PropTypes.shape({
        address: PropTypes.string,
        country: PropTypes.string,
      }),
      payoutMethods: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string,
          type: PropTypes.oneOf(Object.values(PayoutMethodType)),
          name: PropTypes.string,
          data: PropTypes.object,
        }),
      ),
    }),
  ),
};

ExpenseForm.defaultProps = {
  validateOnChange: false,
};

export default React.memo(ExpenseForm);
