"""Persisted review batches and durable deduplication identities."""

from sqlalchemy import Column, String, BigInteger, Integer, JSON, ForeignKey, UniqueConstraint
from app.core.database import Base
from app.models.models import gen_uuid_str


class ImportBatch(Base):
    __tablename__ = "import_batches"
    id = Column(String(36), primary_key=True, default=gen_uuid_str)
    user_id = Column(BigInteger, nullable=False, index=True)
    account_id = Column(String(36), ForeignKey("accounts.id"), nullable=False)
    revision = Column(Integer, nullable=False, default=1)
    status = Column(String(20), nullable=False, default="draft")
    rows = Column(JSON, nullable=False)
    selected_ids = Column(JSON, nullable=False, default=list)
    transaction_ids = Column(JSON, nullable=False, default=list)


class ImportIdentity(Base):
    __tablename__ = "import_identities"
    id = Column(String(36), primary_key=True, default=gen_uuid_str)
    user_id = Column(BigInteger, nullable=False, index=True)
    account_id = Column(String(36), ForeignKey("accounts.id"), nullable=False)
    source_key = Column(String(100), nullable=False)
    transaction_id = Column(String(36), ForeignKey("transactions.id"), nullable=False)
    __table_args__ = (
        UniqueConstraint("user_id", "account_id", "source_key", name="uq_import_identity"),
    )
