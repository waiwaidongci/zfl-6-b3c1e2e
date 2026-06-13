export const SIGNUP_STATUS = {
  PENDING: '待审核',
  REJECTED: '已拒绝',
  CONFIRMED: '正式',
  WAITLISTED: '候补',
  PROMOTED: '候补转正',
  CANCELLED: '已取消',
  CHECKED_IN: '已签到'
};

export const ALL_STATUSES = Object.values(SIGNUP_STATUS);

export const STATUS_META = {
  [SIGNUP_STATUS.PENDING]: {
    label: '待审核',
    color: 'warning',
    isActive: true,
    canCheckIn: false,
    countsAs: { pending: true, approved: false, regular: false, waitlist: false, cancelled: false, rejected: false, checkedIn: false, promoted: false }
  },
  [SIGNUP_STATUS.REJECTED]: {
    label: '已拒绝',
    color: 'danger',
    isActive: false,
    canCheckIn: false,
    countsAs: { pending: false, approved: false, regular: false, waitlist: false, cancelled: false, rejected: true, checkedIn: false, promoted: false }
  },
  [SIGNUP_STATUS.CONFIRMED]: {
    label: '正式',
    color: 'success',
    isActive: true,
    canCheckIn: true,
    countsAs: { pending: false, approved: true, regular: true, waitlist: false, cancelled: false, rejected: false, checkedIn: false, promoted: false }
  },
  [SIGNUP_STATUS.WAITLISTED]: {
    label: '候补',
    color: 'warning',
    isActive: true,
    canCheckIn: false,
    countsAs: { pending: false, approved: true, regular: false, waitlist: true, cancelled: false, rejected: false, checkedIn: false, promoted: false }
  },
  [SIGNUP_STATUS.PROMOTED]: {
    label: '候补转正',
    color: 'success',
    isActive: true,
    canCheckIn: true,
    countsAs: { pending: false, approved: true, regular: true, waitlist: false, cancelled: false, rejected: false, checkedIn: false, promoted: true }
  },
  [SIGNUP_STATUS.CANCELLED]: {
    label: '已取消',
    color: 'muted',
    isActive: false,
    canCheckIn: false,
    countsAs: { pending: false, approved: false, regular: false, waitlist: false, cancelled: true, rejected: false, checkedIn: false, promoted: false }
  },
  [SIGNUP_STATUS.CHECKED_IN]: {
    label: '已签到',
    color: 'success',
    isActive: true,
    canCheckIn: false,
    countsAs: { pending: false, approved: true, regular: true, waitlist: false, cancelled: false, rejected: false, checkedIn: true, promoted: false }
  }
};

const VALID_TRANSITIONS = {
  [SIGNUP_STATUS.PENDING]: [SIGNUP_STATUS.CONFIRMED, SIGNUP_STATUS.WAITLISTED, SIGNUP_STATUS.REJECTED, SIGNUP_STATUS.CANCELLED],
  [SIGNUP_STATUS.REJECTED]: [SIGNUP_STATUS.CANCELLED, SIGNUP_STATUS.PENDING, SIGNUP_STATUS.CONFIRMED, SIGNUP_STATUS.WAITLISTED],
  [SIGNUP_STATUS.CONFIRMED]: [SIGNUP_STATUS.CHECKED_IN, SIGNUP_STATUS.CANCELLED, SIGNUP_STATUS.WAITLISTED, SIGNUP_STATUS.PENDING, SIGNUP_STATUS.REJECTED],
  [SIGNUP_STATUS.WAITLISTED]: [SIGNUP_STATUS.PROMOTED, SIGNUP_STATUS.CANCELLED, SIGNUP_STATUS.CONFIRMED, SIGNUP_STATUS.PENDING],
  [SIGNUP_STATUS.PROMOTED]: [SIGNUP_STATUS.CHECKED_IN, SIGNUP_STATUS.CANCELLED, SIGNUP_STATUS.WAITLISTED, SIGNUP_STATUS.CONFIRMED],
  [SIGNUP_STATUS.CANCELLED]: [SIGNUP_STATUS.PENDING, SIGNUP_STATUS.CONFIRMED, SIGNUP_STATUS.WAITLISTED],
  [SIGNUP_STATUS.CHECKED_IN]: [SIGNUP_STATUS.CONFIRMED, SIGNUP_STATUS.CANCELLED, SIGNUP_STATUS.PROMOTED]
};

export function isValidStatus(status) {
  return ALL_STATUSES.includes(status);
}

export function canTransition(fromStatus, toStatus) {
  if (!isValidStatus(fromStatus) || !isValidStatus(toStatus)) return false;
  return VALID_TRANSITIONS[fromStatus]?.includes(toStatus) || false;
}

export function getValidTransitions(status) {
  if (!isValidStatus(status)) return [];
  return VALID_TRANSITIONS[status] || [];
}

