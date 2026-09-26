"""Canonical CSV imports: explicit review and confirmation, never automatic posting."""

from typing import Literal
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user_id
from app.core.database import get_db
from app.services import bank_import as service
from app.services.bank_import_csv import MAX_BYTES

router = APIRouter()


class RowReview(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=1)
    include: bool | None = None
    type: Literal["expense", "income"] | None = None
    category_id: str | None = None
    note: str | None = Field(None, max_length=2000)
    force_duplicate: bool | None = None


class Confirmation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=1)
    row_ids: list[str] = Field(min_length=1, max_length=1000)


@router.post("/preview")
async def preview(
    file: UploadFile = File(...),
    account_id: str = Form(...),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read(MAX_BYTES + 1)
    return await service.preview(db, user_id, account_id, content)


@router.get("/{batch_id}")
async def get_batch(
    batch_id: str, user_id: int = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)
):
    batch = await service.get_batch(db, user_id, batch_id)
    if batch is None:
        raise HTTPException(404, "Пакет не найден")
    return service.result(batch)


@router.patch("/{batch_id}/rows/{row_id}")
async def review(
    batch_id: str,
    row_id: str,
    payload: RowReview,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    changes = payload.model_dump(exclude_unset=True, exclude={"revision"})
    if any(changes.get(key, True) is None for key in ("include", "type", "force_duplicate")):
        raise HTTPException(422, "Обязательные поля строки не могут быть null")
    result = await service.review(db, user_id, batch_id, row_id, payload.revision, changes)
    if result is None:
        raise HTTPException(404, "Пакет или строка не найдены")
    return result


@router.post("/{batch_id}/confirm")
async def confirm(
    batch_id: str,
    payload: Confirmation,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await service.confirm(db, user_id, batch_id, payload.revision, payload.row_ids)
    if result is None:
        raise HTTPException(404, "Пакет не найден")
    return result
