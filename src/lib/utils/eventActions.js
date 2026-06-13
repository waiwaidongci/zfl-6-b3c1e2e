import { promoteFromWaitlist, createSignup as createSignupFromStore, cancelSignup as cancelSignupFromStore, getEventById, getSeriesEvents } from './storeUtils.js';
import {
  toggleCheckInWithStatus,
  approveSignupWithStatus,
  rejectSignupWithStatus,
  isPending,
  isCheckedIn
} from './signupStatusMachine.js';

export function createEventStore() {
  return {
    create: (eventForm, editingEventId, editingEventPrevLimit, editingEventSeriesId, editingEventSeriesIndex, events, signups) => {
      if (!eventForm.book?.trim() || !eventForm.host?.trim()) {
        return { events, signups, success: false };
      }
      if (editingEventId) {
        const newLimit = Number(eventForm.limit || 0);
        const updatedEvents = events.map((e) =>
          e.id === editingEventId
            ? { ...eventForm, id: editingEventId, limit: newLimit, seriesId: editingEventSeriesId, seriesIndex: editingEventSeriesIndex }
            : e
        );
        let updatedSignups = signups;
        if (newLimit > editingEventPrevLimit) {
          updatedSignups = promoteFromWaitlist(updatedEvents, signups, editingEventId);
        }
        return { events: updatedEvents, signups: updatedSignups, success: true, edited: true };
      } else {
        const event = {
          id: crypto.randomUUID(),
          ...eventForm,
          limit: Number(eventForm.limit || 0)
        };
        return {
          events: [event, ...events],
          signups,
          success: true,
          createdEvent: event
        };
      }
    }
  };
}

export function toggleEventStatus(events, eventId) {
  return events.map((event) =>
    event.id === eventId
      ? { ...event, status: event.status === '开放报名' ? '已关闭' : '开放报名' }
      : event
  );
}

export function toggleCheckIn(signups, signupId) {
  return toggleCheckInWithStatus(signups, signupId);
}

export function approveSignup(events, signups, signupId) {
  const eventsArr = Array.isArray(events) ? events : [events];
  return approveSignupWithStatus(eventsArr, signups, signupId);
}

export function rejectSignup(signups, signupId, rejectionReason) {
  if (!signupId || !rejectionReason?.trim()) return signups;
  return rejectSignupWithStatus(signups, signupId, rejectionReason.trim());
}

export function handleSignupSubmit(events, signups, readers, mySignupIds, selectedEventId, signupForm) {
  const result = createSignupFromStore(events, signups, selectedEventId, signupForm, readers);
  if (result.success) {
    return {
      signups: result.signups,
      readers: result.readers,
      mySignupIds: [...mySignupIds, result.signup.id],
      success: true,
      signup: result.signup
    };
  }
  return { signups, readers, mySignupIds, success: false };
}

export function handleSignupCancel(events, signups, mySignupIds, signupId) {
  const signup = signups.find((item) => item.id === signupId);
  const newSignups = cancelSignupFromStore(events, signups, signupId);
  const newMySignupIds = mySignupIds.filter((mid) => mid !== signupId);
  return {
    signups: newSignups,
    mySignupIds: newMySignupIds,
    _originalSignup: signup
  };
}

export function processEventLimitChanges(events, signups, hydrated, lastEventLimitsRef) {
  if (!hydrated) return { signups, lastLimits: lastEventLimitsRef.current };
  const currentLimits = {};
  events.forEach((event) => {
    const currentLimit = Number(event.limit);
    currentLimits[event.id] = currentLimit;
    if (
      lastEventLimitsRef.current[event.id] !== undefined &&
      currentLimit > lastEventLimitsRef.current[event.id]
    ) {
      signups = promoteFromWaitlist(events, signups, event.id);
    }
  });
  return { signups, lastLimits: currentLimits };
}

export function iso(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function pad(n) {
  return String(n).padStart(2, '0');
}

export function getCalendarData(events, calYear, calMonth) {
  const eventsByDate = events.reduce((acc, event) => {
    const date = event.time.slice(0, 10);
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {});
  const calFirstDay = new Date(calYear, calMonth, 1).getDay();
  const calDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const todayStr = iso();
  return { eventsByDate, calFirstDay, calDaysInMonth, todayStr };
}

export function handleCalendarDayToggle(eventsByDate, day, calYear, calMonth, selectedId, activeDate) {
  const key = `${calYear}-${pad(calMonth + 1)}-${pad(day)}`;
  const dayEvents = eventsByDate[key];
  if (!dayEvents || dayEvents.length === 0) {
    return { selectedId, activeDate, found: false };
  }
  if (dayEvents.length === 1) {
    return { selectedId: dayEvents[0].id, activeDate: '', found: true, single: true };
  }
  return {
    selectedId,
    activeDate: activeDate === key ? '' : key,
    found: true,
    single: false
  };
}
