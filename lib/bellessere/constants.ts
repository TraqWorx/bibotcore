export const BELLESSERE_LOCATION_ID = '38lvVkcTVVRFDDcHqYd1'

// Public GHL service-menu booking link (used in waiting-list invites + the QR).
// Uses the pretty slug URL (same menu as service-menu/6937fbf1a46ad98005960cb7,
// verified) and accepts contact-prefill query params.
export const BELLESSERE_BOOKING_LINK = 'https://links.bibotcrm.it/widget/service-menus/bellessere'

// Per-service booking widget base — /<calendarId> deep-links straight into one
// service (skips the menu), and accepts ?user= + contact-prefill params.
export const BELLESSERE_BOOKING_WIDGET_BASE = 'https://links.bibotcrm.it/widget/booking'

// How long a waiting-list invite is held before we drip to the next person
export const WAITLIST_HOLD_HOURS = 4