export function getStatusMeta(status) {
  return STATUS_META[status] || null;
}

export function isPending(status) {
  return STATUS_META[status]?.countsAs?.pending || false;
}

export function isApproved(status) {
  return STATUS_META[status]?.countsAs?.approved || false;
}

export function isRegular(status) {
  return STATUS_META[status]?.countsAs?.regular || false;
}

export function isWaitlist(status) {
  return STATUS_META[status]?.countsAs?.waitlist || false;
}

export function isCancelled(status) {
  return STATUS_META[status]?.countsAs?.cancelled || false;
}

export function isRejected(status) {
  return STATUS_META[status]?.countsAs?.rejected || false;
}

export function isCheckedIn(status) {
  return STATUS_META[status]?.countsAs?.checkedIn || false;
}

export function isPromoted(status) {
  return STATUS_META[status]?.countsAs?.promoted || false;
}

export function isActive(status) {
  return STATUS_META[status]?.isActive || false;
}

export function canCheckIn(status) {
  return STATUS_META[status]?.canCheckIn || false;
}

export function getStatusColor(status) {
  return STATUS_META[status]?.color || 'muted';
}

export function getStatusLabel(status) {
  return STATUS_META[status]?.label || status;
}

export function deriveLegacyFields(status) {
  if (status === SIGNUP_STATUS.PENDING) {
    return { reviewStatus: '待审核', checkedIn: false, _wasWaitlisted: false };
  }
  if (status === SIGNUP_STATUS.REJECTED) {
    return { reviewStatus: '已拒绝', checkedIn: false, _wasWaitlisted: false };
  }
  if (status === SIGNUP_STATUS.WAITLISTED) {
    return { reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: false };
  }
  if (status === SIGNUP_STATUS.PROMOTED) {
    return { reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: true };
  }
  if (status === SIGNUP_STATUS.CHECKED_IN) {
    return { reviewStatus: '已通过', checkedIn: true, _wasWaitlisted: false };
  }
  if (status === SIGNUP_STATUS.CONFIRMED) {
    return { reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: false };
  }
  if (status === SIGNUP_STATUS.CANCELLED) {
    return { reviewStatus: '', checkedIn: false, _wasWaitlisted: false };
  }
  return { reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: false };
}

export function resolveSignupStatusFromCsv({ signupType, reviewStatus, checkedIn, wasWaitlisted }) {
  const type = String(signupType || '').trim();
  const review = String(reviewStatus || '').trim();
  const ci = typeof checkedIn === 'boolean' ? checkedIn : normalizeCheckinBool(checkedIn);
  const wl = typeof wasWaitlisted === 'boolean' ? wasWaitlisted : String(wasWaitlisted || '').trim() === 'true' || String(wasWaitlisted || '').trim() === '是';

  const isPromotedType = type === '候补转正' || type === 'promoted' || type === '转正';
  const explicitWasWaitlisted = wl || isPromotedType;

  if (review === '已拒绝' || type === '已拒绝' || type === 'rejected') {
    return { status: SIGNUP_STATUS.REJECTED, wasWaitlisted: false };
  }
  if (review === '待审核' || type === '待审核' || type === 'pending') {
    return { status: SIGNUP_STATUS.PENDING, wasWaitlisted: false };
  }
  if (type === '已取消' || type === 'cancelled') {
    return { status: SIGNUP_STATUS.CANCELLED, wasWaitlisted: false };
  }
  if (ci) {
    return { status: SIGNUP_STATUS.CHECKED_IN, wasWaitlisted: explicitWasWaitlisted };
  }
  if (type === '候补' || type === 'waitlist' || type === '候') {
    return { status: SIGNUP_STATUS.WAITLISTED, wasWaitlisted: false };
  }
  if (explicitWasWaitlisted && (type === '正式' || !type || isPromotedType)) {
    return { status: SIGNUP_STATUS.PROMOTED, wasWaitlisted: true };
  }
  return { status: SIGNUP_STATUS.CONFIRMED, wasWaitlisted: false };
}

function normalizeCheckinBool(val) {
  if (!val) return false;
  const v = String(val).trim();
  return v === '已到场' || v === '已签到' || v === '是' || v === 'true' || v === '1' || v === '已';
}

export function resolveSignupStatusFromLegacy(signup) {
  if (!signup) return SIGNUP_STATUS.CONFIRMED;

  if (signup.status && ALL_STATUSES.includes(signup.status)) {
    return signup.status;
  }

  const result = resolveSignupStatusFromCsv({
    signupType: signup.status,
    reviewStatus: signup.reviewStatus,
    checkedIn: signup.checkedIn,
    wasWaitlisted: signup._wasWaitlisted
  });
  return result.status;
}

