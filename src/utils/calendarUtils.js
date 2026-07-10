/**
 * Client-side calendar utilities: Google Calendar, Outlook, and ICS download.
 * All Malta local times (Europe/Malta, UTC+1/+2 DST) are converted to UTC
 * for Google/Outlook URLs. ICS uses TZID=Europe/Malta with local times per RFC 5545.
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
    if (start === 0) { chunks.push(line.slice(0, 75)); start = 75; }
    else { chunks.push(' ' + line.slice(start, start + 74)); start += 74; }
  }
  return chunks.join('\r\n');
}

/**
 * Convert a Malta local date+time to a UTC Date.
 * Uses the Intl trick to determine the actual UTC offset for the given date
 * (handles CET/CEST DST transitions automatically).
 */
function maltaToUTC(dateStr, timeStr) {
  const fakeUTC = new Date(`${dateStr}T${timeStr}:00Z`);
  const maltaStr = fakeUTC.toLocaleString('sv', { timeZone: 'Europe/Malta' });
  const maltaAsUTC = new Date(maltaStr.replace(' ', 'T') + 'Z');
  return new Date(2 * fakeUTC.getTime() - maltaAsUTC.getTime());
}

function toGCalDate(utcDate) {
  return utcDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function eventTitle(booking) {
  return `${booking.sessionName || ''} — ${booking.playerName || ''}`;
}

function eventDetails(booking) {
  return [
    `Player: ${booking.playerName || ''}`,
    `Coach: ${booking.coachName || 'TBC'}`,
    `Booking Ref: ${(booking.id || '').slice(0, 8).toUpperCase()}`,
  ].join('\n');
}

/** Build a Google Calendar event URL (opens pre-filled form in new tab). */
export function buildGoogleCalendarUrl(booking) {
  const startUTC = maltaToUTC(booking.sessionDate, booking.startTime);
  const endUTC   = maltaToUTC(booking.sessionDate, booking.endTime);
  const p = new URLSearchParams({
    action:   'TEMPLATE',
    text:     eventTitle(booking),
    dates:    `${toGCalDate(startUTC)}/${toGCalDate(endUTC)}`,
    location: booking.locationName || '',
    details:  eventDetails(booking),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

/** Build an Outlook / Office 365 calendar compose URL (opens in new tab). */
export function buildOutlookCalendarUrl(booking) {
  const startUTC = maltaToUTC(booking.sessionDate, booking.startTime);
  const endUTC   = maltaToUTC(booking.sessionDate, booking.endTime);
  const p = new URLSearchParams({
    subject:  eventTitle(booking),
    startdt:  startUTC.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    enddt:    endUTC.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    location: booking.locationName || '',
    body:     eventDetails(booking),
  });
  return `https://outlook.live.com/calendar/0/action/compose?${p}`;
}

const MALTA_VTIMEZONE = [
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
];

function buildVEvent(booking) {
  const uid     = `booking-${booking.id || ''}@premierperformancegk.com`;
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dtStart = `TZID=Europe/Malta:${booking.sessionDate.replace(/-/g, '')}T${booking.startTime.replace(/:/g, '')}00`;
  const dtEnd   = `TZID=Europe/Malta:${booking.sessionDate.replace(/-/g, '')}T${booking.endTime.replace(/:/g, '')}00`;

  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;${dtStart}`,
    `DTEND;${dtEnd}`,
    `SUMMARY:${escapeIcs(eventTitle(booking))}`,
    `LOCATION:${escapeIcs(booking.locationName || '')}`,
    `DESCRIPTION:${escapeIcs(eventDetails(booking))}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
  ];
}

/**
 * Generate and trigger a browser download of an ICS file.
 * Accepts a single booking object or an array (multi-session → multiple VEVENTs in one file).
 */
export function downloadIcs(bookings, filename) {
  const list = Array.isArray(bookings) ? bookings : [bookings];
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Premier Performance GK//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    ...MALTA_VTIMEZONE,
    ...list.flatMap(buildVEvent),
    'END:VCALENDAR',
  ];
  const content = lines.map(foldLine).join('\r\n');
  const blob    = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = filename || `booking-${(list[0].id || '').slice(0, 8)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
