"""Shared Metro Istanbul API client with retry-aware session."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

METRO_API_BASE = "https://api.ibb.gov.tr/MetroIstanbul/api/MetroMobile/V2"


class MetroAPIClient:
    """Thin wrapper around requests.Session for Metro Istanbul endpoints."""

    def __init__(self, base_url: str = METRO_API_BASE, timeout: int = 10, retries: Optional[Retry] = None) -> None:
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'IBB-Transport-Platform/1.0',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        })

        retry_config = retries or Retry(
            total=0,
            status=0,
            backoff_factor=0.5,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=("GET", "POST", "OPTIONS")
        )
        adapter = HTTPAdapter(max_retries=retry_config)
        self.session.mount('https://', adapter)
        self.session.mount('http://', adapter)

    def _build_url(self, path: str) -> str:
        if path.startswith('http'):
            return path
        return f"{self.base_url}{path if path.startswith('/') else '/' + path}"

    def get(self, path: str, **kwargs: Any) -> requests.Response:
        timeout = kwargs.pop('timeout', self.timeout)
        url = self._build_url(path)
        return self.session.get(url, timeout=timeout, **kwargs)

    def post(self, path: str, **kwargs: Any) -> requests.Response:
        timeout = kwargs.pop('timeout', self.timeout)
        url = self._build_url(path)
        return self.session.post(url, timeout=timeout, **kwargs)


metro_api_client = MetroAPIClient()
