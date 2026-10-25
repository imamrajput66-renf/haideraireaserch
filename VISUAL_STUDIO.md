# Educational Visual Studio

## Integration
The existing site and authentication remain unchanged. `/visuals` is a new signed-in study tool in the sidebar and homepage feature list. Ten visual modes, education level, style, orientation, language and detail settings are available.

The server interprets requests with streamed Lovable AI Responses (`openai/gpt-6-astra`) into a strict plan. Technical relationships render as escaped SVG, flowcharts use Dagre layout (MIT), and explicit 2D functions use an allowlisted mathjs parser (Apache-2.0) with 501 numerical samples. Organic anatomy, realistic illustrations and infographics use streamed image generation (`openai/gpt-image-2.5-sunburst`). Bitmap refinement sends the original private image to the image editing endpoint; structured refinement supplies the original plan to the interpreter.

## Configuration
`LOVABLE_API_KEY` is required server-side and already configured. Existing Cloud environment variables and generated authenticated clients are reused. No new external API keys are needed. Image generation is billed from workspace AI credits. All image model configuration is isolated in `src/lib/visuals/image-gateway.server.ts`.

The applied Cloud migration creates private history, report, quota and access-block tables, owner-scoped policies, a private `educational-visuals` bucket and an atomic quota function. Default limits: 20 requests per UTC day, 20 seconds between requests; failed attempts count. Files are limited to 12MB. History displays the latest 30 requests. Structured visuals are regenerated from saved plans; bitmap images are stored privately and served with one-hour signed URLs.

## Safety and limitations
No AI-generated HTML, JavaScript or SVG is executed. Numerical expressions exclude assignments and arbitrary functions. A drag-arrow dot-product check rejects arrows pointing with relative motion. These are checks, not general scientific verification: other concepts remain AI-interpreted and must be checked against trusted sources. Output labels and explanations include simplification/uncertainty notices. A report is saved privately for future owner review; no report moderation screen is added.

Image stream bytes are forwarded unchanged with server-side observation of terminal failures to persist access blocks; partial previews are blurred. Incomplete or provider-error streams fail visibly. No timer aborts or automatic transient retries are added. A single zero-event replay preserves the same request. Owner actions must clear any row in `visual_ai_blocks` only after upstream access is restored. This feature does not run scheduled/background AI jobs.

## Deployment
Cloud schema and private storage are already configured. Publish the app using Lovable's Publish action when ready; no separate server deployment is needed. Do not expose server environment variables through VITE-prefixed variables. To change quotas, update the quota function through a migration and keep documentation/tests aligned. To change image models, verify supported model and parameter contracts first.

## Test coverage
`bunx vitest run src/test/visuals.test.ts src/test/visual-stream.test.ts src/test/app-routing.test.tsx src/test/dev-access.test.ts` passes 22 tests covering topic validation, open-ended subjects, dimensions, drag direction, mathematical values, expression safety, escaping, route preservation, fragmented streams, partial-only failures, provider denials and usage errors.

Signed-in browser checks generated drag, greenhouse and parabola diagrams, binary-search flowcharts, and a labeled plant-cell bitmap. Plant-cell refinement used the original image and completed successfully. PNG downloads, private image history readback, accuracy-report submission and the expanded viewer worked. Desktop and 390px phone checks showed no horizontal overflow after correction; existing notes, assistant and dashboard pages still opened without runtime errors. API checks returned 401 without authentication, 400 for malformed JSON, and 429 for an immediate second request. A final live image stream completed after the safeguard changes; latest automatic validation reported build OK.

Not exhaustively tested: every academic subject, every label language, all customization combinations, general scientific correctness, provider/account failures against live accounts (tested with fixtures instead), and the daily quota through 20 billed requests. Generated test visuals and one clearly labeled test report remain in the testing user's private history. Publishing was not performed.