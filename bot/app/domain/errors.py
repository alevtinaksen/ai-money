class ConflictError(ValueError):
    """A concurrent edit or idempotency conflict; HTTP 409."""


Conflict = ConflictError
