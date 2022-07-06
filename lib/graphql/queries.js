import { gql } from '@apollo/client';
import { graphql } from '@apollo/client/react/hoc';

import { collectiveNavbarFieldsFragment } from '../../components/collective-page/graphql/fragments';

import { API_V2_CONTEXT, gqlV2 } from './helpers';

export const transactionFieldsFragment = gql`
  fragment TransactionFields on Transaction {
    id
    uuid
    description
    createdAt
    type
    amount
    currency
    hostCurrency
    hostCurrencyFxRate
    netAmountInCollectiveCurrency(fetchHostFee: true)
    hostFeeInHostCurrency(fetchHostFee: true)
    platformFeeInHostCurrency
    taxAmount
    paymentProcessorFeeInHostCurrency
    paymentMethod {
      id
      service
      type
      name
      data
    }
    collective {
      id
      slug
      name
      type
      imageUrl
      isIncognito
    }
    fromCollective {
      id
      name
      slug
      path
      type
      imageUrl
      isIncognito
    }
    usingGiftCardFromCollective {
      id
      slug
      name
      type
    }
    host {
      id
      slug
      name
      currency
      hostFeePercent
      type
    }
    ... on Expense {
      expense {
        id
        tags
      }
    }
    ... on Order {
      createdAt
      subscription {
        id
        interval
      }
    }
  }
`;

export const transactionsQuery = gql`
  query Transactions(
    $CollectiveId: Int!
    $type: String
    $limit: Int
    $offset: Int
    $dateFrom: String
    $dateTo: String
    $kinds: [String]
  ) {
    allTransactions(
      CollectiveId: $CollectiveId
      type: $type
      limit: $limit
      offset: $offset
      dateFrom: $dateFrom
      dateTo: $dateTo
      kinds: $kinds
    ) {
      id
      ...TransactionFields
      refundTransaction {
        id
        ...TransactionFields
      }
    }
  }

  ${transactionFieldsFragment}
`;

export const loggedInUserQuery = gql`
  query LoggedInUser {
    LoggedInUser {
      id
      email
      image
      isLimited
      CollectiveId
      hasSeenLatestChangelogEntry
      collective {
        id
        name
        legalName
        type
        slug
        imageUrl
        settings
        currency
        isDeletable
        categories
        location {
          id
          address
          country
          structured
        }
        payoutMethods {
          id
          type
          name
          isSaved
        }
        connectedAccounts {
          id
          service
        }
      }
      memberOf {
        id
        role
        collective {
          id
          slug
          type
          isIncognito
          name
          currency
          isHost
          endsAt
          imageUrl
          categories
          host {
            id
          }
          settings
          location {
            id
            address
            country
            structured
          }
          children {
            id
            slug
            type
            name
            isActive
            imageUrl
            host {
              id
            }
          }
        }
      }
    }
  }
`;

export const editCollectivePageFieldsFragment = gql`
  fragment EditCollectivePageFields on CollectiveInterface {
    id
    type
    slug
    isActive
    isIncognito
    startsAt
    endsAt
    timezone
    host {
      id
      createdAt
      slug
      name
      legalName
      currency
      settings
      description
      website
      twitterHandle
      imageUrl
      backgroundImage
      hostCollective {
        id
        slug
        name
        currency
      }
      location {
        id
        country
      }
      stats {
        id
        collectives {
          id
          hosted
        }
      }
    }
    name
    legalName
    company
    image # We still query 'image' because it's required for the edition
    imageUrl
    backgroundImage
    description
    longDescription
    location {
      id
      name
      address
      country
      lat
      long
    }
    privateInstructions
    tags
    twitterHandle
    repositoryUrl
    website
    currency
    settings
    createdAt
    isActive
    isArchived
    isApproved
    isDeletable
    isHost
    hostFeePercent
    expensePolicy
    contributionPolicy
    stats {
      id
      yearlyBudget
      balance
      backers {
        id
        all
      }
      totalAmountSpent
    }
    tiers {
      id
      slug
      type
      name
      description
      useStandalonePage
      longDescription
      amount
      presets
      amountType
      minimumAmount
      goal
      interval
      currency
      maxQuantity
      button
      stats {
        id
        availableQuantity
      }
      invoiceTemplate {
        title
        info
      }
    }
    members(roles: ["ADMIN", "MEMBER", "HOST"]) {
      id
      createdAt
      since
      role
      description
      stats {
        id
        totalDonations
      }
      tier {
        id
        name
      }
      member {
        id
        name
        imageUrl
        slug
        twitterHandle
        description
        ... on User {
          email
        }
      }
    }
    paymentMethods(type: ["CREDITCARD", "GIFTCARD", "PREPAID"], hasBalanceAboveZero: true) {
      id
      uuid
      name
      data
      monthlyLimitPerMember
      service
      type
      balance
      currency
      expiryDate
      orders(hasActiveSubscription: true) {
        id
      }
    }
    # limit: 1 as current best practice to avoid the API fetching entries it doesn't need
    createdGiftCards(limit: 1) {
      total
    }
    connectedAccounts {
      id
      service
      username
      createdAt
      settings
      updatedAt
    }
    plan {
      id
      hostDashboard
      hostedCollectives
      hostFees
      hostFeeSharePercent
      manualPayments
      name
    }
    parentCollective {
      id
      slug
      name
      currency
      imageUrl
      backgroundImage
      settings
    }
    features {
      id
      ...NavbarFields
      VIRTUAL_CARDS
    }
  }
  ${collectiveNavbarFieldsFragment}
`;

