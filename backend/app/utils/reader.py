import re
import hashlib

from bs4 import BeautifulSoup


def html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for node in soup(["script", "style", "iframe", "object"]):
        node.decompose()
    for node in soup.find_all("br"):
        node.replace_with("\n")
    for node in soup.find_all(["p", "div", "h1", "h2", "h3", "li"]):
        node.append("\n")
    return soup.get_text()


def paginate_text(text: str, limit: int = 1800) -> list[str]:
    pages, page = [], ""
    for paragraph in re.split(r"\n+", text.replace("\r\n", "\n").replace("\r", "\n").strip()):
        if not paragraph.strip():
            continue
        for word in paragraph.split():
            for start in range(0, len(word), limit):
                chunk = word[start:start + limit]
                separator = " " if page and not page.endswith("\n\n") else ""
                if len(page) + len(separator) + len(chunk) > limit:
                    pages.append(page.strip())
                    page = ""
                page += (" " if page and not page.endswith("\n\n") else "") + chunk
        if page:
            page += "\n\n"
    if page.strip():
        pages.append(page.strip())
    return pages


def utf16_slice(text: str, start: int, end: int) -> str:
    """Browser Selection offsets count UTF-16 units, including emoji pairs."""
    return text.encode("utf-16-le")[start * 2:end * 2].decode("utf-16-le", errors="replace")


def locate_quote(pages, quote, preferred_page=None, start=0, end=0):
    if preferred_page is not None and 0 <= preferred_page < len(pages):
        if utf16_slice(pages[preferred_page], start, end) == quote:
            return preferred_page, start, end
    matches = []
    for index, page in enumerate(pages):
        offset = page.find(quote)
        while offset >= 0:
            unit_start = len(page[:offset].encode("utf-16-le")) // 2
            matches.append((index, unit_start, unit_start + len(quote.encode("utf-16-le")) // 2))
            if len(matches) > 1:
                return None  # Ambiguous evidence must never highlight a different passage.
            offset = page.find(quote, offset + 1)
    return matches[0] if matches else None


def page_fingerprint(pages):
    return hashlib.sha256("\n".join(pages).encode("utf-8")).hexdigest()
