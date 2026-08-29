"""Trades and cities, as the public sees them."""

from __future__ import annotations

from app.schemas.common import ApiModel


class TradeOut(ApiModel):
    id: int
    slug: str
    name_ar: str
    name_fr: str
    name_en: str
    icon: str
    sort_order: int


class CityOut(ApiModel):
    id: int
    slug: str
    name_ar: str
    name_fr: str
    name_en: str
    latitude: float
    longitude: float
