/**
 * Unit tests for changelog / status-transition timeline parsing.
 *
 * These cover the core capability the MCP server was missing: turning a Jira
 * issue fetched with `expand=changelog` into an exact status-transition history
 * with the wall-clock duration the issue spent in each status.
 */

import {
  parseStatusTimeline,
  formatDuration,
  formatStatusTimeline
} from '../lib/changelog.js';

// A synthetic issue mirroring the shape of GET /issue/{key}?expand=changelog on
// Jira Server/DC. Timestamps are chosen so durations are round numbers.
const CREATED = '2026-01-01T00:00:00.000+0000';
const T1 = '2026-01-02T00:00:00.000+0000'; // Open -> In Progress        (1d in Open)
const T2 = '2026-01-04T00:00:00.000+0000'; // In Progress -> Awaiting Review (2d in In Progress)
const T3 = '2026-01-04T06:00:00.000+0000'; // Awaiting Review -> Done    (6h in Awaiting Review)
const NOW = '2026-01-05T00:00:00.000+0000'; // 18h in Done (still current)

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

function issueWithChangelog(histories, { total, currentStatus = 'Done' } = {}) {
  return {
    key: 'DEV-999',
    fields: {
      summary: 'Test issue',
      created: CREATED,
      status: { name: currentStatus }
    },
    changelog: {
      startAt: 0,
      maxResults: histories.length,
      total: total ?? histories.length,
      histories
    }
  };
}

function statusHistory(created, author, from, to) {
  return {
    created,
    author: { name: author, displayName: author },
    items: [{ field: 'status', fromString: from, toString: to }]
  };
}

const FULL_HISTORIES = [
  statusHistory(T1, 'alice', 'Open', 'In Progress'),
  statusHistory(T2, 'bob', 'In Progress', 'Awaiting Review'),
  statusHistory(T3, 'carol', 'Awaiting Review', 'Done')
];

describe('formatDuration', () => {
  test('formats zero as 0m', () => {
    expect(formatDuration(0)).toBe('0m');
  });

  test('formats minutes only', () => {
    expect(formatDuration(15 * MIN)).toBe('15m');
  });

  test('formats hours and minutes', () => {
    expect(formatDuration(2 * HOUR + 30 * MIN)).toBe('2h 30m');
  });

  test('formats days, hours, minutes', () => {
    expect(formatDuration(2 * DAY + 3 * HOUR + 15 * MIN)).toBe('2d 3h 15m');
  });

  test('omits zero components in the middle but keeps larger unit', () => {
    expect(formatDuration(2 * DAY)).toBe('2d');
    expect(formatDuration(2 * DAY + 15 * MIN)).toBe('2d 15m');
  });
});

