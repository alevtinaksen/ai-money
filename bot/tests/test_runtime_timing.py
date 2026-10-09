"""Latency diagnostics exclude inputs, outputs and exception representations."""
import logging

import pytest

from app.services.runtime_timing import timed_operation, timed_stage


@pytest.mark.asyncio
async def test_timing_keeps_result_and_failure_private(caplog):
    caplog.set_level(logging.INFO, logger="uvicorn.error")
    private = "synthetic-private-transcript-token"

    @timed_operation("bot_preview")
    async def sample(argument, *, fail=False):
        if fail:
            raise RuntimeError(argument)
        return argument

    assert await sample(private) == private
    with pytest.raises(RuntimeError):
        await sample(private, fail=True)
    assert "stage=bot_preview" in caplog.text
    assert "completed=True" in caplog.text and "completed=False" in caplog.text
    assert private not in caplog.text
    assert all(record.exc_info is None for record in caplog.records)
    with pytest.raises(ValueError, match="Unknown"):
        with timed_stage(private):
            pytest.fail("Unknown stage entered")
