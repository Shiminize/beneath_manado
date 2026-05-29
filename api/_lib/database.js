import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';
import { getSeedBook, listSeedBooks } from './book-source.js';
import { decryptDisplayPassword } from './security.js';

let sqlClient;
let schemaPromise;
const readingSessionMigrationId = 'aggregate-page-events-to-reading-sessions-v1';
const readingSessionInactivityMinutes = 30;
const rawReaderEventTypes = new Set(['book_open', 'page_view', 'progress']);
const readingSessionEventTypes = new Set(['reading_session_start', 'reading_session_heartbeat', 'reading_session_end']);

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export async function listBooksForAdmin() {
  if (!hasDatabase()) {
    return listSeedBooks().map((book) => ({
      ...book,
      content: undefined,
      locked: false,
      hasPassword: false,
      passwordDisplay: null,
      passwordState: 'none',
      passwordUpdatedAt: null
    }));
  }

  await ensureSchema();
  const rows = await sql()`
    select
      id, title, author, subtitle, cover, item_type, section, tags, total_chapters, word_count, initial_status,
      locked, password_hash, password_display_payload, password_display_created_at, password_display_updated_at
    from reader_books
    order by title asc
  `;

  return rows.map(mapBookRow);
}

export function toAdminBookSummary(book, analytics) {
  return {
    id: book.id,
    title: book.title,
    locked: book.locked,
    hasPassword: book.hasPassword,
    passwordDisplay: book.passwordDisplay,
    passwordState: book.passwordState,
    passwordUpdatedAt: book.passwordUpdatedAt,
    readingSessions: analytics?.readingSessions || 0,
    views: analytics?.readingSessions || 0,
    sessions: analytics?.sessions || 0,
    maxPercent: analytics?.maxPercent || 0
  };
}

export async function getBookRecord(bookId) {
  if (!hasDatabase()) {
    const seed = getSeedBook(bookId);
    return seed
      ? {
          ...seed,
          locked: false,
          passwordHash: null,
          passwordDisplay: null,
          passwordState: 'none',
          passwordUpdatedAt: null
        }
      : null;
  }

  await ensureSchema();
  const rows = await sql()`
    select
      id, title, author, subtitle, cover, item_type, section, tags, total_chapters, word_count, initial_status,
      locked, password_hash, password_display_payload, password_display_created_at, password_display_updated_at, content_payload
    from reader_books
    where id = ${bookId}
    limit 1
  `;

  if (!rows[0]) return null;
  return {
    ...mapBookRow(rows[0]),
    content: rows[0].content_payload || []
  };
}

export async function setBookAccess(bookId, { locked, passwordHash, passwordDisplayPayload, hasNewPassword = false }) {
  if (!hasDatabase()) {
    return { ok: false, error: 'database_not_configured' };
  }

  await ensureSchema();

  if (!locked) {
    const rows = await sql()`
      update reader_books
      set locked = false,
          password_hash = null,
          password_display_payload = null,
          password_display_created_at = null,
          password_display_updated_at = null,
          updated_at = now()
      where id = ${bookId}
      returning id
    `;
    return rows[0] ? { ok: true } : { ok: false, error: 'book_not_found' };
  }

  if (hasNewPassword) {
    const rows = await sql()`
      update reader_books
      set locked = true,
          password_hash = ${passwordHash || null},
          password_display_payload = ${passwordDisplayPayload || null},
          password_display_created_at = coalesce(password_display_created_at, now()),
          password_display_updated_at = now(),
          updated_at = now()
      where id = ${bookId}
      returning id
    `;
    return rows[0] ? { ok: true } : { ok: false, error: 'book_not_found' };
  }

  const rows = await sql()`
    update reader_books
    set locked = true,
        updated_at = now()
    where id = ${bookId}
    returning id
  `;

  return rows[0] ? { ok: true } : { ok: false, error: 'book_not_found' };
}