export function migrateLegacySignup(signup) {
  if (!signup) return signup;

  if (signup.status && ALL_STATUSES.includes(signup.status)) {
    if (signup.status === SIGNUP_STATUS.CONFIRMED && signup.checkedIn === true) {
      const wasWL = signup._wasWaitlisted || false;
      const derived = deriveLegacyFields(SIGNUP_STATUS.CHECKED_IN);
      const upgraded = {
        ...signup,
        status: SIGNUP_STATUS.CHECKED_IN,
        reviewStatus: derived.reviewStatus,
        checkedIn: true,
        _wasWaitlisted: wasWL,
        _migratedFromLegacy: true,
        _legacyStatus: signup.status
      };
      if (!upgraded.checkedInAt) {
        upgraded.checkedInAt = upgraded.reviewedAt || signup.createdAt || '';
      }
      return upgraded;
    }

    const meta = getStatusMeta(signup.status);
    const expectedLegacy = deriveLegacyFields(signup.status);
    let needsUpdate = false;
    let updated = { ...signup };

    if (signup.reviewStatus && signup.reviewStatus !== expectedLegacy.reviewStatus) {
      updated.reviewStatus = expectedLegacy.reviewStatus;
      needsUpdate = true;
    }
    if (signup.checkedIn !== undefined && Boolean(signup.checkedIn) !== Boolean(expectedLegacy.checkedIn)) {
      updated.checkedIn = expectedLegacy.checkedIn;
      needsUpdate = true;
    }
    if (signup._wasWaitlisted !== undefined) {
      if (signup._wasWaitlisted === false && expectedLegacy._wasWaitlisted === true) {
        updated._wasWaitlisted = true;
        needsUpdate = true;
      }
    }
    if (!updated.reviewStatus) {
      updated.reviewStatus = expectedLegacy.reviewStatus;
      needsUpdate = true;
    }
    if (updated.checkedIn === undefined) {
      updated.checkedIn = expectedLegacy.checkedIn;
      needsUpdate = true;
    }
    if (updated._wasWaitlisted === undefined) {
      updated._wasWaitlisted = expectedLegacy._wasWaitlisted;
      needsUpdate = true;
    }

    if (signup.status === SIGNUP_STATUS.WAITLISTED) {
      if (!updated.waitlistPosition) {
        updated.waitlistPosition = 1;
        needsUpdate = true;
      }
    } else if (updated.waitlistPosition !== undefined) {
      delete updated.waitlistPosition;
      needsUpdate = true;
    }

    if (needsUpdate) {
      updated._syncedFromStatus = true;
    }
    return updated;
  }

  const legacyStatus = signup.status;
  const legacyReviewStatus = signup.reviewStatus;
  const legacyCheckedIn = signup.checkedIn;
  const legacyWasWaitlisted = signup._wasWaitlisted;

  const resolved = resolveSignupStatusFromCsv({
    signupType: legacyStatus,
    reviewStatus: legacyReviewStatus,
    checkedIn: legacyCheckedIn,
    wasWaitlisted: legacyWasWaitlisted
  });
  const resolvedStatus = resolved.status;

  const derived = deriveLegacyFields(resolvedStatus);
  const finalWasWaitlisted = resolved.wasWaitlisted || legacyWasWaitlisted || derived._wasWaitlisted;
  const migrated = {
    ...signup,
    status: resolvedStatus,
    reviewStatus: derived.reviewStatus,
    checkedIn: derived.checkedIn,
    _wasWaitlisted: finalWasWaitlisted,
    _migratedFromLegacy: true
  };

  if (resolvedStatus === SIGNUP_STATUS.WAITLISTED && !migrated.waitlistPosition) {
    migrated.waitlistPosition = 1;
  }

  if (resolvedStatus !== SIGNUP_STATUS.WAITLISTED && migrated.waitlistPosition !== undefined) {
    delete migrated.waitlistPosition;
  }

  if (resolvedStatus === SIGNUP_STATUS.PENDING) {
    migrated.rejectionReason = '';
    migrated.reviewedAt = '';
  } else if (resolvedStatus === SIGNUP_STATUS.REJECTED) {
    migrated.rejectionReason = migrated.rejectionReason || '未提供原因';
  } else {
    migrated.rejectionReason = '';
    migrated.reviewedAt = migrated.reviewedAt || signup.createdAt || '';
  }

  if (legacyCheckedIn && !migrated.checkedInAt) {
    migrated.checkedInAt = migrated.reviewedAt || signup.createdAt || '';
  }

  migrated._migratedFromLegacy = true;
  migrated._legacyStatus = legacyStatus;
  migrated._legacyReviewStatus = legacyReviewStatus;

  return migrated;
}

export function migrateAllSignups(signups) {
  if (!Array.isArray(signups)) return [];
  return signups.map(migrateLegacySignup);
}

