// Phone-class device detection from User-Agent. We deliberately do NOT match iPad:
// modern iPadOS sends a desktop UA by default, and the product decision is
// "phones go to conserjería, larger screens to admin/dashboard."
const PHONE_UA = /iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i;

export function isPhoneUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return PHONE_UA.test(ua);
}