export async function recordUnlockAttempt({ target, identity, ok }) {
  if (!hasDatabase()) return;
  await ensureSchema();
  await sql()`
    insert into reader_unlock_audit (id, target, visitor_hash, ip_network, country, ok)
    values (${randomUUID()}, ${target}, ${identity.visitorHash || 'unknown'}, ${identity.ipNetwork}, ${identity.country}, ${Boolean(ok)})
  `;
}

export async function tooManyAttempts({ target, identity, limit = 8, windowMinutes = 15 }) {
  if (!hasDatabase()) return false;
  await ensureSchema();
  const rows = await sql()`
    select count(*)::int as count
    from reader_unlock_audit
    where target = ${target}
      and visitor_hash = ${identity.visitorHash || 'unknown'}
      and ok = false
      and created_at > now() - make_interval(mins => ${windowMinutes})
  `;
  return Number(rows[0]?.count || 0) >= limit;
}

export async function recordAnalyticsEvent(event, identity) {
  if (!hasDatabase()) return { stored: false };
  await ensureSchema();

  await sql()`
    insert into reader_sessions (id, visitor_hash, ip_network, country, user_agent, started_at, last_seen_at)
    values (${event.sessionId}, ${identity.visitorHash || 'unknown'}, ${identity.ipNetwork}, ${identity.country}, ${identity.userAgent}, now(), now())
    on conflict (id) do update set last_seen_at = now()
  `;

  if (isReadingSessionEvent(event)) {
    await recordReadingSessionEvent(event, identity);
  }

  if (shouldStoreRawAnalyticsEvent(event)) {
    await sql()`
      insert into reader_events (
        id, session_id, visitor_hash, event_type, book_id, chapter_index, page_index, percent, duration_seconds,
        total_pages, total_chapters, ip_network, country
      )
      values (
        ${randomUUID()}, ${event.sessionId}, ${identity.visitorHash || 'unknown'}, ${event.type}, ${event.bookId || null},
        ${nullableNumber(event.chapterIndex)}, ${nullableNumber(event.pageIndex)}, ${nullableNumber(event.percent)},
        ${nullableNumber(event.durationSeconds)}, ${nullableNumber(event.totalPages)}, ${nullableNumber(event.totalChapters)},
        ${identity.ipNetwork}, ${identity.country}
      )
    `;
  }

  return { stored: true };
}

