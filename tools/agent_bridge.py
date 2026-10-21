"""Small JSON bridge to the original deterministic posting and PDF checks.

Invoked with fixed argv by the local Next.js server. Inputs/outputs are data;
no shell or external network is involved. Do not log the request payload.
"""
import json
import re
import sys
from pathlib import Path

from posting_guard import guard
from verify_pdf import verify_pdf


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    payload = json.loads(sys.stdin.buffer.read(1_000_001).decode("utf-8"))
    if sys.argv[1] == "guard":
        text, findings = guard(payload["text"], "auto")
        counts = {key: len(value) for key, value in findings.items()
                  if isinstance(value, (list, dict))}
        print(json.dumps({"text": text, "verdict": findings["verdict"],
                          "counts": counts}, ensure_ascii=False))
    elif sys.argv[1] == "pdf":
        extractor, text, pages = verify_pdf(Path(payload["path"]),
                                            expected_pages=payload["pages"],
                                            min_chars=1, required_text=[],
                                            ascii_dates=True)
        fold = lambda value: re.sub(r"\s+", "", value)
        if fold(text) != fold(payload["source"]):
            raise ValueError("PDF text content or reading order differs from source")
        print(json.dumps({"extractor": extractor, "pages": pages,
                          "readingOrder": "verified", "text": "verified"}))
    else:
        raise ValueError("Unsupported bridge operation")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Avoid reflecting private document/source text in server responses.
        print("Document/security verification failed; check dependencies and content.",
              file=sys.stderr)
        sys.exit(1)
