/** Source text survives Hermes compilation. Only scan explicit labels, never captions or comments. */
export const instagramSponsoredPostScript = String.raw`function(post) {
  var labels = post.querySelectorAll('header span, header a, header [aria-label], a[href*="/ads/about"], [data-testid="sponsored-label"], [aria-label="Sponsored"], [aria-label="Реклама"]');
  var sponsored = ['sponsored', 'реклама', 'рекламная публикация', 'homiylik', 'homiylik qilingan'];
  for (var index = 0; index < labels.length; index++) {
    var node = labels[index];
    var label = (node.getAttribute('aria-label') || node.textContent || '').trim().toLowerCase();
    if (sponsored.includes(label)) return true;
  }
  return false;
}`;