export function ensureSignupConsistency(signup) {
  if (!signup) return signup;
  return migrateLegacySignup(signup);
}

export function ensureAllSignupsConsistency(signups) {
  if (!Array.isArray(signups)) return [];
  return signups.map(ensureSignupConsistency);
}

export function createStatusTransition(signup, toStatus, options = {}) {
  const fromStatus = signup.status;

  if (fromStatus === toStatus) {
    return { ...signup };
  }

  if (!canTransition(fromStatus, toStatus)) {
    throw new Error(`无效状态转换: ${fromStatus} → ${toStatus}`);
  }

  const now = options.now || new Date().toLocaleString();
  const derived = deriveLegacyFields(toStatus);
  const updated = {
    ...signup,
    status: toStatus,
    reviewStatus: derived.reviewStatus,
    checkedIn: derived.checkedIn,
    _wasWaitlisted: toStatus === SIGNUP_STATUS.CHECKED_IN
      ? (isPromoted(fromStatus) || signup._wasWaitlisted || false)
      : derived._wasWaitlisted
  };

  if (fromStatus !== toStatus) {
    updated._statusTransitionedFrom = fromStatus;
    updated._statusTransitionedAt = now;
  }

  if (toStatus === SIGNUP_STATUS.PENDING) {
    updated.rejectionReason = '';
    updated.reviewedAt = '';
    delete updated.waitlistPosition;
  } else if (toStatus === SIGNUP_STATUS.REJECTED) {
    updated.rejectionReason = options.rejectionReason || updated.rejectionReason || '未提供原因';
    updated.reviewedAt = options.reviewedAt || now;
    delete updated.waitlistPosition;
  } else if (toStatus === SIGNUP_STATUS.CONFIRMED) {
    updated.reviewedAt = options.reviewedAt || updated.reviewedAt || now;
    updated.rejectionReason = '';
    updated.checkedInAt = '';
    delete updated.waitlistPosition;
  } else if (toStatus === SIGNUP_STATUS.WAITLISTED) {
    updated.reviewedAt = options.reviewedAt || updated.reviewedAt || now;
    updated.rejectionReason = '';
    updated.waitlistPosition = options.waitlistPosition || updated.waitlistPosition || 1;
  } else if (toStatus === SIGNUP_STATUS.PROMOTED) {
    updated.reviewedAt = options.reviewedAt || updated.reviewedAt || now;
    updated.rejectionReason = '';
    delete updated.waitlistPosition;
  } else if (toStatus === SIGNUP_STATUS.CHECKED_IN) {
    updated.checkedInAt = options.checkedInAt || now;
  } else if (toStatus === SIGNUP_STATUS.CANCELLED) {
    updated.cancelledAt = options.cancelledAt || now;
    delete updated.waitlistPosition;
  }

  if (options.reason) {
    updated._statusChangeReason = options.reason;
  }

  return updated;
}

export function transitionSignup(signups, signupId, toStatus, options = {}) {
  const signup = signups.find((s) => s.id === signupId);
  if (!signup) return signups;

  const updated = createStatusTransition(signup, toStatus, options);
  return signups.map((s) => (s.id === signupId ? updated : s));
}

export function getRegularAndPromotedAndCheckedIn(signups, eventId) {
  return signups.filter(
    (s) => s.eventId === eventId && (isRegular(s.status) || isPromoted(s.status) || isCheckedIn(s.status))
  );
}

export function getWaitlistOrdered(signups, eventId) {
  return signups
    .filter((s) => s.eventId === eventId && isWaitlist(s.status))
    .sort((a, b) => {
      const pa = a.waitlistPosition || 0;
      const pb = b.waitlistPosition || 0;
      if (pa !== pb) return pa - pb;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });
}

export function getApprovedSignupsByEvent(signups, eventId) {
  return signups.filter((s) => s.eventId === eventId && isApproved(s.status));
}

export function approveSignupWithStatus(events, signups, signupId) {
  const signup = signups.find((s) => s.id === signupId);
  if (!signup) return signups;

  if (signup.status !== SIGNUP_STATUS.PENDING) {
    if (isApproved(signup.status)) return signups;
    const event = events.find((e) => e.id === signup.eventId);
    if (!event) return signups;
  }

  const event = events.find((e) => e.id === signup.eventId);
  if (!event) return signups;

  const eventSignups = signups.filter((s) => s.eventId === event.id && isApproved(s.status));
  const regularCount = getRegularAndPromotedAndCheckedIn(signups, event.id).length;
  const waitlistCount = eventSignups.filter((s) => isWaitlist(s.status)).length;
  const limit = Number(event.limit);

  const toStatus = regularCount >= limit ? SIGNUP_STATUS.WAITLISTED : SIGNUP_STATUS.CONFIRMED;
  const options = { reviewedAt: new Date().toLocaleString() };
  if (toStatus === SIGNUP_STATUS.WAITLISTED) {
    options.waitlistPosition = waitlistCount + 1;
  }

  return transitionSignup(signups, signupId, toStatus, options);
}

