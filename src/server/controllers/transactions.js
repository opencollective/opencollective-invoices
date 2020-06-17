import fs from 'fs-extra';
import path from 'path';
import { get } from 'lodash';
import pdf from 'html-pdf';
import sanitizeHtmlLib from 'sanitize-html';

import { logger } from '../logger';
import { fetchInvoice, fetchTransactionInvoice } from '../lib/graphql';

const getPageFormat = (req, invoice) => {
  if (req.query.pageFormat === 'A4' || invoice.fromCollective.currency === 'EUR') {
    return 'A4';
  } else {
    return 'Letter';
  }
};

const getAccessToken = (req, { throwException = true } = {}) => {
  const authorizationHeader = get(req, 'headers.authorization');
  if (!authorizationHeader) {
    if (throwException) {
      throw new Error('Not authorized. Please provide an authorization header.');
    } else {
      return;
    }
  }

  const parts = authorizationHeader.split(' ');
  const scheme = parts[0];
  const accessToken = parts[1];
  if (!/^Bearer$/i.test(scheme) || !accessToken) {
    throw new Error('Invalid authorization header. Format should be: Authorization: Bearer [token]');
  }
  return accessToken;
};

/**
 * Sanitize HTML with only safe values
 */
const sanitizeHtml = html => {
  return sanitizeHtmlLib(html, {
    allowedTags: sanitizeHtmlLib.defaults.allowedTags.concat(['img', 'style', 'h1', 'h2', 'span']),
    allowedSchemes: ['https', 'data'],
    allowedAttributes: Object.assign(sanitizeHtmlLib.defaults.allowedAttributes, {
      '*': ['style', 'class'],
    }),
  });
};

/**
 * Download the invoice in the format given by `req.params`
 */
const downloadInvoice = async (req, res, next, invoice) => {
  const pageFormat = getPageFormat(req, invoice);
  const debug = req.query.debug && ['1', 'true'].includes(req.query.debug.toLowerCase());
  const params = { invoice, pageFormat, debug };
  const { format } = req.params;

  if (format === 'json') {
    res.send(invoice);
  } else if (format === 'html') {
    const html = await req.app.renderToHTML(req, res, '/invoice', params);
    const sendRaw = ['1', 'true'].includes(req.query.raw);
    res.send(sendRaw ? html : sanitizeHtml(html));
  } else if (format === 'pdf') {
    const rawHtml = await req.app.renderToHTML(req, res, '/invoice', params);
    const cleanHtml = sanitizeHtml(rawHtml);
    const filename = `${invoice.slug}.pdf`;
    const pdfOptions = { format: pageFormat, renderDelay: 3000 };

    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', `inline; filename="${filename}"`); // or attachment?
    pdf.create(cleanHtml, pdfOptions).toStream((err, stream) => {
      if (err) {
        logger.error('>>> Error while generating pdf at %s', req.url, err);
        return next(err);
      }
      stream.pipe(res);
    });
  } else {
    logger.error('>>> Unknown format %s for invoice %s', format, invoice.slug);
    throw new Error('Unknown format');
  }
};

export async function invoice(req, res, next) {
  // Keeping the resulting info for 10mn in the CDN cache
  res.setHeader('Cache-Control', `public, max-age=${60 * 10}`);

  const accessToken = getAccessToken(req);

  try {
    const invoice = await fetchInvoice(req.params.invoiceSlug, accessToken);
    return downloadInvoice(req, res, next, invoice);
  } catch (e) {
    logger.error('>>> transactions.invoice error', e.message);
    logger.debug(e);
    if (e.message.match(/No collective found/)) {
      return res.status(404).send('Not found');
    } else {
      return res.status(500).send(`Internal Server Error: ${e.message}`);
    }
  }
}

export async function transactionInvoice(req, res, next) {
  const { transactionUuid } = req.params;
  const accessToken = getAccessToken(req, { throwException: false });
  try {
    const invoice = await fetchTransactionInvoice(transactionUuid, accessToken);
    return downloadInvoice(req, res, next, invoice);
  } catch (e) {
    logger.error('>>> transactions.transactionInvoice error', e.message);
    logger.debug(e);
    if (e.message.match(/No collective found/)) {
      return res.status(404).send('Not found');
    } else {
      return res.status(500).send(`Internal Server Error: ${e.message}`);
    }
  }
}

export async function testFixture(req, res, next) {
  const { fixture } = req.params;
  try {
    const fixturesPath = '../../../test/__fixtures__/invoices/';
    const filePath = path.join(__dirname, fixturesPath, `${path.basename(fixture)}.json`);
    const invoice = await fs.readJson(filePath);
    return downloadInvoice(req, res, next, invoice);
  } catch (e) {
    logger.error('>>> transactions.transactionInvoice error', e.message);
    logger.debug(e);
    if (e.message.match(/No collective found/)) {
      return res.status(404).send('Not found');
    } else {
      return res.status(500).send(`Internal Server Error: ${e.message}`);
    }
  }
}
