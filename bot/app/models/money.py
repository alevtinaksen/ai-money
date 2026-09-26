"""Portable exact-cent storage, including SQLite (which has no fixed decimals)."""

from decimal import Decimal
from sqlalchemy import BigInteger
from sqlalchemy.types import TypeDecorator


class Money(TypeDecorator):
    impl = BigInteger
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        value = Decimal(str(value))
        if not value.is_finite() or value != value.quantize(Decimal("0.01")):
            raise ValueError("Money must contain finite whole cents")
        return int(value * 100)

    def process_result_value(self, value, dialect):
        return None if value is None else Decimal(value) / 100
