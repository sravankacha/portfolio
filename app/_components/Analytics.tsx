/**
 * Cloudflare Web Analytics — privacy-friendly, cookie-free, no consent banner.
 *
 * Token is injected at build time via NEXT_PUBLIC_CF_BEACON_TOKEN (set as a
 * GitHub Actions secret of the same name and exposed to `npm run build`).
 * When the env var is absent we render nothing — keeps local/dev clean.
 */
export default function Analytics() {
  const token = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;
  if (!token) return null;

  return (
    <script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token })}
    />
  );
}
