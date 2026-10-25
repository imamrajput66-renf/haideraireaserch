<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Developer console (/admin) requires BOTH the `developer` role in user_roles (granted by DB trigger to the owner email once confirmed) AND the DEVELOPER_CODE secret, checked server-side in src/lib/admin.functions.ts — why: role alone or code alone must never be enough.
- AI calls go through src/lib/ai/gateway.server.ts (Lovable AI Responses, streamed); chat streams via /api/chat — why: keys stay server-side.
- Document text is extracted in the browser (pdfjs) and stored as keyword-ranked chunks in document_chunks — why: no server PDF parsing on the edge runtime.
- Sign-ins are logged client-side into login_events on SIGNED_IN; only service role reads them — why: developer console activity view.
- Floating ChatWidget is lazy-loaded from __root after idle and reuses /api/chat — why: keeps first page load fast.
- Educational visuals use an authenticated /visuals workspace, strict AI plans, safe SVG/Dagre rendering and allowlisted mathjs expressions; image generation/editing streams through separate authenticated server routes — why: precise text and geometry must not depend on bitmap generation or executable AI code.
- Visual request quotas and AI access blocks are durable database state; files are private owner-scoped storage objects — why: concurrent requests and Worker restarts must not bypass limits or expose student history.
