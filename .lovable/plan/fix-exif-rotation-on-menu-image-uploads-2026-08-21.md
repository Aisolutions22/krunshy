# Fix EXIF rotation on menu image uploads

Phone photos carry an orientation flag instead of physically rotated pixels. The current upload path draws the image through a canvas, which discards that flag, so some photos land sideways or upside down.

## What changes

In the image-upload helper (`src/lib/storage.ts`, `compressImage`):

- Decode the picked file with the browser's EXIF-aware option (`createImageBitmap(file, { imageOrientation: "from-image" })`) so orientation is applied to the pixels **before** any resizing or encoding.
- Fall back to the current decode path if the browser ignores that option, so nothing breaks on older browsers.
- Compute the 800px max-edge scaling from the already-rotated dimensions, so a portrait photo stays portrait and isn't cropped or stretched.

## What stays exactly the same

- Max edge 800px, WebP quality 0.8, JPEG q0.8 fallback.
- 20MB pre-upload reject, SVG passthrough, "keep original if smaller" rule.
- Bucket `menu-images`, UUID filenames, 1-year cache header, 12h signed URLs.
- No thumbnails or responsive sizes.

## Verification

Upload a portrait phone photo with a rotation flag through Admin → Menu and confirm the stored image renders upright in the admin preview and on the customer menu grid.
