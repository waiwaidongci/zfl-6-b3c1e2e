import { readSeries, writeSeries, getSeriesEvents as getSeriesEventsFromStore } from './storeUtils.js';

export function createSeriesStore() {
  let series = readSeries();

  return {
    get: () => series,
    set: (newSeries) => {
      series = newSeries;
      writeSeries(series);
      return series;
    },
    reload: () => {
      series = readSeries();
      return series;
    }
  };
}

export function createSeriesItem(seriesList, formData) {
  if (!formData.title?.trim()) return null;
  const item = {
    id: crypto.randomUUID(),
    ...formData,
    createdAt: new Date().toLocaleString()
  };
  return [item, ...seriesList];
}

export function updateSeriesItem(seriesList, seriesId, formData) {
  return seriesList.map((s) =>
    s.id === seriesId ? { ...s, ...formData } : s
  );
}

export function deleteSeriesItem(seriesList, events, seriesId) {
  const updatedEvents = events.map((e) =>
    e.seriesId === seriesId
      ? { ...e, seriesId: undefined, seriesIndex: undefined }
      : e
  );
  const updatedSeries = seriesList.filter((s) => s.id !== seriesId);
  return { series: updatedSeries, events: updatedEvents };
}

export function addEventToSeries(seriesList, events, seriesId, eventForm) {
  if (!eventForm.book?.trim() || !eventForm.host?.trim() || !seriesId) {
    return { series: seriesList, events, success: false };
  }
  const sEvents = getSeriesEventsFromStore(events, seriesId);
  const event = {
    id: crypto.randomUUID(),
    ...eventForm,
    limit: Number(eventForm.limit || 0),
    seriesId,
    seriesIndex: sEvents.length + 1
  };
  return {
    series: seriesList,
    events: [event, ...events],
    success: true,
    event
  };
}

export function getSeriesWithEvents(seriesList, events) {
  return seriesList.map((s) => {
    const sEvents = events
      .filter((e) => e.seriesId === s.id)
      .sort((a, b) => a.time.localeCompare(b.time));
    return { ...s, events: sEvents };
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
      status: e.status
    }));
}
