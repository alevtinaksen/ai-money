from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, ConfigDict

# --- Account Schemas ---
class AccountBase(BaseModel):
    name: str
    group_name: str = "Личное"
    bank_name: Optional[str] = None
    balance: float = 0.0
    currency: str = "RUB"
    icon: str = "💳"
    color: str = "#2B5BFF"
    is_default: bool = False
    sort_order: int = 0

class AccountCreate(AccountBase):
    pass

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    group_name: Optional[str] = None
    bank_name: Optional[str] = None
    balance: Optional[float] = None
    currency: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_default: Optional[bool] = None

class AccountResponse(AccountBase):
    id: str
    user_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# --- Category Schemas ---
class CategoryBase(BaseModel):
    name: str
    type: Literal["expense", "income"] = "expense"
    icon: str = "📦"
    color: str = "#F3F4F6"
    budget_limit: Optional[float] = None
    sort_order: int = 0

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: str
    user_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# --- Transaction Schemas ---
class TransactionCreate(BaseModel):
    account_id: str
    to_account_id: Optional[str] = None
    category_id: Optional[str] = None
    amount: float
    type: Literal["expense", "income", "transfer"] = "expense"
    note: Optional[str] = None
    created_at: Optional[datetime] = None

class TransactionUpdate(BaseModel):
    account_id: Optional[str] = None
    to_account_id: Optional[str] = None
    category_id: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[Literal["expense", "income", "transfer"]] = None
    note: Optional[str] = None
    created_at: Optional[datetime] = None

class TransactionResponse(BaseModel):
    id: str
    user_id: int
    account_id: str
    to_account_id: Optional[str] = None
    category_id: Optional[str] = None
    amount: float
    type: str
    note: Optional[str] = None
    created_at: datetime
    
    # Nested preview fields
    account_name: Optional[str] = None
    category_name: Optional[str] = None
    category_icon: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# --- AI Parsing Schemas ---
class AIParsedTransaction(BaseModel):
    amount: float = Field(description="Сумма операции")
    type: Literal["expense", "income", "transfer"] = Field(default="expense", description="Тип операции: расход, доход или перевод")
    category_name: Optional[str] = Field(default=None, description="Название категории, например: Еда, Транспорт, Покупки, Здоровье")
    account_name: Optional[str] = Field(default=None, description="Название счета списания, например: Карта Альфа, Т-Банк, Наличные")
    to_account_name: Optional[str] = Field(default=None, description="Название счета зачисления (для перевода)")
    note: Optional[str] = Field(default=None, description="Краткое описание или комментарий, например: Кофе, Такси, Продукты")

class PendingClarification(BaseModel):
    question: str
    suggested_amount: Optional[float] = None
    suggested_options: List[float] = Field(default_factory=list)
    type: str = "expense"
    category_name: Optional[str] = None
    account_name: Optional[str] = None
    note: Optional[str] = None

class AIParsedResult(BaseModel):
    transactions: List[AIParsedTransaction] = Field(default_factory=list, description="Список распознанных транзакций")
    clarification: Optional[str] = Field(default=None, description="Если что-то не понятно или не хватает данных")
    pending: Optional[PendingClarification] = Field(default=None, description="Запрос на уточнение суммы или деталей")

# --- Dashboard & Analytics Schemas ---
class CategoryStat(BaseModel):
    id: str
    name: str
    icon: str
    color: str
    total_amount: float
    percentage: float

class DashboardSummary(BaseModel):
    total_balance: float
    period_label: str
    period_income: float
    period_expense: float
    categories: List[CategoryStat]
    recent_transactions: List[TransactionResponse]