describe('parseStatusTimeline', () => {
  test('extracts each status transition with author and timestamp', () => {
    const parsed = parseStatusTimeline(issueWithChangelog(FULL_HISTORIES), NOW);

    expect(parsed.transitions).toHaveLength(3);
    expect(parsed.transitions[0]).toMatchObject({ from: 'Open', to: 'In Progress', author: 'alice', at: T1 });
    expect(parsed.transitions[2]).toMatchObject({ from: 'Awaiting Review', to: 'Done', author: 'carol', at: T3 });
  });

  test('computes wall-clock duration spent in each status', () => {
    const parsed = parseStatusTimeline(issueWithChangelog(FULL_HISTORIES), NOW);

    expect(parsed.totalsByStatus.Open).toBe(1 * DAY);
    expect(parsed.totalsByStatus['In Progress']).toBe(2 * DAY);
    expect(parsed.totalsByStatus['Awaiting Review']).toBe(6 * HOUR);
    expect(parsed.totalsByStatus.Done).toBe(18 * HOUR);
  });

  test('answers "how long in Awaiting Review before Done" exactly', () => {
    const parsed = parseStatusTimeline(issueWithChangelog(FULL_HISTORIES), NOW);
    const awaiting = parsed.segments.find(s => s.status === 'Awaiting Review');

    expect(awaiting.enteredAt).toBe(T2);
    expect(awaiting.leftAt).toBe(T3);
    expect(awaiting.durationMs).toBe(6 * HOUR);
    expect(awaiting.current).toBe(false);
  });

  test('the initial segment runs from issue creation to the first transition', () => {
    const parsed = parseStatusTimeline(issueWithChangelog(FULL_HISTORIES), NOW);
    const first = parsed.segments[0];

    expect(first.status).toBe('Open');
    expect(first.enteredAt).toBe(CREATED);
    expect(first.leftAt).toBe(T1);
  });

  test('the final segment is open-ended and marked current', () => {
    const parsed = parseStatusTimeline(issueWithChangelog(FULL_HISTORIES), NOW);
    const last = parsed.segments[parsed.segments.length - 1];

    expect(last.status).toBe('Done');
    expect(last.leftAt).toBeNull();
    expect(last.current).toBe(true);
    expect(last.durationMs).toBe(18 * HOUR);
    expect(parsed.currentStatus).toBe('Done');
  });

  test('handles an issue that never changed status (no histories)', () => {
    const parsed = parseStatusTimeline(
      issueWithChangelog([], { currentStatus: 'Open' }),
      NOW
    );

    expect(parsed.transitions).toHaveLength(0);
    expect(parsed.segments).toHaveLength(1);
    expect(parsed.segments[0]).toMatchObject({ status: 'Open', enteredAt: CREATED, leftAt: null, current: true });
    expect(parsed.totalsByStatus.Open).toBe(4 * DAY);
  });

  test('aggregates total time when a status is revisited', () => {
    // Open -> In Progress -> Open (reopened) -> Done
    const t1 = '2026-01-02T00:00:00.000+0000'; // 1d in Open
    const t2 = '2026-01-03T00:00:00.000+0000'; // 1d in In Progress
    const t3 = '2026-01-05T00:00:00.000+0000'; // 2d back in Open
    const histories = [
      statusHistory(t1, 'alice', 'Open', 'In Progress'),
      statusHistory(t2, 'bob', 'In Progress', 'Open'),
      statusHistory(t3, 'carol', 'Open', 'Done')
    ];
    const now = '2026-01-06T00:00:00.000+0000'; // 1d in Done

    const parsed = parseStatusTimeline(issueWithChangelog(histories, { currentStatus: 'Done' }), now);

    expect(parsed.totalsByStatus.Open).toBe(3 * DAY); // 1d + 2d across two visits
    expect(parsed.totalsByStatus['In Progress']).toBe(1 * DAY);
    expect(parsed.totalsByStatus.Done).toBe(1 * DAY);
    expect(parsed.segments.filter(s => s.status === 'Open')).toHaveLength(2);
  });

  test('ignores non-status changelog items (e.g. assignee, description)', () => {
    const histories = [
      {
        created: T1,
        author: { name: 'alice', displayName: 'alice' },
        items: [
          { field: 'assignee', fromString: null, toString: 'bob' },
          { field: 'status', fromString: 'Open', toString: 'Done' }
        ]
      }
    ];
    const parsed = parseStatusTimeline(issueWithChangelog(histories, { currentStatus: 'Done' }), NOW);

    expect(parsed.transitions).toHaveLength(1);
    expect(parsed.transitions[0]).toMatchObject({ from: 'Open', to: 'Done' });
  });

  test('sorts out-of-order histories chronologically before computing', () => {
    const shuffled = [FULL_HISTORIES[2], FULL_HISTORIES[0], FULL_HISTORIES[1]];
    const parsed = parseStatusTimeline(issueWithChangelog(shuffled), NOW);

    expect(parsed.transitions.map(t => t.to)).toEqual(['In Progress', 'Awaiting Review', 'Done']);
    expect(parsed.totalsByStatus['Awaiting Review']).toBe(6 * HOUR);
  });

  test('flags a truncated changelog when total exceeds returned histories', () => {
    const parsed = parseStatusTimeline(
      issueWithChangelog(FULL_HISTORIES, { total: 250 }),
      NOW
    );
    expect(parsed.truncated).toBe(true);
    expect(parsed.totalHistories).toBe(250);
    expect(parsed.returnedHistories).toBe(3);
  });

  test('is not truncated when total equals returned histories', () => {
    const parsed = parseStatusTimeline(issueWithChangelog(FULL_HISTORIES), NOW);
    expect(parsed.truncated).toBe(false);
  });

  test('tolerates a missing author on a history entry', () => {
    const histories = [{ created: T1, items: [{ field: 'status', fromString: 'Open', toString: 'Done' }] }];
    const parsed = parseStatusTimeline(issueWithChangelog(histories, { currentStatus: 'Done' }), NOW);
    expect(parsed.transitions[0].author).toBe('Unknown');
  });
});

describe('formatStatusTimeline', () => {
  test('renders a readable timeline with durations and totals', () => {
    const parsed = parseStatusTimeline(issueWithChangelog(FULL_HISTORIES), NOW);
    const text = formatStatusTimeline(parsed);

    expect(text).toContain('DEV-999');
    expect(text).toContain('Awaiting Review');
    expect(text).toContain('6h'); // duration in Awaiting Review
    expect(text).toContain('Done'); // current status
    expect(text).toContain('current');
  });

  test('surfaces a truncation warning when the changelog was capped', () => {
    const parsed = parseStatusTimeline(issueWithChangelog(FULL_HISTORIES, { total: 250 }), NOW);
    const text = formatStatusTimeline(parsed);
    expect(text.toLowerCase()).toContain('truncated');
  });
});
