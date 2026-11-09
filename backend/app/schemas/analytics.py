from pydantic import BaseModel


class CountItem(BaseModel):
    label: str
    count: int


class DailyPoint(BaseModel):
    date: str
    reported: int
    resolved: int


class AnalyticsTotals(BaseModel):
    reported: int
    verified: int
    resolved: int
    open: int
    duplicates: int
    rejected: int
    community_confirmations: int
    avg_resolution_hours: float | None


class AnalyticsOut(BaseModel):
    totals: AnalyticsTotals
    by_category: list[CountItem]
    by_status: list[CountItem]
    by_municipality: list[CountItem]
    daily: list[DailyPoint]
