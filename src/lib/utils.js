import { get } from 'lodash';

export function formatCurrency(amount, currency = 'USD', options = {}) {
  amount = amount / 100;

  let minimumFractionDigits = 2;
  let maximumFractionDigits = 2;

  if (options.hasOwnProperty('minimumFractionDigits')) {
    minimumFractionDigits = options.minimumFractionDigits;
  } else if (options.hasOwnProperty('precision')) {
    minimumFractionDigits = options.precision;
    maximumFractionDigits = options.precision;
  }

  return amount.toLocaleString(getLocaleFromCurrency(currency), {
    style: 'currency',
    currency,
    minimumFractionDigits: minimumFractionDigits,
    maximumFractionDigits: maximumFractionDigits,
  });
}

function getLocaleFromCurrency(currency) {
  let locale;
  switch (currency) {
    case 'USD':
      locale = 'en-US';
      break;
    case 'EUR':
      locale = 'en-EU';
      break;
    default:
      locale = currency;
  }
  return locale;
}

export const getEnvVar = v => (process.browser ? get(window, ['__NEXT_DATA__', 'env', v]) : get(process, ['env', v]));

export const getBaseImagesUrl = () => getEnvVar('IMAGES_URL');

export function resizeImage(imageUrl, { width, height, query, baseUrl }) {
  if (!imageUrl) return null;
  if (imageUrl.substr(0, 1) === '/') return imageUrl; // if image is a local image, we don't resize it with the proxy.
  if (imageUrl.substr(0, 4).toLowerCase() !== 'http') return null; // Invalid imageUrl;
  if (!query && imageUrl.match(/\.svg$/)) return imageUrl; // if we don't need to transform the image, no need to proxy it.
  let queryurl = '';
  if (query) {
    queryurl = encodeURIComponent(query);
  } else {
    if (width) queryurl += `&width=${width}`;
    if (height) queryurl += `&height=${height}`;
  }

  return `${getBaseImagesUrl() || baseUrl || ''}/proxy/images?src=${encodeURIComponent(imageUrl)}${queryurl}`;
}

export function isValidImageUrl(src) {
  return src && (src.substr(0, 1) === '/' || src.substr(0, 4).toLowerCase() === 'http');
}

export function imagePreview(src, defaultImage, options = { width: 640 }) {
  if (typeof options.width === 'string') {
    options.width = Number(options.width.replace(/rem/, '')) * 10;
  }
  if (typeof options.height === 'string') {
    options.height = Number(options.height.replace(/rem/, '')) * 10;
  }

  if (src) return resizeImage(src, options);
  if (isValidImageUrl(defaultImage)) return defaultImage;
  return null;
}
