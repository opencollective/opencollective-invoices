import { invoiceFields } from './fragments';
import { createClient, gqlV1, API_V1_CONTEXT, gqlV2 } from '.';

export async function fetchInvoiceByDateRange(
  { fromCollectiveSlug, hostSlug, dateFrom, dateTo, hasExpense },
  accessToken,
  apiKey,
) {
  const query = gqlV2`
    query InvoiceByDateRange($fromCollectiveSlug: String!, $hostSlug: String!, $dateFrom: DateTime!, $dateTo: DateTime!, $hasExpense: Boolean) {
      host(slug: $hostSlug) {
        id
        slug
        name
        currency
        imageUrl(height: 200)
        website
        settings
        type
        location {
          name
          address
          country
        }
      }
      fromAccount: account(slug: $fromCollectiveSlug) {
        id
        slug
        name
        currency
        type
        isIncognito
        settings
        location {
          name
          address
          country
        }
      }
      transactions(fromAccount: { slug: $fromCollectiveSlug }, host: { slug: $hostSlug }, dateFrom: $dateFrom, dateTo: $dateTo, limit: 1000, includeIncognitoTransactions: true, hasExpense: $hasExpense) {
        totalCount
        nodes {
          id
          createdAt
          description
          amount {
            valueInCents
            currency
          }
          amountInHostCurrency {
            valueInCents
            currency
          }
          netAmount {
            valueInCents
            currency
          }
          taxAmount {
            valueInCents
            currency
          }
          type
          fromAccount {
            id
            slug
            name
            type
          }
          giftCardEmitterAccount {
            id
            slug
            name
            type
          }
          toAccount {
            id
            slug
            name
            type
          }
          isRefund
          order {
            id
            taxes {
              type
              percentage 
            }
            quantity
            tier {
              id
              type
            }
          }
        }
      }
    }
  `;

  const client = createClient(accessToken, apiKey);
  const { data } = await client.query({
    query,
    variables: { fromCollectiveSlug, hostSlug, dateFrom, dateTo, hasExpense },
    fetchPolicy: 'no-cache',
  });

  if (!data.host) {
    throw new Error(`Host ${hostSlug} doesn't exist`);
  } else if (!data.fromAccount) {
    throw new Error(`Accout ${fromCollectiveSlug} doesn't exist`);
  }

  return data;
}

/**
 * Fetch invoice for a single transaction.
 * This endpoint doesn't require authentication because we assume that the `uuid`
 * is private to the user.
 *
 * @param {string} transactionUuid
 */
export async function fetchTransactionInvoice(transactionUuid, accessToken, apiKey) {
  const query = gqlV1`
    query TransactionInvoice($transactionUuid: String!) {
      TransactionInvoice(transactionUuid: $transactionUuid) {
        ...InvoiceFields
      }
    }

    ${invoiceFields}
  `;

  const client = createClient(accessToken, apiKey);
  const result = await client.query({
    query,
    variables: { transactionUuid },
    context: API_V1_CONTEXT,
    fetchPolicy: 'no-cache',
  });
  return result.data.TransactionInvoice;
}

/**
 * Fetch expense's data to generate an invoice.
 *
 * @param {string} expenseId
 */
export async function fetchExpenseInvoiceData(expenseId, accessToken, apiKey) {
  const query = gqlV2`
    query ExpenseInvoice($expenseId: String!) {
      expense(expense: { id: $expenseId }) {
        id
        legacyId
        description
        currency
        type
        invoiceInfo
        amount
        createdAt
        account {
          id
          type
          name
          slug
          imageUrl
          location {
            address
            country
          }
          ... on Collective {
            host {
              id
              name
              slug
              type
              expensePolicy
              location {
                address
                country
              }
            }
          }
          ... on Event {
            host {
              id
              name
              slug
              type
              expensePolicy
              location {
                address
                country
              }
            }
          }
        }
        payee {
          id
          type
          name
          slug
          imageUrl
        }
        payeeLocation {
          address
          country
        }
        items {
          id
          amount
          description
          incurredAt
          url
        }
      }
    }
  `;

  const client = createClient(accessToken, apiKey);
  const result = await client.query({ query, variables: { expenseId } });
  return result.data.expense;
}
