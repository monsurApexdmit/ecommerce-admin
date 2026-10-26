// Single IANA timezone list shared by General settings and Company settings.
export const TIMEZONES: [string, string][] = [
  ["Asia/Dhaka", "(GMT+6) Asia/Dhaka"],
  ["Asia/Kolkata", "(GMT+5:30) Asia/Kolkata"],
  ["Asia/Karachi", "(GMT+5) Asia/Karachi"],
  ["Asia/Dubai", "(GMT+4) Asia/Dubai"],
  ["Asia/Riyadh", "(GMT+3) Asia/Riyadh"],
  ["Asia/Bangkok", "(GMT+7) Asia/Bangkok"],
  ["Asia/Singapore", "(GMT+8) Asia/Singapore"],
  ["Asia/Kuala_Lumpur", "(GMT+8) Asia/Kuala_Lumpur"],
  ["Asia/Hong_Kong", "(GMT+8) Asia/Hong_Kong"],
  ["Asia/Tokyo", "(GMT+9) Asia/Tokyo"],
  ["Australia/Sydney", "(GMT+10/11) Australia/Sydney"],
  ["Pacific/Auckland", "(GMT+12/13) Pacific/Auckland"],
  ["UTC", "(GMT+0) UTC"],
  ["Europe/London", "(GMT+0/1) Europe/London"],
  ["Europe/Paris", "(GMT+1/2) Europe/Paris"],
  ["Europe/Berlin", "(GMT+1/2) Europe/Berlin"],
  ["Europe/Istanbul", "(GMT+3) Europe/Istanbul"],
  ["Africa/Cairo", "(GMT+2/3) Africa/Cairo"],
  ["Africa/Lagos", "(GMT+1) Africa/Lagos"],
  ["America/New_York", "(GMT-5/-4) America/New_York"],
  ["America/Chicago", "(GMT-6/-5) America/Chicago"],
  ["America/Denver", "(GMT-7/-6) America/Denver"],
  ["America/Los_Angeles", "(GMT-8/-7) America/Los_Angeles"],
  ["America/Toronto", "(GMT-5/-4) America/Toronto"],
  ["America/Sao_Paulo", "(GMT-3) America/Sao_Paulo"],
]

/** Returns the list, appending the saved value when it is not in it so the select never breaks. */
export const timezonesWith = (cur?: string): [string, string][] =>
  !cur || TIMEZONES.some(([a]) => a === cur) ? TIMEZONES : [...TIMEZONES, [cur, cur]]
