from aiogram import Router, F
from aiogram.types import CallbackQuery
from app.core.database import AsyncSessionLocal
from app.services.finance_svc import FinanceService

router = Router()

@router.callback_query(F.data.startswith("tx_del:"))
async def handle_delete_transaction(callback: CallbackQuery):
    tx_id = callback.data.split(":", 1)[1]
    user_id = callback.from_user.id

    async with AsyncSessionLocal() as db:
        success = await FinanceService.delete_transaction(db, user_id, tx_id)
        if success:
            await callback.answer("Запись успешно удалена, баланс возвращён!", show_alert=False)
            await callback.message.edit_text(
                f"❌ **Запись отменена и удалена**\nСумма возвращена на счёт.",
                parse_mode="Markdown"
            )
        else:
            await callback.answer("Запись уже была удалена или не найдена.", show_alert=True)
