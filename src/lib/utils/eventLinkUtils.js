export function buildPublicEventUrl(eventId, baseUrl = '') {
  const path = `/public/${encodeURIComponent(eventId)}`;
  if (baseUrl) {
    const cleanBase = baseUrl.replace(/\/$/, '');
    return `${cleanBase}${path}`;
  }
  return path;
}

export function getEventIdFromUrl(pathname) {
  if (!pathname) return null;
  const match = pathname.match(/^\/public\/([^/]+)/);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch (e) {
      return match[1];
    }
  }
  return null;
}

export function buildCurrentBaseUrl() {
  if (typeof window === 'undefined') return '';
  const { protocol, hostname, port } = window.location;
  const portPart = port ? `:${port}` : '';
  return `${protocol}//${hostname}${portPart}`;
}

export function buildFullPublicUrl(eventId) {
  return buildPublicEventUrl(eventId, buildCurrentBaseUrl());
}

export function copyToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

export function getSeriesPublicEventLinks(events, seriesId) {
  return events
    .filter((e) => e.seriesId === seriesId)
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((e) => ({
      eventId: e.id,
      book: e.book,
      time: e.time,
      url: buildPublicEventUrl(e.id)
    }));
}
