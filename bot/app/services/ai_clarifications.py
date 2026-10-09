"""Explicit amount choices preserve context without guessing or writing money."""
import re
from decimal import Decimal, InvalidOperation
from pydantic import ValidationError
from app.schemas.finance import AIParsedTransaction, PendingClarification, PositiveMoney
from pydantic import TypeAdapter

money = TypeAdapter(PositiveMoney)
GROUPED_RUBLES = re.compile(
    r"(?<![\d.,])([1-9]\d{0,2}(?:\.\d{3})+)\s*(?:руб(?:ль|ля|лей)?\.?|₽)(?!\w)", re.I)


def dotted_amount(source: str):
    """A single ruble amount may use a dot for grouping or decimal precision."""
    matches = list(GROUPED_RUBLES.finditer(source))
    if len(matches) != 1:
        return None
    match = matches[0]
    outside = source[:match.start()] + source[match.end():]
    if (re.search(r"\d|[+*/×№#]|\b(?:по|штук\w*|количеств\w*|дата|число|минус)\b",
                  outside, re.I) or re.search(r"[+-]\s*$", source[:match.start()])):
        return None
    options = []
    for value in (match[1].replace(".", ""), match[1]):
        try:
            amount = money.validate_python(Decimal(value))
        except (ValidationError, InvalidOperation):
            continue
        if amount not in options:
            options.append(amount)
    return (match, options) if options else None


def amount_pending(raw, question: str, options: list[Decimal], currency=None):
    """Keep only one valid operation template; amounts still require user choice."""
    if not isinstance(raw, dict) or not isinstance(raw.get("transactions"), list):
        return None
    if len(raw["transactions"]) != 1 or not isinstance(raw["transactions"][0], dict):
        return None
    try:
        # The model's wrong/invalid amount is never offered or silently repaired.
        context = AIParsedTransaction.model_validate({**raw["transactions"][0], "amount": options[0]})
        if context.type == "transfer":
            return None  # Two-account editing remains in the application.
        return PendingClarification(
            question=question, suggested_options=options, currency=currency,
            **context.model_dump(exclude={"amount"}))
    except (ValidationError, ValueError, IndexError):
        return None
