/**
 * iCalendar (.ics) generation for confirmed bookings.
 * Uses stable UIDs so rescheduled/cancelled events update in calendar apps.
 */

function escapeIcs(str) {
  return String(str ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function foldLine(line) {
  // RFC 5545 §3.1: fold lines longer than 75 octets
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const chunks = [];
  let start = 0;
  while (start < line.length) {
    if (start === 0) {
      chunks.push(line.slice(0, 75));
      start = 75;
    } else {
      chunks.push(' ' + line.slice(start, start + 74));
      start += 74;
    }
  }
  return chunks.join('\r\n');
}

function dtStamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function dtLocal(dateStr, timeStr) {
  // Malta is UTC+1 (or UTC+2 DST). Return as floating local time (TZID approach)
  const d = dateStr.replace(/-/g, '');
  const t = timeStr.replace(/:/g, '') + '00';
  return `TZID=Europe/Malta:${d}T${t}`;
}

/**
 * Build a VEVENT block for a booking.
 * @param {object} opts
 * @param {string} opts.bookingId    - Stable booking UUID (used as UID)
 * @param {string} opts.sessionTitle
 * @param {string} opts.playerName
 * @param {string} opts.sessionDate  - YYYY-MM-DD
 * @param {string} opts.startTime    - HH:MM
 * @param {string} opts.endTime      - HH:MM
 * @param {string} opts.locationName
 * @param {string} opts.locationAddress
 * @param {string} opts.coachName
 * @param {string} opts.instructions
 * @param {'confirmed'|'cancelled'} opts.status
 * @param {number} opts.sequence     - Increment on updates
 */
export function buildIcsEvent(opts) {
  const {
    bookingId,
    sessionTitle,
    playerName,
    sessionDate,
    startTime,
    endTime,
    locationName,
    locationAddress = '',
    coachName = '',
    instructions = '',
    status = 'confirmed',
    sequence = 0,
  } = opts;

  const uid     = `booking-${bookingId}@premierperformancegk.com`;
  const method  = status === 'cancelled' ? 'CANCEL' : 'REQUEST';
  const icsStatus = status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED';

  const summary     = escapeIcs(`${sessionTitle} — ${playerName}`);
  const location    = escapeIcs([locationName, locationAddress].filter(Boolean).join(', '));
  const description = escapeIcs([
    `Player: ${playerName}`,
    `Coach: ${coachName || 'TBC'}`,
    `Booking Ref: ${bookingId.slice(0, 8).toUpperCase()}`,
    instructions ? `Notes: ${instructions}` : '',
  ].filter(Boolean).join('\\n'));

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Premier Performance GK//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Malta',
    'BEGIN:STANDARD',
    'DTSTART:19701025T020000',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19700329T020000',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp()}`,
    `DTSTART;${dtLocal(sessionDate, startTime)}`,
    `DTEND;${dtLocal(sessionDate, endTime)}`,
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    `STATUS:${icsStatus}`,
    `SEQUENCE:${sequence}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.map(foldLine).join('\r\n');
}

/** Generate an ICS download response */
export function icsResponse(icsContent, filename = 'session.ics') {
  return new Response(icsContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}