export function rejectSignupWithStatus(signups, signupId, rejectionReason) {
  return transitionSignup(signups, signupId, SIGNUP_STATUS.REJECTED, {
    rejectionReason,
    reviewedAt: new Date().toLocaleString()
  });
}

export function cancelSignupWithStatus(events, signups, signupId) {
  const signup = signups.find((s) => s.id === signupId);
  if (!signup) return signups;

  if (signup.status === SIGNUP_STATUS.CANCELLED) return signups;

  let newSignups = transitionSignup(signups, signupId, SIGNUP_STATUS.CANCELLED, {
    cancelledAt: new Date().toLocaleString()
  });

  if (isRegular(signup.status) || isPromoted(signup.status) || isCheckedIn(signup.status)) {
    newSignups = promoteFromWaitlistWithStatus(events, newSignups, signup.eventId);
  } else if (isWaitlist(signup.status)) {
    const waitlistSignups = getWaitlistOrdered(newSignups, signup.eventId);

    newSignups = newSignups.map((item) => {
      if (item.eventId === signup.eventId && isWaitlist(item.status)) {
        const idx = waitlistSignups.findIndex((w) => w.id === item.id);
        if (idx >= 0) {
          return { ...item, waitlistPosition: idx + 1 };
        }
      }
      return item;
    });
  }

  return newSignups;
}

export function batchCancelSignups(events, signups, signupIds) {
  let updated = signups;
  for (const id of signupIds) {
    updated = cancelSignupWithStatus(events, updated, id);
  }
  return updated;
}

export function promoteFromWaitlistWithStatus(events, signups, eventId) {
  const event = events.find((e) => e.id === eventId);
  if (!event) return signups;

  const regularCount = getRegularAndPromotedAndCheckedIn(signups, eventId).length;
  const limit = Number(event.limit);

  if (regularCount < limit) {
    const waitlist = getWaitlistOrdered(signups, eventId);
    const spotsToFill = limit - regularCount;
    const toPromote = waitlist.slice(0, spotsToFill);

    if (toPromote.length > 0) {
      let updatedSignups = signups;
      for (const promotee of toPromote) {
        updatedSignups = transitionSignup(updatedSignups, promotee.id, SIGNUP_STATUS.PROMOTED, {
          reviewedAt: new Date().toLocaleString()
        });
      }

      const remainingWaitlist = waitlist.slice(spotsToFill);
      updatedSignups = updatedSignups.map((item) => {
        if (item.eventId === eventId && isWaitlist(item.status)) {
          const newPosition = remainingWaitlist.findIndex((w) => w.id === item.id) + 1;
          if (newPosition > 0) {
            return { ...item, waitlistPosition: newPosition };
          }
        }
        return item;
      });

      return updatedSignups;
    }
  }
  return signups;
}

export function revertPromotedToWaitlist(signups, eventId, maxRegularCount) {
  const currentRegular = getRegularAndPromotedAndCheckedIn(signups, eventId);
  if (currentRegular.length <= maxRegularCount) return signups;

  const toRevertCount = currentRegular.length - maxRegularCount;
  const promotedList = currentRegular
    .filter((s) => isPromoted(s.status))
    .sort((a, b) => {
      const aTime = a.reviewedAt || a.createdAt || '';
      const bTime = b.reviewedAt || b.createdAt || '';
      return bTime.localeCompare(aTime);
    });

  if (promotedList.length === 0) return signups;

  const toRevert = promotedList.slice(0, Math.min(toRevertCount, promotedList.length));
  const toRevertIds = new Set(toRevert.map((s) => s.id));

  const existingWaitlist = getWaitlistOrdered(signups, eventId);
  let nextPosition = existingWaitlist.length + 1;
  let waitlistAddOrder = [...toRevert].reverse();

  let updated = signups.map((item) => {
    if (toRevertIds.has(item.id)) {
      const pos = nextPosition++;
      return {
        ...item,
        status: SIGNUP_STATUS.WAITLISTED,
        waitlistPosition: pos,
        reviewStatus: '已通过',
        checkedIn: false,
        _wasWaitlisted: false
      };
    }
    return item;
  });

  return recountWaitlistPositions(updated, eventId);
}

export function toggleCheckInWithStatus(signups, signupId) {
  const signup = signups.find((s) => s.id === signupId);
  if (!signup) return signups;

  if (signup.status === SIGNUP_STATUS.CHECKED_IN) {
    const returnTo = signup._wasWaitlisted || signup._statusTransitionedFrom === SIGNUP_STATUS.PROMOTED
      ? SIGNUP_STATUS.PROMOTED
      : SIGNUP_STATUS.CONFIRMED;
    return transitionSignup(signups, signupId, returnTo, {});
  }

  if (canCheckIn(signup.status)) {
    return transitionSignup(signups, signupId, SIGNUP_STATUS.CHECKED_IN, {
      checkedInAt: new Date().toLocaleString()
    });
  }

  return signups;
}

