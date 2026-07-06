# Email signatures (local only)

Signature files are **not committed to git**. After cloning:

1. Run `bash scripts/install-mail-signatures.sh` to copy examples, or manually:
   - Copy `manifest.json.example` → `manifest.json`
   - Copy `you@company.com.txt.example` → `you@company.com.txt` (one file per sender address)
2. Edit `manifest.json` to map lowercase sender emails to signature files:

```json
{
  "you@company.com": {
    "default": "you@company.com.txt",
    "with-founder": "you@company.com-founder.txt"
  }
}
```

3. Edit each `.txt` file with your real signature text.
4. Restart Cursor (or reload MCP) after changes.

The `mail_draft_email` tool appends signatures when `sender` matches a manifest entry. Use `signature: "none"` to skip.
