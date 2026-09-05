import ipaddress
import re
import socket
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

_URL_RE = re.compile(r"https?://[^\s<>\"]+", re.IGNORECASE)
_MAX_REDIRECTS = 3
_TIMEOUT = 5.0
_MAX_BYTES = 512_000  # only need the <head>; refuse to buffer a huge body


@dataclass
class LinkPreview:
    url: str
    title: str | None
    description: str | None
    image_url: str | None
    site_name: str | None


def extract_first_url(*texts: str | None) -> str | None:
    for text in texts:
        if not text:
            continue
        match = _URL_RE.search(text)
        if match:
            return match.group(0).rstrip(").,!?")
    return None


def _is_safe_host(hostname: str) -> bool:
    """Blocks SSRF: refuses to fetch a URL whose host resolves to a
    loopback/private/link-local/reserved address, so a post body can't be
    used to make this server hit its own internal network."""
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            return False
    return True


def _validated_url(url: str) -> str | None:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return None
    if not _is_safe_host(parsed.hostname):
        return None
    return url


def fetch_preview(url: str) -> LinkPreview | None:
    """Best-effort OpenGraph fetch. Returns None on any failure — a missing
    preview must never block creating the post it's attached to. Follows
    redirects manually (rather than httpx's own follow_redirects) so every
    hop gets the same SSRF host check as the original URL.

    Deliberately catches anything (network errors, decode errors, malformed
    HTML) — this is a best-effort enhancement attached to post creation, and
    it must never be the reason a post fails to save."""
    current = _validated_url(url)
    if not current:
        return None

    try:
        with httpx.Client(timeout=_TIMEOUT, follow_redirects=False) as client:
            for _ in range(_MAX_REDIRECTS + 1):
                with client.stream(
                    "GET", current, headers={"User-Agent": "Mozilla/5.0 (compatible; MUTTechBot/1.0)"}
                ) as res:
                    if res.is_redirect:
                        location = res.headers.get("location")
                        if not location:
                            return None
                        current = _validated_url(urljoin(current, location))
                        if not current:
                            return None
                        continue

                    if res.status_code != 200:
                        return None
                    content_type = res.headers.get("content-type", "")
                    if "text/html" not in content_type:
                        return None

                    body = b""
                    for chunk in res.iter_bytes():
                        body += chunk
                        if len(body) >= _MAX_BYTES:
                            break
                    html = body.decode(res.encoding or "utf-8", errors="ignore")
                    return _parse_og(current, html)
        return None
    except Exception:  # noqa: BLE001 — see docstring
        return None


def _meta(soup: BeautifulSoup, *names: str) -> str | None:
    for name in names:
        tag = soup.find("meta", property=name) or soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
            return tag["content"].strip()
    return None


def _parse_og(url: str, html: str) -> LinkPreview:
    soup = BeautifulSoup(html, "html.parser")
    title = _meta(soup, "og:title", "twitter:title")
    if not title and soup.title and soup.title.string:
        title = soup.title.string.strip()
    description = _meta(soup, "og:description", "twitter:description", "description")
    image = _meta(soup, "og:image", "twitter:image")
    if image:
        image = urljoin(url, image)
    site_name = _meta(soup, "og:site_name")
    return LinkPreview(
        url=url,
        title=title[:200] if title else None,
        description=description[:400] if description else None,
        image_url=image,
        site_name=site_name[:100] if site_name else None,
    )
