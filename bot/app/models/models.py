import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, BigInteger, Numeric, Boolean,
    ForeignKey, DateTime, Integer, Text, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def gen_uuid_str() -> str:
    return str(uuid.uuid4())

def utc_now():
    return datetime.now(timezone.utc)

class Account(Base):
    __tablename__ = "accounts"

    id = Column(String(36), primary_key=True, default=gen_uuid_str)
    user_id = Column(BigInteger, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    group_name = Column(String(50), nullable=False, default="Личное")
    bank_name = Column(String(50), nullable=True)
    balance = Column(Numeric(14, 2), nullable=False, default=0.00)
    currency = Column(String(10), nullable=False, default="RUB")
    icon = Column(String(20), default="💳")
    color = Column(String(30), default="#2B5BFF")
    is_default = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    transactions = relationship("Transaction", back_populates="account", foreign_keys="Transaction.account_id")

class Category(Base):
    __tablename__ = "categories"

    id = Column(String(36), primary_key=True, default=gen_uuid_str)
    user_id = Column(BigInteger, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(20), nullable=False, default="expense") # expense / income
    icon = Column(String(20), default="📦")
    color = Column(String(30), default="#F3F4F6")
    budget_limit = Column(Numeric(14, 2), nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    transactions = relationship("Transaction", back_populates="category")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True, default=gen_uuid_str)
    user_id = Column(BigInteger, nullable=False, index=True)
    client_id = Column(String(36), nullable=True, index=True)  # Idempotency key from frontend
    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    to_account_id = Column(String(36), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    category_id = Column(String(36), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    amount = Column(Numeric(14, 2), nullable=False)
    type = Column(String(20), nullable=False) # expense / income / transfer
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, index=True)

    account = relationship("Account", foreign_keys=[account_id], back_populates="transactions")
    to_account = relationship("Account", foreign_keys=[to_account_id])
    category = relationship("Category", back_populates="transactions")

    __table_args__ = (
        UniqueConstraint("user_id", "client_id", name="uq_transaction_user_client"),
    )

