"""Trades and cities. Public — P1's grid needs them before anyone signs in."""

from __future__ import annotations

from fastapi import APIRouter

from app.deps import DbSession
from app.repositories.catalog import CatalogRepository
from app.schemas.catalog import CityOut, TradeOut

router = APIRouter(tags=["catalog"])


@router.get("/trades", response_model=list[TradeOut])
def list_trades(db: DbSession) -> list[TradeOut]:
    trades = CatalogRepository(db).list_trades()
    return [TradeOut.model_validate(t) for t in trades]


@router.get("/cities", response_model=list[CityOut])
def list_cities(db: DbSession) -> list[CityOut]:
    cities = CatalogRepository(db).list_cities()
    return [CityOut.model_validate(c) for c in cities]
