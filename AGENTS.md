git checkout -b dev origin/main   # or: git checkout dev && git pull
# replace AGENTS.md with the file above, then:
git add AGENTS.md
git commit -m "AGENTS.md: default to npm run dev, not base44 dev, during Base44→Cloudflare transition"
git push -u origin dev