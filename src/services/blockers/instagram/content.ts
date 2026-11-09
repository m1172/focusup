/** Source text survives Hermes compilation. Only scan explicit labels, never captions or comments. */
export const instagramSponsoredPostScript = String.raw`function(post) {
  var labels = post.querySelectorAll('header span, header a, header [aria-label], a[href*="/ads/about"], [data-testid="sponsored-label"], [aria-label="Sponsored"], [aria-label="Реклама"], [aria-label="Reklama"]');
  // Instagram's own ad label in English, Russian and Uzbek (Latin and Cyrillic).
  var sponsored = ['sponsored', 'реклама', 'рекламная публикация', 'спонсировано', 'reklama', 'homiylik', 'homiylik qilingan', 'homiylik asosida', 'ҳомийлик'];
  for (var index = 0; index < labels.length; index++) {
    var node = labels[index];
    // Labels can carry a separator dot after them ("Sponsored ·").
    var label = (node.getAttribute('aria-label') || node.textContent || '').trim().toLowerCase().replace(/[\s·•.]+$/, '');
    if (sponsored.includes(label)) return true;
  }
  return false;
}`;