export const editCollectivePageQuery = gql`
  query EditCollectivePage($slug: String) {
    Collective(slug: $slug) {
      id
      ...EditCollectivePageFields
    }
  }

  ${editCollectivePageFieldsFragment}
`;

export const legacyCollectiveQuery = gql`
  query LegacyCollective($slug: String) {
    Collective(slug: $slug) {
      id
      isActive
      isPledged
      type
      slug
      path
      name
      company
      imageUrl
      backgroundImage
      description
      longDescription
      location {
        id
        name
        address
        country
        lat
        long
      }
      twitterHandle
      githubHandle
      repositoryUrl
      website
      currency
      settings
      createdAt
      stats {
        id
        balance
        yearlyBudget
        backers {
          id
          all
          users
          organizations
          collectives
        }
        collectives {
          id
          hosted
          memberOf
        }
        transactions {
          id
          all
        }
        expenses {
          id
          all
        }
        updates
        events
        totalAmountSpent
        totalAmountReceived
      }
      tiers {
        id
        slug
        type
        name
        description
        useStandalonePage
        button
        amount
        amountType
        minimumAmount
        presets
        interval
        currency
        maxQuantity
        stats {
          id
          totalOrders
          totalActiveDistinctOrders
          availableQuantity
        }
        orders(limit: 30, isActive: true) {
          id
          fromCollective {
            id
            slug
            type
            name
            imageUrl
            website
            isIncognito
          }
        }
      }
      isHost
      hostFeePercent
      canApply
      isArchived
      isFrozen
      isApproved
      isDeletable
      host {
        id
        slug
        name
        imageUrl
        features {
          id
          CONTACT_FORM
        }
      }
      members {
        id
        role
        createdAt
        since
        description
        member {
          id
          description
          name
          slug
          type
          imageUrl
          backgroundImage
          isIncognito
          company
        }
      }
      ... on User {
        isIncognito
        memberOf(limit: 60) {
          id
          role
          createdAt
          stats {
            id
            totalDonations
          }
          collective {
            id
            name
            currency
            slug
            path
            type
            imageUrl
            backgroundImage
            description
            longDescription
            parentCollective {
              id
              slug
            }
          }
        }
      }
      ... on Organization {
        memberOf(limit: 60) {
          id
          role
          createdAt
          stats {
            id
            totalDonations
          }
          collective {
            id
            name
            currency
            slug
            path
            type
            imageUrl
            backgroundImage
            description
            longDescription
            parentCollective {
              id
              slug
            }
          }
        }
      }
    }
  }
`;

export const collectiveNavbarQuery = gqlV2/* GraphQL */ `
  query CollectiveNavbar($slug: String!) {
    account(slug: $slug) {
      id
      legacyId
      type
      slug
      name
      imageUrl(height: 256)
      ... on Event {
        parent {
          id
          slug
        }
      }
      ... on Project {
        parent {
          id
          slug
        }
      }
      features {
        id
        ...NavbarFields
      }
    }
  }
  ${collectiveNavbarFieldsFragment}
`;

export const addCollectiveNavbarData = component => {
  return graphql(collectiveNavbarQuery, { options: { context: API_V2_CONTEXT } })(component);
};