export function batchCheckIn(signups, signupIds) {
  let updated = signups;
  for (const id of signupIds) {
    updated = toggleCheckInWithStatus(updated, id);
  }
  return updated;
}

export function createNewSignupStatus(event, eventSignups) {
  const approvedSignups = eventSignups.filter((s) => isApproved(s.status));
  const regularCount = approvedSignups.filter((s) => isRegular(s.status) || isPromoted(s.status) || isCheckedIn(s.status)).length;
  const waitlistCount = approvedSignups.filter((s) => isWaitlist(s.status)).length;
  const limit = Number(event.limit);

  if (event.reviewRequired) {
    return { status: SIGNUP_STATUS.PENDING, waitlistPosition: undefined };
  } else if (regularCount >= limit) {
    return { status: SIGNUP_STATUS.WAITLISTED, waitlistPosition: waitlistCount + 1 };
  } else {
    return { status: SIGNUP_STATUS.CONFIRMED, waitlistPosition: undefined };
  }
}

export function buildNewSignup(event, eventSignups, signupData) {
  const { status, waitlistPosition } = createNewSignupStatus(event, eventSignups);
  const now = new Date().toLocaleString();
  const derived = deriveLegacyFields(status);

  return {
    id: signupData.id || crypto.randomUUID(),
    eventId: event.id,
    name: signupData.name || '',
    phone: signupData.phone || '',
    answer: signupData.answer || '',
    readerId: signupData.readerId || undefined,
    status,
    waitlistPosition,
    reviewStatus: derived.reviewStatus,
    rejectionReason: status === SIGNUP_STATUS.REJECTED ? (signupData.rejectionReason || '未提供原因') : '',
    reviewedAt: status === SIGNUP_STATUS.PENDING ? '' : now,
    checkedIn: derived.checkedIn,
    checkedInAt: '',
    createdAt: signupData.createdAt || now,
    _wasWaitlisted: derived._wasWaitlisted
  };
}

export function buildSignupFromCsvRow(eventId, parsedRow, existingWaitlistCount = 0) {
  const wasWaitlistedRaw = parsedRow.wasWaitlisted || parsedRow._wasWaitlisted;
  const wasWaitlistedBool = typeof wasWaitlistedRaw === 'boolean'
    ? wasWaitlistedRaw
    : String(wasWaitlistedRaw || '').trim() === 'true' || String(wasWaitlistedRaw || '').trim() === '是';

  const resolved = resolveSignupStatusFromCsv({
    signupType: parsedRow.signupType,
    reviewStatus: parsedRow.reviewStatus,
    checkedIn: parsedRow.checkedIn,
    wasWaitlisted: wasWaitlistedBool
  });
  const status = resolved.status;

  const derived = deriveLegacyFields(status);
  const now = new Date().toLocaleString();

  const finalWasWaitlisted = (status === SIGNUP_STATUS.CHECKED_IN)
    ? (wasWaitlistedBool || resolved.wasWaitlisted || derived._wasWaitlisted)
    : (resolved.wasWaitlisted || derived._wasWaitlisted);

  const signup = {
    id: parsedRow.id || crypto.randomUUID(),
    eventId,
    name: parsedRow.name || '',
    phone: parsedRow.phone || '',
    answer: parsedRow.answer || '',
    readerId: parsedRow.readerId || undefined,
    status,
    reviewStatus: derived.reviewStatus,
    rejectionReason: status === SIGNUP_STATUS.REJECTED ? (parsedRow.rejectionReason || '未提供原因') : '',
    reviewedAt: parsedRow.reviewedAt || (status === SIGNUP_STATUS.PENDING ? '' : now),
    checkedIn: derived.checkedIn,
    checkedInAt: parsedRow.checkedInAt || (derived.checkedIn ? now : ''),
    createdAt: parsedRow.createdAt || now,
    cancelledAt: status === SIGNUP_STATUS.CANCELLED ? (parsedRow.cancelledAt || now) : undefined,
    _wasWaitlisted: finalWasWaitlisted,
    _importedFromCsv: true
  };

  if (status === SIGNUP_STATUS.WAITLISTED) {
    signup.waitlistPosition = parsedRow.waitlistPosition || existingWaitlistCount + 1;
  }

  return signup;
}