export async function getAnalyticsSnapshot({ rangeDays = 30, bookId = 'all' }) {
  if (!hasDatabase()) {
    return {
      setupRequired: true,
      totals: { readingSessions: 0, views: 0, sessions: 0, uniqueVisitors: 0, readMinutes: 0 },
      books: [],
      recentSessions: [],
      recentEvents: [],
      progressDepth: []
    };
  }

  await ensureSchema();
  const bookFilter = bookId === 'all' ? null : bookId;
  const totals = await sql()`
    select
      count(*)::int as reading_sessions,
      count(distinct site_session_id)::int as sessions,
      count(distinct visitor_hash)::int as unique_visitors,
      coalesce(sum(duration_seconds), 0)::int as read_seconds
    from reader_reading_sessions
    where created_at > now() - make_interval(days => ${rangeDays})
      and (${bookFilter}::text is null or book_id = ${bookFilter})
  `;

  const books = await sql()`
    select
      b.id,
      b.title,
      b.locked,
      count(rs.*)::int as reading_sessions,
      count(distinct rs.site_session_id)::int as sessions,
      coalesce(max(rs.max_percent), 0)::int as max_percent
    from reader_books b
    left join reader_reading_sessions rs on rs.book_id = b.id and rs.created_at > now() - make_interval(days => ${rangeDays})
    where (${bookFilter}::text is null or b.id = ${bookFilter})
    group by b.id, b.title, b.locked
    order by reading_sessions desc, b.title asc
  `;

  const recentSessions = await sql()`
    select
      book_id, started_at, last_seen_at, ended_at, duration_seconds, ip_network, country,
      start_chapter_index, start_page_index, last_chapter_index, last_page_index, max_percent
    from reader_reading_sessions
    where created_at > now() - make_interval(days => ${rangeDays})
      and (${bookFilter}::text is null or book_id = ${bookFilter})
    order by coalesce(ended_at, last_seen_at, started_at) desc
    limit 60
  `;

  const progressDepth = await sql()`
    select
      book_id,
      max(max_percent)::int as max_percent,
      max(last_chapter_index)::int as deepest_chapter,
      max(last_page_index)::int as deepest_page
    from reader_reading_sessions
    where created_at > now() - make_interval(days => ${rangeDays})
      and book_id is not null
      and (${bookFilter}::text is null or book_id = ${bookFilter})
    group by book_id
    order by max_percent desc nulls last
  `;

  return {
    setupRequired: false,
    totals: {
      readingSessions: Number(totals[0]?.reading_sessions || 0),
      views: Number(totals[0]?.reading_sessions || 0),
      sessions: Number(totals[0]?.sessions || 0),
      uniqueVisitors: Number(totals[0]?.unique_visitors || 0),
      readMinutes: Math.round(Number(totals[0]?.read_seconds || 0) / 60)
    },
    books: books.map((row) => ({
      id: row.id,
      title: row.title,
      locked: row.locked,
      readingSessions: Number(row.reading_sessions || 0),
      views: Number(row.reading_sessions || 0),
      sessions: Number(row.sessions || 0),
      maxPercent: Number(row.max_percent || 0)
    })),
    recentSessions: recentSessions.map(mapReadingSessionRow),
    recentEvents: recentSessions.map((row) => ({
      type: 'reading_session',
      bookId: row.book_id,
      chapterIndex: row.last_chapter_index,
      pageIndex: row.last_page_index,
      percent: row.max_percent,
      durationSeconds: row.duration_seconds,
      ipNetwork: row.ip_network,
      country: row.country,
      createdAt: row.started_at
    })),
    progressDepth: progressDepth.map((row) => ({
      bookId: row.book_id,
      maxPercent: Number(row.max_percent || 0),
      deepestChapter: row.deepest_chapter,
      deepestPage: row.deepest_page
    }))
  };
}

export async function listBookReadingSessions({ bookId, rangeDays = 30, limit = 80 }) {
  if (!hasDatabase()) {
    return { setupRequired: true, sessions: [] };
  }

  await ensureSchema();
  const boundedLimit = Math.min(200, Math.max(1, Number(limit) || 80));
  const rows = await sql()`
    select
      book_id, started_at, last_seen_at, ended_at, duration_seconds, ip_network, country,
      start_chapter_index, start_page_index, last_chapter_index, last_page_index, max_percent
    from reader_reading_sessions
    where book_id = ${bookId}
      and created_at > now() - make_interval(days => ${rangeDays})
    order by coalesce(ended_at, last_seen_at, started_at) desc
    limit ${boundedLimit}
  `;

  return {
    setupRequired: false,
    sessions: rows.map(mapReadingSessionRow)
  };
}

export async function listBookViewEvents(options) {
  const result = await listBookReadingSessions(options);
  return { ...result, events: result.sessions || [] };
}

export async function ensureSchema() {
  if (!hasDatabase()) return;
  if (!schemaPromise) {
    schemaPromise = initializeSchema();
  }
  await schemaPromise;
}

function sql() {
  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }
  return sqlClient;
}

