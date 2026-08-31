"""Shared HTML shell for outgoing email — keeps every email on-brand (navy +
gold, matching the site's actual palette, not the old dark-green mock-ups in
design/emails/) without each caller re-typing the boilerplate."""

NAVY = "#1a2744"
GOLD = "#c9a84c"
CREAM = "#faf8f3"
MUTED = "#7a7060"
BORDER = "#ddd6c4"


def render_email(*, eyebrow: str, heading: str, body_html: str, cta_label: str | None = None, cta_url: str | None = None) -> str:
    cta_block = ""
    if cta_label and cta_url:
        cta_block = f"""
        <tr><td style="padding:26px 26px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="background:{GOLD};border-radius:8px;">
              <a href="{cta_url}" style="display:inline-block;padding:14px 26px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:{NAVY};text-decoration:none;">{cta_label}</a>
            </td>
          </tr></table>
        </td></tr>
        """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>{heading} — MUT Tech Community</title>
</head>
<body style="margin:0;padding:0;background:{CREAM};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{CREAM};">
<tr><td align="center" style="padding:32px 16px;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;background:#ffffff;border:1px solid {BORDER};border-radius:12px;">

  <tr><td style="padding:20px 26px;background:{NAVY};border-radius:12px 12px 0 0;">
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;letter-spacing:-.2px;">MUT Tech Community</div>
  </td></tr>

  <tr><td style="padding:30px 26px 0;">
    <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:{GOLD};">{eyebrow}</div>
    <h1 style="margin:14px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:26px;line-height:1.15;letter-spacing:-0.5px;color:{NAVY};">{heading}</h1>
    <div style="margin-top:14px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;">{body_html}</div>
  </td></tr>
{cta_block}
  <tr><td style="padding:28px 26px 30px;">
    <div style="border-top:1px solid {BORDER};padding-top:18px;font-family:'Courier New',monospace;font-size:11px;line-height:1.8;color:{MUTED};">
      MUT Tech Community &middot; Murang'a University of Technology
    </div>
  </td></tr>

</table>

</td></tr>
</table>
</body>
</html>"""
