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
  return signups.filter((item) => item.reviewStatus === '已通过');
}

export function getPendingSignups(signups) {
  return sortByCreatedAtAsc(signups.filter((item) => item.reviewStatus === '待审核'));
}

export function getRejectedSignups(signups) {
  return sortByReviewedAtDesc(signups.filter((item) => item.reviewStatus === '已拒绝'));
}

export function getRegularSignups(signups) {
  return getApprovedSignups(signups).filter((item) => item.status === '正式');
}

export function getWaitlistSignups(signups) {
  return sortByWaitlistPosition(getApprovedSignups(signups).filter((item) => item.status === '候补'));
}

export function getCheckedInCount(signups) {
  return signups.filter((item) => item.checkedIn).length;
}

export function getRegularCheckedInCount(signups) {
  return getRegularSignups(signups).filter((item) => item.checkedIn).length;
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
  return [...signups].sort((a, b) => {
    const statusOrder = { '待审核': 0, '已通过': 1, '已拒绝': 2 };
    if (statusOrder[a.reviewStatus] !== statusOrder[b.reviewStatus]) {
      return statusOrder[a.reviewStatus] - statusOrder[b.reviewStatus];
    }
    if (a.status !== b.status) {
      return a.status === '正式' ? -1 : 1;
    }
    if (a.status === '候补') {
      return a.waitlistPosition - b.waitlistPosition;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}