export function getSignupStatusDisplay(signup) {
  const meta = getStatusMeta(signup.status);
  if (!meta) return { label: signup.status, color: 'muted', isActive: false, canCheckIn: false, cssClass: 'muted' };

  let label = meta.label;
  if (isWaitlist(signup.status) && signup.waitlistPosition) {
    label = `候补 #${signup.waitlistPosition}`;
  }

  const cssClass = signup.status === SIGNUP_STATUS.PENDING ? 'pending'
    : signup.status === SIGNUP_STATUS.REJECTED ? 'rejected'
    : signup.status === SIGNUP_STATUS.WAITLISTED ? 'waitlist'
    : signup.status === SIGNUP_STATUS.CANCELLED ? 'muted'
    : signup.status === SIGNUP_STATUS.CHECKED_IN ? 'checkedIn'
    : signup.status === SIGNUP_STATUS.PROMOTED ? 'promoted'
    : 'regular';

  return {
    label,
    color: meta.color,
    isActive: meta.isActive,
    canCheckIn: meta.canCheckIn,
    cssClass
  };
}

export function getCancelActionLabel(signup) {
  if (signup.status === SIGNUP_STATUS.PENDING) return '取消申请';
  if (signup.status === SIGNUP_STATUS.REJECTED) return '删除记录';
  if (signup.status === SIGNUP_STATUS.WAITLISTED) return '退出候补';
  if (signup.status === SIGNUP_STATUS.CANCELLED) return '';
  return '取消报名';
}

export function recountWaitlistPositions(signups, eventId) {
  const waitlistSignups = signups
    .filter((s) => s.eventId === eventId && isWaitlist(s.status))
    .sort((a, b) => {
      const aTime = a.createdAt || '';
      const bTime = b.createdAt || '';
      const aPos = a.waitlistPosition || 0;
      const bPos = b.waitlistPosition || 0;
      if (aPos !== bPos && aPos > 0 && bPos > 0) return aPos - bPos;
      return aTime.localeCompare(bTime);
    });

  return signups.map((item) => {
    if (item.eventId === eventId && isWaitlist(item.status)) {
      const idx = waitlistSignups.findIndex((w) => w.id === item.id);
      return { ...item, waitlistPosition: idx >= 0 ? idx + 1 : item.waitlistPosition };
    }
    return item;
  });
}

export function recountAllWaitlistPositions(signups) {
  if (!Array.isArray(signups)) return [];
  const eventIds = new Set(signups.map((s) => s.eventId).filter(Boolean));
  let updated = signups;
  for (const eventId of eventIds) {
    updated = recountWaitlistPositions(updated, eventId);
  }
  return updated;
}

export function sortSignupsByStatusPriority(signups) {
  const statusPriority = {
    [SIGNUP_STATUS.PENDING]: 0,
    [SIGNUP_STATUS.CONFIRMED]: 1,
    [SIGNUP_STATUS.PROMOTED]: 1,
    [SIGNUP_STATUS.WAITLISTED]: 2,
    [SIGNUP_STATUS.CHECKED_IN]: 1,
    [SIGNUP_STATUS.REJECTED]: 3,
    [SIGNUP_STATUS.CANCELLED]: 4
  };

  return [...signups].sort((a, b) => {
    const pa = statusPriority[a.status] ?? 5;
    const pb = statusPriority[b.status] ?? 5;
    if (pa !== pb) return pa - pb;
    if (isWaitlist(a.status) && isWaitlist(b.status)) {
      return (a.waitlistPosition || 0) - (b.waitlistPosition || 0);
    }
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });
}

export function getStatusCounts(signups) {
  const counts = {
    total: signups.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    regular: 0,
    waitlist: 0,
    checkedIn: 0,
    promoted: 0,
    cancelled: 0
  };

  for (const s of signups) {
    if (isPending(s.status)) counts.pending++;
    if (isApproved(s.status)) counts.approved++;
    if (isRejected(s.status)) counts.rejected++;
    if (isRegular(s.status)) counts.regular++;
    if (isWaitlist(s.status)) counts.waitlist++;
    if (isCheckedIn(s.status)) counts.checkedIn++;
    if (isPromoted(s.status)) counts.promoted++;
    if (isCancelled(s.status)) counts.cancelled++;
  }

  counts.regular = counts.regular + counts.checkedIn + counts.promoted;
  return counts;
}

export function handleLimitIncrease(events, signups, eventId, oldLimit, newLimit) {
  if (newLimit <= oldLimit) return signups;
  return promoteFromWaitlistWithStatus(events, signups, eventId);
}

export function handleLimitDecrease(events, signups, eventId, oldLimit, newLimit) {
  if (newLimit >= oldLimit) return signups;
  return revertPromotedToWaitlist(signups, eventId, newLimit);
}

