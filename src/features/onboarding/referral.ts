/** Invite codes are letters, digits and dashes, upper-cased, at most 24 characters. */
export function cleanReferralCode(text: string) {
  return text.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
}
