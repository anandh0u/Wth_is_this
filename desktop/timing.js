function reminderState(event, now = Date.now()) {
  if (event.status !== 'scheduled' || event.notifiedAt) return 'skip';
  const time = Date.parse(event.startsAt);
  if (!Number.isFinite(time) || time > now) return 'skip';
  return now - time <= 300000 ? 'due' : 'missed';
}
function idleMemeDue({ enabled, idleSeconds, threshold, lastPlayed, now, locked }) {
  return Boolean(enabled && !locked && idleSeconds >= threshold && now-lastPlayed >= 120000);
}
module.exports = { reminderState, idleMemeDue };