async function initializeSchema() {
  await sql()`
    create table if not exists reader_books (
      id text primary key,
      title text not null,
      author text not null,
      subtitle text not null,
      cover text not null,
      item_type text not null,
      section text not null,
      tags jsonb not null default '[]'::jsonb,
      total_chapters integer not null,
      word_count integer not null,
      initial_status text not null,
      locked boolean not null default false,
      password_hash text,
      content_payload jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;

  await sql()`alter table reader_books add column if not exists password_display_payload text`;
  await sql()`alter table reader_books add column if not exists password_display_created_at timestamptz`;
  await sql()`alter table reader_books add column if not exists password_display_updated_at timestamptz`;

  await sql()`
    create table if not exists reader_sessions (
      id text primary key,
      visitor_hash text not null,
      ip_network text not null,
      country text not null,
      user_agent text not null,
      started_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now()
    )
  `;

  await sql()`
    create table if not exists reader_events (
      id text primary key,
      session_id text not null,
      visitor_hash text not null,
      event_type text not null,
      book_id text,
      chapter_index integer,
      page_index integer,
      percent integer,
      duration_seconds integer,
      total_pages integer,
      total_chapters integer,
      ip_network text not null,
      country text not null,
      created_at timestamptz not null default now()
    )
  `;

  await sql()`
    create table if not exists reader_reading_sessions (
      id text primary key,
      site_session_id text not null,
      book_id text not null,
      visitor_hash text not null,
      ip_network text not null,
      country text not null,
      started_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      ended_at timestamptz,
      duration_seconds integer not null default 0,
      start_chapter_index integer,
      start_page_index integer,
      last_chapter_index integer,
      last_page_index integer,
      max_percent integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql()`
    create table if not exists reader_analytics_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  await sql()`
    create table if not exists reader_unlock_audit (
      id text primary key,
      target text not null,
      visitor_hash text not null,
      ip_network text not null,
      country text not null,
      ok boolean not null,
      created_at timestamptz not null default now()
    )
  `;

  await sql()`create index if not exists reader_events_created_at_idx on reader_events (created_at desc)`;
  await sql()`create index if not exists reader_events_book_created_idx on reader_events (book_id, created_at desc)`;
  await sql()`create index if not exists reader_events_session_idx on reader_events (session_id)`;
  await sql()`create index if not exists reader_reading_sessions_book_created_idx on reader_reading_sessions (book_id, created_at desc)`;
  await sql()`create index if not exists reader_reading_sessions_site_book_idx on reader_reading_sessions (site_session_id, book_id, last_seen_at desc)`;
  await sql()`create index if not exists reader_reading_sessions_active_idx on reader_reading_sessions (site_session_id, ended_at, last_seen_at desc)`;
  await sql()`create index if not exists reader_unlock_audit_target_visitor_idx on reader_unlock_audit (target, visitor_hash, created_at desc)`;

  for (const book of listSeedBooks()) {
    await sql()`
      insert into reader_books (
        id, title, author, subtitle, cover, item_type, section, tags, total_chapters, word_count, initial_status, content_payload
      )
      values (
        ${book.id}, ${book.title}, ${book.author}, ${book.subtitle}, ${book.cover}, ${book.type}, ${book.section},
        ${JSON.stringify(book.tags)}::jsonb, ${book.totalChapters}, ${book.wordCount}, ${book.initialStatus},
        ${JSON.stringify(book.content)}::jsonb
      )
      on conflict (id) do update set
        title = excluded.title,
        author = excluded.author,
        subtitle = excluded.subtitle,
        cover = excluded.cover,
        item_type = excluded.item_type,
        section = excluded.section,
        tags = excluded.tags,
        total_chapters = excluded.total_chapters,
        word_count = excluded.word_count,
        initial_status = excluded.initial_status,
        content_payload = excluded.content_payload,
        updated_at = now()
    `;
  }

  await migrateLegacyPageViewsToReadingSessions();
}

async function recordReadingSessionEvent(event, identity) {
  if (!event.bookId) return;

  const mode = getReadingSessionMode(event.type);
  const durationSeconds = nullableNumber(event.durationSeconds);
  const chapterIndex = nullableNumber(event.chapterIndex);
  const pageIndex = nullableNumber(event.pageIndex);
  const percent = nullableNumber(event.percent) || 0;

  if (mode === 'start') {
    await sql()`
      update reader_reading_sessions
      set ended_at = coalesce(ended_at, last_seen_at),
          updated_at = now()
      where site_session_id = ${event.sessionId}
        and book_id <> ${event.bookId}
        and ended_at is null
    `;
  }

  const activeRows = await sql()`
    select id
    from reader_reading_sessions
    where site_session_id = ${event.sessionId}
      and book_id = ${event.bookId}
      and ended_at is null
      and last_seen_at > now() - make_interval(mins => ${readingSessionInactivityMinutes})
    order by last_seen_at desc
    limit 1
  `;

  if (!activeRows[0]) {
    await sql()`
      insert into reader_reading_sessions (
        id, site_session_id, book_id, visitor_hash, ip_network, country, started_at, last_seen_at, ended_at,
        duration_seconds, start_chapter_index, start_page_index, last_chapter_index, last_page_index, max_percent
      )
      values (
        ${randomUUID()}, ${event.sessionId}, ${event.bookId}, ${identity.visitorHash || 'unknown'}, ${identity.ipNetwork}, ${identity.country},
        now(), now(), ${mode === 'end' ? new Date().toISOString() : null},
        ${durationSeconds || 0}, ${chapterIndex}, ${pageIndex}, ${chapterIndex}, ${pageIndex}, ${percent}
      )
    `;
    return;
  }

  const activeId = activeRows[0].id;
  if (mode === 'end') {
    await sql()`
      update reader_reading_sessions
      set last_seen_at = now(),
          ended_at = now(),
          duration_seconds = greatest(
            coalesce(duration_seconds, 0),
            coalesce(${durationSeconds}::int, greatest(0, floor(extract(epoch from (now() - started_at)))::int))
          ),
          last_chapter_index = coalesce(${chapterIndex}, last_chapter_index),
          last_page_index = coalesce(${pageIndex}, last_page_index),
          max_percent = greatest(coalesce(max_percent, 0), ${percent}),
          updated_at = now()
      where id = ${activeId}
    `;
    return;
  }

  await sql()`
    update reader_reading_sessions
    set last_seen_at = now(),
        duration_seconds = greatest(
          coalesce(duration_seconds, 0),
          coalesce(${durationSeconds}::int, greatest(0, floor(extract(epoch from (now() - started_at)))::int))
        ),
        start_chapter_index = coalesce(start_chapter_index, ${chapterIndex}),
        start_page_index = coalesce(start_page_index, ${pageIndex}),
        last_chapter_index = coalesce(${chapterIndex}, last_chapter_index),
        last_page_index = coalesce(${pageIndex}, last_page_index),
        max_percent = greatest(coalesce(max_percent, 0), ${percent}),
        updated_at = now()
    where id = ${activeId}
  `;
}

async function migrateLegacyPageViewsToReadingSessions() {
  const migrations = await sql()`
    select id
    from reader_analytics_migrations
    where id = ${readingSessionMigrationId}
    limit 1
  `;
  if (migrations[0]) return;

  const rows = await sql()`
    select session_id, visitor_hash, event_type, book_id, chapter_index, page_index, percent, duration_seconds, ip_network, country, created_at
    from reader_events
    where event_type in ('book_open', 'page_view')
      and book_id is not null
    order by session_id asc, book_id asc, created_at asc
  `;
  const groups = buildLegacyReadingSessionGroups(rows, readingSessionInactivityMinutes);

  for (const group of groups) {
    await sql()`
      insert into reader_reading_sessions (
        id, site_session_id, book_id, visitor_hash, ip_network, country, started_at, last_seen_at, ended_at,
        duration_seconds, start_chapter_index, start_page_index, last_chapter_index, last_page_index, max_percent, created_at, updated_at
      )
      values (
        ${group.id}, ${group.siteSessionId}, ${group.bookId}, ${group.visitorHash}, ${group.ipNetwork}, ${group.country},
        ${group.startedAt.toISOString()}, ${group.lastSeenAt.toISOString()}, ${group.endedAt.toISOString()},
        ${group.durationSeconds}, ${group.startChapterIndex}, ${group.startPageIndex}, ${group.lastChapterIndex}, ${group.lastPageIndex},
        ${group.maxPercent}, ${group.startedAt.toISOString()}, now()
      )
      on conflict (id) do nothing
    `;
  }

  await sql()`delete from reader_events where event_type = 'page_view'`;
  await sql()`
    insert into reader_analytics_migrations (id)
    values (${readingSessionMigrationId})
    on conflict (id) do nothing
  `;
}

export function buildLegacyReadingSessionGroups(rows, inactivityMinutes = readingSessionInactivityMinutes) {
  const inactivityMs = inactivityMinutes * 60 * 1000;
  const sortedRows = [...rows]
    .filter((row) => getRowValue(row, 'book_id', 'bookId') && getRowValue(row, 'session_id', 'sessionId'))
    .sort((left, right) => {
      const leftKey = `${getRowValue(left, 'session_id', 'sessionId')}:${getRowValue(left, 'book_id', 'bookId')}`;
      const rightKey = `${getRowValue(right, 'session_id', 'sessionId')}:${getRowValue(right, 'book_id', 'bookId')}`;
      if (leftKey !== rightKey) return leftKey.localeCompare(rightKey);
      return getRowDate(left).getTime() - getRowDate(right).getTime();
    });

  const groups = [];
  let current = null;

  for (const row of sortedRows) {
    const rowTime = getRowDate(row);
    const siteSessionId = getRowValue(row, 'session_id', 'sessionId');
    const bookId = getRowValue(row, 'book_id', 'bookId');
    const startsNextGroup =
      !current ||
      current.siteSessionId !== siteSessionId ||
      current.bookId !== bookId ||
      rowTime.getTime() - current.lastSeenAt.getTime() > inactivityMs;

    if (startsNextGroup) {
      current = createLegacyReadingSessionGroup(row, rowTime);
      groups.push(current);
    }

    applyLegacyReadingSessionRow(current, row, rowTime);
  }

  for (const group of groups) {
    if (!group.durationSeconds) {
      group.durationSeconds = Math.max(0, Math.round((group.lastSeenAt.getTime() - group.startedAt.getTime()) / 1000));
    }
    group.endedAt = group.lastSeenAt;
  }

  return groups;
}

function mapBookRow(row) {
  const passwordDisplayState = resolvePasswordDisplayState(row);

  return {
    id: row.id,
    type: row.item_type,
    title: row.title,
    author: row.author,
    subtitle: row.subtitle,
    cover: row.cover,
    description: '',
    section: row.section,
    tags: row.tags || [],
    totalChapters: row.total_chapters,
    wordCount: row.word_count,
    initialStatus: row.initial_status,
    locked: row.locked,
    passwordHash: row.password_hash || null,
    hasPassword: Boolean(row.password_hash),
    passwordDisplay: passwordDisplayState.passwordDisplay,
    passwordState: passwordDisplayState.passwordState,
    passwordUpdatedAt: row.password_display_updated_at || null
  };
}

export function resolvePasswordDisplayState(row) {
  if (!row.password_hash) {
    return { passwordDisplay: null, passwordState: 'none' };
  }

  if (!row.password_display_payload) {
    return { passwordDisplay: null, passwordState: 'reset_required' };
  }

  try {
    const passwordDisplay = decryptDisplayPassword(row.password_display_payload);
    if (passwordDisplay) return { passwordDisplay, passwordState: 'visible' };
  } catch {
    // If the display key is missing or rotated, preserve the hash-only lock state.
  }

  return { passwordDisplay: null, passwordState: 'reset_required' };
}

export function shouldStoreRawAnalyticsEvent(event) {
  return !rawReaderEventTypes.has(event.type) && !readingSessionEventTypes.has(event.type);
}

function isReadingSessionEvent(event) {
  return Boolean(event.bookId) && (rawReaderEventTypes.has(event.type) || readingSessionEventTypes.has(event.type));
}

function getReadingSessionMode(eventType) {
  if (eventType === 'book_open' || eventType === 'reading_session_start') return 'start';
  if (eventType === 'reading_session_end') return 'end';
  return 'heartbeat';
}

function mapReadingSessionRow(row) {
  return {
    bookId: row.book_id,
    startedAt: row.started_at,
    lastSeenAt: row.last_seen_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    ipNetwork: row.ip_network,
    country: row.country,
    startChapterIndex: row.start_chapter_index,
    startPageIndex: row.start_page_index,
    lastChapterIndex: row.last_chapter_index,
    lastPageIndex: row.last_page_index,
    maxPercent: Number(row.max_percent || 0)
  };
}

function createLegacyReadingSessionGroup(row, rowTime) {
  const siteSessionId = getRowValue(row, 'session_id', 'sessionId');
  const bookId = getRowValue(row, 'book_id', 'bookId');

  return {
    id: `legacy:${siteSessionId}:${bookId}:${rowTime.toISOString()}`,
    siteSessionId,
    bookId,
    visitorHash: getRowValue(row, 'visitor_hash', 'visitorHash') || 'unknown',
    ipNetwork: getRowValue(row, 'ip_network', 'ipNetwork') || 'unknown',
    country: getRowValue(row, 'country', 'country') || 'XX',
    startedAt: rowTime,
    lastSeenAt: rowTime,
    endedAt: rowTime,
    durationSeconds: 0,
    startChapterIndex: null,
    startPageIndex: null,
    lastChapterIndex: null,
    lastPageIndex: null,
    maxPercent: 0
  };
}

function applyLegacyReadingSessionRow(group, row, rowTime) {
  const chapterIndex = nullableNumber(getRowValue(row, 'chapter_index', 'chapterIndex'));
  const pageIndex = nullableNumber(getRowValue(row, 'page_index', 'pageIndex'));
  const percent = nullableNumber(getRowValue(row, 'percent', 'percent')) || 0;
  const durationSeconds = nullableNumber(getRowValue(row, 'duration_seconds', 'durationSeconds')) || 0;

  group.lastSeenAt = rowTime;
  group.durationSeconds += durationSeconds;
  group.maxPercent = Math.max(group.maxPercent, percent);

  if (chapterIndex !== null || pageIndex !== null) {
    if (group.startChapterIndex === null && group.startPageIndex === null) {
      group.startChapterIndex = chapterIndex;
      group.startPageIndex = pageIndex;
    }
    group.lastChapterIndex = chapterIndex;
    group.lastPageIndex = pageIndex;
  }
}

function getRowValue(row, snakeKey, camelKey) {
  return row[snakeKey] ?? row[camelKey] ?? null;
}

function getRowDate(row) {
  const value = getRowValue(row, 'created_at', 'createdAt');
  return value instanceof Date ? value : new Date(value);
}

function nullableNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function resolveRetentionDays(rawValue = process.env.ANALYTICS_RETENTION_DAYS) {
  const parsedRetentionDays = Number(rawValue || 90);
  return Number.isFinite(parsedRetentionDays) ? Math.max(1, parsedRetentionDays) : 90;
}

export async function enforceRetention() {
  if (!hasDatabase()) return { ok: false, error: 'database_not_configured' };
  await ensureSchema();

  const retentionDays = resolveRetentionDays();
  await sql()`delete from reader_events where created_at < now() - make_interval(days => ${retentionDays})`;
  await sql()`delete from reader_reading_sessions where created_at < now() - make_interval(days => ${retentionDays})`;
  await sql()`delete from reader_unlock_audit where created_at < now() - make_interval(days => ${retentionDays})`;

  return { ok: true, retentionDays };
}
