/**
 * Limits shared between the sell form, the product API routes and the upload
 * route. These were previously duplicated as bare literals in each place,
 * which is how the web form ended up capped at 3 images while the Flutter app
 * allowed 5 and the API enforced nothing at all.
 *
 * The Flutter app cannot import this file; `sell_product_screen.dart` carries
 * the same number with a comment pointing back here.
 */

/** Maximum product images per listing. */
export const MAX_LISTING_IMAGES = 3

/** Maximum size of a single uploaded image, enforced by `POST /api/upload`. */
export const MAX_UPLOAD_SIZE_MB = 5
