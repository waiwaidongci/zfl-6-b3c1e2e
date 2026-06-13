import {
  isApproved,
  isPending,
  isRejected,
  isRegular,
  isWaitlist,
  isPromoted,
  isCheckedIn,
  SIGNUP_STATUS,
  sortSignupsByStatusPriority
} from './signupStatusMachine.js';

export function getSignupsByEvent(signups, eventId) {
  return signups.filter((item) => item.eventId === eventId);
}

export function sortByCreatedAtAsc(signups) {
  return [...signups].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function sortByReviewedAtDesc(signups) {
  return [...signups].sort((a, b) => (b.reviewedAt || '').localeCompare(a.reviewedAt || ''));
}

export function sortByWaitlistPosition(signups) {
  return [...signups].sort((a, b) => a.waitlistPosition - b.waitlistPosition);
}

export function getApprovedSignups(signups) {
  return signups.filter((item) => isApproved(item.status));
}

export function getPendingSignups(signups) {
  return sortByCreatedAtAsc(signups.filter((item) => isPending(item.status)));
}

export function getRejectedSignups(signups) {
  return sortByReviewedAtDesc(signups.filter((item) => isRejected(item.status)));
}

export function getRegularSignups(signups) {
  return getApprovedSignups(signups).filter((item) => isRegular(item.status) || isPromoted(item.status) || isCheckedIn(item.status));
}

export function getWaitlistSignups(signups) {
  return sortByWaitlistPosition(getApprovedSignups(signups).filter((item) => isWaitlist(item.status)));
}

export function getCheckedInCount(signups) {
  return signups.filter((item) => isCheckedIn(item.status)).length;
}

export function getRegularCheckedInCount(signups) {
  return getRegularSignups(signups).filter((item) => isCheckedIn(item.status)).length;
}

export function getGroupedSignups(signups) {
  return {
    regular: getRegularSignups(signups),
    waitlist: getWaitlistSignups(signups),
    pending: getPendingSignups(signups),
    rejected: getRejectedSignups(signups)
  };
}

export function sortSignupsForCsv(signups) {
  return sortSignupsByStatusPriority(signups);
}
