import httpx


def web_search(query: str) -> str:
    return f"[web search] query: {query} (requires search API key)"


def web_fetch(url: str, timeout: int = 15) -> str:
    try:
        resp = httpx.get(url, timeout=timeout, follow_redirects=True)
        resp.raise_for_status()
        text = resp.text
        return text[:10000] + ("..." if len(text) > 10000 else "")
    except httpx.HTTPError as e:
        return f"Error fetching URL: {e}"
