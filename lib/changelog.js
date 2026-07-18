/**
 * Status-transition timeline parsing for Jira changelogs.
 *
 * Jira exposes an issue's status history only through the `changelog` EXPAND
 * (GET /issue/{key}?expand=changelog), never as a field. This module turns that
 * raw `changelog.histories[]` payload into an exact, chronologically-ordered
 * status timeline with the wall-clock duration spent in each status, so callers
 * can answer questions like "how long did this sit in Awaiting Review before
 * Done" from real transition timestamps instead of approximating from
 * created/updated.
 *
 * Functions are pure (an injectable `now` keeps duration math deterministic).
 */

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Format a millisecond duration as a compact "Nd Nh Nm" string.
 * Zero components are omitted; a zero total renders as "0m".
 * @param {number} ms - Duration in milliseconds
 * @returns {string}
 */
export function formatDuration(ms) {
  if (!ms || ms <= 0) {
    return '0m';
  }

  const days = Math.floor(ms / MS_PER_DAY);
  const hours = Math.floor((ms % MS_PER_DAY) / MS_PER_HOUR);
  const minutes = Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE);

  const parts = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  // Sub-minute durations (e.g. a rapid double-transition) still deserve a value.
  return parts.length > 0 ? parts.join(' ') : '0m';
}

/**
 * Parse a Jira issue fetched with expand=changelog into a status timeline.
 *
 * @param {Object} issue - Issue payload including `changelog`
 * @param {number|string|Date} [now=Date.now()] - Reference time for the still-open
 *   final segment. Injectable for deterministic testing.
 * @returns {Object} Structured timeline:
 *   - key, currentStatus, created
 *   - transitions[]: { at, author, from, to } in chronological order
 *   - segments[]: { status, enteredAt, leftAt|null, durationMs, current }
 *   - totalsByStatus: { [status]: totalMs } aggregated across revisits
 *   - truncated, totalHistories, returnedHistories
 */
export function parseStatusTimeline(issue, now = Date.now()) {
  const nowMs = new Date(now).getTime();
  const created = issue?.fields?.created ?? null;
  const currentStatus = issue?.fields?.status?.name ?? null;

  const changelog = issue?.changelog ?? {};
  const histories = Array.isArray(changelog.histories) ? changelog.histories : [];

  // Collect every status-change item, tagged with when and by whom.
  const transitions = [];
  for (const history of histories) {
    for (const item of history.items ?? []) {
      if (item.field === 'status') {
        transitions.push({
          at: history.created,
          author: history.author?.displayName ?? history.author?.name ?? 'Unknown',
          from: item.fromString ?? null,
          to: item.toString ?? null
        });
      }
    }
  }

  // Jira Server usually returns histories oldest-first, but do not rely on it.
  transitions.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  // Build contiguous status segments. Segment boundaries are: issue creation,
  // each transition timestamp, and finally `now` for the open current status.
  const segments = [];
  if (transitions.length === 0) {
    // Never transitioned: one open segment in the current status since creation.
    segments.push(makeSegment(currentStatus, created, null, nowMs, true));
  } else {
    // Initial status is the `from` of the first transition (or, defensively,
    // the current status if the first transition has no `from`).
    const initialStatus = transitions[0].from ?? currentStatus;
    segments.push(makeSegment(initialStatus, created, transitions[0].at, nowMs, false));

    for (let i = 0; i < transitions.length; i++) {
      const status = transitions[i].to;
      const enteredAt = transitions[i].at;
      const isLast = i === transitions.length - 1;
      const leftAt = isLast ? null : transitions[i + 1].at;
      segments.push(makeSegment(status, enteredAt, leftAt, nowMs, isLast));
    }
  }

  // Aggregate total time per status across all (possibly repeated) segments.
  const totalsByStatus = {};
  for (const seg of segments) {
    if (seg.status == null) {
      continue;
    }
    totalsByStatus[seg.status] = (totalsByStatus[seg.status] ?? 0) + seg.durationMs;
  }

  const returnedHistories = histories.length;
  const totalHistories = typeof changelog.total === 'number' ? changelog.total : returnedHistories;

  return {
    key: issue?.key ?? null,
    currentStatus,
    created,
    transitions,
    segments,
    totalsByStatus,
    returnedHistories,
    totalHistories,
    truncated: totalHistories > returnedHistories
  };
}

/**
 * Build one timeline segment with its computed duration.
 * @param {string|null} status
 * @param {string|null} enteredAt - ISO timestamp
 * @param {string|null} leftAt - ISO timestamp, or null if still current
 * @param {number} nowMs - Reference time for an open segment
 * @param {boolean} current
 * @returns {Object}
 */
function makeSegment(status, enteredAt, leftAt, nowMs, current) {
  const startMs = enteredAt != null ? new Date(enteredAt).getTime() : nowMs;
  const endMs = leftAt != null ? new Date(leftAt).getTime() : nowMs;
  const durationMs = Math.max(0, endMs - startMs);
  return { status, enteredAt, leftAt, durationMs, current };
}

/**
 * Render a parsed timeline as human-readable text: per-status segments with
 * durations, then a totals summary. Token-cheaper than the raw changelog JSON.
 * @param {Object} parsed - Output of parseStatusTimeline
 * @returns {string}
 */
export function formatStatusTimeline(parsed) {
  const lines = [];
  lines.push(`Status history for ${parsed.key ?? 'issue'} (current: ${parsed.currentStatus ?? 'N/A'})`);

  if (parsed.truncated) {
    lines.push(
      `WARNING: changelog truncated — ${parsed.returnedHistories} of ${parsed.totalHistories} history entries returned. ` +
      'Durations below may be incomplete.'
    );
  }

  lines.push('');
  lines.push('Timeline:');
  for (const seg of parsed.segments) {
    const entered = seg.enteredAt ? new Date(seg.enteredAt).toISOString() : 'unknown';
    const suffix = seg.current
      ? `${formatDuration(seg.durationMs)} (current)`
      : formatDuration(seg.durationMs);
    lines.push(`  ${entered}  ${seg.status ?? 'N/A'}  —  ${suffix}`);
  }

  lines.push('');
  lines.push('Total time per status:');
  const totals = Object.entries(parsed.totalsByStatus).sort((a, b) => b[1] - a[1]);
  for (const [status, ms] of totals) {
    lines.push(`  ${status}: ${formatDuration(ms)}`);
  }

  return lines.join('\n');
}