export function handleLimitChange(events, signups, eventId, oldLimit, newLimit) {
  const oldNum = Number(oldLimit);
  const newNum = Number(newLimit);
  if (newNum > oldNum) {
    const updatedEvents = events.map((e) => e.id === eventId ? { ...e, limit: newNum } : e);
    return promoteFromWaitlistWithStatus(updatedEvents, signups, eventId);
  } else if (newNum < oldNum) {
    return revertPromotedToWaitlist(signups, eventId, newNum);
  }
  return signups;
}

export const SIGNUP_STATUS_TRANSITION_LABELS = {
  [`${SIGNUP_STATUS.PENDING}→${SIGNUP_STATUS.CONFIRMED}`]: '审核通过（正式）',
  [`${SIGNUP_STATUS.PENDING}→${SIGNUP_STATUS.WAITLISTED}`]: '审核通过（候补）',
  [`${SIGNUP_STATUS.PENDING}→${SIGNUP_STATUS.REJECTED}`]: '审核拒绝',
  [`${SIGNUP_STATUS.PENDING}→${SIGNUP_STATUS.CANCELLED}`]: '取消申请',
  [`${SIGNUP_STATUS.CONFIRMED}→${SIGNUP_STATUS.CHECKED_IN}`]: '签到',
  [`${SIGNUP_STATUS.CONFIRMED}→${SIGNUP_STATUS.CANCELLED}`]: '取消报名',
  [`${SIGNUP_STATUS.CONFIRMED}→${SIGNUP_STATUS.WAITLISTED}`]: '降至候补',
  [`${SIGNUP_STATUS.CONFIRMED}→${SIGNUP_STATUS.PENDING}`]: '退回待审核',
  [`${SIGNUP_STATUS.CONFIRMED}→${SIGNUP_STATUS.REJECTED}`]: '拒绝报名',
  [`${SIGNUP_STATUS.WAITLISTED}→${SIGNUP_STATUS.PROMOTED}`]: '候补转正',
  [`${SIGNUP_STATUS.WAITLISTED}→${SIGNUP_STATUS.CONFIRMED}`]: '直接转为正式',
  [`${SIGNUP_STATUS.WAITLISTED}→${SIGNUP_STATUS.CANCELLED}`]: '退出候补',
  [`${SIGNUP_STATUS.WAITLISTED}→${SIGNUP_STATUS.PENDING}`]: '退回待审核',
  [`${SIGNUP_STATUS.PROMOTED}→${SIGNUP_STATUS.CHECKED_IN}`]: '签到',
  [`${SIGNUP_STATUS.PROMOTED}→${SIGNUP_STATUS.CANCELLED}`]: '取消报名',
  [`${SIGNUP_STATUS.PROMOTED}→${SIGNUP_STATUS.WAITLISTED}`]: '退回候补',
  [`${SIGNUP_STATUS.PROMOTED}→${SIGNUP_STATUS.CONFIRMED}`]: '转为正式',
  [`${SIGNUP_STATUS.CHECKED_IN}→${SIGNUP_STATUS.CONFIRMED}`]: '撤销签到',
  [`${SIGNUP_STATUS.CHECKED_IN}→${SIGNUP_STATUS.CANCELLED}`]: '取消报名',
  [`${SIGNUP_STATUS.CHECKED_IN}→${SIGNUP_STATUS.PROMOTED}`]: '撤销签到（候补转正）',
  [`${SIGNUP_STATUS.REJECTED}→${SIGNUP_STATUS.PENDING}`]: '退回待审核',
  [`${SIGNUP_STATUS.REJECTED}→${SIGNUP_STATUS.CONFIRMED}`]: '改为正式',
  [`${SIGNUP_STATUS.REJECTED}→${SIGNUP_STATUS.WAITLISTED}`]: '改为候补',
  [`${SIGNUP_STATUS.REJECTED}→${SIGNUP_STATUS.CANCELLED}`]: '删除记录',
  [`${SIGNUP_STATUS.CANCELLED}→${SIGNUP_STATUS.PENDING}`]: '恢复待审核',
  [`${SIGNUP_STATUS.CANCELLED}→${SIGNUP_STATUS.CONFIRMED}`]: '恢复正式',
  [`${SIGNUP_STATUS.CANCELLED}→${SIGNUP_STATUS.WAITLISTED}`]: '恢复候补'
};

export function getTransitionLabel(fromStatus, toStatus) {
  const key = `${fromStatus}→${toStatus}`;
  return SIGNUP_STATUS_TRANSITION_LABELS[key] || `${fromStatus} → ${toStatus}`;
}

export function normalizeEvent(event) {
  if (!event) return event;
  if (event.reviewRequired === undefined) {
    return { ...event, reviewRequired: false };
  }
  return event;
}

export function normalizeEvents(events) {
  if (!Array.isArray(events)) return [];
  return events.map(normalizeEvent);
}

export function normalizeSignup(signup) {
  return migrateLegacySignup(signup);
}

export function normalizeSignups(signups) {
  return migrateAllSignups(signups);
}
