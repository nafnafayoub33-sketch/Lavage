"""Trades, cities, and the platform settings table."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.policy import DEFAULTS
from app.models.catalog import City, Trade
from app.models.system import PlatformSetting


class CatalogRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_trades(self, *, only_active: bool = True) -> list[Trade]:
        stmt = select(Trade).order_by(Trade.sort_order, Trade.slug)
        if only_active:
            stmt = stmt.where(Trade.is_active.is_(True))
        return list(self.db.execute(stmt).scalars())

    def get_trade_by_slug(self, slug: str) -> Trade | None:
        return self.db.execute(select(Trade).where(Trade.slug == slug)).scalar_one_or_none()

    def list_cities(self, *, only_active: bool = True) -> list[City]:
        stmt = select(City).order_by(City.name_fr)
        if only_active:
            stmt = stmt.where(City.is_active.is_(True))
        return list(self.db.execute(stmt).scalars())


class SettingsRepository:
    """Reads `platform_settings`, falling back to `app.core.policy.DEFAULTS`.

    The fallback is what makes a fresh database — or a key an admin has not
    touched — behave instead of crash.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, key: str) -> Any:
        row = self.db.get(PlatformSetting, key)
        if row is None:
            return DEFAULTS.get(key)
        return row.value

    def get_int(self, key: str) -> int:
        value = self.get(key)
        if isinstance(value, bool) or not isinstance(value, int):
            fallback = DEFAULTS.get(key)
            return int(fallback) if isinstance(fallback, int) else 0
        return value

    def set(self, key: str, value: Any, *, actor_id: int | None = None) -> PlatformSetting:
        row = self.db.get(PlatformSetting, key)
        if row is None:
            row = PlatformSetting(key=key, value=value, updated_by_id=actor_id)
            self.db.add(row)
        else:
            row.value = value
            row.updated_by_id = actor_id
        self.db.flush()
        return row
