import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';
import { getSeedBook, listSeedBooks } from './book-source.js';
import { decryptDisplayPassword } from './security.js';

let sqlClient;
let schemaPromise;
let lastRetentionCleanup = 0;

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

  await cleanupRetention();

  return { stored: true };
}

export async function getAnalyticsSnapshot({ rangeDays = 30, bookId = 'all' }) {
  if (!hasDatabase()) {
    return {
      setupRequired: true,
      totals: { views: 0, sessions: 0, uniqueVisitors: 0, readMinutes: 0 },
      books: [],
      recentEvents: [],
      progressDepth: []
    };
  }

  await ensureSchema();
  const bookFilter = bookId === 'all' ? null : bookId;
  const totals = await sql()`
    select
      count(*) filter (where event_type in ('book_open', 'page_view'))::int as views,
      count(distinct session_id)::int as sessions,
      count(distinct visitor_hash)::int as unique_visitors,
      coalesce(sum(duration_seconds), 0)::int as read_seconds
    from reader_events
    where created_at > now() - make_interval(days => ${rangeDays})
      and (${bookFilter}::text is null or book_id = ${bookFilter})
  `;

  const books = await sql()`
    select
      b.id,
      b.title,
      b.locked,
      count(e.*) filter (where e.event_type in ('book_open', 'page_view'))::int as views,
      count(distinct e.session_id)::int as sessions,
      coalesce(max(e.percent), 0)::int as max_percent
    from reader_books b
    left join reader_events e on e.book_id = b.id and e.created_at > now() - make_interval(days => ${rangeDays})
    where (${bookFilter}::text is null or b.id = ${bookFilter})
    group by b.id, b.title, b.locked
    order by views desc, b.title asc
  `;

  const recentEvents = await sql()`
    select event_type, book_id, chapter_index, page_index, percent, duration_seconds, ip_network, country, created_at
    from reader_events
    where created_at > now() - make_interval(days => ${rangeDays})
      and (${bookFilter}::text is null or book_id = ${bookFilter})
    order by created_at desc
    limit 60
  `;

  const progressDepth = await sql()`
    select book_id, max(percent)::int as max_percent, max(chapter_index)::int as deepest_chapter, max(page_index)::int as deepest_page
    from reader_events
    where created_at > now() - make_interval(days => ${rangeDays})
      and book_id is not null
      and (${bookFilter}::text is null or book_id = ${bookFilter})
    group by book_id
    order by max_percent desc nulls last
  `;

  return {
    setupRequired: false,
    totals: {
      views: Number(totals[0]?.views || 0),
      sessions: Number(totals[0]?.sessions || 0),
      uniqueVisitors: Number(totals[0]?.unique_visitors || 0),
      readMinutes: Math.round(Number(totals[0]?.read_seconds || 0) / 60)
    },
    books: books.map((row) => ({
      id: row.id,
      title: row.title,
      locked: row.locked,
      views: Number(row.views || 0),
      sessions: Number(row.sessions || 0),
      maxPercent: Number(row.max_percent || 0)
    })),
    recentEvents: recentEvents.map((row) => ({
      type: row.event_type,
      bookId: row.book_id,
      chapterIndex: row.chapter_index,
      pageIndex: row.page_index,
      percent: row.percent,
      durationSeconds: row.duration_seconds,
      ipNetwork: row.ip_network,
      country: row.country,
      createdAt: row.created_at
    })),
    progressDepth: progressDepth.map((row) => ({
      bookId: row.book_id,
      maxPercent: Number(row.max_percent || 0),
      deepestChapter: row.deepest_chapter,
      deepestPage: row.deepest_page
    }))
  };
}

export async function listBookViewEvents({ bookId, rangeDays = 30, limit = 80 }) {
  if (!hasDatabase()) {
    return { setupRequired: true, events: [] };
  }

  await ensureSchema();
  const boundedLimit = Math.min(200, Math.max(1, Number(limit) || 80));
  const rows = await sql()`
    select event_type, chapter_index, page_index, percent, duration_seconds, ip_network, country, created_at
    from reader_events
    where book_id = ${bookId}
      and event_type in ('book_open', 'page_view')
      and created_at > now() - make_interval(days => ${rangeDays})
    order by created_at desc
    limit ${boundedLimit}
  `;

  return {
    setupRequired: false,
    events: rows.map((row) => ({
      createdAt: row.created_at,
      eventType: row.event_type,
      ipNetwork: row.ip_network,
      country: row.country,
      chapterIndex: row.chapter_index,
      pageIndex: row.page_index,
      percent: row.percent,
      durationSeconds: row.duration_seconds
    }))
  };
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

function nullableNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function cleanupRetention() {
  const now = Date.now();
  if (now - lastRetentionCleanup < 60 * 60 * 1000) return;
  lastRetentionCleanup = now;

  const parsedRetentionDays = Number(process.env.ANALYTICS_RETENTION_DAYS || 90);
  const retentionDays = Number.isFinite(parsedRetentionDays) ? Math.max(1, parsedRetentionDays) : 90;
  await sql()`delete from reader_events where created_at < now() - make_interval(days => ${retentionDays})`;
  await sql()`delete from reader_unlock_audit where created_at < now() - make_interval(days => ${retentionDays})`;
}
