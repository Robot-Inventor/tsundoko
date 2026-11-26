// VRChat's image API answers 403 unless the User-Agent names an application, a version, and a contact.
// Sharing one identifying UA keeps page and image fetches equally acceptable to hosts with that rule.
const userAgent =
    "Mozilla/5.0 (compatible; tsundoko/1.0; +https://github.com/Robot-Inventor/tsundoko; purpose=link-preview; like-twitterbot)";

export { userAgent };
